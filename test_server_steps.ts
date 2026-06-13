import { initializeApp as initializeClientApp } from "firebase/app";
import { getAuth as getClientAuth, signInAnonymously as signClientInAnonymously } from "firebase/auth";
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc, setDoc as setClientDoc } from "firebase/firestore";
import fs from "fs";

async function testPersist() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const clientApp = initializeClientApp(config);
  const clientAuth = getClientAuth(clientApp);
  const clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId || "zion-hr-database");

  try {
    await signClientInAnonymously(clientAuth);
    const id = "test_diagnostic_" + Date.now();
    console.log("Writing to systemReports:", id);
    const reportRef = clientDoc(clientDb, "systemReports", id);
    await setClientDoc(reportRef, {
      empId: "EMP001",
      empName: "Test employee name",
      subject: "Diagnostic",
      message: "Blah",
      timestamp: new Date().toISOString(),
      status: "Pending"
    });
    console.log("Write success!");

    console.log("Reading back...");
    const snap = await getClientDoc(reportRef);
    console.log("Exist:", snap.exists());
    if (snap.exists()) {
      console.log("Data:", snap.data());
    }
  } catch (err: any) {
    console.error("Failed:", err.message || err);
  }
}

testPersist().then(() => process.exit(0));
