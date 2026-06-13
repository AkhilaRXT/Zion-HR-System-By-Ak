import { initializeApp as initializeClientApp } from "firebase/app";
import { getAuth as getClientAuth, signInAnonymously as signClientInAnonymously } from "firebase/auth";
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc } from "firebase/firestore";
import fs from "fs";

async function runDiagnosis() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const clientApp = initializeClientApp(config);
  const clientAuth = getClientAuth(clientApp);
  const clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId || "zion-hr-database");

  console.log("Using Database ID:", config.firestoreDatabaseId || "zion-hr-database");

  try {
    console.log("--- Attempting Anonymous Login ---");
    const cred = await signClientInAnonymously(clientAuth);
    const uid = cred.user.uid;
    console.log("Anonymous UID:", uid);

    console.log("\n--- Checking if credentials can be read directly ---");
    try {
      const credRef = clientDoc(clientDb, "credentials", "zioncommercialcreditampara@gmail.com");
      const snap = await getClientDoc(credRef);
      console.log("Read credentials SUCCESS! Exists:", snap.exists());
      if (snap.exists()) {
        console.log("Found real password/isAdmin:", !!snap.data().password, snap.data().isAdmin);
      }
    } catch (err: any) {
      console.error("Read credentials FAILED!", err);
    }

  } catch (err: any) {
    console.error("Diagnosis error:", err);
  }
}

runDiagnosis().then(() => process.exit(0));
