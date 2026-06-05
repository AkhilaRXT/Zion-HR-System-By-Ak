import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
let storage: any = null;
try {
  storage = getStorage(app);
} catch (e) {
  console.warn("Storage is not available", e);
}

export { storage };


// Enable long polling to fix "Could not reach Cloud Firestore backend" connection errors in heavily proxied environments.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export default app;
