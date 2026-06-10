import { db, storage } from './firebase';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';

const saveChunked = async (base64: string, type: string): Promise<string> => {
   const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
   const chunkSize = 800000; // 800KB chunks
   const chunks = Math.ceil(base64.length / chunkSize);
   
   const batch = writeBatch(db);

   for (let i = 0; i < chunks; i++) {
     const chunkData = base64.substring(i * chunkSize, (i + 1) * chunkSize);
     batch.set(doc(db, 'fileChunks', `${id}_${i}`), { data: chunkData });
   }
   
   batch.set(doc(db, 'fileChunks', id), { chunks, type });
   await batch.commit();
   
   return `chunked:${id}`;
};

const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // If it is an image, compress it
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = event.target?.result;
                    if (!result) {
                        reject(new Error('FileReader result is empty'));
                        return;
                    }
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_DIM = 1024;
                            if (width > MAX_DIM || height > MAX_DIM) {
                                if (width > height) {
                                    height = Math.round((height * MAX_DIM) / width);
                                    width = MAX_DIM;
                                } else {
                                    width = Math.round((width * MAX_DIM) / height);
                                    height = MAX_DIM;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                reject(new Error('Failed to get 2D canvas context'));
                                return;
                            }
                            ctx.drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', 0.6));
                        } catch (err) {
                            reject(err);
                        }
                    };
                    img.onerror = () => reject(new Error('Failed to load image for compression'));
                    img.src = result as string; // Set src AFTER assigning onload and onerror
                } catch (readerOnloadErr) {
                    reject(readerOnloadErr);
                }
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result) {
                    resolve(reader.result as string);
                } else {
                    reject(new Error('FileReader result is empty'));
                }
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        }
    });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    let base64 = '';
    try {
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('File size must be less than 5 MB'));
        return;
      }

      // Convert and compress (if image)
      base64 = await getBase64(file);

      if (!storage) {
        throw new Error("Storage service is not available, falling back to Firestore");
      }

      const cleanName = file.name ? file.name.replace(/[^a-zA-Z0-9.]/g, '') : 'file';
      const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + cleanName;
      const storageRef = ref(storage, 'attachments/' + id);

      // Wrap Storage upload in a 5-second timeout so it falls back to Firestore chunks safely if Storage hangs
      const uploadPromise = (async () => {
        await uploadString(storageRef, base64, 'data_url');
        return await getDownloadURL(storageRef);
      })();

      const timeoutPromise = new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error('Firebase Storage upload timed out')), 5000)
      );

      const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
      resolve(downloadURL);
    } catch (err: any) {
      console.warn("Storage upload failed, falling back to Firestore chunks:", err);
      // Fallback
      if (file.size > 3 * 1024 * 1024) {
          reject(new Error('Firebase Storage failed to upload and file is too large for Firestore fallback. Please ensure Storage is enabled.'));
          return;
      }
      try {
          const finalBase64 = base64 || await getBase64(file);
          if (finalBase64.length < 800000) {
             resolve(finalBase64);
          } else {
             const chunkedId = await saveChunked(finalBase64, file.type);
             resolve(chunkedId);
          }
      } catch(fallbackErr: any) {
          reject(new Error('Storage and chunking both failed: ' + fallbackErr.message));
      }
    }
  });
};

export const handleDownloadAttachment = async (attachment: string, defaultName: string) => {
  if (!attachment) return;

  try {
    // If it's a direct Storage HTTP URL, just open it in a new tab
    if (attachment.startsWith('http')) {
      window.open(attachment, '_blank');
      return;
    }

    let urlToDownload = attachment;
    let actualType = '';

    if (attachment.startsWith('chunked:')) {
      const id = attachment.split(':')[1];
      const metaDoc = await getDoc(doc(db, 'fileChunks', id));
      if (!metaDoc.exists()) throw new Error('File not found');
      
      const { chunks, type } = metaDoc.data();
      actualType = type;
      
      const chunkPromises = [];
      for (let i = 0; i < chunks; i++) {
        chunkPromises.push(getDoc(doc(db, 'fileChunks', `${id}_${i}`)));
      }
      const chunkDocs = await Promise.all(chunkPromises);
      
      let fullBase64 = '';
      for (const chunkDoc of chunkDocs) {
        if (chunkDoc.exists()) {
          fullBase64 += chunkDoc.data().data;
        }
      }
      urlToDownload = fullBase64;
    } else {
       // Regular base64
       if (attachment.startsWith('data:image/png')) actualType = 'image/png';
       else if (attachment.startsWith('data:image/jpeg')) actualType = 'image/jpeg';
       else actualType = 'application/pdf';
    }

    // Adjust extension based on type
    let finalName = defaultName;
    if (actualType === 'image/png') finalName += '.png';
    else if (actualType === 'image/jpeg' || actualType === 'image/jpg') finalName += '.jpg';
    else finalName += '.pdf';

    // Convert Data URI to Blob for reliable downloading/viewing of large files
    const parts = urlToDownload.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = finalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch (err: any) {
     console.error("Error downloading file:", err);
     alert("Failed to download file. It may be corrupted or deleted.");
  }
};
