export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If it is an image, compress it to fit Firestore's 1MB document size limit
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

    // If it is a PDF or other file type, enforce a strict size limit of 1MB
    // 1MB file converts to ~1.33MB base64, which is the maximum safe size for standard storage.
    if (file.size > 1024 * 1024) {
      reject(new Error('PDF/Document size must be less than 1 MB to fit system storage limits'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
