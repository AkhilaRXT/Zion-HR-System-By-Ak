import React, { useState, useEffect } from 'react';
import { AppData, Session, Attendance } from '../types';
import { DataStore } from '../lib/dataStore';
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface DashboardProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function Dashboard({ session, data, onRefresh }: DashboardProps) {
  const isAdmin = session.isAdmin;
  const today = new Date().toISOString().split('T')[0];
  const currentEmpId = session.empId;
  
  // Admin Stats
  const canSeeStaff = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('staff'));
  const canSeeAttendance = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('attendance'));
  const canSeeLeaves = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('leave'));
  const canSeeAdvances = isAdmin && (session.email === "zioncommercialcreditampara@gmail.com" || session.permissions?.includes('payroll'));

  const totalStaff = data.employees.length;
  const presentToday = new Set(
    data.attendance
      .filter(a => a.date === today && (a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day'))
      .map(a => a.empId)
      .filter(id => data.employees.some(e => e.id === id))
  ).size;
  const pendingLeavesCount = data.leaves.filter(l => l.status === 'Pending').length;
  const approvedAdvancesCount = data.advances.filter(a => a.status === 'Approved').length;

  // Member Stats
  const myAttendance = data.attendance.find(a => a.empId === currentEmpId && a.date === today);
  const myPendingLeaves = data.leaves.filter(l => l.empId === currentEmpId && l.status === 'Pending').length;
  const myApprovedAdvances = data.advances.filter(a => a.empId === currentEmpId && a.status === 'Approved').length;
  
  const calculateDays = (from: string, to: string) => {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const myApprovedLeaves = data.leaves.filter(l => l.empId === currentEmpId && l.status === 'Approved');
  const myAnnualTaken = myApprovedLeaves.filter(l => l.type === 'Annual').reduce((acc, l) => acc + calculateDays(l.from, l.to), 0);
  const myBalance = (data.settings.leavePolicy.annualTotal || 0) - myAnnualTaken;

  const [selectedEmpId, setSelectedEmpId] = useState(data.employees[0]?.id || '');
  const [empSearch, setEmpSearch] = useState('');

  // Sync selection with search results
  useEffect(() => {
    const filtered = data.employees.filter(e => 
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

  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

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

  const handleCheckIn = async () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const schedule = data.settings.workSchedule;
    const isSaturday = now.getDay() === 6;
    const startTime = isSaturday ? schedule.saturdays.start : schedule.weekdays.start;
    const status = timeStr > startTime ? 'Late' : 'Present';

    try {
      await DataStore.checkIn(selectedEmpId, status, timeStr);
      const emp = data.employees.find(e => e.id === selectedEmpId);
      showNotification(`${emp?.name} checked in!`);
    } catch (err) {
      showNotification('Failed to check in.', 'error');
    }
  };

  const handleCheckOut = async () => {
    const rec = data.attendance.find(a => a.empId === selectedEmpId && a.date === today);
    if (!rec) {
      showNotification(`Employee hasn't checked in yet!`, 'warning');
      return;
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      await DataStore.checkOut(rec.id, timeStr);
      const emp = data.employees.find(e => e.id === selectedEmpId);
      showNotification(`${emp?.name} checked out!`, 'info');
    } catch (err) {
      showNotification('Failed to check out.', 'error');
    }
  };

  const todayAttendance = data.attendance.filter(a => a.date === today);
  const displayEmployees = canSeeAttendance ? data.employees : data.employees.filter(e => e.id === currentEmpId);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {isAdmin ? (
          <>
            {canSeeStaff && <StatCard icon={Users} title="Total Active Staff" value={totalStaff} />}
            {canSeeAttendance && <StatCard icon={CalendarDays} title="Present Today" value={`${presentToday} / ${totalStaff}`} />}
            {canSeeLeaves && <StatCard icon={MailWarning} title="Pending Leaves" value={pendingLeavesCount} color="text-brand-accent" />}
            {canSeeAdvances && <StatCard icon={HandCoins} title="Approved Advances" value={approvedAdvancesCount} />}
            {!canSeeStaff && !canSeeAttendance && !canSeeLeaves && !canSeeAdvances && (
              <div className="col-span-full p-12 bg-white border border-border-accent rounded-2xl text-center shadow-sm">
                <p className="text-text-secondary font-medium text-sm">Welcome to the Admin Dashboard</p>
              </div>
            )}
          </>
        ) : (
          <>
            <StatCard 
              icon={CalendarDays} 
              title="Today's Status" 
              value={myAttendance ? myAttendance.status : 'Absent'} 
              color={myAttendance ? 'text-emerald-500' : 'text-red-500'}
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

      {canSeeAttendance && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8"
        >
          <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            Mark Attendance
          </h3>
          <div className="flex flex-wrap gap-6 items-end">
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
                  {data.employees
                    .filter(e => 
                      e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
                      e.id.toLowerCase().includes(empSearch.toLowerCase())
                    )
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.id} – {e.name}</option>
                    ))
                  }
                  {data.employees.filter(e => 
                    e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
                    e.id.toLowerCase().includes(empSearch.toLowerCase())
                  ).length === 0 && (
                    <option disabled>No employees found</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleCheckIn} className="btn btn-primary">
                Check In
              </button>
              <button onClick={handleCheckOut} className="btn btn-outline">
                Check Out
              </button>
            </div>
          </div>
        </motion.div>
      )}

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
              return (
                <tr key={emp.id}>
                  <td className="font-mono text-sm text-brand-accent">{emp.id}</td>
                  <td className="font-medium text-text-primary">{emp.name}</td>
                  <td>
                    <span className={`badge ${
                      !rec ? 'badge-danger' : 
                      rec.status === 'Present' ? 'badge-success' : 
                      rec.status === 'Half Day' ? 'badge-warning' : 
                      rec.status === 'Late' ? 'badge-info' : 
                      rec.status === 'Leave' ? 'badge-info' : 'badge-danger'
                    }`}>
                      {rec ? rec.status : 'Absent'}
                    </span>
                  </td>
                  <td className="font-mono text-sm text-text-secondary">{rec ? rec.checkIn : '--'}</td>
                  <td className="font-mono text-sm text-text-secondary">
                    {rec ? (rec.checkOut === '--' ? <span className="text-text-secondary italic">Not yet</span> : rec.checkOut) : '--'}
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
