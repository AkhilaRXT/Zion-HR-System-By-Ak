import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);

async function check() {
  try {
    await signInAnonymously(auth);
    console.log("Logged in anonymously. UID:", auth.currentUser.uid);
    
    // Check employees
    try {
      const emps = await getDocs(collection(db, 'employees'));
      console.log("Employees success! Count:", emps.docs.length);
    } catch(e) {
      console.error("Employees error:", e.message);
    }
    
    // Check customNets
    try {
      const nets = await getDocs(collection(db, 'customNets'));
      console.log("CustomNets success! Count:", nets.docs.length);
    } catch(e) {
      console.error("CustomNets error:", e.message);
    }
    
    // Check targets
    try {
      const tgts = await getDocs(collection(db, 'targets'));
      console.log("Targets success! Count:", tgts.docs.length);
    } catch(e) {
      console.error("Targets error:", e.message);
    }

  } catch (e) {
    console.error("Fatal error:", e);
  }
  process.exit(0);
}
check();
