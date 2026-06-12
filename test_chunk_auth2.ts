import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";
import "dotenv/config";

const app = initializeApp({
  projectId: "zion-hr-database",
});
const db = getFirestore(app);

async function test() {
  const base64 = "a".repeat(4 * 1024 * 1024);
  const id = 'file_' + Date.now();
  const chunkSize = 800000;
  const chunks = Math.ceil(base64.length / chunkSize);
  const batch = writeBatch(db);

  for (let i = 0; i < chunks; i++) {
    const chunkData = base64.substring(i * chunkSize, (i + 1) * chunkSize);
    batch.set(doc(db, 'fileChunks', `${id}_${i}`), { data: chunkData });
  }
  batch.set(doc(db, 'fileChunks', id), { chunks, type: "text/plain" });

  try {
    await batch.commit();
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
