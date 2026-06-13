import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "zion-hr-database");
const auth = getAuth(app);

async function probe() {
  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;
  console.log("Logged in anonymously. UID:", uid);

  async function testRead(path) {
    try {
      const parts = path.split('/');
      const snap = await getDoc(doc(db, parts[0], parts[1]));
      console.log(`[READ] ${path} -> SUCCESS (exists: ${snap.exists()})`);
    } catch(e) {
      console.log(`[READ] ${path} -> DENIED (${e.code})`);
    }
  }

  async function testWrite(path, uid) {
    try {
      const parts = path.split('/');
      await setDoc(doc(db, parts[0], parts[1]), { test: "probe", secretPasscode: "ZION_SERVER_SECRET_987654321", empId: "PROBE1", date: "2026-06-12", status: "Present", role: "user", username: "probe" }, { merge: true });
      console.log(`[WRITE] ${path} -> SUCCESS`);
    } catch(e) {
      console.log(`[WRITE] ${path} -> DENIED (${e.code})`);
    }
  }

  await testRead('settings/global');
  await testRead('credentials/zioncommercialcreditampara@gmail.com');
  await testRead('employees/EMP003');
  await testRead('users/' + uid);
  await testRead('server_sessions/' + uid);

  await testWrite('users/' + uid, uid);
  await testWrite('server_sessions/' + uid, uid);
  await testWrite('systemReports/probe_1', uid);
  await testWrite('attendance/probe_1', uid);

  process.exit(0);
}
probe();
