import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import "dotenv/config";

const app = initializeApp({
  projectId: "zion-hr-database",
  appId: "1:836979008084:web:cdacccdfaab3ca79d6add3",
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKey"
});
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  await signInAnonymously(auth);
  try {
    await setDoc(doc(db, "fileChunks", "test1"), { data: "test" });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
