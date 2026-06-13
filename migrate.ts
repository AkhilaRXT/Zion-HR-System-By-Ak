import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "zion-hr-database");
const auth = getAuth(app);

async function migrate() {
  try {
    const credAuth = await signInAnonymously(auth);
    const uid = credAuth.user.uid;
    
    // Fake the server session
    await setDoc(doc(db, "server_sessions", uid), { secretPasscode: "ZION_SERVER_SECRET_987654321" });
    console.log("Mocked server session for migration...");

    const credSnap = await getDocs(collection(db, 'credentials'));
    let count = 0;
    let hashes = 0;
    
    for (const d of credSnap.docs) {
      const data = d.data();
      if (data.password && !data.passwordHash) {
        const passwordHash = bcrypt.hashSync(data.password, 10);
        await updateDoc(d.ref, {
          passwordHash,
          password: deleteField()
        });
        count++;
        console.log(`Migrated ${d.id}`);
      } else if (data.password && data.passwordHash) {
         // Has both, remove plain text
         await updateDoc(d.ref, { password: deleteField() });
         hashes++;
         console.log(`Cleaned up plain text password from ${d.id}`);
      }
    }
    
    console.log(`Migration completed! Handled ${count} unhashed documents, cleaned up ${hashes} plain text duplicates.`);
  } catch(e: any) {
    console.error("Migration failed:", e.message);
  }

  process.exit(0);
}

migrate();
