import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
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
    console.log("Logged in anonymously. UID:", uid);

    try {
      // 1. Control write (systemReports)
      const reportPath = doc(db, 'systemReports', 'test_write_report_' + Date.now());
      await setDoc(reportPath, {
        empId: 'EMP001',
        empName: 'Test Employee',
        subject: 'Diagnostic Report',
        message: 'This is a diagnostic write test.',
        timestamp: new Date().toISOString(),
        status: 'Pending'
      });
      console.log("1. Write to systemReports SUCCESS!");
    } catch (err) {
      console.error("1. Write to systemReports failed:", err.message);
    }

    try {
      // 2. Target write (users/{uid})
      const userPath = doc(db, 'users', uid);
      await setDoc(userPath, {
        empId: 'EMP001',
        role: 'user',
        username: 'test_user',
        viewableBranches: []
      });
      console.log("2. Write to users/{uid} SUCCESS!");
      
      const snap = await getDoc(userPath);
      console.log("Read users/{uid} success! exists:", snap.exists(), snap.data());
    } catch (err) {
      console.error("2. Write to users/{uid} failed:", err.message);
    }

  } catch (err) {
    console.error("Fatal run error:", err);
  }
  process.exit(0);
}
run();
