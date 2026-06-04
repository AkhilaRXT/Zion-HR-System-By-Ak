import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId);

async function run() {
  try {
    await signInAnonymously(auth);
    const q = query(collection(db, 'attendance'), limit(1));
    const snap = await getDocs(q);
    console.log("Total docs:", snap.size);
    snap.forEach(d => console.log(d.id, d.data()));
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
