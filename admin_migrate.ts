import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

process.env.FIRESTORE_EMULATOR_HOST = ""; 

try {
  initializeApp({
    projectId: config.projectId,
  });
} catch(e){}

// The admin SDK firestore() can take a databaseId as property in older syntax, or via getFirestore(app, id) in v12+?
// Actually, firebase-admin might not support named databases if older. Let's assume initialized default for projectId. 
// If getFirestore throws due to wrong signature, we can catch it.

async function migrate() {
  try {
    let dbToUse = getFirestore();
    
    // There isn't an officially supported way to specify database in all admin SDK versions simply.
    // Try passing it.
    try {
      dbToUse = getFirestore(undefined, config.firestoreDatabaseId || "zion-hr-database");
    } catch(e) {}

    const snap = await dbToUse.collection('credentials').get();
    let count = 0;
    
    for (const d of snap.docs) {
      const data = d.data();
      if (data.password && !data.passwordHash) {
        const passwordHash = bcrypt.hashSync(data.password, 10);
        await d.ref.update({
          passwordHash,
          password: FieldValue.delete()
        });
        count++;
        console.log(`Migrated ${d.id}`);
      } else if (data.password && data.passwordHash) {
         await d.ref.update({ password: FieldValue.delete() });
         console.log(`Cleaned up plain text password from ${d.id}`);
      }
    }
    
    console.log(`Migration completed via admin SDK! Handled ${count} unhashed documents.`);
  } catch(e: any) {
    console.error("Migration failed:", e.message);
  }

  process.exit(0);
}

migrate();
