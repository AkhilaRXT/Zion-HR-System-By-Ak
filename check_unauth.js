import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const emps = await getDocs(collection(db, 'employees'));
    console.log("Employees success! Count:", emps.docs.length);
  } catch(e) {
    console.error("Employees error msg:", e.message);
    console.error("error code:", e.code);
    console.error("error details:", e.details);
    console.error(e);
  }
  process.exit(0);
}
check();
