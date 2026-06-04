import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
    const uid = cred.user.uid;
    console.log("Logged in:", uid);

    try {
      // 1. Create user document
      const userPath = doc(db, 'users', uid);
      await setDoc(userPath, {
        empId: 'TEST_EMP',
        role: 'user',
        username: 'test_user',
        viewableBranches: []
      });
      console.log("1. Created user doc");

      // 2. Create message where we are sender AND participant (should succeed)
      const msgId = 'test_msg_' + Date.now();
      const msgPath = doc(db, 'messages', msgId);
      await setDoc(msgPath, {
        senderId: 'TEST_EMP',
        participants: ['TEST_EMP'],
        readBy: []
      });
      console.log("2. Created message doc");

      // 3. Update message readBy
      await updateDoc(msgPath, {
        readBy: arrayUnion('TEST_EMP')
      });
      console.log("3. Updated message readBy SUCCESS!");

    } catch(e) {
      console.log("Operation FAILED", e.message);
    }
  } catch (err) {
    console.error("Failed:", err.message);
  }
  process.exit(0);
}
run();
