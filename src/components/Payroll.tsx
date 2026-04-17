import React, { useState } from 'react';
import { AppData, Session, AdvanceRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Wallet, FileText, Check, X, Printer, FileDown, HandCoins, Paperclip } from 'lucide-react';
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

  const handleExport = async () => {
    const sheetData = data.employees.map(emp => {
      const advTotal = data.advances
        .filter(a => {
          const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
          return a.empId === emp.id && a.status === 'Approved' && !a.isPaid && advanceMonth === selectedMonth;
        })
        .reduce((s, a) => s + a.amount, 0);
      
      const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
      const epf = (emp.hasEPF && payComponents.epf) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
      
      const isAlreadyFinalized = data.paidDeductions?.[emp.id]?.includes(selectedMonth);

      const earnings = {
        'Basic Salary': payComponents.baseSalary ? (emp.baseSalary || 0) : 0,
        'Performance Allowance': payComponents.performanceAllowance ? (emp.performanceAllowance || 0) : 0,
        'Traveling Allowance': payComponents.travelingAllowance ? (emp.travelingAllowance || 0) : 0,
        'Vehicle Allowance': payComponents.vehicleAllowance ? (emp.vehicleAllowance || 0) : 0,
        'Petrol Allowance': payComponents.petrolAllowance ? petrolLKR : 0,
        'Attendance Bonus': payComponents.attendanceBonus ? (emp.attendanceBonus || 0) : 0,
        'Overtime': payComponents.overtime ? (emp.overtime || 0) : 0,
      };

      const totalEarnings = Object.values(earnings).reduce((s, v) => s + v, 0);

      const deductions = {
        'Salary Advances': payComponents.deductions ? advTotal : 0,
        'Bike Installment': (payComponents.deductions && !isAlreadyFinalized) ? (emp.bikeInstallment || 0) : 0,
        'Staff Loan': (payComponents.deductions && !isAlreadyFinalized) ? (emp.staffLoan || 0) : 0,
        [`EPF (${epfPercentage}%)`]: (!isAlreadyFinalized) ? epf : 0,
      };

      const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
      const net = totalEarnings - totalDeductions;

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
    
    // Show confirmation to finalize
    setTimeout(() => {
      setShowFinalizeConfirm(true);
    }, 1000);
  };

  const handleFinalize = async () => {
    const empIds = data.employees.map(e => e.id);
    try {
      await DataStore.finalizePayroll(selectedMonth, empIds);
      showNotification(`Payroll for ${selectedMonth} has been finalized. Advances marked as paid.`);
      setShowFinalizeConfirm(false);
    } catch (err) {
      showNotification('Failed to finalize payroll.', 'error');
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row gap-12 items-start">
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
                <label className="text-xs font-medium text-text-secondary mb-2 block">Attachment (PDF/Image, max 700KB)</label>
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
                    <button onClick={handleExport} className="btn btn-outline w-full justify-center py-4">
                      Export to Excel
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
                          <div className="flex flex-col gap-1">
                            <span className={`badge ${statusCls}`}>{a.status}</span>
                            {a.isPaid && <span className="badge bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Paid</span>}
                            {a.actionedBy && a.status !== 'Pending' && (
                              <div className="text-[10px] text-text-secondary mt-1">by {a.actionedBy}</div>
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
              <div className="p-6 border-b border-border-accent flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  Generated Paysheet
                  <span className="text-text-secondary font-normal ml-2">— {selectedMonth}</span>
                </h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>EMP ID</th>
                    <th>Name</th>
                    <th>Gross</th>
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
                    const epf = (emp.hasEPF && payComponents.epf) ? (emp.baseSalary || 0) * (epfPercentage / 100) : 0;
                    const isAlreadyFinalized = data.paidDeductions?.[emp.id]?.includes(selectedMonth);

                    const totalEarnings = (payComponents.baseSalary ? (emp.baseSalary || 0) : 0) + 
                                          (payComponents.performanceAllowance ? (emp.performanceAllowance || 0) : 0) + 
                                          (payComponents.travelingAllowance ? (emp.travelingAllowance || 0) : 0) + 
                                          (payComponents.vehicleAllowance ? (emp.vehicleAllowance || 0) : 0) +
                                          (payComponents.petrolAllowance ? petrolLKR : 0) + 
                                          (payComponents.attendanceBonus ? (emp.attendanceBonus || 0) : 0) + 
                                          (payComponents.overtime ? (emp.overtime || 0) : 0);

                    const totalDeductions = payComponents.deductions ? (advTotal + 
                                            ((!isAlreadyFinalized) ? (emp.bikeInstallment || 0) : 0) + 
                                            ((!isAlreadyFinalized) ? (emp.staffLoan || 0) : 0) + 
                                            ((!isAlreadyFinalized) ? epf : 0)) : 0;
                    const net = totalEarnings - totalDeductions;

                    return (
                      <tr key={emp.id}>
                        <td className="font-mono text-sm text-brand-accent">{emp.id}</td>
                        <td className="font-medium text-text-primary">{emp.name}</td>
                        <td className="text-xs text-text-secondary">LKR {totalEarnings.toLocaleString()}</td>
                        <td className="font-mono text-sm text-text-primary font-semibold">LKR {net.toLocaleString()}</td>
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
                              payComponents
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

      <ConfirmModal 
        isOpen={showFinalizeConfirm}
        title="Finalize Payroll"
        message={`Do you want to finalize the payroll for ${selectedMonth}? This will mark all approved advances as PAID and ensure recurring deductions (Staff Loan, Bike Installment, EPF) are not charged again if you run the paysheet for this month again.`}
        confirmText="Finalize & Mark Paid"
        onConfirm={handleFinalize}
        onCancel={() => setShowFinalizeConfirm(false)}
        type="info"
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
