import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
    try {
        const usersSnap = await getDocs(query(collection(db, 'credentials'), where('empId', '==', 'EMP0015')));
        usersSnap.forEach(d => {
            console.log(d.id, d.data());
        });
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
