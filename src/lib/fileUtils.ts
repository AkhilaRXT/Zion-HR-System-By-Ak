import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    // Support up to 3MB by chunking in Firestore
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error('File size must be less than 3 MB'));
      return;
    }

    // If it is an image, compress it
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if too large (restrict max dimension to 1024px)
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
          const base64 = canvas.toDataURL('image/jpeg', 0.6);
          
          if (base64.length > 900000) {
              // Even after compression it's large, we chunk it
              try {
                const chunkedId = await saveChunked(base64, 'image/jpeg');
                resolve(chunkedId);
              } catch(e) {
                reject(new Error('Failed to process large image'));
              }
          } else {
            resolve(base64);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
      };
      reader.onerror = error => reject(error);
      return;
    }

    // For PDFs and other files, chunk if necessary
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (base64.length < 900000) {
        resolve(base64); // Fits comfortably in one document
      } else {
        try {
          const chunkedId = await saveChunked(base64, file.type);
          resolve(chunkedId);
        } catch (err) {
          reject(new Error('Failed to save large file. It may be too big or there was a network error.'));
        }
      }
    };
    reader.onerror = error => reject(error);
  });
};

const saveChunked = async (base64: string, type: string): Promise<string> => {
   const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
   const chunkSize = 800000;
   const chunks = Math.ceil(base64.length / chunkSize);
   
   // Write chunks
   const promises = [];
   for (let i = 0; i < chunks; i++) {
     const chunkData = base64.substring(i * chunkSize, (i + 1) * chunkSize);
     promises.push(setDoc(doc(db, 'fileChunks', `${id}_${i}`), { data: chunkData }));
   }
   await Promise.all(promises);
   
   // Write metadata doc
   await setDoc(doc(db, 'fileChunks', id), { chunks, type });
   return `chunked:${id}`;
};

export const handleDownloadAttachment = async (attachment: string, defaultName: string) => {
  if (!attachment) return;

  try {
    let urlToDownload = attachment;
    let actualType = '';

    if (attachment.startsWith('chunked:')) {
      const id = attachment.split(':')[1];
      const metaDoc = await getDoc(doc(db, 'fileChunks', id));
      if (!metaDoc.exists()) throw new Error('File not found');
      
      const { chunks, type } = metaDoc.data();
      actualType = type;
      let fullBase64 = '';
      for (let i = 0; i < chunks; i++) {
        const chunkDoc = await getDoc(doc(db, 'fileChunks', `${id}_${i}`));
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

    const link = document.createElement('a');
    link.href = urlToDownload;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err: any) {
     console.error("Error downloading file:", err);
     alert("Failed to download file. It may be corrupted or deleted.");
  }
};
