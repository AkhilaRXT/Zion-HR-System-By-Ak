import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId);

async function run() {
  const p = doc(db, 'hello', 'world2');
  const task = setDoc(p, { test: 1 });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 5000));
  
  try {
     await Promise.race([task, timeout]);
     console.log("SUCCESS");
  } catch(e) {
     console.log("FAILED", e.message);
  }
  process.exit(0);
}
run();
