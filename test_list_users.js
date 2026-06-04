import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log(`Users count: ${snap.size}`);
    snap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (err) {
    console.error("Failed:", err.message);
  }
  process.exit(0);
}
run();
