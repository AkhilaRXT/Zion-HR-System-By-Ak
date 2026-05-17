import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DataStore, STORAGE_KEY, getLocalIsoDate } from './lib/dataStore';
import { Session, AppData, Employee, Attendance, LeaveRequest, AdvanceRequest, Target, AuditLog, AppSettings, CashRequest, UserCredential, AdhocBonus } from './types';
import { db, auth } from './lib/firebase';
import { collection, onSnapshot, doc, query, limit, orderBy, where, QuerySnapshot, DocumentData } from 'firebase/firestore';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StaffManagement from './components/StaffManagement';
import TargetManagement from './components/TargetManagement';
import AnnouncementManagement from './components/AnnouncementManagement';
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
import BranchManagement from './components/BranchManagement';
import HolidayCalendar from './components/HolidayCalendar';
import DataMigration from './components/DataMigration';
import { Clock, Menu, Loader2 } from 'lucide-react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const routePattern = location.pathname.replace(/^\//, '').replace(/-/g, '_').toLowerCase();
  const route = routePattern === 'login' || !routePattern ? 'dashboard' : routePattern;

  const [session, setSession] = useState<Session | null>(DataStore.getSession());
  const [currentTime, setCurrentTime] = useState(new Date());

  const [appData, setAppData] = useState<AppData>(() => DataStore.getData());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSettingsReady, setIsSettingsReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    DataStore.saveData(appData);
  }, [appData]);

  // URL Sync Effects
  useEffect(() => {
    if (!session && !isLoading && location.pathname.toLowerCase() !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [session, isLoading, location.pathname, navigate]);

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

  const pendingUpdate = useRef<Partial<AppData>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePart = (part: Partial<AppData>) => {
    Object.assign(pendingUpdate.current, part);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const updates = pendingUpdate.current;
      pendingUpdate.current = {};
      setAppData(prev => ({ ...prev, ...updates }));
    }, 30);
  };

  useEffect(() => {
    DataStore.init();

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthReady(true);
      } else if (DataStore.getSession()) {
        // If there's a custom session but firebase auth lost its anonymous state, restore it.
        DataStore.ensureAuth()
          .then(() => setIsAuthReady(true))
          .catch(() => {
            DataStore.logout();
            window.location.reload();
          });
      } else {
        setIsAuthReady(true);
      }
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
      if (err.message.toLocaleLowerCase().includes('quota')) setDbError('Firebase Daily Quota Exceeded. Some data may not load until tomorrow (or maybe Firebase takes time to update after Blaze upgrade).');
      else setDbError('Database Connection Error (' + err.message + ')');
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
        setDbError('Firebase App is experiencing limits or upgrading taking effect.');
      } else if (msg.toLowerCase().includes('permission-denied') || msg.toLowerCase().includes('insufficient permissions')) {
        setDbError(`Permission Denied for ${name}. Your database rules may be out of date.`);
      } else {
        setDbError(`Sync error (${name}): ${msg}`);
      }
    };

    // All users need the public directory
    const unsubDir = onSnapshot(query(collection(db, 'directory'), limit(1000)), (snap) => {
      updatePart({ directory: snap.docs.map(d => d.data() as any) });
    }, (err) => handleErr('directory', err));
    unsubs.push(unsubDir);

    if (session.isAdmin) {
      // ADMIN: Core data (Employees & Paid Deductions logic)
      const unsubEmployees = onSnapshot(query(collection(db, 'employees'), limit(1000)), (snap) => {
        updatePart({ employees: snap.docs.map(d => ({ ...d.data(), id: d.id }) as Employee) });
      }, (err) => handleErr('employees', err));
      unsubs.push(unsubEmployees);

      // Core Request Collections - These are relatively small, needed in multiple views
      // Syncing them once here avoids re-syncing on every page change
      const syncCoreCollection = (name: string, key: string) => {
        let qRef = query(collection(db, name), limit(150));
        if (['leaves', 'advances', 'cashRequests', 'targets'].includes(name)) {
          qRef = query(collection(db, name), orderBy('id', 'desc'), limit(150));
        } else if (['adhocBonuses', 'dcCollections', 'systemReports'].includes(name)) {
          qRef = query(collection(db, name), orderBy('timestamp', 'desc'), limit(150));
        }
        return onSnapshot(qRef, (snap) => {
          updatePart({ [key]: snap.docs.map(d => ({ ...d.data(), id: d.id })) });
        }, (err) => handleErr(name, err));
      };

      unsubs.push(syncCoreCollection('branches', 'branches'));
      unsubs.push(syncCoreCollection('holidays', 'holidays'));
      unsubs.push(syncCoreCollection('targets', 'targets'));
      unsubs.push(syncCoreCollection('announcements', 'announcements'));

      if (session.email === "zioncommercialcreditampara@gmail.com") {
        unsubs.push(syncCoreCollection('systemReports', 'systemReports'));
      }

      const unsubPaid = onSnapshot(query(collection(db, 'paidDeductions'), limit(2000)), (snap) => {
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
      let myProfile: Employee | null = null;
      let branchStaff: Employee[] = [];
      const updateCombinedEmployees = () => {
        const combined = new Map<string, Employee>();
        if (myProfile) combined.set(myProfile.id, myProfile);
        branchStaff.forEach(emp => combined.set(emp.id, emp));
        updatePart({ employees: Array.from(combined.values()) });
      };

      // EMPLOYEE: Their own record & related data
      const unsubMe = onSnapshot(doc(db, 'employees', session.empId), (snap) => {
        if (snap.exists()) {
          myProfile = { ...snap.data(), id: snap.id } as Employee;
          updateCombinedEmployees();
        }
      }, (err) => handleErr('my_profile', err));
      unsubs.push(unsubMe);

      // Branch Manager check dependencies - non-admins need branches
      const syncCoreCollectionForEmployee = (name: string, key: string) => {
        const q = query(collection(db, name), limit(1000));
        return onSnapshot(q, (snap) => {
          updatePart({ [key]: snap.docs.map(d => ({ ...d.data(), id: d.id })) });
        }, (err) => handleErr(name, err));
      };
      unsubs.push(syncCoreCollectionForEmployee('branches', 'branches'));
      unsubs.push(syncCoreCollectionForEmployee('holidays', 'holidays'));
      unsubs.push(syncCoreCollectionForEmployee('announcements', 'announcements'));

      // If they are a branch manager, fetch their staff
      if (session.viewableBranches && session.viewableBranches.length > 0) {
        const branches = session.viewableBranches.slice(0, 10);
        const qEmp = query(collection(db, 'employees'), where('branch', 'in', branches));
        unsubs.push(onSnapshot(qEmp, (snap) => {
          branchStaff = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Employee);
          updateCombinedEmployees();
        }, (err) => handleErr('managed_employees', err)));
      }

      // Employee's own collections
      const syncOwn = (coll: string, key: string) => {
        let q = query(collection(db, coll), where('empId', '==', session.empId));
        return onSnapshot(q, (snap) => {
          updatePart({ [key]: snap.docs.map(d => ({ ...d.data(), id: d.id })) });
        }, (err) => handleErr(`own_${coll}`, err));
      };
      
      unsubs.push(syncOwn('leaves', 'leaves'));
      unsubs.push(syncOwn('advances', 'advances'));
      unsubs.push(syncOwn('cashRequests', 'cashRequests'));
      unsubs.push(syncOwn('attendance', 'attendance'));
      unsubs.push(syncOwn('adhocBonuses', 'adhocBonuses'));
      unsubs.push(syncOwn('targets', 'targets'));
      
      if (session.viewableBranches && session.viewableBranches.length > 0) {
        const branches = session.viewableBranches.slice(0, 10);
        const qDcC = query(collection(db, 'dcCollections'), where('branch', 'in', branches), limit(1000));
        unsubs.push(onSnapshot(qDcC, (snap) => {
          updatePart({ dcCollections: snap.docs.map(d => ({ ...d.data(), id: d.id } as any)) });
        }, (err) => handleErr('dcCollections_bm', err)));
      } else {
        unsubs.push(syncOwn('dcCollections', 'dcCollections'));
      }
      
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
        const todayStr = getLocalIsoDate();
        
        const qAttendance = query(collection(db, 'attendance'), where('date', '==', todayStr), limit(500));
        unsubs.push(onSnapshot(qAttendance, (snap) => updatePart({ attendance: snap.docs.map(d => ({ ...d.data(), id: d.id }) as any) }), (err) => console.log('Stat sync skipped:', err)));

        if (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('leave')) {
            const qLeaves = query(collection(db, 'leaves'), where('status', '==', 'Pending'));
            unsubs.push(onSnapshot(qLeaves, (snap) => updatePart({ leaves: snap.docs.map(d => ({ ...d.data(), id: d.id }) as any) }), (err) => console.log('Stat sync skipped leaves:', err)));
        }

        if (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('payroll')) {
            const qAdvances = query(collection(db, 'advances'), where('status', '==', 'Pending'));
            unsubs.push(onSnapshot(qAdvances, (snap) => updatePart({ advances: snap.docs.map(d => ({ ...d.data(), id: d.id }) as any) }), (err) => console.log('Stat sync skipped advances:', err)));
        }

        if (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('cash_requests')) {
            const qCash = query(collection(db, 'cashRequests'), where('status', '==', 'Pending'));
            unsubs.push(onSnapshot(qCash, (snap) => updatePart({ cashRequests: snap.docs.map(d => ({ ...d.data(), id: d.id }) as any) }), (err) => console.log('Stat sync skipped cash:', err)));
        }
     }
     
     return () => unsubs.forEach(u => u());
  }, [session, isAuthReady, route]);

  // 4. Route-Specific Admin Sync - Fetches only what's needed for the active view
  useEffect(() => {
    const isBranchManager = session?.viewableBranches && session.viewableBranches.length > 0;
    if ((!session?.isAdmin && !isBranchManager) || !isAuthReady) return;
    if (route === 'dashboard' && !isBranchManager) return; // Admins handled by dashboard effect. Managers don't trigger dashboard effect, so we shouldn't skip for them if they need it.

    const unsubs: (() => void)[] = [];
    const handleErr = (name: string, err: any) => {
      console.warn(`Route sync failed for ${name}:`, err);
    };

    const syncRouteCollection = (coll: string, key: string, qRef?: any) => {
      const ref = qRef || query(collection(db, coll), limit(1000));
      const unsub = onSnapshot(ref, (snapshot) => {
        updatePart({ [key]: snapshot.docs.map(d => ({ ...d.data(), id: d.id })) });
      }, (err) => handleErr(coll, err));
      unsubs.push(unsub);
    };

    if (route === 'attendance') {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 30); // Show 30 days of history
      const monthAgoStr = getLocalIsoDate(monthAgo);

      const fullAttQuery = query(collection(db, 'attendance'), where('date', '>=', monthAgoStr), orderBy('date', 'desc'), limit(1500));
      syncRouteCollection('attendance', 'attendance', fullAttQuery);
    }

    if (route === 'dashboard' && isBranchManager) {
      const todayStr = getLocalIsoDate();
      const todayAttQuery = query(collection(db, 'attendance'), where('date', '==', todayStr), limit(200));
      syncRouteCollection('attendance', 'attendance', todayAttQuery);
    }

    if (!session?.isAdmin) return; // Following collections are STRICTLY for Admins

    if (route === 'leave') syncRouteCollection('leaves', 'leaves');
    if (route === 'advances') syncRouteCollection('advances', 'advances');
    if (route === 'payroll') syncRouteCollection('customNets', 'customNets');
    if (route === 'targets') syncRouteCollection('targets', 'targets');
    if (route === 'dc_collection') syncRouteCollection('dcCollections', 'dcCollections');

    if (route === 'cash_requests') {
      const q = query(collection(db, 'cashRequests'), orderBy('id', 'desc'), limit(500));
      syncRouteCollection('cashRequests', 'cashRequests', q);
    }

    if (route === 'payroll') {
      const receiptQuery = query(collection(db, 'payrollReceipts'), orderBy('timestamp', 'desc'), limit(150));
      syncRouteCollection('payrollReceipts', 'payrollReceipts', receiptQuery);
      
      const bonusQuery = query(collection(db, 'adhocBonuses'), orderBy('timestamp', 'desc'), limit(500));
      syncRouteCollection('adhocBonuses', 'adhocBonuses', bonusQuery);
    }

    if (route === 'staff') {
      syncRouteCollection('credentials', 'credentials');
    }

    if (route === 'audit') {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(150));
      syncRouteCollection('auditLogs', 'auditLogs', q);
    }

    return () => unsubs.forEach(u => u());
  }, [session, route, isAuthReady]);

  // Loader lifecycle
  useEffect(() => {
    if (isAuthReady && isSettingsReady) {
      setIsLoading(false);
    }
  }, [isAuthReady, isSettingsReady]);

  const refreshData = () => {
    window.location.reload();
  };

  const handleLogin = (newSession: Session) => {
    DataStore.setSession(newSession);
    setSession(newSession);
    navigate('/dashboard');
  };

  useEffect(() => {
    // Audit logging for mere page views has been removed to conserve Firebase Write quota
    // DataStore.logAction('Page View', `User viewed ${getPageTitle()}`, 'Auth');
  }, [route]);

  const handleLogout = () => {
    DataStore.logout();
    setSession(null);
  };

  if (isLoading) {
    return (
      <div className="app-container bg-bg-primary relative overflow-hidden flex h-screen">
        <aside className="w-[280px] bg-white/60 backdrop-blur-xl border-r border-border-accent p-8 hidden md:block h-full z-50">
           <div className="w-10 h-10 bg-gray-200 animate-pulse rounded-lg mb-4" />
           <div className="w-3/4 h-6 bg-gray-200 animate-pulse rounded mb-1" />
           <div className="w-1/2 h-4 bg-gray-200 animate-pulse rounded mb-12" />
           <div className="space-y-4">
             {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="w-full h-10 bg-gray-200 animate-pulse rounded-lg" />
             ))}
           </div>
        </aside>
        <main className="main-content flex-1 flex flex-col h-full w-full">
           <header className="px-6 md:px-12 py-6 md:py-8 border-b border-border-accent bg-white/50 flex justify-between items-center">
              <div className="w-48 h-8 bg-gray-200 animate-pulse rounded" />
              <div className="w-32 h-8 bg-gray-200 animate-pulse rounded-full hidden md:block" />
           </header>
           <div className="p-6 md:p-12 flex-1">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-32 bg-white/50 border border-border-accent animate-pulse rounded-2xl" />
               ))}
             </div>
             <div className="h-96 w-full bg-white/50 border border-border-accent animate-pulse rounded-2xl" />
           </div>
        </main>
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
      if (id === 'dashboard' || id === 'myprofile' || id === 'leave' || id === 'payroll' || id === 'advances' || id === 'cash_requests' || id === 'mail' || id === 'dc_collection' || id === 'reports' || id === 'holidays') return true;
      
      if (isMasterAdmin) return true;

      // Branch Managers can access Attendance
      if (id === 'attendance') {
        const managedBranches = (appData.branches || []).filter(b => b.managerId === session.empId);
        if (managedBranches.length > 0) return true;
      }

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
      case 'performance': return <TargetManagement session={session} data={appData} />;
      case 'announcements': return <AnnouncementManagement session={session} data={appData} />;
      case 'holidays': return <HolidayCalendar session={session} data={appData} onRefresh={refreshData} />;
      case 'mail': return <InternalMail session={session} data={appData} />;
      case 'dc_collection': return <DCCollection session={session} data={appData} />;
      case 'reports': return <ReportCenter session={session} data={appData} />;
      case 'branches': return <BranchManagement data={appData} onRefresh={refreshData} />;
      case 'migration': return <DataMigration session={session} />;
      case 'myprofile': return <MyProfile session={session} data={appData} onRefresh={refreshData} />;
      case 'settings': return <Settings session={session} data={appData} onRefresh={refreshData} />;
      case 'audit': return <AuditLogs session={session} data={appData} />;
      default: return <Dashboard session={session} data={appData} onRefresh={refreshData} />;
    }
  };

  function getPageTitle() {
    switch (route) {
      case 'dashboard': return 'Dashboard';
      case 'staff': return 'Staff Management';
      case 'attendance': return 'Attendance Tracking';
      case 'leave': return 'Leave Management';
      case 'payroll': return 'Payroll Management';
      case 'advances': return session.isAdmin ? 'Advance Management' : 'Salary Advances';
      case 'cash_requests': return 'Cash Requests';
      case 'performance': return 'Performance & Targets';
      case 'announcements': return 'Announcement Management';
      case 'holidays': return 'Holiday Calendar';
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
