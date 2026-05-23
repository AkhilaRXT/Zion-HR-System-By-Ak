import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    // Try to write a test message
    const testDocRef = doc(db, 'messages', 'test_unauth_write');
    await setDoc(testDocRef, {
      senderId: 'SYSTEM',
      participants: ['SYSTEM'],
      subject: 'Test',
      body: 'Test',
      timestamp: new Date().toISOString()
    });
    console.log("Write to messages/test_unauth_write SUCCESSFUL!");
    
    const docSnap = await getDoc(testDocRef);
    console.log("Read from messages/test_unauth_write SUCCESSFUL!", docSnap.exists() ? docSnap.data() : "No data");
  } catch(e) {
    console.error("Messages error msg:", e.message);
    console.error("error code:", e.code);
    console.error("error details:", e.details);
    console.error(e);
  }
  process.exit(0);
}
check();
