import React, { useState, useEffect } from 'react';
import { DataStore } from './lib/dataStore';
import { Session, AppData, Employee, Attendance, LeaveRequest, AdvanceRequest, Target, AuditLog, AppSettings } from './types';
import { db, auth } from './lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StaffManagement from './components/StaffManagement';
import AttendanceView from './components/Attendance';
import LeaveManagement from './components/LeaveManagement';
import Payroll from './components/Payroll';
import Settings from './components/Settings';
import MyProfile from './components/MyProfile';
import AuditLogs from './components/AuditLogs';
import { Clock, Menu, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [route, setRoute] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [appData, setAppData] = useState<AppData>(DataStore.getData());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    DataStore.init();
    const existing = DataStore.getSession();
    if (existing) setSession(existing);

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user && user.email === "zioncommercialcreditampara@gmail.com") {
        const current = DataStore.getSession();
        if (current && !current.email) {
          const updated = { ...current, email: user.email };
          DataStore.setSession(updated);
          setSession(updated);
        }
      }
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];
    
    const updatePart = (part: Partial<AppData>) => {
      setAppData(prev => ({ ...prev, ...part }));
    };

    // If admin, listen to everything. If employee, listen to restricted set.
    // For now, we'll try to listen to all, but we need to handle permission errors gracefully.
    const syncCollection = (name: string, setter: (data: any[]) => void) => {
      try {
        const unsub = onSnapshot(collection(db, name), (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ ...doc.data() }));
          setter(docs);
        }, (error) => {
          console.warn(`Permission denied for collection ${name}. This is expected for non-admin users.`);
        });
        unsubscribers.push(unsub);
      } catch (err) {
        console.error(`Error setting up listener for ${name}:`, err);
      }
    };

    if (session.isAdmin) {
      syncCollection('employees', (docs) => updatePart({ employees: docs as Employee[] }));
      syncCollection('attendance', (docs) => updatePart({ attendance: docs as Attendance[] }));
      syncCollection('leaves', (docs) => updatePart({ leaves: docs as LeaveRequest[] }));
      syncCollection('advances', (docs) => updatePart({ advances: docs as AdvanceRequest[] }));
      syncCollection('targets', (docs) => updatePart({ targets: docs as Target[] }));
      syncCollection('auditLogs', (docs) => updatePart({ auditLogs: (docs as AuditLog[]).sort((a, b) => b.id - a.id) }));
      
      const unsubPaid = onSnapshot(collection(db, 'paidDeductions'), (snap) => {
        const paid: { [key: string]: string[] } = {};
        snap.docs.forEach(d => { paid[d.id] = d.data().months || []; });
        updatePart({ paidDeductions: paid });
      }, (err) => console.warn('Permission denied for paidDeductions'));
      unsubscribers.push(unsubPaid);
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

        // Sync their own attendance
        const attendanceQuery = query(collection(db, 'attendance'), where('empId', '==', session.empId));
        const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
          const docs = snap.docs.map(d => d.data() as Attendance);
          updatePart({ attendance: docs });
        }, (err) => console.warn('Permission denied for attendance'));
        unsubscribers.push(unsubAttendance);
      });
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        updatePart({ settings: snap.data() as AppSettings });
      }
    }, (err) => console.warn('Permission denied for settings'));
    unsubscribers.push(unsubSettings);

    // Initial loading check
    const loadTimer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(loadTimer);
    };
  }, [session]);

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
      <div className="fixed inset-0 bg-bg-primary flex flex-col items-center justify-center gap-6 z-[300]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-brand-accent/20 rounded-full" />
          <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-text-primary font-serif text-xl tracking-[4px] uppercase">Nexus HR</h2>
          <p className="text-text-secondary text-[10px] uppercase tracking-[2px]">Synchronizing with Cloud...</p>
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
      // Always accessible for everyone
      if (id === 'dashboard' || id === 'myprofile' || id === 'leave' || id === 'payroll') return true;
      
      // Master Admin (Google Login) gets everything
      const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
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
      case 'myprofile': return 'My Profile';
      case 'settings': return 'Control Panel';
      case 'audit': return 'Audit Logs';
      default: return 'Dashboard';
    }
  };

  const theme = appData.settings.theme;
  const primaryColor = theme?.primary || '#6366f1';
  const accentColor = theme?.accent || '#818cf8';
  const bgColor = theme?.background || '#0f172a';
  const secondaryColor = theme?.secondary || '#10b981';
  const textPrimary = theme?.textPrimary || '#f8fafc';
  const textSecondary = theme?.textSecondary || '#94a3b8';

  return (
    <div className="app-container bg-bg-primary">
      <style>
        {`
          :root {
            --brand-accent: ${primaryColor};
            --brand-secondary: ${secondaryColor};
            --border-accent: ${accentColor}4d;
            --bg-primary: ${bgColor};
            --bg-secondary: ${bgColor}ee;
            --text-primary: ${textPrimary};
            --text-secondary: ${textSecondary};
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
        <header className="px-6 md:px-12 py-6 md:py-10 flex justify-between items-center border-b border-border-accent mb-8 md:mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-text-secondary hover:text-brand-accent"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-serif text-2xl md:text-5xl font-normal text-text-primary">{getPageTitle()}</h1>
          </div>
          <div className="hidden md:flex text-[11px] text-text-secondary uppercase tracking-[3px] items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {currentTime.toLocaleDateString('en-GB')} &bull; {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </header>

        <div className="px-6 md:px-12 pb-12">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
