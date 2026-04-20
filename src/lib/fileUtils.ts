export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 3MB limit (Base64 adds ~33% overhead, so 3MB file becomes ~4MB string)
    // CRITICAL: Firestore has a 1MB per document limit. 
    // Large files should be images (which we compress) or very small PDFs.
    if (file.size > 3000 * 1024) {
      reject(new Error('File size must be less than 3MB'));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
