import React, { useState } from 'react';
import { AppData, Session, LeaveRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Check, X, PlaneTakeoff, Paperclip } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Notification, { NotificationType } from './Notification';
import { fileToBase64 } from '../lib/fileUtils';

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
  const policy = data.settings?.leavePolicy || { monthlyLimit: 0, annualTotal: 0, casualTotal: 0, sickTotal: 0 };
  const approvedLeaves = (data.leaves || []).filter(l => l.empId === currentEmpId && l.status === 'Approved');
  
  const calculateDays = (from: string, to: string) => {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const annualTaken = approvedLeaves.filter(l => l.type === 'Annual').reduce((acc, l) => acc + calculateDays(l.from, l.to), 0);
  const casualTaken = approvedLeaves.filter(l => l.type === 'Casual').reduce((acc, l) => acc + calculateDays(l.from, l.to), 0);
  const sickTaken = approvedLeaves.filter(l => l.type === 'Sick').reduce((acc, l) => acc + calculateDays(l.from, l.to), 0);

  const casualBalance = (policy.casualTotal || 0) - casualTaken;
  const sickBalance = (policy.sickTotal || 0) - sickTaken;
  const annualBalance = (policy.annualTotal || 0) - annualTaken;

  const balances = {
    annual: annualBalance,
    casual: casualBalance,
    sick: sickBalance
  };

  const [newLeave, setNewLeave] = useState({
    type: 'Annual' as 'Annual' | 'Casual' | 'Sick',
    from: '',
    to: '',
    reason: '',
    attachment: ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setNewLeave({ ...newLeave, attachment: base64 });
      } catch (err: any) {
        showNotification(err.message || 'Failed to process file', 'error');
      }
    }
  };

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
      setNewLeave({ type: 'Annual', from: '', to: '', reason: '', attachment: '' });
    } catch (err) {
      showNotification('Failed to submit leave request.', 'error');
    }
  };

  const handleStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateLeaveStatus(id, status, session.name);
      showNotification(`Leave request ${status.toLowerCase()}.`);
    } catch (err) {
      showNotification('Failed to update leave status.', 'error');
    }
  };

  const filteredLeaves = (data.leaves || []).filter(l => canManageLeaves || l.empId === currentEmpId).sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <BalanceCard title="Annual Leave" value={balances.annual} />
        <BalanceCard title="Casual Leave" value={balances.casual} />
        <BalanceCard title="Sick Leave" value={balances.sick} />
      </div>

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <div className="w-full lg:w-1/3 glass-panel p-6 md:p-8">
          <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            Apply for Leave
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Leave Type</label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">From Date</label>
                <input 
                  type="date" className="form-control" required 
                  value={newLeave.from} onChange={e => setNewLeave({...newLeave, from: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">To Date</label>
                <input 
                  type="date" className="form-control" required 
                  value={newLeave.to} onChange={e => setNewLeave({...newLeave, to: e.target.value})}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Reason</label>
              <textarea 
                className="form-control min-h-[100px]" required 
                placeholder="State reason..."
                value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Attachment (PDF/Image, max 3MB)</label>
              <input 
                type="file" 
                accept=".pdf,image/*"
                className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-accent file:text-white hover:file:bg-blue-700"
                onChange={handleFileChange}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center py-4">
              Submit Request
            </button>
          </form>
        </div>

        <div className="w-full lg:w-2/3 table-container">
          <div className="p-6 border-b border-border-accent">
            <h3 className="text-sm font-semibold text-text-primary">
              {canManageLeaves ? 'All Leave Requests' : 'My Leave Requests'}
            </h3>
          </div>
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
                const emp = (data.employees || []).find(e => e.id === l.empId);
                const statusCls = l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                
                // Calculate balance for this specific employee
                const empApprovedLeaves = (data.leaves || []).filter(leave => leave.empId === l.empId && leave.status === 'Approved');
                const empAnnualTaken = empApprovedLeaves.filter(leave => leave.type === 'Annual').reduce((acc, leave) => acc + calculateDays(leave.from, leave.to), 0);
                const empCasualTaken = empApprovedLeaves.filter(leave => leave.type === 'Casual').reduce((acc, leave) => acc + calculateDays(leave.from, leave.to), 0);
                const empSickTaken = empApprovedLeaves.filter(leave => leave.type === 'Sick').reduce((acc, leave) => acc + calculateDays(leave.from, leave.to), 0);

                const empCasualBalance = (policy.casualTotal || 0) - empCasualTaken;
                const empSickBalance = (policy.sickTotal || 0) - empSickTaken;
                const empAnnualBalance = (policy.annualTotal || 0) - empAnnualTaken;

                return (
                  <tr key={l.id}>
                    <td>
                      <div className="font-medium text-text-primary">{emp?.name || l.empId}</div>
                      {canManageLeaves && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-text-secondary rounded-md">Annual: {empAnnualBalance}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-text-secondary rounded-md">Casual: {empCasualBalance}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-text-secondary rounded-md">Sick: {empSickBalance}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-text-secondary">{l.type}</td>
                    <td className="font-mono text-sm text-text-secondary">
                      {l.from} → {l.to}
                      {l.attachment && (
                        <div className="mt-2">
                          <a href={l.attachment} download={`Leave_Request_${l.empId}.pdf`} className="text-xs font-medium text-brand-accent hover:text-blue-700 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> View Attachment
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusCls}`}>{l.status}</span>
                      {l.actionedBy && l.status !== 'Pending' && (
                        <div className="text-[10px] text-text-secondary mt-1">by {l.actionedBy}</div>
                      )}
                    </td>
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
