import "dotenv/config";
import express from "express";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import bcrypt from "bcryptjs";

// Load configuration
let config: any = {};
try {
  config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
} catch (e: any) {
  console.warn("[Config] Could not read firebase-applet-config.json:", e.message);
  config = { firestoreDatabaseId: "zion-hr-database" };
}

// Initialize Firebase Admin SDK lazily
let adminDb: any = null;

function getAdminDb(): any {
  if (adminDb) return adminDb;

  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saKey) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable. Admin initialization cannot proceed.");
  }

  try {
    let credentialsJson;
    const trimmed = saKey.trim();
    if (trimmed.startsWith("{")) {
      credentialsJson = JSON.parse(trimmed);
    } else {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      credentialsJson = JSON.parse(decoded);
    }

    let adminApp;
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert(credentialsJson),
      });
    } else {
      adminApp = getApps()[0];
    }
    
    const dbId = config.firestoreDatabaseId || "zion-hr-database";
    adminDb = getFirestore(adminApp, dbId);
    console.log("Firebase Admin SDK initialized successfully with database ID:", dbId);
    return adminDb;
  } catch (err: any) {
    console.error("Error initializing Firebase Admin SDK:", err.message);
    throw new Error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
  }
}

const app = express();
app.use(express.json());

// Trust reverse proxy headers
app.set('trust proxy', 1);

// We define the same route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, uid } = req.body;

    if (!username || !password || !uid) {
      return res.status(400).json({ error: "Missing required fields: username, password, and uid are required." });
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.warn("[Auth] FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not configured.");
      return res.status(503).json({
        error: "Admin Account setup required: Please configure 'FIREBASE_SERVICE_ACCOUNT_KEY' in your Environment Variables, then refresh and try again.",
        code: "MISSING_SERVICE_ACCOUNT_KEY"
      });
    }

    const db = getAdminDb();
    const usernameClean = username.trim().toLowerCase();
    
    let credDocRef;
    let credDoc;
    try {
      credDocRef = db.collection("credentials").doc(usernameClean);
      credDoc = await credDocRef.get();
    } catch (err: any) {
      console.error("Firebase Admin SDK fetch error for credentials:", err);
      return res.status(500).json({ error: "Internal Server Error during auth checks. See server logs." });
    }

    if (!credDoc.exists) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const cred = credDoc.data();
    if (!cred) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    let passwordValid = false;
    if (cred.passwordHash) {
      passwordValid = bcrypt.compareSync(password, cred.passwordHash);
    } else if (cred.password === password) {
      passwordValid = true;
      try {
         const newHash = bcrypt.hashSync(password, 10);
         await credDocRef.update({
           passwordHash: newHash,
           password: FieldValue.delete()
         });
         cred.passwordHash = newHash;
      } catch (updateErr) {
         console.warn('Auto-migration for user', usernameClean, 'failed:', updateErr);
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Resolve managed branches
    let viewableBranches = cred.viewableBranches || [];
    if (usernameClean === 'zioncommercialcreditampara@gmail.com' && !viewableBranches.includes('ALL')) {
      viewableBranches.push('ALL');
    }

    try {
      const branchesSnap = await db.collection('branches').get();
      const managed = branchesSnap.docs
        .map((d: any) => d.data())
        .filter((b: any) => b.managerId === cred.empId)
        .map((b: any) => b.name);
      if (managed.length > 0) {
        viewableBranches = [...new Set([...viewableBranches, ...managed])];
      }
    } catch (branchErr) {
      console.warn('Failed to fetch branches during server-side login:', branchErr);
    }

    // Resolve employee status
    const empDocRef = db.collection('employees').doc(cred.empId);
    const empDoc = await empDocRef.get();
    const emp = empDoc.exists ? empDoc.data() : null;

    if (emp && emp.status === 'Dormant') {
      return res.status(403).json({ error: "Unauthorized: This account has been deactivated (Dormant)." });
    }

    // Update rules Context synchronization
    const userDocRef = db.collection("users").doc(uid);
    await userDocRef.set({
      empId: cred.empId,
      role: cred.isAdmin ? 'admin' : 'user',
      username: usernameClean,
      viewableBranches: viewableBranches
    }, { merge: true });

    // Session response
    const session = {
      empId: cred.empId,
      username: usernameClean,
      name: emp ? emp.name : (cred.username || "Employee"),
      email: emp ? emp.email : undefined,
      isAdmin: cred.isAdmin || false,
      permissions: cred.permissions || (cred.isAdmin ? ['staff', 'attendance', 'leave', 'payroll', 'settings'] : []),
      viewableBranches
    };

    res.json({ success: true, session });
  } catch (err: any) {
    console.error("Backend auth login error in lambda:", err);
    res.status(500).json({ error: "An internal server error occurred during auth validation." });
  }
});

// For Vercel Serverless Function compatibility, export the application
export default app;
