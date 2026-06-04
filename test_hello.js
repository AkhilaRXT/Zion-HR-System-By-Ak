import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId); // hitting zion-hr-database
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    try {
      const p = doc(db, 'hello', 'world');
      await setDoc(p, { test: 1 });
      console.log("hello SUCCEEDED");
    } catch(e) {
      console.log("hello FAILED", e.message);
    }
  } catch (err) { }
  process.exit(0);
}
run();
