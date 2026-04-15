import React, { useState } from 'react';
import { AppData, Session, LeaveRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Check, X, PlaneTakeoff } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Notification, { NotificationType } from './Notification';

interface LeaveManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function LeaveManagement({ session, data, onRefresh }: LeaveManagementProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManageLeaves = isAdmin && (isMasterAdmin || session.permissions?.includes('leave'));
  
  const currentEmpId = session.empId;
  
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };
  
  // Calculate leave balances dynamically based on current policy and approved leaves
  const policy = data.settings.leavePolicy;
  const approvedLeaves = data.leaves.filter(l => l.empId === currentEmpId && l.status === 'Approved');
  
  const annualTaken = approvedLeaves.filter(l => l.type === 'Annual').length;
  const casualTaken = approvedLeaves.filter(l => l.type === 'Casual').length;
  const sickTaken = approvedLeaves.filter(l => l.type === 'Sick').length;

  const casualBalance = (policy.casualTotal || 0) - casualTaken;
  const sickBalance = (policy.sickTotal || 0) - sickTaken;
  const annualBalance = casualBalance + sickBalance - annualTaken;

  const balances = {
    annual: annualBalance,
    casual: casualBalance,
    sick: sickBalance
  };

  const [newLeave, setNewLeave] = useState({
    type: 'Annual' as 'Annual' | 'Casual' | 'Sick',
    from: '',
    to: '',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const request: LeaveRequest = {
      id: Date.now(),
      empId: currentEmpId,
      ...newLeave,
      status: 'Pending'
    };
    try {
      await DataStore.addLeaveRequest(request);
      showNotification('Leave Application Submitted!');
      setNewLeave({ type: 'Annual', from: '', to: '', reason: '' });
    } catch (err) {
      showNotification('Failed to submit leave request.', 'error');
    }
  };

  const handleStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateLeaveStatus(id, status);
      showNotification(`Leave request ${status.toLowerCase()}.`);
    } catch (err) {
      showNotification('Failed to update leave status.', 'error');
    }
  };

  const filteredLeaves = data.leaves.filter(l => canManageLeaves || l.empId === currentEmpId).sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <BalanceCard title="Annual Leave" value={balances.annual} />
        <BalanceCard title="Casual Leave" value={balances.casual} />
        <BalanceCard title="Sick Leave" value={balances.sick} />
      </div>

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <div className="w-full lg:w-1/3 bg-bg-secondary border border-border-accent p-6 md:p-10">
          <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            Apply for Leave
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Leave Type</label>
              <select 
                className="form-control"
                value={newLeave.type}
                onChange={e => setNewLeave({...newLeave, type: e.target.value as any})}
              >
                <option value="Annual">Annual</option>
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">From Date</label>
                <input 
                  type="date" className="form-control" required 
                  value={newLeave.from} onChange={e => setNewLeave({...newLeave, from: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">To Date</label>
                <input 
                  type="date" className="form-control" required 
                  value={newLeave.to} onChange={e => setNewLeave({...newLeave, to: e.target.value})}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Reason</label>
              <textarea 
                className="form-control min-h-[100px]" required 
                placeholder="State reason..."
                value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center py-4">
              Submit Request
            </button>
          </form>
        </div>

        <div className="w-full lg:w-2/3 table-container">
          <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8">
            {canManageLeaves ? 'All Leave Requests' : 'My Leave Requests'}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Status</th>
                {canManageLeaves && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map(l => {
                const emp = data.employees.find(e => e.id === l.empId);
                const statusCls = l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                
                // Calculate balance for this specific employee
                const empApprovedLeaves = data.leaves.filter(leave => leave.empId === l.empId && leave.status === 'Approved');
                const empAnnualTaken = empApprovedLeaves.filter(leave => leave.type === 'Annual').length;
                const empCasualTaken = empApprovedLeaves.filter(leave => leave.type === 'Casual').length;
                const empSickTaken = empApprovedLeaves.filter(leave => leave.type === 'Sick').length;

                const empCasualBalance = (policy.casualTotal || 0) - empCasualTaken;
                const empSickBalance = (policy.sickTotal || 0) - empSickTaken;
                const empAnnualBalance = empCasualBalance + empSickBalance - empAnnualTaken;

                return (
                  <tr key={l.id}>
                    <td>
                      <div className="uppercase tracking-[1px] text-[12px] font-medium">{emp?.name || l.empId}</div>
                      {canManageLeaves && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded uppercase tracking-[1px]">Annual: {empAnnualBalance}</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded uppercase tracking-[1px]">Casual: {empCasualBalance}</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded uppercase tracking-[1px]">Sick: {empSickBalance}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-[11px] uppercase tracking-[1px] text-text-secondary">{l.type}</td>
                    <td className="font-serif text-[12px]">{l.from} → {l.to}</td>
                    <td><span className={`badge ${statusCls}`}>{l.status}</span></td>
                    {canManageLeaves && (
                      <td>
                        {l.status === 'Pending' ? (
                          <div className="flex gap-4">
                            <button 
                              onClick={() => handleStatus(l.id, 'Approved')}
                              className="text-emerald-500 hover:text-white transition-all"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleStatus(l.id, 'Rejected')}
                              className="text-red-500 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : '-'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

function BalanceCard({ title, value }: any) {
  return (
    <div className="stat-card group">
      <div className="flex justify-between items-start">
        <div className="title">{title}</div>
        <div className="p-2 bg-brand-accent/10 rounded-lg group-hover:bg-brand-accent/20 transition-colors">
          <PlaneTakeoff className="w-4 h-4 text-brand-accent" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="value">{value}</div>
        <div className="text-[10px] uppercase tracking-[1px] text-text-secondary">Days Available</div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl group-hover:bg-brand-accent/10 transition-all duration-500" />
    </div>
  );
}
