import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

async function test() {
  try {
    const q = query(collection(db, 'cashRequests'));
    const snap = await getDocs(q);
    const sorted = snap.docs.map(d => ({id: d.id, ...d.data()}))
        .sort((a,b) => b.id - a.id)
        .slice(0, 5); // get the latest 5
        
    for (const doc of sorted) {
      console.log(`-- ID: ${doc.id}, Date: ${doc.date}, Desc: ${doc.description}`);
      console.log(`Attachment: ${doc.attachment ? 'YES' : 'NO'}`);
      console.log(`Attachments: ${doc.attachments ? doc.attachments.length : 0}`);
    }
    process.exit(0);
  } catch(e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
test();
