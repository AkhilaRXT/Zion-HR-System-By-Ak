import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const q = collection(db, 'paidDeductions');
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      console.log("deleting", d.id);
      await deleteDoc(d.ref);
    }
    console.log("done wiping paidDeductions");
  } catch (e) {
    console.log(e);
  }
}
run();
