import { db, storage } from './firebase';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';

const saveChunked = async (base64: string, type: string): Promise<string> => {
   const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
   const chunkSize = 200000; // 200KB chunks to avoid rules evaluation limit
   const chunks = Math.ceil(base64.length / chunkSize);
   
   const batch = writeBatch(db);

   for (let i = 0; i < chunks; i++) {
     const chunkData = base64.substring(i * chunkSize, (i + 1) * chunkSize);
     batch.set(doc(db, 'fileChunks', `${id}_${i}`), { data: chunkData });
   }
   
   batch.set(doc(db, 'fileChunks', id), { chunks, type });
   try {
     await batch.commit();
   } catch (error) {
     const { handleFirestoreError, OperationType } = await import('./dataStore');
     handleFirestoreError(error, OperationType.WRITE, `fileChunks/${id}`);
   }
   
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
                            const MAX_DIM = 600;
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
                            resolve(canvas.toDataURL('image/jpeg', 0.4));
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

const uploadToGoogleDrive = async (file: File, accessToken: string): Promise<string> => {
  const metadata = {
    name: file.name,
    mimeType: file.type,
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error('Google Drive upload failed: ' + errText);
  }

  const result = await uploadResponse.json();
  const fileId = result.id;

  // Set reader permission for anyone with the link so company managers can view/download
  try {
    const permissionResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
    if (!permissionResponse.ok) {
      console.warn('Failed to set public view permission on Google Drive file:', await permissionResponse.text());
    }
  } catch (permissionErr) {
    console.warn('Error setting Google Drive file permissions:', permissionErr);
  }

  return result.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    let base64 = '';
    try {
      // Ensure we have active and synchronized database credentials before proceeding with files
      const { DataStore, retrieveGoogleAccessToken } = await import('./dataStore');
      await DataStore.ensureAuth();

      if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/) && file.type !== 'application/pdf') {
        reject(new Error('Invalid file type. Only images and PDF files are allowed.'));
        return;
      }

      const gDriveToken = await retrieveGoogleAccessToken();
      if (gDriveToken) {
        try {
          console.log('[Google Drive] Uploading attachment directly to Google Drive...');
          const gDriveUrl = await uploadToGoogleDrive(file, gDriveToken);
          console.log('[Google Drive] File uploaded successfully:', gDriveUrl);
          resolve(gDriveUrl);
          return;
        } catch (driveErr: any) {
          console.warn('[Google Drive] Upload failed, falling back to standard pathways:', driveErr);
        }
      }

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
      console.warn("Storage upload failed, falling back to inline or chunked Firestore storage:", err);
      try {
          const finalBase64 = base64 || await getBase64(file);
          if (finalBase64.length < 950000) {
              resolve(finalBase64);
          } else {
              console.log('[Fallback] File exceeds 950KB base64 length limit, uploading as chunked Firestore documents...');
              const chunkedId = await saveChunked(finalBase64, file.type);
              resolve(chunkedId);
          }
      } catch(fallbackErr: any) {
          reject(new Error('File processing failed: ' + fallbackErr.message));
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
