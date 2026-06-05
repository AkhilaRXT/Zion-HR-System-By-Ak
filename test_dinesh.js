import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
            const data = d.data();
            if ((data.email && data.email.toLowerCase().includes('dinesh')) || data.empId === 'EMP0015' || d.id === 'EMP0015') {
                console.log(d.id, data);
            }
        });
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
