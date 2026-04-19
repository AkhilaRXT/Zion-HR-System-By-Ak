import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DataStore } from './lib/dataStore';
import { Session, AppData, Employee, Attendance, LeaveRequest, AdvanceRequest, Target, AuditLog, AppSettings, CashRequest, UserCredential } from './types';
import { db, auth } from './lib/firebase';
import { collection, onSnapshot, doc, query, limit, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StaffManagement from './components/StaffManagement';
import AttendanceView from './components/Attendance';
import LeaveManagement from './components/LeaveManagement';
import Payroll from './components/Payroll';
import CashRequests from './components/CashRequests';
import Settings from './components/Settings';
import MyProfile from './components/MyProfile';
import AuditLogs from './components/AuditLogs';
import InternalMail from './components/InternalMail';
import { Clock, Menu, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [route, setRoute] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [appData, setAppData] = useState<AppData>(DataStore.getData());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSettingsReady, setIsSettingsReady] = useState(false);

  // Safety fallback for all loading states
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('Loading fallback triggered after 6s. Database may be unresponsive.');
        setIsLoading(false);
        setIsAuthReady(true);
        setIsSettingsReady(true);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    DataStore.init();
    const existing = DataStore.getSession();
    if (existing) setSession(existing);

    const unsubAuth = auth.onAuthStateChanged((user) => {
      setIsAuthReady(true);
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    // Always sync settings, even before login
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const newSettings = snap.data() as AppSettings;
        setAppData(prev => ({ ...prev, settings: newSettings }));
        setIsSettingsReady(true);
        // Cache settings to localStorage to prevent theme flash on next load
        try {
          const raw = localStorage.getItem('zion_hr_data');
          const localData = raw ? JSON.parse(raw) : DataStore.getData();
          localData.settings = newSettings;
          localStorage.setItem('zion_hr_data', JSON.stringify(localData));
        } catch (e) {
          console.warn('Failed to cache settings locally');
        }
      } else {
        setIsSettingsReady(true);
      }
    }, (err) => {
      console.warn('Permission denied or error fetching settings:', err);
      setIsSettingsReady(true);
    });

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    if (!session) {
      if (isAuthReady && isSettingsReady) setIsLoading(false);
      return;
    }
    
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }

    const unsubscribers: (() => void)[] = [];
    
    const updatePart = (part: Partial<AppData>) => {
      setAppData(prev => ({ ...prev, ...part }));
    };

    // If admin, listen to everything. If employee, listen to restricted set.
    // For now, we'll try to listen to all, but we need to handle permission errors gracefully.
    const syncCollection = (name: string, setter: (data: any[]) => void, queryRef?: any) => {
      try {
        const ref = queryRef || collection(db, name);
        const unsub = onSnapshot(ref, (snapshot: QuerySnapshot<DocumentData>) => {
          const docs = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            // Ensure the document ID is always present in the object, 
            // prioritizing the actual document name for total accuracy.
            return { ...data, id: doc.id };
          });
          setter(docs);
        }, (error: any) => {
          console.warn(`Permission denied for collection ${name}. This is expected for non-admin users.`);
        });
        unsubscribers.push(unsub);
      } catch (err) {
        console.error(`Error setting up listener for ${name}:`, err);
      }
    };

    if (session.isAdmin) {
      // Core global collections (Always needed for names and dashboard)
      syncCollection('employees', (docs) => updatePart({ employees: docs as Employee[] }));
      syncCollection('credentials', (docs) => updatePart({ credentials: docs as UserCredential[] }));
      
      // Limit attendance for the dashboard to recent items
      const attendanceQuery = query(collection(db, 'attendance'), orderBy('id', 'desc'), limit(150));
      syncCollection('attendance', (docs) => updatePart({ attendance: docs as Attendance[] }), attendanceQuery);
      
      syncCollection('leaves', (docs) => updatePart({ leaves: docs as LeaveRequest[] }));

      // Lazy load modules based on current route
      if (route === 'payroll' || route === 'settings') {
        syncCollection('advances', (docs) => updatePart({ advances: docs as AdvanceRequest[] }));
        syncCollection('payrollReceipts', (docs) => {
          const sorted = docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          updatePart({ payrollReceipts: sorted as any[] });
        });
        syncCollection('cashRequests', (docs) => updatePart({ cashRequests: docs as CashRequest[] }));
        syncCollection('targets', (docs) => updatePart({ targets: docs as Target[] }));
        
        const unsubPaid = onSnapshot(collection(db, 'paidDeductions'), (snap) => {
          const paid: { [key: string]: string[] } = {};
          const paidAmts: { [empId: string]: { [month: string]: number } } = {};
          const paidNts: { [empId: string]: { [month: string]: string } } = {};
          const paidCmps: { [empId: string]: { [month: string]: string[] } } = {};
          snap.docs.forEach(d => { 
            paid[d.id] = d.data().months || []; 
            paidAmts[d.id] = d.data().paidAmounts || {};
            paidNts[d.id] = d.data().paidNotes || {};
            paidCmps[d.id] = d.data().paidComponents || {};
          });
          updatePart({ paidDeductions: paid, paidSalaryAmounts: paidAmts, paidSalaryNotes: paidNts, paidComponents: paidCmps });
        }, (err) => console.warn('Permission denied for paidDeductions'));
        unsubscribers.push(unsubPaid);
      }
      
      if (route === 'audit') {
        const auditQuery = query(collection(db, 'auditLogs'), orderBy('id', 'desc'), limit(70));
        syncCollection('auditLogs', (docs) => updatePart({ auditLogs: docs as AuditLog[] }), auditQuery);
      }
    } else {
      // Regular employee: only sync their own data
      const unsubEmp = onSnapshot(doc(db, 'employees', session.empId), (snap) => {
        if (snap.exists()) {
          const emp = snap.data() as Employee;
          setAppData(prev => ({
            ...prev,
            employees: [emp] // For employee view, we only need their own record
          }));
        }
      }, (err) => console.warn('Permission denied for employee profile'));
      unsubscribers.push(unsubEmp);

      // Sync their own leaves
      import('firebase/firestore').then(({ query, where }) => {
        const leavesQuery = query(collection(db, 'leaves'), where('empId', '==', session.empId));
        const unsubLeaves = onSnapshot(leavesQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as LeaveRequest);
          updatePart({ leaves: docs });
        }, (err) => console.warn('Permission denied for leaves'));
        unsubscribers.push(unsubLeaves);

        // Sync their own advances
        const advancesQuery = query(collection(db, 'advances'), where('empId', '==', session.empId));
        const unsubAdvances = onSnapshot(advancesQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as AdvanceRequest);
          updatePart({ advances: docs });
        }, (err) => console.warn('Permission denied for advances'));
        unsubscribers.push(unsubAdvances);

        // Sync their own cash requests
        const cashQuery = query(collection(db, 'cashRequests'), where('empId', '==', session.empId));
        const unsubCash = onSnapshot(cashQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as CashRequest);
          updatePart({ cashRequests: docs });
        }, (err) => console.warn('Permission denied for cashRequests'));
        unsubscribers.push(unsubCash);

        // Sync their own attendance
        const attendanceQuery = query(collection(db, 'attendance'), where('empId', '==', session.empId));
        const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as Attendance);
          updatePart({ attendance: docs });
        }, (err) => console.warn('Permission denied for attendance'));
        unsubscribers.push(unsubAttendance);
      });
    }

    // Sync messages for the current user (sender or recipient)
    if (route === 'mail' || route === 'dashboard') {
      import('firebase/firestore').then(({ query, where, limit }) => {
        const messagesQuery = query(collection(db, 'messages'), where('participants', 'array-contains', session.empId), limit(50));
        const unsubMessages = onSnapshot(messagesQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as any);
          docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          updatePart({ internalMessages: docs });
        }, (err) => console.warn('Permission denied for messages'));
        unsubscribers.push(unsubMessages);
      });
    }

    // Always fetch directory for autocomplete
    const dirQuery = collection(db, 'directory');
    const unsubDirList = onSnapshot(dirQuery, (snap) => {
       const publicDir = snap.docs.map(d => d.data() as any);
       setAppData(prev => ({ ...prev, directory: publicDir }));
    }, (err) => console.warn('Permission denied for general directory list'));
    unsubscribers.push(unsubDirList);

    // Allow 800ms for initial collections to trigger their cached snapshots.
    // Since we now cache settings and have no dummy data, this guarantees a smooth, flash-free transition.
    const loadTimer = setTimeout(() => setIsLoading(false), 800);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(loadTimer);
    };
  }, [session, isAuthReady, isSettingsReady, route]);

  const refreshData = () => {
    // No longer needed with real-time sync, but keeping for compatibility
  };

  const handleLogin = (newSession: Session) => {
    DataStore.setSession(newSession);
    setSession(newSession);
    setRoute('dashboard');
  };

  useEffect(() => {
    if (session) {
      DataStore.logAction('Page View', `User viewed ${getPageTitle()}`, 'Auth');
    }
  }, [route]);

  const handleLogout = () => {
    DataStore.logout();
    setSession(null);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-bg-primary flex flex-col items-center justify-center gap-8 z-[300]">
        <div className="relative w-24 h-24 animate-pulse">
          {appData.settings.logo ? (
            <img src={appData.settings.logo} alt="Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
          ) : (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
              <path d="M50 0 A50 50 0 0 0 50 100 L50 0" fill="#1B4384" />
              <path d="M50 0 A50 50 0 0 1 50 100 L50 0" fill="#27A745" />
              <path d="M30 30 L70 30 L30 70 L70 70" fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <div className="absolute inset-0 border-4 border-brand-accent/30 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-text-primary font-serif text-3xl font-bold">{appData.settings.companyName || 'Zion HR'}</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-text-secondary text-sm font-medium mt-2">Synchronizing with Cloud...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} data={appData} />;
  }

  const renderView = () => {
    // Basic permission check for rendering
    const hasAccess = (id: string) => {
      const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
      
      // Specifically protect settings
      if (id === 'settings') {
        return isMasterAdmin;
      }

      // Always accessible for everyone
      if (id === 'dashboard' || id === 'myprofile' || id === 'leave' || id === 'payroll' || id === 'cash_requests' || id === 'mail') return true;
      
      if (isMasterAdmin) return true;

      // Regular members cannot see anything else
      if (!session.isAdmin) return false;
      
      // Staff Admins must have the specific permission for other areas
      if (session.permissions && session.permissions.length > 0) {
        return session.permissions.includes(id);
      }
      
      // If an admin has no permissions defined, they get nothing else
      return false;
    };

    if (!hasAccess(route)) return <Dashboard session={session} data={appData} onRefresh={refreshData} />;

    switch (route) {
      case 'dashboard': return <Dashboard session={session} data={appData} onRefresh={refreshData} />;
      case 'staff': return <StaffManagement session={session} data={appData} onRefresh={refreshData} />;
      case 'attendance': return <AttendanceView session={session} data={appData} onRefresh={refreshData} />;
      case 'leave': return <LeaveManagement session={session} data={appData} onRefresh={refreshData} />;
      case 'payroll': return <Payroll session={session} data={appData} onRefresh={refreshData} />;
      case 'cash_requests': return <CashRequests session={session} data={appData} />;
      case 'mail': return <InternalMail session={session} data={appData} />;
      case 'myprofile': return <MyProfile session={session} data={appData} onRefresh={refreshData} />;
      case 'settings': return <Settings session={session} data={appData} onRefresh={refreshData} />;
      case 'audit': return <AuditLogs session={session} data={appData} />;
      default: return <Dashboard session={session} data={appData} onRefresh={refreshData} />;
    }
  };

  const getPageTitle = () => {
    switch (route) {
      case 'dashboard': return 'Dashboard';
      case 'staff': return 'Staff Management';
      case 'attendance': return 'Attendance Tracking';
      case 'leave': return 'Leave Management';
      case 'payroll': return 'Payroll & Advances';
      case 'cash_requests': return 'Cash Requests';
      case 'mail': return 'Internal Mail';
      case 'myprofile': return 'My Profile';
      case 'settings': return 'Control Panel';
      case 'audit': return 'Audit Logs';
      default: return 'Dashboard';
    }
  };

  const theme = appData.settings.theme;
  const primaryColor = theme?.primary || '#2563eb';
  const accentColor = theme?.accent || '#e5e7eb';
  const bgColor = theme?.background || '#f3f4f6';
  const secondaryColor = theme?.secondary || '#10b981';
  const textPrimary = theme?.textPrimary || '#111827';
  const textSecondary = theme?.textSecondary || '#6b7280';
  const blobs = appData.settings.backgroundBlobs || { enabled: true, blur: 150, opacity: 5 };

  return (
    <div className="app-container bg-bg-primary relative overflow-hidden">
      {/* Background Decorative Blobs */}
      {blobs.enabled && (
        <>
          <div 
            className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-accent rounded-full pointer-events-none z-0 transition-all duration-1000" 
            style={{ filter: `blur(${blobs.blur}px)`, opacity: blobs.opacity / 100 }}
          />
          <div 
            className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary rounded-full pointer-events-none z-0 transition-all duration-1000" 
            style={{ filter: `blur(${blobs.blur}px)`, opacity: blobs.opacity / 100 }}
          />
          <div 
            className="fixed top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-400 rounded-full pointer-events-none z-0 transition-all duration-1000" 
            style={{ filter: `blur(${blobs.blur * 0.8}px)`, opacity: blobs.opacity / 100 }}
          />
        </>
      )}

      <style>
        {`
          :root {
            --color-brand-accent: ${primaryColor};
            --color-brand-secondary: ${secondaryColor};
            --color-border-accent: ${accentColor};
            --color-bg-primary: ${bgColor};
            --color-bg-secondary: #ffffff;
            --color-text-primary: ${textPrimary};
            --color-text-secondary: ${textSecondary};
          }
        `}
      </style>
      <Sidebar 
        session={session} 
        data={appData}
        activeRoute={route} 
        onNavigate={(r) => {
          setRoute(r);
          setIsSidebarOpen(false);
        }} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="main-content">
        <header className="px-6 md:px-12 py-6 md:py-8 flex justify-between items-center border-b border-border-accent bg-white/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-text-secondary hover:text-brand-accent transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl md:text-3xl font-bold text-text-primary tracking-tight">{getPageTitle()}</h1>
          </div>
          <div className="hidden md:flex text-xs font-bold text-text-secondary items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-border-accent">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="uppercase tracking-widest">{currentTime.toLocaleDateString('en-GB')}</span>
            <span className="text-brand-accent">|</span>
            <span className="font-mono">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </header>

        <div className="px-6 md:px-12 pb-12 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
