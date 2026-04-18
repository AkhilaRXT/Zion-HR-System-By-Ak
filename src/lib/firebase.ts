import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use persistent local cache if supported, but in AI Studio iframes IndexedDB is often disabled
// so we fall back to memory cache to prevent offline errors
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
