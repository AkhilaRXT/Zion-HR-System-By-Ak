import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "zion-hr-database");
const auth = getAuth(app);

async function testOldLogin() {
  const cred = await signInAnonymously(auth);
  console.log("Anon uid:", cred.user.uid);
  
  const usernameClean = 'admin'; // Testing admin
  const credDocRef = doc(db, 'credentials', usernameClean);
  const credDoc = await getDoc(credDocRef);

  if (!credDoc.exists()) {
    console.log("Cred not found");
    process.exit(1);
  }
  console.log("Cred found:", credDoc.data());

  const credData = credDoc.data();
  const empId = credData.empId;

  // Now test reading employee
  try {
    const empDocRef = doc(db, 'employees', empId);
    const empDoc = await getDoc(empDocRef);
    console.log("Employee EXISTS:", empDoc.exists(), empDoc.data());
  } catch (e) {
    console.log("Employee read failed:", e.message);
  }

  // Now test writing to users
  try {
     await setDoc(doc(db, 'users', cred.user.uid), {
        empId: credData.empId,
        role: credData.isAdmin ? 'admin' : 'user',
        username: usernameClean,
        viewableBranches: credData.viewableBranches || []
     }, { merge: true });
     console.log("Wrote to users successfully");
  } catch (e) {
     console.log("Failed to write users:", e.message);
  }

  process.exit(0);
}

testOldLogin();
