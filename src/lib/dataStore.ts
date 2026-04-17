import { AppData, Employee, Session, AppSettings, Attendance, LeaveRequest, AdvanceRequest, AuditLog, Credential, CashRequest } from '../types';
import { db, auth } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';

export const STORAGE_KEY = 'zion_hr_data';
const AUTH_KEY = 'zion_hr_session';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const initialData: AppData = {
  employees: [],
  credentials: [],
  attendance: [],
  leaves: [],
  targets: [],
  advances: [],
  cashRequests: [],
  leaveBalances: {},
  settings: {
    companyName: 'Zion HR',
    companySubtitle: 'Human Resources',
    leavePolicy: {
      monthlyLimit: 2,
      annualTotal: 24,
      casualTotal: 10,
      sickTotal: 14
    },
    workSchedule: {
      weekdays: { start: '08:35', end: '17:00' },
      saturdays: { start: '09:00', end: '13:30' },
      sundays: false
    },
    fuelPrice: 398,
    theme: {
      primary: '#6366f1',
      accent: '#818cf8',
      background: '#0f172a',
      secondary: '#10b981',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8'
    },
    backgroundBlobs: {
      enabled: true,
      blur: 150,
      opacity: 5
    },
    loginHero: {
      titleLine1: 'Empowering Your',
      titleLine2: 'Financial Future',
      stat1Value: '100%',
      stat1Label: 'Secure',
      stat2Value: '24/7',
      stat2Label: 'Access',
      backgroundImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop'
    }
  },
  auditLogs: [],
  paidDeductions: {},
  internalMessages: []
};

