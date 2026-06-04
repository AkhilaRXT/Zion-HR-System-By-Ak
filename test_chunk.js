import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  const id = 'test_chunk_' + Date.now();
  const chunkData = 'x'.repeat(800000);
  try {
    await setDoc(doc(db, 'fileChunks', id), { data: chunkData });
    console.log("Success with 800k");
    process.exit(0);
  } catch(e) {
    console.error("Error with 800k:", e);
    process.exit(1);
  }
}
test();
