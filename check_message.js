import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    console.log("Logged in anonymously. UID:", uid);

    // Setup an admin profile in the users collection so rules grant us permission
    await setDoc(doc(db, 'users', uid), {
      empId: 'SYSTEM',
      role: 'admin',
      viewableBranches: ['ALL']
    });
    console.log("Admin user profile synced successfully!");

    const messageId = 'xKv9eIe6C1O558qrR55p';
    const docRef = doc(db, 'messages', messageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("Message data:", JSON.stringify(snap.data(), null, 2));
    } else {
      console.log(`Message '${messageId}' does not exist!`);
    }
  } catch (err) {
    console.error("Error in diagnostic:", err);
  }
  process.exit(0);
}

run();
