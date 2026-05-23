import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Logged in anonymously. UID:", cred.user.uid);
    try {
      // settings/global should be readable by anyone
      const snap = await getDoc(doc(db, 'settings', 'global'));
      console.log("Read settings/global success! exists:", snap.exists());
    } catch (err) {
      console.error("Read settings/global failed:", err.message);
    }

    try {
      // Let's try reading employees/EMP001
      const snap = await getDoc(doc(db, 'employees', 'EMP001'));
      console.log("Read employees/EMP001 success! exists:", snap.exists());
    } catch (err) {
      console.error("Read employees/EMP001 failed:", err.message);
    }

    try {
      // Let's try reading credentials/admin or another username
      const snap = await getDoc(doc(db, 'credentials', 'admin'));
      console.log("Read credentials/admin success! exists:", snap.exists());
    } catch (err) {
      console.error("Read credentials/admin failed:", err.message);
    }
  } catch (err) {
    console.error("Fatal run error:", err);
  }
  process.exit(0);
}
run();
