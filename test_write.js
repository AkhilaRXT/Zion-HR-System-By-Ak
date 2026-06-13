import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "zion-hr-database");
const auth = getAuth(app);

async function probe() {
  try {
    const credAuth = await signInAnonymously(auth);
    const uid = credAuth.user.uid;
    console.log("Mocked UID:", uid);
    
    await setDoc(doc(db, "server_sessions", uid), { secretPasscode: "ZION_SERVER_SECRET_987654321" });
    console.log("Mocked server session SUCCESS");
  } catch(e) {
    console.log("Mocked server session FAILED: ", e.message);
  }
  process.exit(0);
}
probe();
