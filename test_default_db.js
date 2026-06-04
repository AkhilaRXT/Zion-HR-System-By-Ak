import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
// Use deep default database (by not passing the firestoreDatabaseId string)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Logged in anonymously. UID:", cred.user.uid);

    try {
      // settings/global should be readable by anyone on default database
      const snap = await getDoc(doc(db, 'settings', 'global'));
      console.log("Read settings/global from default DB success! exists:", snap.exists());
    } catch (err) {
      console.error("Read settings/global from default DB failed:", err.message);
    }

    try {
      // Test writing to users/{uid} on default database
      const testPath = doc(db, 'users', cred.user.uid);
      await setDoc(testPath, {
        empId: 'TEST_EMP_DEFAULT_DB',
        role: 'user',
        username: 'test_anon',
        viewableBranches: []
      });
      console.log("Write to users/{uid} on default DB SUCCESS!");
      
      const snap = await getDoc(testPath);
      console.log("Read from users/{uid} on default DB success! exists:", snap.exists(), snap.data());
    } catch (err) {
      console.error("Write to users/{uid} on default DB failed:", err.message);
    }

  } catch (err) {
    console.error("Fatal run error:", err);
  }
  process.exit(0);
}
run();