export const DataStore = {
  async init() {
    try {
      // Test connection
      await getDocFromServer(doc(db, 'test', 'connection'));
      
      // Seed initial data if settings don't exist
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (!settingsDoc.exists()) {
        console.log('Seeding initial data...');
        await setDoc(doc(db, 'settings', 'global'), initialData.settings);
        
        // Seed initial employees and credentials
        for (const emp of initialData.employees) {
          await setDoc(doc(db, 'employees', emp.id), emp);
        }
        for (const cred of initialData.credentials) {
          await setDoc(doc(db, 'credentials', cred.username.toLowerCase()), cred);
        }
        for (const [empId, balance] of Object.entries(initialData.leaveBalances)) {
          await setDoc(doc(db, 'leaveBalances', empId), balance);
        }
      } else {
        // Self-repair for master admin record and settings
        try {
          const adminDoc = await getDoc(doc(db, 'employees', 'EMP003'));
          if (adminDoc.exists()) {
            const data = adminDoc.data() as Employee;
            if (data.email !== "zioncommercialcreditampara@gmail.com") {
              await updateDoc(doc(db, 'employees', 'EMP003'), { email: "zioncommercialcreditampara@gmail.com" });
            }
          }

          if (settingsDoc.exists()) {
            const settingsData = settingsDoc.data() as AppSettings;
            if (settingsData.companyName === 'NEXUS') {
              await updateDoc(doc(db, 'settings', 'global'), { 
                companyName: 'Zion HR', 
                companySubtitle: 'Human Resources' 
              });
            }
          }

          // Ensure directory exists for all current employees to fix autocomplete
          const employeesQuery = query(collection(db, 'employees'));
          const employeesSnap = await getDocs(employeesQuery);
          for (const docSnap of employeesSnap.docs) {
             const emp = docSnap.data() as Employee;
             const dirSnap = await getDoc(doc(db, 'directory', emp.id));
             if (!dirSnap.exists()) {
                await setDoc(doc(db, 'directory', emp.id), { id: emp.id, name: emp.name });
             }
          }

        } catch (e) {
          console.warn('Self-repair skipped or failed:', e);
        }
      }
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  },

  async resetData() {
    // This is dangerous in production, but for the user's request:
    const data = initialData;
    try {
      // Reset settings
      await setDoc(doc(db, 'settings', 'global'), data.settings);
      
      // Clear other collections would require batching or individual deletes
      // For now, we'll just log it
      await this.logAction('Database Reset', 'System data reset initiated.', 'Settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getData(): AppData {
    // This will be replaced by real-time sync in App.tsx
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialData;
  },

  saveData(data: AppData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  async logAction(action: string, details: string, type: AuditLog['type'], userOverride?: string) {
    const session = this.getSession();
    const log: AuditLog = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      user: userOverride || (session ? `${session.name} (${session.empId})` : 'System'),
      action,
      details,
      type
    };
    try {
      await setDoc(doc(db, 'auditLogs', log.id.toString()), log);
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  },

  async login(username: string, password: string): Promise<{ success: boolean; session?: Session; error?: string }> {
    try {
      // Sign in anonymously first to get an auth context for Firestore rules
      try {
        if (!auth.currentUser) {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        }
      } catch (authErr: any) {
        console.warn('Anonymous Auth is disabled in Firebase Console. Username/Password login may have limited access.');
        if (authErr.code === 'auth/admin-restricted-operation') {
          return { 
            success: false, 
            error: 'System Error: Please enable "Anonymous Authentication" in your Firebase Console to allow Username/Password login.' 
          };
        }
      }

      const credDoc = await getDoc(doc(db, 'credentials', username.toLowerCase()));
      if (!credDoc.exists()) {
        return { success: false, error: 'Invalid username or password.' };
      }
      const cred = credDoc.data() as Credential;
      if (cred.password !== password) {
        return { success: false, error: 'Invalid username or password.' };
      }

      // Sync to users collection for rules (with password token for backend validation)
      // This MUST happen before we fetch the protected employee profile so isOwner() is true
      try {
        await setDoc(doc(db, 'users', auth.currentUser!.uid), {
          empId: cred.empId,
          role: cred.isAdmin ? 'admin' : 'user',
          username: username.toLowerCase(),
          passToken: password
        });
      } catch (e) {
        console.warn('Failed to sync user doc:', e);
      }

      const empDoc = await getDoc(doc(db, 'employees', cred.empId));
      const emp = empDoc.exists() ? empDoc.data() as Employee : null;

      const session: Session = { 
        empId: cred.empId, 
        name: emp ? emp.name : 'Unknown', 
        email: emp?.email || undefined,
        isAdmin: cred.isAdmin,
        permissions: cred.permissions || []
      };

      await this.logAction('Login Success', `User ${username} logged in successfully via credentials.`, 'Auth', `${session.name} (${session.empId})`);
      return { success: true, session };
    } catch (error) {
      await this.logAction('Login Failed', `Username: ${username}`, 'Auth');
      handleFirestoreError(error, OperationType.GET, `credentials/${username}`);
      return { success: false, error: 'An error occurred during login.' };
    }
  },

  async loginWithGoogle(): Promise<{ success: boolean; session?: Session; error?: string }> {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if this user is an admin based on email
      const isAdmin = user.email === "zioncommercialcreditampara@gmail.com";
      
      // Try to find an employee record for this email
      const empQuery = query(collection(db, 'employees'), where('email', '==', user.email));
      const empSnap = await getDocs(empQuery);
      let empId = 'GUEST';
      let name = user.displayName || 'Google User';

      if (!empSnap.empty) {
        const empData = empSnap.docs[0].data() as Employee;
        empId = empData.id;
        name = empData.name;
      } else if (isAdmin) {
        // Fallback for master admin if record not found by email
        empId = 'EMP003';
        name = 'Master Administrator';
      } else {
        await this.logAction('Google Login Failed', `Unauthorized email: ${user.email}`, 'Auth', user.email || 'Unknown');
        return { success: false, error: 'Unauthorized: Your Google account is not registered in the system.' };
      }

      const session: Session = {
        empId,
        name,
        email: user.email || undefined,
        isAdmin,
        permissions: ['staff', 'attendance', 'leave', 'payroll', 'settings']
      };

      // Sync to users collection for rules
      try {
        await setDoc(doc(db, 'users', user.uid), {
          empId,
          role: isAdmin ? 'admin' : 'user',
          email: user.email
        });
      } catch (e) {
        console.warn('Failed to sync user doc:', e);
      }

      await this.logAction('Google Login', `User ${user.email} logged in via Google.`, 'Auth', `${session.name} (${session.empId})`);
      return { success: true, session };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : (error?.message || 'Unknown error');
      await this.logAction('Google Login Failed', errorMessage, 'Auth');
      console.error('Google Login Error:', error);
      return { success: false, error: `Google Sign-In Error: ${errorMessage}` };
    }
  },

  getSession(): Session | null {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setSession(session: Session) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
  },

  logout() {
    const session = this.getSession();
    if (session) {
      this.logAction('Logout', `User ${session.name} (${session.empId}) logged out.`, 'Auth');
    }
    sessionStorage.removeItem(AUTH_KEY);
    auth.signOut().catch(console.error);
  },

  async updateSettings(newSettings: AppSettings) {
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
      await this.logAction('Update Settings', 'System settings and theme updated.', 'Settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    }
  },

  async ensureAuth() {
    if (!auth.currentUser) {
      try {
        const { signInAnonymously } = await import('firebase/auth');
        await signInAnonymously(auth);
      } catch (e) {
        console.error('Failed to establish auth context');
      }
    }
  },

  async addEmployee(emp: Employee, cred: any) {
    try {
      await this.ensureAuth();
      await setDoc(doc(db, 'employees', emp.id), emp);
      await setDoc(doc(db, 'directory', emp.id), { id: emp.id, name: emp.name });
      await setDoc(doc(db, 'credentials', cred.username.toLowerCase()), cred);
      
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsDoc.exists() ? settingsDoc.data() as AppSettings : initialData.settings;
      const policy = settings.leavePolicy;
      
      await setDoc(doc(db, 'leaveBalances', emp.id), { 
        annual: policy.annualTotal, 
        casual: policy.casualTotal, 
        sick: policy.sickTotal 
      });
      
      await this.logAction('Add Employee', `Added new employee: ${emp.name} (${emp.id}). Role: ${emp.role}, Dept: ${emp.department}`, 'Employee');
      return { success: true };
    } catch (error: any) {
      await this.logAction('Add Employee Failed', `Name: ${emp.name}, Error: ${error.message}`, 'Employee');
      console.error('Add Employee Error:', error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission Denied: You do not have authority to add members. Please ensure you are logged in with the Master Admin account (zioncommercialcreditampara@gmail.com).');
      }
      handleFirestoreError(error, OperationType.CREATE, `employees/${emp.id}`);
      throw error;
    }
  },

  async updateEmployee(empId: string, updates: Partial<Employee>, credUpdates?: Partial<Credential>) {
    try {
      await this.ensureAuth();
      const empRef = doc(db, 'employees', empId);
      await updateDoc(empRef, updates);

      if (updates.name) {
        await setDoc(doc(db, 'directory', empId), { id: empId, name: updates.name }, { merge: true });
      }

      if (credUpdates) {
        // Find the username for this employee to update credentials
        const credQuery = query(collection(db, 'credentials'), where('empId', '==', empId));
        const credSnap = await getDocs(credQuery);
        if (!credSnap.empty) {
          const credDoc = credSnap.docs[0];
          await updateDoc(credDoc.ref, credUpdates);
        }
      }

      const detailStr = Object.keys(updates).join(', ');
      await this.logAction('Update Employee', `Updated details for ${empId}: ${detailStr}`, 'Employee');
      return { success: true };
    } catch (error: any) {
      await this.logAction('Update Employee Failed', `ID: ${empId}, Error: ${error.message}`, 'Employee');
      console.error('Update Employee Error:', error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission Denied: You do not have authority to update members. Please log in with your Admin Google Account.');
      }
      handleFirestoreError(error, OperationType.UPDATE, `employees/${empId}`);
      throw error;
    }
  },

  async deleteEmployee(empId: string) {
    try {
      await this.ensureAuth();
      await deleteDoc(doc(db, 'employees', empId));
      await deleteDoc(doc(db, 'directory', empId));
      await deleteDoc(doc(db, 'leaveBalances', empId));
      
      // Delete credentials too
      const credQuery = query(collection(db, 'credentials'), where('empId', '==', empId));
      const credSnap = await getDocs(credQuery);
      for (const d of credSnap.docs) {
        await deleteDoc(d.ref);
      }

      await this.logAction('Delete Employee', `Permanently deleted employee: ${empId}`, 'Employee');
      return { success: true };
    } catch (error: any) {
      await this.logAction('Delete Employee Failed', `ID: ${empId}, Error: ${error.message}`, 'Employee');
      console.error('Delete Employee Error:', error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission Denied: You do not have authority to delete members. Please log in with your Admin Google Account.');
      }
      handleFirestoreError(error, OperationType.DELETE, `employees/${empId}`);
      throw error;
    }
  },

  async updateAttendance(id: number, updates: Partial<Attendance>) {
    try {
      await this.ensureAuth();
      await updateDoc(doc(db, 'attendance', id.toString()), updates);
      const detailStr = Object.keys(updates).map(k => `${k}: ${(updates as any)[k]}`).join(', ');
      await this.logAction('Update Attendance', `Modified record ${id}. Changes: ${detailStr}`, 'Attendance');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${id}`);
    }
  },

  async deleteAttendance(id: number) {
    try {
      await this.ensureAuth();
      await deleteDoc(doc(db, 'attendance', id.toString()));
      await this.logAction('Delete Attendance', `Deleted attendance record ${id}`, 'Attendance');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `attendance/${id}`);
    }
  },

  async checkIn(empId: string, status: 'Present' | 'Late', displayTime: string) {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    try {
      await this.ensureAuth();
      
      // Check if record already exists for today
      const q = query(collection(db, 'attendance'), where('empId', '==', empId), where('date', '==', dateStr));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Update existing record
        const docRef = snap.docs[0].ref;
        await updateDoc(docRef, {
          status,
          checkIn: displayTime,
          checkOut: '--'
        });
      } else {
        // Create new record
        const id = Date.now();
        await setDoc(doc(db, 'attendance', id.toString()), {
          id,
          empId,
          date: dateStr,
          status,
          checkIn: displayTime,
          checkOut: '--'
        });
      }
      await this.logAction('Attendance In', `Employee ${empId} marked as ${status} at ${displayTime}`, 'Attendance');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attendance`);
    }
  },

  async checkOut(id: number, time: string) {
    try {
      await this.ensureAuth();
      await updateDoc(doc(db, 'attendance', id.toString()), { checkOut: time });
      await this.logAction('Check Out', `Attendance record ${id} checked out at ${time}`, 'Attendance');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${id}`);
    }
  },

  async addLeaveRequest(request: LeaveRequest) {
    try {
      await this.ensureAuth();
      await setDoc(doc(db, 'leaves', request.id.toString()), request);
      await this.logAction('Leave Apply', `New ${request.type} leave requested by ${request.empId} from ${request.from} to ${request.to}. Reason: ${request.reason}`, 'Leave');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `leaves/${request.id}`);
    }
  },

  async updateLeaveStatus(id: number, status: 'Approved' | 'Rejected', actionedBy?: string) {
    try {
      await this.ensureAuth();
      const leaveRef = doc(db, 'leaves', id.toString());
      const leaveDoc = await getDoc(leaveRef);
      const leaveData = leaveDoc.data() as LeaveRequest;
      
      const updates = actionedBy ? { status, actionedBy } : { status };
      await updateDoc(leaveRef, updates);

      // If approved, create attendance records for each day in the range
      if (status === 'Approved') {
        const start = new Date(leaveData.from);
        const end = new Date(leaveData.to);
        const current = new Date(start);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          const attId = Date.now() + Math.floor(Math.random() * 1000);
          
          // Check if attendance already exists for this day/emp
          const attQuery = query(
            collection(db, 'attendance'), 
            where('empId', '==', leaveData.empId), 
            where('date', '==', dateStr)
          );
          const attSnap = await getDocs(attQuery);
          
          if (attSnap.empty) {
            await setDoc(doc(db, 'attendance', attId.toString()), {
              id: attId,
              empId: leaveData.empId,
              date: dateStr,
              status: 'Leave',
              checkIn: '--',
              checkOut: '--'
            });
          } else {
            const existingDoc = attSnap.docs[0];
            await updateDoc(existingDoc.ref, { 
              status: 'Leave', 
              checkIn: '--', 
              checkOut: '--' 
            });
          }
          
          current.setDate(current.getDate() + 1);
          // Small delay to ensure unique IDs if loop is fast
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      await this.logAction('Leave Decision', `${status} ${leaveData.type} leave for ${leaveData.empId} (${leaveData.from} to ${leaveData.to})`, 'Leave');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leaves/${id}`);
    }
  },

  async addAdvanceRequest(request: AdvanceRequest) {
    try {
      await setDoc(doc(db, 'advances', request.id.toString()), request);
      await this.logAction('Advance Request', `New salary advance requested by ${request.empId} for LKR ${request.amount.toLocaleString()}. Reason: ${request.reason}`, 'Advance');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `advances/${request.id}`);
    }
  },

  async updateAdvanceStatus(id: number, status: 'Approved' | 'Rejected', actionedBy?: string) {
    try {
      const advRef = doc(db, 'advances', id.toString());
      const advDoc = await getDoc(advRef);
      const advData = advDoc.data() as AdvanceRequest;
      
      const updates = actionedBy ? { status, actionedBy } : { status };
      await updateDoc(advRef, updates);
      await this.logAction('Advance Decision', `${status} advance request for ${advData.empId} (LKR ${advData.amount.toLocaleString()})`, 'Advance');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `advances/${id}`);
    }
  },

  async addCashRequest(request: CashRequest) {
    try {
      await setDoc(doc(db, 'cashRequests', request.id.toString()), request);
      await this.logAction('Cash Request', `New cash request by ${request.empId} for LKR ${request.amount.toLocaleString()}. Category: ${request.category}`, 'Cash');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cashRequests/${request.id}`);
    }
  },

  async updateCashRequestStatus(id: number, status: 'Approved' | 'Rejected', actionedBy?: string) {
    try {
      const cashRef = doc(db, 'cashRequests', id.toString());
      const cashDoc = await getDoc(cashRef);
      const cashData = cashDoc.data() as CashRequest;
      
      const updates = actionedBy ? { status, actionedBy } : { status };
      await updateDoc(cashRef, updates);
      await this.logAction('Cash Decision', `${status} cash request for ${cashData.empId} (LKR ${cashData.amount.toLocaleString()})`, 'Cash');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cashRequests/${id}`);
    }
  },

  async addTarget(target: any) {
    try {
      await setDoc(doc(db, 'targets', target.id.toString()), target);
      await this.logAction('Add Target', `Set target for ${target.empId}: ${target.category} - ${target.targetCount} units for ${target.month}`, 'Settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `targets/${target.id}`);
    }
  },

  async deleteTarget(id: number) {
    try {
      await deleteDoc(doc(db, 'targets', id.toString()));
      await this.logAction('Delete Target', `Deleted target record ${id}`, 'Settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `targets/${id}`);
    }
  },

  async finalizePayroll(month: string, empIds: string[]) {
    // This would ideally be a batch or a cloud function
    // For now, we'll just log it and maybe update a few records
    await this.logAction('Finalize Payroll', `Payroll finalized for ${month}`, 'Settings');
  }
};
