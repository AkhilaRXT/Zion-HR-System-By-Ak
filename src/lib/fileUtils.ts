export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 700KB limit to be safe for Firestore 1MB doc limit
    if (file.size > 700 * 1024) {
      reject(new Error('File size must be less than 700KB'));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
