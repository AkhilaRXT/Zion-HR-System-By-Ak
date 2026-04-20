import React, { useState } from 'react';
import { AppData, Session, AdvanceRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Wallet, FileText, Check, X, Printer, FileDown, HandCoins, Paperclip, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { printPayAdvice } from '../lib/payAdvice';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import Notification, { NotificationType } from './Notification';
import ConfirmModal from './ConfirmModal';
import { fileToBase64 } from '../lib/fileUtils';

interface PayrollProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function Payroll({ session, data, onRefresh }: PayrollProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const hasPayrollPermission = isAdmin && (isMasterAdmin || session.permissions?.includes('payroll'));
  
  const fuelPrice = data.settings.fuelPrice;
  const currentEmpId = session.empId;
  const [showPaysheet, setShowPaysheet] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  const [epfPercentage, setEpfPercentage] = useState(8);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [resetConfirmData, setResetConfirmData] = useState<string | null>(null);
  const [deleteReceiptConfirmId, setDeleteReceiptConfirmId] = useState<string | null>(null);

  const [finalizeData, setFinalizeData] = useState<{ empId: string; net: number, notes: string, components: string[] }[] | null>(null);

  const [activeTab, setActiveTab] = useState<'processing' | 'receipts'>('processing');
  const [showReceipt, setShowReceipt] = useState(false);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<{
    month: string;
    date: Date;
    data: { empId: string; net: number; notes: string; components: string[] }[];
  } | null>(null);

  const [customBonuses, setCustomBonuses] = useState<Record<string, number>>({});

  React.useEffect(() => {
    const bonusesForMonth = (data.adhocBonuses || []).filter(b => b.month === selectedMonth);
    const bonusMap: Record<string, number> = {};
    bonusesForMonth.forEach(b => {
      bonusMap[b.empId] = b.amount;
    });
    setCustomBonuses(bonusMap);
  }, [selectedMonth, data.adhocBonuses]);

  const [globalBonusTemplate, setGlobalBonusTemplate] = useState<number>(0);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const [newAdvance, setNewAdvance] = useState({ amount: 0, reason: '', attachment: '' });
  const [payComponents, setPayComponents] = useState({
    baseSalary: true,
    performanceAllowance: true,
    travelingAllowance: true,
    vehicleAllowance: true,
    petrolAllowance: true,
    attendanceBonus: true,
    overtime: true,
    deductions: true,
    epf: true
  });

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
    const emp = data.employees.find(e => e.id === currentEmpId);
    if (!emp) return;

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const advTotal = data.advances
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
    const advancesToExport = data.advances
      .filter(a => hasPayrollPermission || a.empId === currentEmpId)
      .sort((a, b) => b.id - a.id);

    const sheetData = advancesToExport.map(a => {
      const emp = data.employees.find(e => e.id === a.empId);
      return {
        Date: a.date,
        'EMP ID': a.empId,
        'Employee Name': emp?.name || 'Unknown',
        Reason: a.reason,
        Amount: a.amount,
        Status: a.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary Advances');
    XLSX.writeFile(wb, `Salary_Advances_${new Date().toISOString().split('T')[0]}.xlsx`);
    await DataStore.logAction('Export Data', 'Exported Salary Advances to Excel', 'Advance');
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const handleExport = async () => {
    setIsProcessing(true);
    const nets: { empId: string; net: number, notes: string, components: string[] }[] = [];
    
    // Base list of what the user intends to pay
    const selectedCompsBase: string[] = [];
    if (payComponents.baseSalary) selectedCompsBase.push('Basic');
    if (payComponents.performanceAllowance) selectedCompsBase.push('Bonus');
    if (payComponents.travelingAllowance) selectedCompsBase.push('Travel');
    if (payComponents.vehicleAllowance) selectedCompsBase.push('Vehicle');
    if (payComponents.petrolAllowance) selectedCompsBase.push('Petrol');
    if (payComponents.attendanceBonus) selectedCompsBase.push('Attendance');
    if (payComponents.overtime) selectedCompsBase.push('Overtime');
    if (payComponents.deductions) selectedCompsBase.push('Deductions');
    if (payComponents.epf) selectedCompsBase.push('EPF');

    const sheetData = data.employees.map(emp => {
      const alreadyPaidCmps = data.paidComponents?.[emp.id]?.[selectedMonth] || [];
      
      // Components actually being paid to THIS employee in THIS run
      const actuallyPayingCmps = selectedCompsBase.filter(c => !alreadyPaidCmps.includes(c));
      const notesStr = actuallyPayingCmps.join(', ');

      const advTotal = data.advances
        .filter(a => {
          const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
          return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && advanceMonth === selectedMonth;
        })
        .reduce((s, a) => s + a.amount, 0);
      
      const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
      const epf = (emp.hasEPF && payComponents.epf && !alreadyPaidCmps.includes('EPF')) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
      
      const isAlreadyFinalized = data.paidDeductions?.[emp.id]?.includes(selectedMonth);

      const earnings = {
        'Basic Salary': (payComponents.baseSalary && !alreadyPaidCmps.includes('Basic')) ? (emp.baseSalary || 0) : 0,
        'Performance Allowance': (payComponents.performanceAllowance && !alreadyPaidCmps.includes('Bonus')) ? (emp.performanceAllowance || 0) : 0,
        'Traveling Allowance': (payComponents.travelingAllowance && !alreadyPaidCmps.includes('Travel')) ? (emp.travelingAllowance || 0) : 0,
        'Vehicle Allowance': (payComponents.vehicleAllowance && !alreadyPaidCmps.includes('Vehicle')) ? (emp.vehicleAllowance || 0) : 0,
        'Petrol Allowance': (payComponents.petrolAllowance && !alreadyPaidCmps.includes('Petrol')) ? petrolLKR : 0,
        'Attendance Bonus': (payComponents.attendanceBonus && !alreadyPaidCmps.includes('Attendance')) ? (emp.attendanceBonus || 0) : 0,
        'Overtime': (payComponents.overtime && !alreadyPaidCmps.includes('Overtime')) ? (emp.overtime || 0) : 0,
        'Ad-Hoc Bonus': (!alreadyPaidCmps.includes('CustomBonus')) ? (customBonuses[emp.id] || 0) : 0
      };

      const totalEarnings = Object.values(earnings).reduce((s, v) => s + v, 0);

      const deductions = {
        'Salary Advances': payComponents.deductions ? advTotal : 0,
        'Bike Installment': (payComponents.deductions && !isAlreadyFinalized) ? (emp.bikeInstallment || 0) : 0,
        'Staff Loan': (payComponents.deductions && !isAlreadyFinalized) ? (emp.staffLoan || 0) : 0,
        [`EPF (${epfPercentage}%)`]: (!isAlreadyFinalized) ? epf : 0,
      };

      const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
      
      const net = Math.max(0, totalEarnings - totalDeductions);
      
      // If we are paying something OR if it is the first time we are locking deductions for this month
      if (net > 0 || !isAlreadyFinalized) {
        if (earnings['Ad-Hoc Bonus'] > 0) actuallyPayingCmps.push('CustomBonus');
        const finalNote = notesStr ? `${notesStr} (LKR ${net.toLocaleString()})` : `Payout (LKR ${net.toLocaleString()})`;
        nets.push({ empId: emp.id, net, notes: finalNote, components: actuallyPayingCmps });
      }

      return {
        'EMP ID': emp.id,
        'Employee Name': emp.name,
        'Designation': emp.role,
        'Branch': emp.branch,
        'Bank Name': emp.bankName || '-',
        'Bank Branch': emp.bankBranch || '-',
        'Account No': emp.accountNo || '-',
        ...earnings,
        'TOTAL EARNINGS': totalEarnings,
        ...deductions,
        'TOTAL DEDUCTIONS': totalDeductions,
        'NET PAYABLE AMOUNT': net
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Paysheet');
    XLSX.writeFile(wb, `Nexus_Payroll_${selectedMonth.replace(' ', '_')}.xlsx`);
    await DataStore.logAction('Export Data', `Exported Payroll for ${selectedMonth} to Excel`, 'Payroll' as any);
    
    setIsProcessing(false);
    setFinalizeData(nets);
    // Show confirmation to finalize
    setTimeout(() => {
      setShowFinalizeConfirm(true);
    }, 1000);
  };

  const handleResetMonth = () => {
    setResetConfirmData(selectedMonth);
  };
  
  const executeResetMonth = async () => {
    if (!resetConfirmData) return;
    setIsProcessing(true);
    setResetConfirmData(null);
    try {
      await DataStore.resetPayrollMonth(selectedMonth);
      showNotification(`Successfully unlocked/reset payroll data for ${selectedMonth}`);
    } catch(err) {
      console.error(err);
      showNotification('Failed to reset month.', 'error');
    }
    setIsProcessing(false);
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    try {
      if (finalizeData && finalizeData.length > 0) {
        await DataStore.finalizePayroll(selectedMonth, finalizeData);
        setLastTransaction({ month: selectedMonth, date: new Date(), data: finalizeData });
        setShowReceipt(true);
        showNotification(`Payroll finalized and marked as paid for ${selectedMonth}`);
      }
      setShowFinalizeConfirm(false);
      setFinalizeData([]);
    } catch (error) {
      console.error(error);
      showNotification('Failed to finalize payroll', 'error');
    }
    setIsProcessing(false);
  };

  const handleDeleteReceipt = (receiptId: string) => {
    setDeleteReceiptConfirmId(receiptId);
  };
  
  const executeDeleteReceipt = async () => {
    if (!deleteReceiptConfirmId) return;
    const receiptId = deleteReceiptConfirmId;
    setDeleteReceiptConfirmId(null);
    try {
      await DataStore.deletePayrollReceipt(receiptId);
      showNotification(`Receipt ${receiptId} reversed and deleted successfully.`);
    } catch (e: any) {
      console.error("Delete Receipt Failed:", e);
      if (e?.authInfo?.error) {
        showNotification(e.authInfo.error, 'error');
      } else {
        showNotification(e?.message || 'Failed to delete receipt.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 border-b border-border-accent">
        <button
          onClick={() => setActiveTab('processing')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'processing' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Payment Processing
        </button>
        {hasPayrollPermission && (
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'receipts' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            Payment Receipts Mode
          </button>
        )}
      </div>

      {activeTab === 'processing' && (
        <div className="flex flex-col lg:flex-row gap-12 items-start mt-6">
          <div className="w-full lg:w-1/3 space-y-8">
            <div className="glass-panel p-6 md:p-8">
              <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
              Request Salary Advance
            </h3>
            <form onSubmit={handleAdvanceSubmit} className="space-y-5">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Amount (LKR)</label>
                <input 
                  type="number" className="form-control" required min="1"
                  value={newAdvance.amount || ''} onChange={e => setNewAdvance({...newAdvance, amount: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Reason</label>
                <input 
                  type="text" className="form-control" required 
                  value={newAdvance.reason} onChange={e => setNewAdvance({...newAdvance, reason: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Attachment (PDF/Image, max 3MB)</label>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-accent file:text-white hover:file:bg-blue-700"
                  onChange={handleAdvanceFileChange}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center py-4">Submit Request</button>
            </form>
          </div>

          {hasPayrollPermission && (
            <div className="glass-panel p-8 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  Paysheet Generator
                </h3>
                <p className="text-xs text-text-secondary font-medium">Calculates net salary for all employees</p>
              </div>

              <div className="space-y-5">
                <div className="form-group">
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Select Month</label>
                  <input 
                    type="month" className="form-control"
                    onChange={e => {
                      const date = new Date(e.target.value);
                      setSelectedMonth(date.toLocaleString('default', { month: 'long', year: 'numeric' }));
                    }}
                  />
                </div>

                <div className="space-y-4 border-t border-border-accent pt-5">
                  <label className="text-xs font-semibold text-text-primary block mb-3">Include in this Payment</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'baseSalary', label: 'Basic Salary' },
                      { id: 'performanceAllowance', label: 'Performance' },
                      { id: 'travelingAllowance', label: 'Traveling' },
                      { id: 'vehicleAllowance', label: 'Vehicle' },
                      { id: 'petrolAllowance', label: 'Petrol' },
                      { id: 'attendanceBonus', label: 'Attendance' },
                      { id: 'overtime', label: 'Overtime' },
                      { id: 'deductions', label: 'Deductions (Advances/Loans)' },
                      { id: 'epf', label: 'EPF Deduction' }
                    ].map(comp => (
                      <label key={comp.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-brand-accent"
                          checked={(payComponents as any)[comp.id]}
                          onChange={e => setPayComponents({...payComponents, [comp.id]: e.target.checked})}
                        />
                        <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                          {comp.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {payComponents.epf && (
                  <div className="form-group animate-in fade-in slide-in-from-top-2 border-t border-border-accent pt-5">
                    <label className="text-xs font-medium text-text-secondary mb-2 block">EPF Percentage (%)</label>
                    <input 
                      type="number" className="form-control"
                      value={epfPercentage}
                      onChange={e => setEpfPercentage(Number(e.target.value))}
                    />
                  </div>
                )}

                <div className="space-y-4 pt-4">
                  <button 
                    onClick={() => setShowPaysheet(true)}
                    className="btn btn-primary w-full justify-center py-4"
                  >
                    Process Paysheet
                  </button>
                  {showPaysheet && (
                    <button onClick={handleExport} disabled={isProcessing} className="btn btn-outline w-full justify-center py-4">
                      {isProcessing ? 'Processing...' : 'Export to Excel'}
                    </button>
                  )}
                  {isMasterAdmin && (
                     <button 
                       onClick={handleResetMonth} 
                       disabled={isProcessing}
                       className="text-xs text-red-500 hover:text-red-700 w-full text-center mt-2 p-2 disabled:opacity-50"
                     >
                        Reset / Unlock {selectedMonth}
                     </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-2/3 space-y-12">
          <div className="table-container">
            <div className="p-6 border-b border-border-accent flex justify-between items-center">
              <h3 className="text-sm font-semibold text-text-primary">
                {hasPayrollPermission ? 'All Salary Advances' : 'My Salary Advances'}
              </h3>
              <button 
                onClick={handleExportAdvances}
                className="btn btn-outline py-2 px-4 h-auto text-xs"
              >
                <FileDown className="w-4 h-4" />
                Export
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {hasPayrollPermission && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.advances
                  .filter(a => hasPayrollPermission || a.empId === currentEmpId)
                  .sort((a, b) => b.id - a.id)
                  .map(a => {
                    const emp = data.employees.find(e => e.id === a.empId);
                    const statusCls = a.status === 'Approved' ? 'badge-success' : a.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                    
                    // Calculate net salary for this employee to show context
                    let netSalary = 0;
                    if (emp) {
                      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                      const advTotal = data.advances
                        .filter(adv => {
                          const advanceMonth = new Date(adv.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                          return adv.empId === emp.id && adv.status === 'Approved' && !adv.isPaid && advanceMonth === currentMonth;
                        })
                        .reduce((s, adv) => s + adv.amount, 0);
                      
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

                      netSalary = totalEarnings - totalDeductions;
                    }

                    return (
                      <tr key={a.id}>
                        <td className="font-mono text-sm text-text-secondary">{a.date}</td>
                        <td>
                          <div className="font-medium text-text-primary">{emp?.name || a.empId}</div>
                          <div className="text-xs text-text-secondary font-medium mt-1 flex items-center gap-2">
                            {a.reason}
                            {a.attachment && (
                              <a href={a.attachment} download={`Advance_Request_${a.empId}.pdf`} className="text-brand-accent hover:text-blue-700 flex items-center gap-1" title="View Attachment">
                                <Paperclip className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {hasPayrollPermission && emp && (
                            <div className="mt-2">
                              <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md font-semibold">
                                Est. Net: LKR {netSalary.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="font-mono text-sm text-brand-accent font-semibold">LKR {a.amount.toLocaleString()}</td>
                        <td>
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`badge ${statusCls}`}>{a.status}</span>
                            {a.isPaid && <span className="badge bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Settled via Payroll</span>}
                            
                            {/* Render History Log if available */}
                            {a.actionHistory && a.actionHistory.length > 0 ? (
                              <div className="mt-1 space-y-1 w-full bg-slate-50 rounded-md p-2 border border-slate-100 flex flex-col items-start text-left">
                                {a.actionHistory.map((h, i) => (
                                  <div key={i} className="text-[9px] text-slate-500 w-full text-left leading-tight">
                                    <span className="font-semibold text-slate-700">{h.action}</span> by {h.by}
                                  </div>
                                ))}
                              </div>
                            ) : (
                               a.actionedBy && a.status !== 'Pending' && (
                                 <div className="text-[10px] text-text-secondary mt-1 text-left w-full">by {a.actionedBy}</div>
                               )
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td>
                            {a.status === 'Pending' ? (
                              <div className="flex gap-4">
                                <button onClick={() => handleAdvanceStatus(a.id, 'Approved')} className="text-emerald-500 hover:text-white transition-all">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleAdvanceStatus(a.id, 'Rejected')} className="text-red-500 hover:text-white transition-all">
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

          {isAdmin && showPaysheet && (
            <div className="table-container animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-border-accent flex flex-col gap-4 md:flex-row md:items-center justify-between bg-gray-50/50">
                <h3 className="text-sm font-semibold text-text-primary">
                  Generated Paysheet
                  <span className="text-text-secondary font-normal ml-2">— {selectedMonth}</span>
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-border-accent shadow-sm">
                    <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">Global Bonus:</span>
                    <span className="text-xs text-text-secondary">LKR</span>
                    <input 
                      type="number" 
                      className="w-24 text-sm font-semibold text-brand-primary outline-none border-b border-transparent focus:border-brand-accent transition-colors bg-transparent"
                      placeholder="0"
                      value={globalBonusTemplate || ''}
                      onChange={e => setGlobalBonusTemplate(Number(e.target.value))}
                    />
                    <button 
                      onClick={async () => {
                        const nextBonuses = { ...customBonuses };
                        const batchPromises = data.employees.map(e => {
                          nextBonuses[e.id] = globalBonusTemplate;
                          return DataStore.saveAdhocBonus({
                            id: `${selectedMonth}_${e.id}`,
                            empId: e.id,
                            month: selectedMonth,
                            amount: globalBonusTemplate,
                            addedBy: session.name,
                            timestamp: new Date().toISOString()
                          });
                        });
                        setCustomBonuses(nextBonuses);
                        await Promise.all(batchPromises);
                        showNotification(`Applied LKR ${globalBonusTemplate.toLocaleString()} bonus to all.`);
                      }}
                      className="text-[10px] bg-brand-primary text-white px-2 py-1 rounded hover:bg-brand-secondary transition-colors whitespace-nowrap"
                    >
                      Apply All
                    </button>
                    <button 
                      onClick={async () => {
                        const clearPromises = Object.keys(customBonuses).map(empId => 
                          DataStore.clearAdhocBonus(`${selectedMonth}_${empId}`)
                        );
                        setCustomBonuses({});
                        setGlobalBonusTemplate(0);
                        await Promise.all(clearPromises);
                        showNotification('Cleared all ad-hoc bonuses.');
                      }}
                      className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 transition-colors whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>EMP ID</th>
                    <th>Name</th>
                    <th>Gross</th>
                    <th>Ad-Hoc Bonus</th>
                    <th>Net Salary</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map(emp => {
                    const advTotal = data.advances
                      .filter(a => {
                        const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                        return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && advanceMonth === selectedMonth;
                      })
                      .reduce((s, a) => s + a.amount, 0);
                    
                    const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
                    const alreadyPaidCmps = data.paidComponents?.[emp.id]?.[selectedMonth] || [];
                    const epf = (emp.hasEPF && payComponents.epf && !alreadyPaidCmps.includes('EPF')) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
                    const isAlreadyFinalized = data.paidDeductions?.[emp.id]?.includes(selectedMonth);

                    const manualBonus = (!alreadyPaidCmps.includes('CustomBonus')) ? (customBonuses[emp.id] || 0) : 0;

                    const totalEarnings = ((payComponents.baseSalary && !alreadyPaidCmps.includes('Basic')) ? (emp.baseSalary || 0) : 0) + 
                                          ((payComponents.performanceAllowance && !alreadyPaidCmps.includes('Bonus')) ? (emp.performanceAllowance || 0) : 0) + 
                                          ((payComponents.travelingAllowance && !alreadyPaidCmps.includes('Travel')) ? (emp.travelingAllowance || 0) : 0) + 
                                          ((payComponents.vehicleAllowance && !alreadyPaidCmps.includes('Vehicle')) ? (emp.vehicleAllowance || 0) : 0) +
                                          ((payComponents.petrolAllowance && !alreadyPaidCmps.includes('Petrol')) ? petrolLKR : 0) + 
                                          ((payComponents.attendanceBonus && !alreadyPaidCmps.includes('Attendance')) ? (emp.attendanceBonus || 0) : 0) + 
                                          ((payComponents.overtime && !alreadyPaidCmps.includes('Overtime')) ? (emp.overtime || 0) : 0) +
                                          manualBonus;

                    const totalDeductions = payComponents.deductions ? (advTotal + 
                                            ((!isAlreadyFinalized) ? (emp.bikeInstallment || 0) : 0) + 
                                            ((!isAlreadyFinalized) ? (emp.staffLoan || 0) : 0) + 
                                            ((!isAlreadyFinalized) ? epf : 0)) : 0;
                                            
                    const net = Math.max(0, totalEarnings - totalDeductions);

                    return (
                      <tr key={emp.id}>
                        <td className="font-mono text-sm text-brand-accent">{emp.id}</td>
                        <td className="font-medium text-text-primary">{emp.name}</td>
                        <td className="text-xs text-text-secondary">LKR {(totalEarnings - manualBonus).toLocaleString()}</td>
                        <td>
                          {(!alreadyPaidCmps.includes('CustomBonus')) ? (
                            <div className="flex items-center gap-1 max-w-[120px]">
                              <span className="text-xs text-text-secondary">LKR</span>
                              <input 
                                type="number" 
                                min="0"
                                className="w-full text-sm font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded px-2 py-1 outline-none focus:border-emerald-300 focus:bg-emerald-50 transition-colors"
                                value={customBonuses[emp.id] || ''}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setCustomBonuses(prev => ({ ...prev, [emp.id]: val }));
                                }}
                                onBlur={async (e) => {
                                  const val = Number(e.target.value);
                                  if (val > 0) {
                                    await DataStore.saveAdhocBonus({
                                      id: `${selectedMonth}_${emp.id}`,
                                      empId: emp.id,
                                      month: selectedMonth,
                                      amount: val,
                                      addedBy: session.name,
                                      timestamp: new Date().toISOString()
                                    });
                                  } else {
                                    await DataStore.clearAdhocBonus(`${selectedMonth}_${emp.id}`);
                                  }
                                }}
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold italic">Paid ({manualBonus})</span>
                          )}
                        </td>
                        <td className="font-mono text-sm font-semibold text-text-primary">LKR {net.toLocaleString()}</td>
                        <td>
                          <button 
                            onClick={() => printPayAdvice(
                              emp, 
                              selectedMonth, 
                              advTotal, 
                              fuelPrice, 
                              payComponents.epf, 
                              epfPercentage,
                              data.settings.companyName,
                              data.settings.companySubtitle,
                              payComponents,
                              manualBonus
                            )}
                            className="text-text-secondary hover:text-brand-accent transition-colors"
                            title="Print Advice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'receipts' && hasPayrollPermission && (
        <div className="space-y-6 mt-6">
          <div className="table-container">
            <div className="p-6 border-b border-border-accent flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" /> Payment Transaction Receipts
              </h3>
            </div>
            {data.payrollReceipts && data.payrollReceipts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {data.payrollReceipts.map(receipt => {
                  const isExpanded = expandedReceipt === receipt.id;
                  
                  return (
                  <div key={receipt.id} className="border border-border-accent bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    <div className="p-5">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Transaction</span>
                            <h4 className="text-sm font-bold text-text-primary mt-2">{receipt.month}</h4>
                            <p className="text-[10px] text-text-secondary mt-1">{new Date(receipt.timestamp).toLocaleString()}</p>
                          </div>
                          <span className="text-xs font-mono text-text-secondary font-medium">#{receipt.id.split('-')[1]}</span>
                       </div>
                       <div className="space-y-3 pt-3 border-t border-border-accent">
                          <div className="flex justify-between">
                            <span className="text-xs text-text-secondary">Employees Paid</span>
                            <span className="text-xs font-medium text-text-primary">{receipt.employeesPaid}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-text-secondary">Actioned By</span>
                            <span className="text-xs font-medium text-text-primary">{receipt.actionedBy}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-bold text-text-primary">Total Payout</span>
                            <span className="text-sm font-mono font-bold text-emerald-600">LKR {receipt.totalPayout.toLocaleString()}</span>
                          </div>
                       </div>
                       
                       <div className="mt-4 pt-3 border-t border-border-accent flex justify-between items-center gap-2">
                         <button 
                            onClick={() => setExpandedReceipt(isExpanded ? null : receipt.id)}
                            className="text-xs font-medium text-brand-primary flex items-center gap-1 hover:text-brand-accent transition-colors"
                         >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                         </button>
                         {isMasterAdmin && (
                            <button 
                              onClick={() => handleDeleteReceipt(receipt.id)}
                              className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors"
                              title="Delete Transaction & Reverse Payouts"
                            >
                              <Trash2 className="w-3 h-3" /> Revert
                            </button>
                         )}
                       </div>
                       
                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden"
                           >
                             <div className="mt-4 space-y-2 pt-2 border-t border-border-accent/50 max-h-48 overflow-y-auto custom-scrollbar">
                               {receipt.transactions.map((t, idx) => {
                                  const emp = data.employees.find(e => e.id === t.empId);
                                  return (
                                    <div key={idx} className="p-2 border border-border-accent rounded bg-gray-50 flex justify-between items-center">
                                       <div className="overflow-hidden">
                                          <p className="text-xs font-semibold text-text-primary truncate">{emp?.name || t.empId}</p>
                                          <p className="text-[9px] text-text-secondary truncate mt-0.5">{t.notes}</p>
                                       </div>
                                       <div className="text-right flex-shrink-0 ml-2">
                                          <p className="text-xs font-mono font-bold text-emerald-600">LKR {t.net.toLocaleString()}</p>
                                       </div>
                                    </div>
                                  );
                               })}
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="p-12 text-center text-text-secondary text-sm">
                 No payment receipts generated yet.
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showFinalizeConfirm}
        title="Finalize Payroll"
        message={`Do you want to finalize the payroll for ${selectedMonth}? This will lock the partial payments and mark approved advances as PAID. You will get a receipt summary on success.`}
        confirmText="Finalize & Mark Paid"
        onConfirm={handleFinalize}
        onCancel={() => setShowFinalizeConfirm(false)}
        type="info"
      />

      <ConfirmModal 
        isOpen={!!resetConfirmData}
        title="Reset Month Data"
        message={`Are you SURE you want to unlock ${selectedMonth}? This will reset all partial payments, and any salary advances settled this month will become pending deductions again. Make sure no money was actually transferred!`}
        confirmText="Unlock & Reset"
        onConfirm={executeResetMonth}
        onCancel={() => setResetConfirmData(null)}
        type="danger"
      />

      <ConfirmModal 
        isOpen={!!deleteReceiptConfirmId}
        title="Delete Payment Receipt"
        message={`Are you SURE you want to delete this payment receipt? All partial payments inside it will be reversed, and any salary advances settled in this batch will become pending deductions again.`}
        confirmText="Revert & Delete"
        onConfirm={executeDeleteReceipt}
        onCancel={() => setDeleteReceiptConfirmId(null)}
        type="danger"
      />

      <AnimatePresence>
        {showReceipt && lastTransaction && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="p-6 border-b border-border-accent flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Payment Receipt</h3>
                  <p className="text-xs text-text-secondary mt-1">Transaction Summary for {lastTransaction.month}</p>
                </div>
                <button onClick={() => setShowReceipt(false)} className="text-text-secondary hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="flex gap-4 mb-8">
                  <div className="flex-1 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">Total Payout</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      LKR {lastTransaction.data.reduce((s, p) => s + p.net, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs font-semibold text-blue-800 mb-1">Employees Paid</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {lastTransaction.data.length}
                    </p>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-text-primary mb-4">Detailed Breakdown</h4>
                <div className="space-y-3">
                  {lastTransaction.data.map((p, idx) => {
                     const emp = data.employees.find(e => e.id === p.empId);
                     return (
                       <div key={idx} className="p-4 border border-border-accent rounded-xl bg-white flex justify-between items-center">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{emp?.name || p.empId} <span className="font-mono text-xs text-text-secondary ml-2">{p.empId}</span></p>
                            <p className="text-[10px] text-text-secondary mt-1 max-w-[300px] truncate">{p.notes}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-mono font-bold text-brand-primary">LKR {p.net.toLocaleString()}</p>
                             <p className="text-[10px] font-semibold text-emerald-600 mt-1 uppercase tracking-wider">SUCCESS</p>
                          </div>
                       </div>
                     );
                  })}
                </div>
              </div>
              <div className="p-6 border-t border-border-accent bg-gray-50 flex justify-end">
                <button onClick={() => setShowReceipt(false)} className="btn btn-primary">
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
