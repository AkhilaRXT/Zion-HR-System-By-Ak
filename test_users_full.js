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
    const uid = cred.user.uid;
    console.log("Logged in:", uid);
    
    // Testing write to users
    try {
      const p = doc(db, 'users', uid);
      await setDoc(p, {
        empId: 'EMP001',
        role: 'admin',
        username: 'test',
        passToken: 'token',
        email: 'test@test.com',
        viewableBranches: ['ALL']
      });
      console.log("users FULL SUCCEEDED");
    } catch(e) {
      console.log("users FULL FAILED", e.message);
    }
  } catch (err) { }
  process.exit(0);
}
run();
