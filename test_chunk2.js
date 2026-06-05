import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, config.firestoreDatabaseId);

async function run() {
    try {
        await signInWithEmailAndPassword(auth, 'zioncommercialcreditampara@gmail.com', 'admin1234'); // wait, I don't know the password
        console.log("Logged in");
        await setDoc(doc(db, 'fileChunks', 'test1234'), { test: "data" });
        console.log("Written!");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
