import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppData, Session, Attendance } from '../types';
import { DataStore, getLocalIsoDate } from '../lib/dataStore';
import { 
  Users, 
  CalendarDays, 
  MailWarning, 
  TrendingUp, 
  UserPlus, 
  LogIn, 
  LogOut,
  Edit3,
  HandCoins,
  X,
  Trash2,
  MapPin,
  Fingerprint,
  Wallet,
  Gift,
  Megaphone,
  Plus,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface DashboardProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
  dbErrors?: Record<string, string>;
}

export default function Dashboard({ session, data, onRefresh, dbErrors }: DashboardProps) {
  const navigate = useNavigate();
  const isAdmin = session.isAdmin;
  const today = getLocalIsoDate();
  const currentEmpId = session.empId;
  
  // Admin Stats
  const canSeeStaff = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('staff'));
  const isBranchManager = session.viewableBranches && session.viewableBranches.length > 0 && !session.email?.includes('zioncommercialcreditampara@gmail.com');
  const canSeeAttendance = (isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('attendance'))) || isBranchManager;
  const canSeeLeaves = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('leave'));
  const canSeeAdvances = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('payroll'));
  const canSeeCashRequests = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('cash_requests'));

  const viewableBranches = session.viewableBranches || [];
  const canViewEmployee = (empId: string) => {
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (isAdmin && (viewableBranches.length === 0 || viewableBranches.includes('ALL'))) return true;
    if (viewableBranches.includes('ALL')) return true;
    const emp = (data.employees || []).find(e => e.id === empId);
    return emp ? viewableBranches.includes(emp.branch) : false;
  };

  const activeStaff = (data.employees || []).filter(e => {
    if (e.status === 'Dormant' || e.id === 'EMP003') return false;
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (isAdmin && (viewableBranches.length === 0 || viewableBranches.includes('ALL'))) return true;
    if (viewableBranches.includes('ALL')) return true;
    // Branch Managers should only see their own branch staff
    if (isBranchManager && !isAdmin) return viewableBranches.includes(e.branch);
    // Standard members
    if (!isAdmin) return true; // Standard employees see company-wide active staff for Milestones etc.
    return viewableBranches.includes(e.branch);
  });
  
  const totalStaff = activeStaff.length;
  const activeStaffIds = new Set(activeStaff.map(e => e.id));

  const presentToday = (data.attendance || [])
      .filter(a => a.date === today && (a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day') && activeStaffIds.has(a.empId))
      .length;
      
  const uniqueDates = Array.from(new Set((data.attendance || []).map(a => a.date))).slice(0, 3).join(', ');

  const pendingLeavesCount = (data.leaves || []).filter(l => l.status === 'Pending' && activeStaffIds.has(l.empId)).length;
  const pendingAdvancesCount = (data.advances || []).filter(a => a.status === 'Pending' && activeStaffIds.has(a.empId)).length;
  const approvedAdvancesCount = (data.advances || []).filter(a => a.status === 'Approved' && activeStaffIds.has(a.empId)).length;
  const pendingCashRequestsCount = (data.cashRequests || []).filter(c => c.status === 'Pending' && activeStaffIds.has(c.empId)).length;

  // Member Stats
  const myAttendance = (data.ownAttendance || data.attendance || []).find(a => a.empId === currentEmpId && a.date === today);
  const isTodayHoliday = (data.holidays || []).some(h => h.date === today);
  const myPendingLeaves = (data.ownLeaves || data.leaves || []).filter(l => l.empId === currentEmpId && l.status === 'Pending').length;
  const myApprovedAdvances = (data.ownAdvances || data.advances || []).filter(a => a.empId === currentEmpId && a.status === 'Approved').length;
  
  const calculateDays = (from: string, to: string) => {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const myApprovedLeaves = (data.ownLeaves || data.leaves || []).filter(l => l.empId === currentEmpId && l.status === 'Approved');
  const myAnnualTaken = myApprovedLeaves.filter(l => l.type === 'Annual').reduce((acc, l) => acc + calculateDays(l.from, l.to), 0);
  const myBalance = (data.settings?.leavePolicy?.annualTotal || 0) - myAnnualTaken;

  const [selectedEmpId, setSelectedEmpId] = useState((data.employees || [])[0]?.id || '');
  const [empSearch, setEmpSearch] = useState('');

  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const currentMonth = new Date().getMonth();
  const milestones = activeStaff.filter(e => {
    if (!e.dateOfBirth && !e.joinDate) return false;
    let bMonth = -1, jMonth = -1;
    if (e.dateOfBirth) bMonth = new Date(e.dateOfBirth).getMonth();
    if (e.joinDate) jMonth = new Date(e.joinDate).getMonth();
    return bMonth === currentMonth || jMonth === currentMonth;
  });

  const recentAnnouncements = [...(data.announcements || [])]
    .filter(a => {
      const postDate = a.date ? new Date(a.date) : new Date();
      if (isNaN(postDate.getTime())) return true; // Show if date is invalid just in case
      const expirationDate = new Date(postDate);
      expirationDate.setDate(expirationDate.getDate() + (a.daysToStay || 7));
      return new Date() <= expirationDate;
    })
    .sort((a,b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  // Sync selection with search results
  useEffect(() => {
    const validStaff = (data.employees || []).filter(e => e.status !== 'Dormant' && e.id !== 'EMP003');
    const filtered = validStaff.filter(e => 
      e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
      e.id.toLowerCase().includes(empSearch.toLowerCase())
    );
    if (filtered.length > 0) {
      const isStillInList = filtered.some(e => e.id === selectedEmpId);
      if (!isStillInList) {
        setSelectedEmpId(filtered[0].id);
      }
    }
  }, [empSearch, data.employees, selectedEmpId]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleUpdateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAttendance) {
      try {
        await DataStore.updateAttendance(editingAttendance.id, editingAttendance);
        setEditingAttendance(null);
        showNotification('Attendance record updated.');
      } catch (err) {
        showNotification('Failed to update attendance.', 'error');
      }
    }
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteAttendance(confirmDelete);
        setConfirmDelete(null);
        showNotification('Attendance record deleted.');
      } catch (err) {
        showNotification('Failed to delete attendance.', 'error');
      }
    }
  };

  const getLocationInfo = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      const tryGetLocation = (highAccuracy: boolean, retriesLeft: number) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(`${position.coords.latitude},${position.coords.longitude}`);
          },
          (error) => {
            console.warn('Geolocation error:', error);
            if (error.code === error.TIMEOUT) {
              if (retriesLeft > 0) {
                console.warn(`Geolocation timeout (${highAccuracy ? 'High' : 'Low'} Accuracy). Retrying with low accuracy...`);
                tryGetLocation(false, retriesLeft - 1);
              } else {
                reject(new Error('The request to get user location timed out multiple times. Please move to an open area with better GPS signal or adjust your device location settings (Try opening Maps first).'));
              }
            } else {
              let errorMessage = 'Failed to get location. Please allow location access to continue.';
              if (error.code === error.PERMISSION_DENIED) {
                errorMessage = 'Location access denied. Please allow location access to check in/out.';
              } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = 'Location information is unavailable.';
              }
              reject(new Error(errorMessage));
            }
          },
          { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: highAccuracy ? 0 : 60000 }
        );
      };

      // Try High Accuracy first, allow 1 retry (which will drop to Low Accuracy)
      tryGetLocation(true, 1);
    });
  };

  const hasBiometricRegistered = (empId: string) => {
    const emp = data.employees?.find(e => e.id === empId);
    return !!(emp && emp.passkeyRawId);
  };

  const handleRegisterBiometrics = async () => {
    const empIdToUse = canSeeAttendance ? selectedEmpId : currentEmpId;

    if (hasBiometricRegistered(empIdToUse)) {
      showNotification('This employee already has a device registered. Please contact Master Admin to reset it.', 'warning');
      return;
    }

    if (!window.PublicKeyCredential) {
      showNotification('Biometrics not supported on this device/browser', 'error');
      return; 
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        showNotification('Fingerprint/Face authenticator not available', 'error');
        return;
      }
      
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Zion HR' },
          user: {
            id: userId,
            name: empIdToUse,
            displayName: 'Employee ' + empIdToUse
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;
        
      if (credential) {
        const bytes = new Uint8Array(credential.rawId);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const encoded = btoa(binary);
        await DataStore.updateEmployee(empIdToUse, { passkeyRawId: encoded });
        showNotification('Biometric registered successfully!', 'success');
        // Force a re-render
        setRefreshKey(k => k + 1);
      }
    } catch (err: any) {
      console.warn('Biometric registration error:', err);
      showNotification('Registration failed: ' + err.message, 'error');
    }
  };

  const verifyBiometrics = async (empId: string): Promise<boolean> => {
    const emp = data.employees?.find(e => e.id === empId);
    const savedCredId = emp?.passkeyRawId;
    
    if (!savedCredId) {
       showNotification('Please register Fingerprint/Biometrics first!', 'warning');
       return false;
    }

    if (!window.PublicKeyCredential) {
      showNotification('Biometrics not supported here.', 'error');
      return false; 
    }

    try {
      const binaryStr = atob(savedCredId);
      const credIdArray = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        credIdArray[i] = binaryStr.charCodeAt(i);
      }
      
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credIdArray,
            type: 'public-key'
          }],
          userVerification: 'required'
        }
      });
      return true;
    } catch (err: any) {
      console.warn('Biometric error:', err);
      if (err.name === 'NotAllowedError') {
        showNotification('Verification cancelled.', 'error');
        return false; 
      }
      showNotification('Biometric check failed.', 'error');
      return false; 
    }
  };

  const handleCheckIn = async () => {
    const empIdToUse = canSeeAttendance ? selectedEmpId : currentEmpId;

    const isVerified = await verifyBiometrics(empIdToUse);
    if (!isVerified) {
      showNotification('Biometric verification cancelled or failed.', 'error');
      return;
    }

    const now = new Date();
    const compareTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const schedule = data.settings.workSchedule;
    const isSaturday = now.getDay() === 6;
    const startTime = isSaturday ? schedule.saturdays.start : schedule.weekdays.start;
    const status = compareTime > startTime ? 'Late' : 'Present';

    try {
      const loc = await getLocationInfo();
      await DataStore.checkIn(empIdToUse, status, displayTime, loc);
      const emp = data.employees.find(e => e.id === empIdToUse);
      showNotification(`${emp?.name} checked in!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to check in.', 'error');
    }
  };

  const handleAdminCheckIn = async () => {
    const empIdToUse = canSeeAttendance ? selectedEmpId : currentEmpId;
    const now = new Date();
    const compareTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const schedule = data.settings.workSchedule;
    const isSaturday = now.getDay() === 6;
    const startTime = isSaturday ? schedule.saturdays.start : schedule.weekdays.start;
    const status = compareTime > startTime ? 'Late' : 'Present';

    try {
      await DataStore.checkIn(empIdToUse, status, displayTime, "Manual Override");
      const emp = data.employees.find(e => e.id === empIdToUse);
      showNotification(`${emp?.name} checked in manually!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to check in.', 'error');
    }
  };

  const handleAdminCheckOut = async () => {
    const empIdToUse = canSeeAttendance ? selectedEmpId : currentEmpId;
    const rec = (data.attendance || []).find(a => a.empId === empIdToUse && a.date === today);
    if (!rec) {
      showNotification(`Employee hasn't checked in yet!`, 'warning');
      return;
    }

    const now = new Date();
    const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    try {
      await DataStore.checkOut(rec.id, displayTime, "Manual Override");
      const emp = (data.employees || []).find(e => e.id === empIdToUse);
      showNotification(`${emp?.name} checked out manually!`, 'info');
    } catch (err: any) {
      showNotification(err.message || 'Failed to check out.', 'error');
    }
  };

  const handleCheckOut = async () => {
    const empIdToUse = canSeeAttendance ? selectedEmpId : currentEmpId;
    const rec = (data.attendance || []).find(a => a.empId === empIdToUse && a.date === today);
    if (!rec) {
      showNotification(`Employee hasn't checked in yet!`, 'warning');
      return;
    }

    const isVerified = await verifyBiometrics(empIdToUse);
    if (!isVerified) {
      showNotification('Biometric verification cancelled or failed.', 'error');
      return;
    }

    const now = new Date();
    const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    try {
      const loc = await getLocationInfo();
      await DataStore.checkOut(rec.id, displayTime, loc);
      const emp = (data.employees || []).find(e => e.id === empIdToUse);
      showNotification(`${emp?.name} checked out!`, 'info');
    } catch (err: any) {
      showNotification(err.message || 'Failed to check out.', 'error');
    }
  };

  const todayAttendance = (data.attendance || []).filter(a => a.date === today);
  const displayEmployees = canSeeAttendance 
    ? activeStaff
    : (data.employees || []).filter(e => e.id === currentEmpId);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {(isAdmin || isBranchManager) ? (
          <>
            {(canSeeStaff || isBranchManager) && <StatCard icon={Users} title={isBranchManager && !isAdmin ? "Branch Staff" : "Total Active Staff"} value={totalStaff} />}
            {canSeeAttendance && <StatCard icon={CalendarDays} title="Present Today" value={`${presentToday} / ${totalStaff}`} />}
            {canSeeLeaves && <StatCard icon={MailWarning} title="Pending Leaves" value={pendingLeavesCount} color={pendingLeavesCount > 0 ? "text-amber-500" : "text-brand-accent"} />}
            {canSeeAdvances && <StatCard icon={HandCoins} title="Pending Advances" value={pendingAdvancesCount} color={pendingAdvancesCount > 0 ? "text-amber-500" : "text-brand-accent"} />}
            {canSeeCashRequests && <StatCard icon={Wallet} title="Pending Cash Requests" value={pendingCashRequestsCount} color={pendingCashRequestsCount > 0 ? "text-amber-500" : "text-brand-accent"} />}
            {!canSeeStaff && !canSeeAttendance && !canSeeLeaves && !canSeeAdvances && !canSeeCashRequests && !isBranchManager && (
              <div className="col-span-full p-12 bg-white border border-border-accent rounded-2xl text-center shadow-sm">
                <p className="text-text-secondary font-medium text-sm">Welcome to the Admin Dashboard (T: {today} | DB: {uniqueDates} | Tot: {(data.attendance||[]).length})</p>
              </div>
            )}
          </>
        ) : (
          <>
            <StatCard 
              icon={CalendarDays} 
              title="Today's Status" 
              value={myAttendance ? myAttendance.status : (isTodayHoliday ? 'Holiday' : 'Absent')} 
              color={myAttendance || isTodayHoliday ? 'text-emerald-500' : 'text-red-500'}
            />
            <StatCard 
              icon={LogIn} 
              title="Clock In Time" 
              value={myAttendance ? myAttendance.checkIn : '--:--'} 
              color="text-brand-primary"
            />
            <StatCard icon={MailWarning} title="My Pending Leaves" value={myPendingLeaves} color="text-brand-accent" />
            <StatCard icon={TrendingUp} title="Leave Balance" value={myBalance} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand-accent" />
              Company Announcements
            </h3>
          </div>
          {!data.announcements ? (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary mb-2" />
              <p className="text-xs text-text-secondary">Loading announcements...</p>
            </div>
          ) : recentAnnouncements.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">No active announcements within the last 7 days.</p>
              <div className="pt-2 text-right border-t border-gray-100">
                <button 
                  onClick={() => navigate('/announcements')}
                  className="text-xs font-bold text-brand-primary hover:text-brand-accent transition-colors inline-flex items-center gap-1"
                >
                  View Archive & History
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {recentAnnouncements.map(ann => {
                const priorityColors = {
                  High: 'text-red-500 bg-red-50 border-red-100',
                  Medium: 'text-brand-accent bg-brand-accent/5 border-brand-accent/20',
                  Low: 'text-blue-500 bg-blue-50 border-blue-100'
                };
                return (
                  <div key={ann.id} className={`p-4 rounded-lg border relative group ${priorityColors[ann.priority || 'Medium']}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-sm text-text-primary">{ann.title}</h4>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white">
                        {ann.priority || 'Medium'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary text-justify">{ann.content}</p>
                    <span className="text-[9px] text-text-tertiary mt-2 block tracking-wider uppercase">
                      {(data.employees || []).find(e => e.id === ann.authorId)?.name || 'Admin'} {ann.date && !isNaN(new Date(ann.date).getTime()) ? `• ${new Date(ann.date).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                );
              })}
              
              <div className="pt-2 text-right border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => navigate('/announcements')}
                  className="text-xs font-bold text-brand-primary hover:text-brand-accent transition-colors inline-flex items-center gap-1"
                >
                  View All Announcements
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            <Gift className="w-4 h-4 text-brand-accent" />
            Milestones This Month
          </h3>
          {milestones.length === 0 ? (
            <p className="text-sm text-text-secondary">No milestones this month.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map(e => {
                const isBday = e.dateOfBirth && new Date(e.dateOfBirth).getMonth() === currentMonth;
                const isAnniv = e.joinDate && new Date(e.joinDate).getMonth() === currentMonth;
                return (
                  <div key={e.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-border-accent shadow-sm">
                    <div className={`p-2 rounded-full ${isBday ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{e.name}</p>
                      <p className="text-xs text-text-secondary">
                        {isBday && isAnniv ? (
                          `Birthday: ${new Date(e.dateOfBirth!).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} & ${new Date().getFullYear() - new Date(e.joinDate!).getFullYear()} Yr Anniversary`
                        ) : isBday ? (
                          `Birthday: ${new Date(e.dateOfBirth!).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
                        ) : (
                          `${new Date().getFullYear() - new Date(e.joinDate!).getFullYear()} Yr Anniversary`
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8"
      >
        <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
          Mark My Attendance
        </h3>
        <div className="flex flex-wrap gap-6 items-end">
          {canSeeAttendance && (
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Search & Select Employee</label>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Search by name or ID..."
                  className="form-control"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                />
                <select 
                  className="form-control"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  {displayEmployees
                    .filter(e => 
                      e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
                      e.id.toLowerCase().includes(empSearch.toLowerCase())
                    )
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.id} – {e.name}</option>
                    ))
                  }
                  {displayEmployees.filter(e => 
                    e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
                    e.id.toLowerCase().includes(empSearch.toLowerCase())
                  ).length === 0 && (
                    <option disabled>No employees found</option>
                  )}
                </select>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex gap-4">
              <button onClick={handleCheckIn} className="btn btn-primary">
                Check In
              </button>
              <button onClick={handleCheckOut} className="btn btn-outline">
                Check Out
              </button>
            </div>
            {canSeeAttendance && (
              <div className="flex gap-4 border-l border-border-accent pl-4">
                <button onClick={handleAdminCheckIn} className="btn btn-outline text-amber-600 border-amber-200 hover:bg-amber-50">
                  Manual In
                </button>
                <button onClick={handleAdminCheckOut} className="btn btn-outline text-amber-600 border-amber-200 hover:bg-amber-50">
                  Manual Out
                </button>
              </div>
            )}
            {!hasBiometricRegistered(canSeeAttendance ? selectedEmpId : currentEmpId) && (
              <button onClick={handleRegisterBiometrics} className="btn btn-outline border-dashed gap-2">
                <Fingerprint className="w-4 h-4" />
                Register Biometrics
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="table-container glass-panel">
        <div className="p-6 border-b border-border-accent">
          <h3 className="text-sm font-semibold text-text-primary">
            Daily Attendance Log <span className="text-text-secondary font-normal ml-2">— {today}</span>
          </h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>EMP No</th>
              <th>Name</th>
              <th>Status</th>
              <th>Check In</th>
              <th>Check Out</th>
              {canSeeAttendance && <th></th>}
            </tr>
          </thead>
          <tbody>
            {displayEmployees.map(emp => {
              const rec = todayAttendance.find(a => a.empId === emp.id);
              const statusText = rec ? rec.status : (isTodayHoliday ? 'Holiday' : 'Absent');
              return (
                <tr key={emp.id}>
                  <td className="font-mono text-sm text-brand-accent">{emp.id}</td>
                  <td className="font-medium text-text-primary">{emp.name}</td>
                  <td>
                    <span className={`badge ${
                      statusText === 'Holiday' ? 'badge-success bg-emerald-100 text-emerald-800' :
                      statusText === 'Absent' ? 'badge-danger' : 
                      statusText === 'Present' ? 'badge-success' : 
                      statusText === 'Half Day' ? 'badge-warning' : 
                      statusText === 'Late' ? 'badge-info' : 
                      statusText === 'Leave' ? 'badge-info' : 'badge-danger'
                    }`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span className={!rec ? 'text-text-secondary' : 'text-text-primary font-medium'}>{rec?.checkIn || '--'}</span>
                      {rec?.checkInLocation && (
                         <a href={`https://maps.google.com/?q=${rec.checkInLocation}`} target="_blank" rel="noopener noreferrer" title="View Location">
                           <MapPin className="w-3.5 h-3.5 text-brand-accent hover:text-brand-secondary transition-colors" />
                         </a>
                      )}
                    </div>
                  </td>
                  <td className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span className={!rec ? 'text-text-secondary' : 'text-text-primary font-medium'}>
                        {rec ? (rec.checkOut === '--' ? <span className="text-text-secondary italic">Not yet</span> : rec.checkOut) : '--'}
                      </span>
                      {rec?.checkOutLocation && (
                         <a href={`https://maps.google.com/?q=${rec.checkOutLocation}`} target="_blank" rel="noopener noreferrer" title="View Location">
                           <MapPin className="w-3.5 h-3.5 text-emerald-500 hover:text-emerald-600 transition-colors" />
                         </a>
                      )}
                    </div>
                  </td>
                  {canSeeAttendance && (
                    <td>
                      {rec && (
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setEditingAttendance(rec)}
                            className="text-text-secondary hover:text-brand-accent transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(rec.id)}
                            className="text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingAttendance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-border-accent p-8 rounded-2xl w-full max-w-md shadow-xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-semibold text-text-primary">Edit Attendance</h3>
              <button onClick={() => setEditingAttendance(null)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAttendance} className="space-y-6">
              <div className="form-group">
                <label className="text-sm font-medium text-text-secondary mb-2 block">Check In Time</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. 08:30 AM"
                  value={editingAttendance.checkIn} 
                  onChange={e => setEditingAttendance({...editingAttendance, checkIn: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-sm font-medium text-text-secondary mb-2 block">Check Out Time</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. 05:30 PM"
                  value={editingAttendance.checkOut} 
                  onChange={e => setEditingAttendance({...editingAttendance, checkOut: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Status</label>
                <select 
                  className="form-control"
                  value={editingAttendance.status}
                  onChange={e => setEditingAttendance({...editingAttendance, status: e.target.value as any})}
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Late">Late</option>
                  <option value="Leave">Leave</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center py-4">
                Update Record
              </button>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record? This action cannot be undone."
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, color = "text-text-primary", isProgress = false, progress = 0 }: any) {
  return (
    <div className="glass-panel p-6 flex flex-col gap-3 relative overflow-hidden shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start">
        <div className="text-text-secondary text-sm font-sans font-medium">{title}</div>
        <div className="p-2 bg-brand-accent/10 rounded-lg group-hover:bg-brand-accent/20 transition-colors">
          <Icon className="w-4 h-4 text-brand-accent" />
        </div>
      </div>
      <div className={`text-3xl font-serif font-semibold ${color}`}>{value}</div>
      {isProgress && (
        <div className="w-full h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-brand-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl group-hover:bg-brand-accent/10 transition-all duration-500" />
    </div>
  );
}
