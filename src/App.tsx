import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DataStore, STORAGE_KEY } from './lib/dataStore';
import { Session, AppData, Employee, Attendance, LeaveRequest, AdvanceRequest, Target, AuditLog, AppSettings, CashRequest, UserCredential, AdhocBonus } from './types';
import { db, auth } from './lib/firebase';
import { collection, onSnapshot, doc, query, limit, orderBy, where, QuerySnapshot, DocumentData } from 'firebase/firestore';
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
import SalaryAdvances from './components/SalaryAdvances';
import DCCollection from './components/DCCollection';
import ReportCenter from './components/ReportCenter';
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
  const [dbError, setDbError] = useState<string | null>(null);

  // Safety fallback for all loading states
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('Loading fallback triggered after 4s. Database may be unresponsive.');
        setIsLoading(false);
        setIsAuthReady(true);
        setIsSettingsReady(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // --- DATA SYNCHRONIZATION ---

  const updatePart = (part: Partial<AppData>) => {
    setAppData(prev => ({ ...prev, ...part }));
  };

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

  // 1. Core Config Sync (Settings) - Active as long as app is mounted
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const newSettings = snap.data() as AppSettings;
        setAppData(prev => ({ ...prev, settings: newSettings }));
        setIsSettingsReady(true);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const localData = raw ? JSON.parse(raw) : DataStore.getData();
          localData.settings = newSettings;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
        } catch (e) {}
      } else {
        setIsSettingsReady(true);
      }
    }, (err) => {
      console.warn('Permission denied or error fetching settings:', err);
      if (err.message.toLocaleLowerCase().includes('quota')) setDbError('Firebase Daily Quota Exceeded. Some data may not load until tomorrow.');
      setIsSettingsReady(true);
    });
    return () => unsubSettings();
  }, []);

  // 2. Core Session/Profile Sync - Active when logged in (Stable data)
  useEffect(() => {
    if (!session || !isAuthReady) return;
    
    const unsubs: (() => void)[] = [];
    const handleErr = (name: string, err: any) => {
      console.warn(`Error in ${name}:`, err);
      const msg = err.message || String(err);
      if (msg.toLowerCase().includes('quota')) {
        setDbError('Firebase Daily quota exceeded. Try again tomorrow or enable billing.');
      } else if (msg.toLowerCase().includes('permission-denied')) {
        setDbError(`Permission Denied for ${name}. Ensure your account has correct roles.`);
      } else {
        setDbError(`Sync error (${name}): ${msg}`);
      }
    };

    // All users need the public directory
    const unsubDir = onSnapshot(collection(db, 'directory'), (snap) => {
      updatePart({ directory: snap.docs.map(d => d.data() as any) });
    }, (err) => handleErr('directory', err));
    unsubs.push(unsubDir);

    if (session.isAdmin) {
      // ADMIN: Core data (Employees & Paid Deductions logic)
      const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
        updatePart({ employees: snap.docs.map(d => ({ ...d.data(), id: d.id }) as Employee) });
      }, (err) => handleErr('employees', err));
      unsubs.push(unsubEmployees);

      // Core Request Collections - These are relatively small, needed in multiple views
      // Syncing them once here avoids re-syncing on every page change
      const syncCoreCollection = (name: string, key: string) => {
        return onSnapshot(collection(db, name), (snap) => {
          updatePart({ [key]: snap.docs.map(d => ({ ...d.data(), id: d.id })) });
        }, (err) => handleErr(name, err));
      };

      unsubs.push(syncCoreCollection('leaves', 'leaves'));
      unsubs.push(syncCoreCollection('advances', 'advances'));
      unsubs.push(syncCoreCollection('cashRequests', 'cashRequests'));
      unsubs.push(syncCoreCollection('adhocBonuses', 'adhocBonuses'));
      unsubs.push(syncCoreCollection('targets', 'targets'));
      unsubs.push(syncCoreCollection('dcCollections', 'dcCollections'));

      if (session.email === "zioncommercialcreditampara@gmail.com") {
        unsubs.push(syncCoreCollection('systemReports', 'systemReports'));
      }

      const unsubPaid = onSnapshot(collection(db, 'paidDeductions'), (snap) => {
        const paid: { [key: string]: string[] } = {};
        const paidAmts: { [empId: string]: { [month: string]: number } } = {};
        const paidNts: { [empId: string]: { [month: string]: string } } = {};
        const paidCmps: { [empId: string]: { [month: string]: string[] } } = {};
        snap.docs.forEach(d => { 
          const data = d.data();
          paid[d.id] = data.months || []; 
          paidAmts[d.id] = data.paidAmounts || {};
          paidNts[d.id] = data.paidNotes || {};
          paidCmps[d.id] = data.paidComponents || {};
        });
        updatePart({ paidDeductions: paid, paidSalaryAmounts: paidAmts, paidSalaryNotes: paidNts, paidComponents: paidCmps });
      }, (err) => handleErr('paidDeductions', err));
      unsubs.push(unsubPaid);

    } else {
      // EMPLOYEE: Their own record & related data
      const unsubMe = onSnapshot(doc(db, 'employees', session.empId), (snap) => {
        if (snap.exists()) updatePart({ employees: [snap.data() as Employee] });
      }, (err) => handleErr('my_profile', err));
      unsubs.push(unsubMe);

      // Employee's own collections
      const syncOwn = (coll: string, key: string) => {
        const q = query(collection(db, coll), where('empId', '==', session.empId));
        return onSnapshot(q, (snap) => {
          updatePart({ [key]: snap.docs.map(d => ({ ...d.data(), id: d.id })) });
        }, (err) => handleErr(`own_${coll}`, err));
      };
      
      unsubs.push(syncOwn('leaves', 'leaves'));
      unsubs.push(syncOwn('advances', 'advances'));
      unsubs.push(syncOwn('cashRequests', 'cashRequests'));
      unsubs.push(syncOwn('attendance', 'attendance'));
      unsubs.push(syncOwn('adhocBonuses', 'adhocBonuses'));
      unsubs.push(syncOwn('dcCollections', 'dcCollections'));
      
      const unsubPaidOwn = onSnapshot(doc(db, 'paidDeductions', session.empId), (snap) => {
        if (snap.exists()) {
          const d = snap;
          const data = d.data();
          const paid: { [key: string]: string[] } = { [d.id]: data?.months || [] };
          const paidAmts: { [key: string]: any } = { [d.id]: data?.paidAmounts || {} };
          const paidNts: { [key: string]: any } = { [d.id]: data?.paidNotes || {} };
          const paidCmps: { [key: string]: any } = { [d.id]: data?.paidComponents || {} };
          updatePart({ paidDeductions: paid, paidSalaryAmounts: paidAmts, paidSalaryNotes: paidNts, paidComponents: paidCmps });
        }
      }, (err) => handleErr('own_paid_deductions', err));
      unsubs.push(unsubPaidOwn);
    }

    return () => unsubs.forEach(u => u());
  }, [session, isAuthReady]); 

  // 3. Dashboards / Quick-View Stats - Fetches small window of data
  useEffect(() => {
     if (!session?.isAdmin || !isAuthReady) return;
     const unsubs: (() => void)[] = [];
     
     // Only if on dashboard, get recent stuff for stats
     if (route === 'dashboard') {
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        
        const qAttendance = query(collection(db, 'attendance'), where('date', '>=', weekAgoStr), orderBy('date', 'desc'), limit(500));
        unsubs.push(onSnapshot(qAttendance, (snap) => updatePart({ attendance: snap.docs.map(d => ({ ...d.data(), id: d.id }) as any) }), (err) => console.log('Stat sync skipped:', err)));
     }
     
     return () => unsubs.forEach(u => u());
  }, [session, isAuthReady, route]);

  // 4. Route-Specific Admin Sync - Fetches only what's needed for the active view
  useEffect(() => {
    if (!session?.isAdmin || !isAuthReady) return;
    if (route === 'dashboard') return; // Handled by dashboard effect
    
    const unsubs: (() => void)[] = [];
    const handleErr = (name: string, err: any) => {
      console.warn(`Route sync failed for ${name}:`, err);
      setDbError(`Route Sync Error (${name}): ${err.message || String(err)}`);
    };

    const syncRouteCollection = (coll: string, key: string, qRef?: any) => {
      const ref = qRef || collection(db, coll);
      const unsub = onSnapshot(ref, (snapshot) => {
        updatePart({ [key]: snapshot.docs.map(d => ({ ...d.data(), id: d.id })) });
      }, (err) => handleErr(coll, err));
      unsubs.push(unsub);
    };

    if (route === 'attendance') {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 60); // Show 60 days of history
      const monthAgoStr = monthAgo.toISOString().split('T')[0];

      const fullAttQuery = query(collection(db, 'attendance'), where('date', '>=', monthAgoStr), orderBy('date', 'desc'), limit(2000));
      syncRouteCollection('attendance', 'attendance', fullAttQuery);
    }

    // Note: leaves, advances, cashRequests, adhocBonuses are now in core sync (Effect 2)
    // for admins to prevent flashing when navigating.

    if (route === 'payroll') {
      const receiptQuery = query(collection(db, 'payrollReceipts'), orderBy('timestamp', 'desc'), limit(100));
      syncRouteCollection('payrollReceipts', 'payrollReceipts', receiptQuery);
    }

    if (route === 'staff') {
      syncRouteCollection('credentials', 'credentials');
    }

    if (route === 'audit') {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(150));
      syncRouteCollection('auditLogs', 'auditLogs', q);
    }

    if (route === 'mail') {
      const q = query(collection(db, 'messages'), where('participants', 'array-contains', session.empId), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }) as any);
        docs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        updatePart({ internalMessages: docs });
      }, (err) => handleErr('messages', err));
      unsubs.push(unsub);
    }

    return () => unsubs.forEach(u => u());
  }, [session, route, isAuthReady]);

  // Loader lifecycle
  useEffect(() => {
    if (session && isAuthReady && isSettingsReady) {
      const timer = setTimeout(() => setIsLoading(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [session, isAuthReady, isSettingsReady]);

  const refreshData = () => {
    window.location.reload();
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
          <h2 className="text-text-primary font-serif text-3xl font-bold">{appData.settings?.companyName || 'Zion HR'}</h2>
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
      if (id === 'dashboard' || id === 'myprofile' || id === 'leave' || id === 'payroll' || id === 'advances' || id === 'cash_requests' || id === 'mail' || id === 'dc_collection' || id === 'reports') return true;
      
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
      case 'advances': return <SalaryAdvances session={session} data={appData} onRefresh={refreshData} />;
      case 'cash_requests': return <CashRequests session={session} data={appData} />;
      case 'mail': return <InternalMail session={session} data={appData} />;
      case 'dc_collection': return <DCCollection session={session} data={appData} />;
      case 'reports': return <ReportCenter session={session} data={appData} />;
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
      case 'payroll': return 'Payroll Management';
      case 'advances': return session.isAdmin ? 'Advance Management' : 'Salary Advances';
      case 'cash_requests': return 'Cash Requests';
      case 'mail': return 'Internal Mail';
      case 'dc_collection': return 'DC Collection';
      case 'reports': return 'Report Center';
      case 'myprofile': return 'My Profile';
      case 'settings': return 'Control Panel';
      case 'audit': return 'Audit Logs';
      default: return 'Dashboard';
    }
  };

  const theme = appData.settings?.theme;
  const primaryColor = theme?.primary || '#2563eb';
  const accentColor = theme?.accent || '#e5e7eb';
  const bgColor = theme?.background || '#f3f4f6';
  const secondaryColor = theme?.secondary || '#10b981';
  const textPrimary = theme?.textPrimary || '#111827';
  const textSecondary = theme?.textSecondary || '#6b7280';
  const blobs = appData.settings?.backgroundBlobs || { enabled: true, blur: 150, opacity: 5 };

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
        {dbError && (
          <div className="bg-red-500 text-white px-6 py-2 text-center text-xs font-bold animate-pulse sticky top-0 z-[100]">
            ⚠️ {dbError}
          </div>
        )}
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
