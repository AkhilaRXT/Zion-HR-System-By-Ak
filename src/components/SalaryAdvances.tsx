import React, { useState } from 'react';
import { AppData, Session, AdvanceRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { HandCoins, Check, X, FileDown, Paperclip, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import Notification, { NotificationType } from './Notification';
import { fileToBase64 } from '../lib/fileUtils';

interface SalaryAdvancesProps {
  session: Session;
  data: AppData;
  onRefresh?: () => void;
}

export default function SalaryAdvances({ session, data }: SalaryAdvancesProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const hasPayrollPermission = isAdmin && (isMasterAdmin || session.permissions?.includes('payroll'));
  const currentEmpId = session.empId;
  const fuelPrice = data.settings.fuelPrice;

  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [newAdvance, setNewAdvance] = useState({ amount: 0, reason: '', attachment: '' });
  const [activeTab, setActiveTab] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>(hasPayrollPermission ? 'Pending' : 'All');
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dateRange, setDateRange] = useState({
    from: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1)),
    to: formatDateForInput(new Date())
  });

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleAdvanceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setNewAdvance({ ...newAdvance, attachment: base64 });
      } catch (err: any) {
        showNotification(err.message || 'Failed to process file', 'error');
      }
    }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate current net salary to validate advance request
    const emp = (data.employees || []).find(e => e.id === currentEmpId);
    if (!emp) return;

    if (emp.status === 'Dormant') {
      showNotification('Advance requests are not available for dormant accounts.', 'error');
      return;
    }

    if (emp.salaryStatus && emp.salaryStatus !== 'Active') {
      showNotification(`Cannot request advance. Your salary is currently on hold (${emp.salaryStatus}).`, 'error');
      return;
    }

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const advTotal = (data.advances || [])
      .filter(a => {
        const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && advanceMonth === currentMonth;
      })
      .reduce((s, a) => s + a.amount, 0);
    
    const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
    const epf = emp.hasEPF ? (emp.baseSalary || 0) * 0.08 : 0;
    
    const totalEarnings = (emp.baseSalary || 0) + 
                          (emp.performanceAllowance || 0) + 
                          (emp.travelingAllowance || 0) + 
                          (emp.vehicleAllowance || 0) +
                          petrolLKR + 
                          (emp.attendanceBonus || 0) + 
                          (emp.overtime || 0);

    const totalDeductions = advTotal + 
                            (emp.bikeInstallment || 0) + 
                            (emp.staffLoan || 0) + 
                            epf;

    const netSalary = totalEarnings - totalDeductions;

    if (newAdvance.amount > netSalary) {
      showNotification(`Cannot request LKR ${newAdvance.amount.toLocaleString()}. Your current net salary is LKR ${netSalary.toLocaleString()}.`, 'error');
      return;
    }

    const request: AdvanceRequest = {
      id: Date.now(),
      empId: currentEmpId,
      amount: newAdvance.amount,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      reason: newAdvance.reason,
      attachment: newAdvance.attachment
    };
    try {
      await DataStore.addAdvanceRequest(request);
      showNotification('Salary advance requested successfully!');
      setNewAdvance({ amount: 0, reason: '', attachment: '' });
    } catch (err) {
      showNotification('Failed to request advance.', 'error');
    }
  };

  const handleAdvanceStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateAdvanceStatus(id, status, session.name);
      showNotification(`Advance request ${status.toLowerCase()}.`);
    } catch (err) {
      showNotification('Failed to update advance status.', 'error');
    }
  };

  const handleExportAdvances = async () => {
    const advancesToExport = (data.advances || [])
      .filter(a => {
        const matchesPermission = hasPayrollPermission || a.empId === currentEmpId;
        const matchesDate = a.date >= dateRange.from && a.date <= dateRange.to;
        const matchesStatus = activeTab === 'All' || a.status === activeTab;
        return matchesPermission && matchesDate && matchesStatus;
      })
      .sort((a, b) => b.id - a.id);

    const sheetData = advancesToExport.map(a => {
      const emp = (data.employees || []).find(e => e.id === a.empId);
      const settledInfo = a.actionHistory?.find(h => h.action.includes('Settled'))?.by || (a.isPaid ? a.actionedBy : '');
      return {
        Date: a.date,
        'EMP ID': a.empId,
        'Employee Name': emp?.name || 'Unknown',
        Reason: a.reason,
        Amount: a.amount,
        Status: a.status,
        'Actioned By': a.actionedBy || '',
        Paid: a.isPaid ? 'Yes' : 'No',
        'Settled By': settledInfo || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Salary Advances');
    XLSX.writeFile(wb, `Salary_Advances_${dateRange.from}_to_${dateRange.to}.xlsx`);
  };

  const calculateEstimatedNet = (emp: any) => {
    if (!emp) return 0;
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Check what's already been paid this month
    const alreadyPaidCmps = (data.paidComponents?.[emp.id]?.[currentMonth] || []);
    const isMonthFinalized = (data.paidDeductions?.[emp.id] || []).includes(currentMonth);

    // Earnings (Only include what hasn't been paid yet)
    const base = !alreadyPaidCmps.includes('Basic') ? (emp.baseSalary || 0) : 0;
    const performance = !alreadyPaidCmps.includes('Bonus') ? (emp.performanceAllowance || 0) : 0;
    const travel = !alreadyPaidCmps.includes('Travel') ? (emp.travelingAllowance || 0) : 0;
    const vehicle = !alreadyPaidCmps.includes('Vehicle') ? (emp.vehicleAllowance || 0) : 0;
    const attendance = !alreadyPaidCmps.includes('Attendance') ? (emp.attendanceBonus || 0) : 0;
    const overtime = !alreadyPaidCmps.includes('Overtime') ? (emp.overtime || 0) : 0;
    const petrolLKR = !alreadyPaidCmps.includes('Petrol') ? (emp.petrolLitres || 0) * fuelPrice : 0;
    
    // Ad-hoc bonuses for this month
    const adhocTotal = (data.adhocBonuses || [])
      .filter(b => b.empId === emp.id && b.month === currentMonth && !alreadyPaidCmps.includes('CustomBonus'))
      .reduce((s, b) => s + b.amount, 0);

    const totalEarnings = base + performance + travel + vehicle + attendance + overtime + petrolLKR + adhocTotal;

    // Deductions
    const advTotal = (data.advances || [])
      .filter(a => {
        const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && advanceMonth === currentMonth;
      })
      .reduce((s, a) => s + a.amount, 0);

    const epfPercentage = data.settings?.epfPercentage || 8;
    const epf = (!isMonthFinalized && emp.hasEPF) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
    const bike = !isMonthFinalized ? (emp.bikeInstallment || 0) : 0;
    const loan = !isMonthFinalized ? (emp.staffLoan || 0) : 0;

    const totalDeductions = advTotal + epf + bike + loan;

    return Math.max(0, totalEarnings - totalDeductions);
  };

  const displayAdvances = (data.advances || [])
    .filter(a => {
        const matchesPermission = hasPayrollPermission || a.empId === currentEmpId;
        const matchesDate = a.date >= dateRange.from && a.date <= dateRange.to;
        const matchesStatus = activeTab === 'All' || a.status === activeTab;
        return matchesPermission && matchesDate && matchesStatus;
    })
    .sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-12">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="glass-panel p-8">
            <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-brand-accent" />
              Apply for Advance
            </h3>
            <form onSubmit={handleAdvanceSubmit} className="space-y-6">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block tracking-wider uppercase">Amount (LKR)</label>
                <input 
                  type="number" className="form-control" required min="1"
                  value={newAdvance.amount || ''} onChange={e => setNewAdvance({...newAdvance, amount: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block tracking-wider uppercase">Reason</label>
                <textarea 
                  className="form-control min-h-[100px] py-3" required 
                  value={newAdvance.reason} onChange={e => setNewAdvance({...newAdvance, reason: e.target.value})}
                  placeholder="Why do you need this advance?"
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block tracking-wider uppercase">Attachment</label>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-brand-accent/10 file:text-brand-accent hover:file:bg-brand-accent/20 cursor-pointer"
                  onChange={handleAdvanceFileChange}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center py-4">Submit Request</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
              <div className="form-group">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">From Date</label>
                <input 
                  type="date" className="form-control text-xs" 
                  value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">To Date</label>
                <input 
                  type="date" className="form-control text-xs" 
                  value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})}
                />
              </div>
            </div>
            <button 
              onClick={handleExportAdvances}
              className="btn btn-outline py-2.5 px-6 h-auto text-xs w-full md:w-auto"
            >
              <FileDown className="w-4 h-4" />
              Export to Excel
            </button>
          </div>

          <div className="table-container">
            <div className="p-8 border-b border-border-accent bg-gray-50/50 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {hasPayrollPermission ? 'Salary Advance Management' : 'My Advance Requests'}
                  </h3>
                  <p className="text-[10px] text-text-secondary font-medium mt-1 uppercase tracking-widest">
                    Showing results from {dateRange.from} to {dateRange.to}
                  </p>
                </div>
              </div>
              
              <div className="flex border-b border-border-accent">
                {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all relative ${
                      activeTab === tab 
                      ? 'text-brand-accent' 
                      : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Request Date</th>
                  <th>Employee</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {hasPayrollPermission && <th className="text-right">Manage</th>}
                </tr>
              </thead>
              <tbody>
                {displayAdvances.length > 0 ? displayAdvances.map(a => {
                  const emp = (data.employees || []).find(e => e.id === a.empId);
                  const statusCls = a.status === 'Approved' ? 'badge-success' : a.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                  
                  return (
                    <tr key={a.id} className="group">
                      <td className="font-mono text-xs text-text-secondary">{a.date}</td>
                      <td>
                        <div className="font-semibold text-sm text-text-primary">{emp?.name || a.empId}</div>
                        <div className="text-[10px] text-text-secondary font-medium mt-0.5 tracking-tight">{emp?.id}</div>
                        {hasPayrollPermission && (
                          <div className="mt-2 group-hover:block transition-all">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 uppercase tracking-tight">
                              EST. BAL: LKR {calculateEstimatedNet(emp).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-text-secondary font-medium mt-2 flex items-center gap-2">
                          {a.reason}
                          {a.attachment && (
                            <a href={a.attachment} download={`Advance_${a.empId}.pdf`} className="text-brand-accent hover:underline flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="font-mono text-sm font-bold text-brand-accent">LKR {a.amount.toLocaleString()}</td>
                      <td>
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex flex-col gap-0.5">
                            <span className={`badge ${statusCls} flex items-center gap-1.5`}>
                              {a.status === 'Pending' && <Clock className="w-3 h-3" />}
                              {a.status}
                            </span>
                            {a.actionedBy && (
                              <span className="text-[9px] text-text-secondary font-medium pl-1">
                                By: {a.actionedBy}
                              </span>
                            )}
                          </div>
                          
                          {a.isPaid && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-tight">Settled</span>
                              {a.actionHistory?.find(h => h.action.includes('Settled')) && (
                                <span className="text-[9px] text-text-secondary font-medium pl-1">
                                  By: {a.actionHistory.find(h => h.action.includes('Settled'))?.by}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      {hasPayrollPermission && (
                        <td className="text-right">
                          {a.status === 'Pending' ? (
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => handleAdvanceStatus(a.id, 'Approved')}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAdvanceStatus(a.id, 'Rejected')}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : '-'}
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={hasPayrollPermission ? 5 : 4} className="text-center py-12 text-text-secondary font-medium italic">
                      No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} requests found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
