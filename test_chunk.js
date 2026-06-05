import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  const id = 'test_chunk_' + Date.now();
  const chunkData = 'x'.repeat(500000);
  try {
    await setDoc(doc(db, 'fileChunks', id), { data: chunkData });
    console.log("Success with 500k chars");
    const chunkData300 = 'x'.repeat(300000);
    await setDoc(doc(db, 'fileChunks', id+'_300'), { data: chunkData300 });
    console.log("Success with 300k chars");
    process.exit(0);
  } catch(e) {
    console.error("Error writing chunk:", e);
    process.exit(1);
  }
}
test();
