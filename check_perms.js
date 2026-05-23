import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);

async function checkCollection(name, id = 'TEST001') {
  try {
    const res = await getDoc(doc(db, name, id));
    console.log(`[SUCCESS] Read from '${name}/${id}'. Exists:`, res.exists());
  } catch (e) {
    console.error(`[DENIED] Read from '${name}/${id}'. Error:`, e.message);
  }
}

async function check() {
  try {
    await signInAnonymously(auth);
    console.log("Logged in anonymously. UID:", auth.currentUser.uid);
    console.log("Is anonymous:", auth.currentUser.isAnonymous);
    const token = await auth.currentUser.getIdToken();
    console.log("Token length:", token ? token.length : 0);
    console.log("Waiting for Auth token sync to Firestore...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const collections = [
      ['employees', 'EMP001'],
      ['attendance', 'ATT001'],
      ['leaves', 'LV001'],
      ['advances', 'ADV001'],
      ['cashRequests', 'CASH001'],
      ['targets', 'TGT001'],
      ['announcements', 'ANN001'],
      ['settings', 'global'],
      ['auditLogs', 'LOG001'],
      ['payrollReceipts', 'PAY001'],
      ['paidDeductions', 'EMP001'],
      ['branches', 'BR001'],
      ['holidays', 'HOL001'],
      ['customNets', 'NET001'],
      ['performanceAllowances', 'PERF001'],
      ['own_performanceAllowances', 'PERF001'],
      ['messages', 'test_unauth_write']
    ];

    for (const [name, id] of collections) {
      await checkCollection(name, id);
    }

  } catch (e) {
    console.error("Fatal error:", e);
  }
  process.exit(0);
}
check();
