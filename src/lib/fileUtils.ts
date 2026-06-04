import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    // For large files (e.g., 3MB limit now), we must use Firebase Storage instead of Firestore documents
    // because Firestore has a strict 1MB document size limit.
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error('File size must be less than 3 MB'));
      return;
    }

    // Try uploading to cloud storage if the file is greater than 500KB or if it is a PDF
    if (file.size > 500 * 1024 || file.type === 'application/pdf') {
      try {
        const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        resolve(downloadUrl);
        return;
      } catch (err: any) {
        // If Firebase Storage is not enabled or fails (e.g., rules not set), fallback to Base64 logic below
        console.warn('Firebase Storage upload failed, falling back to base64 encoding', err);
        
        // If it's >1MB and we fallback to base64, we must reject because Firestore will crash
        if (file.size > 1024 * 1024 - 100000) { // Safety margin
           reject(new Error('Firebase Storage could not process this file, and it is too large to save directly to the database. Please contact the administrator to enable Firebase Storage, or choose a file under 1MB.'));
           return;
        }
      }
    }

    // If it is an image, compress it to fit Firestore's limits if storage failed or isn't used
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
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
          
          // Compress the image to JPEG with 0.6 quality (looks great and yields 50-150KB)
          const base64 = canvas.toDataURL('image/jpeg', 0.6);
          
          // Verify size of base64 data url (800,000 chars is ~600KB, well under 1MB)
          if (base64.length > 800000) {
            reject(new Error('Compressed image is still too large. Please select a smaller file.'));
          } else {
            resolve(base64);
          }
        };
        img.onerror = () => {
          reject(new Error('Failed to load image for compression'));
        };
      };
      reader.onerror = error => reject(error);
      return;
    }

    // Read small non-image files directly into base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
