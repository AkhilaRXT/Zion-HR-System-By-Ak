import React, { useState } from 'react';
import { AppData, Session, AdvanceRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { HandCoins, Check, X, FileDown, Paperclip, Clock, Pencil, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import Notification, { NotificationType } from './Notification';
import { fileToBase64, handleDownloadAttachment } from '../lib/fileUtils';

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
  const viewableBranches = session.viewableBranches || [];

  const canViewEmployee = (empId: string) => {
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (viewableBranches.includes('ALL')) return true;
    const emp = (data.employees || []).find((e: any) => e.id === empId);
    if (!emp) return false;
    if (viewableBranches.length > 0) return viewableBranches.includes(emp.branch);
    if (session.isAdmin) {
      const myEmp = (data.employees || []).find((e: any) => e.id === session.empId);
      return myEmp?.branch === emp.branch;
    }
    return false;
  };

  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newAdvance, setNewAdvance] = useState({ amount: 0, reason: '', attachment: '', deductFrom: 'Basic' as 'Basic' | 'Petrol' | 'Traveling' | 'Vehicle' });
  const [activeTab, setActiveTab] = useState<'Pending' | 'Approved' | 'Rejected' | 'All' | 'Fixed Loans'>(hasPayrollPermission ? 'Pending' : 'All');
  const [editingAdvance, setEditingAdvance] = useState<AdvanceRequest | null>(null);
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dateRange, setDateRange] = useState({
    from: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: formatDateForInput(new Date())
  });

  const [searchedAdvances, setSearchedAdvances] = useState<AdvanceRequest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [branchFilter, setBranchFilter] = useState('ALL');

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await DataStore.searchAdvances(dateRange.from, dateRange.to);
      setSearchedAdvances(results);
      setHasSearched(true);
    } catch(err) {
      showNotification('Failed to fetch advances.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    if (!hasSearched) {
      handleSearch();
    }
  }, []);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleAdvanceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const base64 = await fileToBase64(file);
        setNewAdvance(prev => ({ ...prev, attachment: base64 }));
      } catch (err: any) {
        showNotification(err.message || 'Failed to process file', 'error');
        e.target.value = '';
      } finally {
        setIsUploading(false);
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
    const advTotal = (data.ownAdvances || data.advances || [])
      .filter(a => {
        const advanceDateStr = a.approvedDate || a.date;
        const [mStr, yStr] = currentMonth.split(' ');
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIndex = months.indexOf(mStr);
        const yearNum = parseInt(yStr, 10);
        
        const [advYearStr, advMonthStr] = advanceDateStr.split('-');
        const advYear = parseInt(advYearStr, 10);
        const advMnth = parseInt(advMonthStr, 10) - 1; // 0-indexed
        const isPastOrCurrent = advYear < yearNum || (advYear === yearNum && advMnth <= monthIndex);

        return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && isPastOrCurrent;
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
      attachment: newAdvance.attachment,
      deductFrom: newAdvance.deductFrom || 'Basic'
    };
    try {
      await DataStore.addAdvanceRequest(request);
      showNotification('Salary advance requested successfully!');
      setNewAdvance({ amount: 0, reason: '', attachment: '', deductFrom: 'Basic' });
      setSearchedAdvances(prev => [request, ...prev]);
    } catch (err) {
      showNotification('Failed to request advance.', 'error');
    }
  };

  const handleAdvanceStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateAdvanceStatus(id, status, session.name);
      showNotification(`Advance request ${status.toLowerCase()}.`);
      setSearchedAdvances(prev => prev.map(a => a.id === id ? { ...a, status, actionedBy: session.name } : a));
    } catch (err) {
      showNotification('Failed to update advance status.', 'error');
    }
  };

  const handleUpdateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdvance) return;

    try {
      const updates: any = {
        amount: editingAdvance.amount,
        date: editingAdvance.date,
        status: editingAdvance.status,
        isPaid: editingAdvance.isPaid || false,
        deductFrom: editingAdvance.deductFrom || 'Basic'
      };
      
      if (editingAdvance.approvedDate) {
        updates.approvedDate = editingAdvance.approvedDate;
      } else {
        updates.approvedDate = null;
      }

      await DataStore.updateAdvance(editingAdvance.id, updates, session.name);
      showNotification('Advance updated successfully.');
      setSearchedAdvances(prev => prev.map(a => a.id === editingAdvance.id ? { ...a, ...updates } : a));
      setEditingAdvance(null);
    } catch (err) {
      showNotification('Failed to update advance.', 'error');
    }
  };

  const handleExportAdvances = async () => {
    const advancesToExport = searchedAdvances
      .filter(a => {
        const hasBranchMgrAccess = viewableBranches.length > 0;
        const matchesPermission = (hasPayrollPermission || hasBranchMgrAccess) ? canViewEmployee(a.empId) : a.empId === currentEmpId;
        const matchesDate = a.date >= dateRange.from && a.date <= dateRange.to;
        const matchesStatus = (() => {
          if (activeTab === 'All') return true;
          if (activeTab === 'Settled') return a.status === 'Approved' && a.isPaid;
          if (activeTab === 'Partial') return a.status === 'Approved' && !a.isPaid && a.paidAmount && a.paidAmount > 0;
          if (activeTab === 'Approved') return a.status === 'Approved' && !a.isPaid && (!a.paidAmount || a.paidAmount === 0);
          return a.status === activeTab;
        })();
        const emp = (data.employees || []).find(e => e.id === a.empId);
        const matchesBranch = branchFilter === 'ALL' || emp?.branch === branchFilter;
        return matchesPermission && matchesDate && matchesStatus && matchesBranch;
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
    const adhocTotal = (data.ownAdhocBonuses || data.adhocBonuses || [])
      .filter(b => b.empId === emp.id && b.month === currentMonth && !alreadyPaidCmps.includes('CustomBonus'))
      .reduce((s, b) => s + b.amount, 0);

    const totalEarnings = base + performance + travel + vehicle + attendance + overtime + petrolLKR + adhocTotal;

    // Deductions
    const advTotal = (data.ownAdvances || data.advances || [])
      .filter(a => {
        const advanceDateStr = a.approvedDate || a.date;
        const [mStr, yStr] = currentMonth.split(' ');
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIndex = months.indexOf(mStr);
        const yearNum = parseInt(yStr, 10);
        
        const [advYearStr, advMonthStr] = advanceDateStr.split('-');
        const advYear = parseInt(advYearStr, 10);
        const advMnth = parseInt(advMonthStr, 10) - 1; // 0-indexed
        const isPastOrCurrent = advYear < yearNum || (advYear === yearNum && advMnth <= monthIndex);

        return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && isPastOrCurrent;
      })
      .reduce((s, a) => s + a.amount, 0);

    const epfPercentage = data.settings?.epfPercentage || 8;
    const epf = (!isMonthFinalized && emp.hasEPF) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
    const bike = !isMonthFinalized ? (emp.bikeInstallment || 0) : 0;
    const loan = !isMonthFinalized ? (emp.staffLoan || 0) : 0;

    const totalDeductions = advTotal + epf + bike + loan;

    return Math.max(0, totalEarnings - totalDeductions);
  };

  const displayAdvances = searchedAdvances
    .filter(a => {
        const hasBranchMgrAccess = viewableBranches.length > 0;
        const matchesPermission = (hasPayrollPermission || hasBranchMgrAccess) ? canViewEmployee(a.empId) : a.empId === currentEmpId;
        const matchesDate = a.date >= dateRange.from && a.date <= dateRange.to;
        const matchesStatus = (() => {
          if (activeTab === 'All') return true;
          if (activeTab === 'Settled') return a.status === 'Approved' && a.isPaid;
          if (activeTab === 'Partial') return a.status === 'Approved' && !a.isPaid && a.paidAmount && a.paidAmount > 0;
          if (activeTab === 'Approved') return a.status === 'Approved' && !a.isPaid && (!a.paidAmount || a.paidAmount === 0);
          return a.status === activeTab;
        })();
        
        const emp = (data.employees || []).find(e => e.id === a.empId);
        const matchesBranch = branchFilter === 'ALL' || emp?.branch === branchFilter;

        let matchesSearchTerm = true;
        if (searchTerm) {
          const empName = emp?.name?.toLowerCase() || '';
          const empIdStr = a.empId.toLowerCase();
          const q = searchTerm.toLowerCase();
          matchesSearchTerm = empName.includes(q) || empIdStr.includes(q);
        }

        return matchesPermission && matchesDate && matchesStatus && matchesSearchTerm && matchesBranch;
    })
    .sort((a, b) => b.id - a.id);

  return (
    <>
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
                <label className="text-xs font-medium text-text-secondary mb-2 block tracking-wider uppercase">Deduct From</label>
                <select
                  className="form-control"
                  required
                  value={newAdvance.deductFrom}
                  onChange={e => setNewAdvance({...newAdvance, deductFrom: e.target.value as any})}
                >
                  <option value="Basic">Basic Salary</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Traveling">Traveling</option>
                  <option value="Vehicle">Vehicle Allowance</option>
                </select>
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
                <label className="text-xs font-medium text-text-secondary mb-2 block tracking-wider uppercase">Attachment (PDF max 3MB, Images auto-compressed)</label>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-brand-accent/10 file:text-brand-accent hover:file:bg-brand-accent/20 cursor-pointer"
                  onChange={handleAdvanceFileChange}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center py-4" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <div className="form-group md:col-span-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">Search Employee</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    className="form-control text-xs pl-9"
                    placeholder="Search Name or ID..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group md:col-span-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">From Date</label>
                <input 
                  type="date" className="form-control text-xs" 
                  value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})}
                />
              </div>
              <div className="form-group md:col-span-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">To Date</label>
                <input 
                  type="date" className="form-control text-xs" 
                  value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})}
                />
              </div>
              {(hasPayrollPermission || viewableBranches.length > 0) && (
                <div className="form-group md:col-span-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">Branch</label>
                  <select
                    className="form-control text-xs"
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  >
                    <option value="ALL">All Branches</option>
                    {Array.from(new Set((data.employees || []).filter(e => e.branch).map(e => e.branch))).map(b => (
                      <option key={b as string} value={b as string}>{b as string}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={handleSearch}
                disabled={isSearching}
                className="btn btn-primary py-2.5 px-6 h-auto text-xs flex-1 md:flex-none justify-center"
              >
                <Search className="w-4 h-4 ml-0 mr-2" />
                {isSearching ? '...' : 'Search'}
              </button>
              <button 
                onClick={handleExportAdvances}
                className="btn btn-outline py-2.5 px-6 h-auto text-xs flex-1 md:flex-none justify-center"
              >
                <FileDown className="w-4 h-4 ml-0 mr-2" />
                Export
              </button>
            </div>
          </div>

          <div className="table-container">
            <div className="p-8 border-b border-border-accent bg-gray-50/50 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {hasPayrollPermission ? 'Salary Advance Management' : 'My Advance Requests'}
                  </h3>
                  <p className="text-[10px] text-text-secondary font-medium mt-1 uppercase tracking-widest">
                    {hasSearched ? `Showing results from ${dateRange.from} to ${dateRange.to}` : 'Click search to load advance requests'}
                  </p>
                </div>
              </div>
              
              <div className="flex border-b border-border-accent flex-wrap">
                {(hasPayrollPermission ? ['Pending', 'Approved', 'Partial', 'Settled', 'Rejected', 'All', 'Fixed Loans'] : ['Pending', 'Approved', 'Partial', 'Settled', 'Rejected', 'All'] as const).map((tab) => (
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
            
            {activeTab === 'Fixed Loans' ? (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Branch</th>
                    <th className="text-right">Monthly Installment</th>
                    <th className="text-right">Months Deducted</th>
                    <th className="text-right">Total Est. Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.employees || [])
                    .filter(e => canViewEmployee(e.id))
                    .map(emp => {
                      const monthlyStaffLoan = emp.staffLoan || 0;
                      const oldMonths = (data.paidDeductions?.[emp.id] || []).filter(month => !data.paidComponents?.[emp.id]?.[month]);
                      const newMonthsWithLoans = Object.keys(data.paidComponents?.[emp.id] || {}).filter(month => {
                        return data.paidComponents![emp.id][month].includes('Loans');
                      });
                      
                      const monthsDeducted = oldMonths.length + newMonthsWithLoans.length;
                      
                      return {
                        emp,
                        monthsDeducted,
                        totalEstimatedCollected: monthsDeducted * monthlyStaffLoan
                      };
                    })
                    .filter(s => s.monthsDeducted > 0 || (s.emp.staffLoan && s.emp.staffLoan > 0) || (s.emp.bikeInstallment && s.emp.bikeInstallment > 0))
                    .sort((a, b) => b.totalEstimatedCollected - a.totalEstimatedCollected)
                    .map(s => (
                      <tr key={s.emp.id}>
                        <td>
                          <div className="font-semibold text-sm text-text-primary">{s.emp.name}</div>
                          <div className="text-[10px] text-text-secondary font-medium mt-0.5 tracking-tight">{s.emp.id}</div>
                        </td>
                        <td>
                           <span className="badge badge-surface">{s.emp.branch}</span>
                        </td>
                        <td className="text-right font-mono text-sm text-text-secondary">
                          {s.emp.staffLoan > 0 ? `LKR ${s.emp.staffLoan.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-right text-sm text-text-secondary">
                          {s.monthsDeducted} {s.monthsDeducted === 1 ? 'Month' : 'Months'}
                        </td>
                        <td className="text-right font-mono text-sm font-bold text-brand-accent">
                          LKR {s.totalEstimatedCollected.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
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
                        <div className="text-[10px] text-text-secondary font-medium mt-2 flex flex-wrap items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-100 uppercase tracking-tight">
                            Deduct from: {a.deductFrom || 'Basic'}
                          </span>
                          <span>{a.reason}</span>
                          {a.attachment && (
                            <button onClick={() => handleDownloadAttachment(a.attachment!, `Advance_${a.empId}`)} className="text-brand-accent hover:underline flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                            </button>
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
                          
                          {a.isPaid ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-tight">Settled</span>
                              {a.actionHistory?.find(h => h.action.includes('Settled')) && (
                                <span className="text-[9px] text-text-secondary font-medium pl-1">
                                  By: {a.actionHistory.find(h => h.action.includes('Settled'))?.by}
                                </span>
                              )}
                            </div>
                          ) : (a.paidAmount && a.paidAmount > 0) ? (
                            <div className="flex flex-col gap-0.5 mt-1">
                              <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-tight border border-orange-100">
                                Partial (LKR {a.paidAmount.toLocaleString()})
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      {hasPayrollPermission && (
                        <td className="text-right">
                          <div className="flex gap-2 justify-end">
                            {(a.status === 'Pending' || isMasterAdmin) && (
                              <>
                                {a.status !== 'Approved' && (
                                  <button 
                                    onClick={() => handleAdvanceStatus(a.id, 'Approved')}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                {a.status !== 'Rejected' && (
                                  <button 
                                    onClick={() => handleAdvanceStatus(a.id, 'Rejected')}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {isMasterAdmin && (
                              <button 
                                onClick={() => setEditingAdvance(a)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={hasPayrollPermission ? 5 : 4} className="text-center py-12 text-text-secondary font-medium italic">
                      {!hasSearched ? (
                        'Click search to load advance requests.'
                      ) : (
                        `No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} requests found for the selected date range.`
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
    </div>

      {editingAdvance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Edit Advance Request</h3>
                <p className="text-indigo-100 text-sm">Modify advance details manually</p>
              </div>
              <button 
                onClick={() => setEditingAdvance(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                id="close-edit-modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateAdvance} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Amount (LKR)
                  </label>
                  <input
                    type="number"
                    value={editingAdvance.amount}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-background-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={editingAdvance.status}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, status: e.target.value as any })}
                    className="w-full px-4 py-2 bg-background-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Request Date
                </label>
                <input
                  type="date"
                  value={editingAdvance.date}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, date: e.target.value })}
                  className="w-full px-4 py-2 bg-background-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Deduct From
                </label>
                <select
                  value={editingAdvance.deductFrom || 'Basic'}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, deductFrom: e.target.value as any })}
                  className="w-full px-4 py-2 bg-background-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                >
                  <option value="Basic">Basic Salary</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Traveling">Traveling</option>
                  <option value="Vehicle">Vehicle Allowance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Approved Date
                </label>
                <input
                  type="date"
                  value={editingAdvance.approvedDate || ''}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, approvedDate: e.target.value })}
                  className="w-full px-4 py-2 bg-background-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
                <p className="text-[10px] text-text-secondary mt-1">Deduction month calculation is based on this date if present.</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-background-secondary rounded-xl">
                <input
                  type="checkbox"
                  id="edit-is-paid"
                  checked={editingAdvance.isPaid || false}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, isPaid: e.target.checked })}
                  className="w-5 h-5 rounded border-border-primary text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="edit-is-paid" className="text-sm font-medium text-text-primary">
                  Marked as Settled (Paid)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAdvance(null)}
                  className="flex-1 px-6 py-3 border border-border-primary text-text-secondary font-bold rounded-xl hover:bg-background-secondary transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
