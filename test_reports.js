import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
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

    const reportPath = doc(db, 'systemReports', 'report_' + Date.now());
    await setDoc(reportPath, {
      subject: 'Test', message: 'Test message', timestamp: new Date().toISOString()
    });
    console.log("Write success!");
  } catch (err) {
    console.error("Failed:", err.message);
  }
  process.exit(0);
}
run();
