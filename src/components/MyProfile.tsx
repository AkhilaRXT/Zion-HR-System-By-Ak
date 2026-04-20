import React, { useRef, useState } from 'react';
import { AppData, Session } from '../types';
import { User, Wallet, CalendarCheck, PlaneTakeoff, Camera, Landmark, Database } from 'lucide-react';
import { DataStore } from '../lib/dataStore';
import { compressImage } from '../lib/imageUtils';
import { AnimatePresence } from 'motion/react';
import Notification, { NotificationType } from './Notification';

interface MyProfileProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function MyProfile({ session, data, onRefresh }: MyProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const emp = (data.employees || []).find(e => e.id === session.empId);
  if (!emp) return <div className="p-8 text-brand-accent uppercase tracking-[2px]">Employee not found</div>;

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const compressed = await compressImage(base64String);
          await DataStore.updateEmployee(emp.id, { profilePic: compressed });
          showNotification('Profile picture updated successfully!');
        } catch (err) {
          console.error('Failed to compress image:', err);
          showNotification('Failed to process image. Ensure file is an image under 3MB.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fuelPrice = data.settings?.fuelPrice || 398;
  const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
  
  // Calculate leave balances dynamically based on current policy and approved leaves
  const policy = data.settings?.leavePolicy || { monthlyLimit: 0, annualTotal: 0, casualTotal: 0, sickTotal: 0 };
  const approvedLeaves = (data.leaves || []).filter(l => l.empId === emp.id && l.status === 'Approved');
  
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

  const myAttendance = (data.attendance || []).filter(a => a.empId === emp.id).sort((a, b) => b.id - a.id).slice(0, 5);
  const myLeaves = (data.leaves || []).filter(l => l.empId === emp.id).sort((a, b) => b.id - a.id);
  const myAdvances = (data.advances || []).filter(a => a.empId === emp.id).sort((a, b) => b.id - a.id);
  const myCashRequests = (data.cashRequests || []).filter(r => r.empId === emp.id).sort((a, b) => b.id - a.id);
  
  const pendingLeaves = myLeaves.filter(l => l.status === 'Pending');
  const pendingAdvances = myAdvances.filter(a => a.status === 'Pending');
  const pendingCashRequests = myCashRequests.filter(r => r.status === 'Pending');
  
  const recentHistory = [
    ...myLeaves.filter(l => l.status !== 'Pending').map(l => ({ ...l, typeCategory: 'Leave' as const })),
    ...myAdvances.filter(a => a.status !== 'Pending').map(a => ({ ...a, typeCategory: 'Advance' as const })),
    ...myCashRequests.filter(r => r.status !== 'Pending').map(r => ({ ...r, typeCategory: 'Cash' as const, originalCategory: r.category }))
  ].sort((a, b) => b.id - a.id).slice(0, 5);

  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const advTotal = (data.advances || [])
    .filter(a => {
      const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      // In the profile view, show all approved advances for the month, regardless of isPaid, so they can see their total advance deduction for the month's breakdown
      return a.empId === emp.id && a.status === 'Approved' && advanceMonth === currentMonth;
    })
    .reduce((s, a) => s + a.amount, 0);
  
  const isAlreadyFinalized = data.paidDeductions?.[emp.id]?.includes(currentMonth);

  const epf = emp.hasEPF ? (emp.baseSalary || 0) * 0.08 : 0;
  const bikeInstallment = emp.bikeInstallment || 0;
  const staffLoan = emp.staffLoan || 0;

  const totalDeductions = advTotal + bikeInstallment + staffLoan + epf;
  
  const pendingBonus = (data.adhocBonuses || []).find(b => b.empId === emp.id && b.month === currentMonth)?.amount || 0;
  const gross = (emp.baseSalary || 0) + (emp.travelingAllowance || 0) + (emp.vehicleAllowance || 0) +
                (emp.performanceAllowance || 0) + petrolLKR + (emp.attendanceBonus || 0) + (emp.overtime || 0) + pendingBonus;

  const alreadyPaid = data.paidSalaryAmounts?.[emp.id]?.[currentMonth] || 0;
  const rawNet = gross - totalDeductions - alreadyPaid;
  const netSalary = Math.max(0, rawNet);

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="glass-panel p-10">
        <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
          <div 
            onClick={handlePhotoClick}
            className="w-32 h-32 bg-bg-primary border border-border-accent flex items-center justify-center relative group cursor-pointer overflow-hidden rounded-full shadow-lg"
          >
            {emp.profilePic ? (
              <img src={emp.profilePic} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-16 h-16 text-brand-accent/50" />
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-bold text-text-primary mb-1">{emp.name}</h3>
            <p className="text-sm font-semibold text-brand-accent mb-6">{emp.role}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">Employee ID</p>
                <p className="text-sm font-semibold text-text-primary">{emp.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">Department</p>
                <p className="text-sm font-semibold text-text-primary">{emp.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-secondary">Branch</p>
                <p className="text-sm font-semibold text-text-primary">{emp.branch}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8">
          <h4 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-accent" /> Salary Breakdown ({currentMonth})
          </h4>
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Earnings</p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Basic Salary</span>
                <span className="font-mono text-text-primary font-semibold">LKR {emp.baseSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Allowances</span>
                <span className="font-mono text-text-primary font-semibold">LKR {(petrolLKR + (emp.travelingAllowance || 0) + (emp.vehicleAllowance || 0)).toLocaleString()}</span>
              </div>
              {(emp.performanceAllowance || 0) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary font-medium">Performance Bonus</span>
                  <span className="font-mono text-text-primary font-semibold">LKR {emp.performanceAllowance.toLocaleString()}</span>
                </div>
              )}
              {pendingBonus > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-600 font-medium">Ad-Hoc Bonus / Incentives</span>
                  <span className="font-mono text-emerald-600 font-bold">LKR {pendingBonus.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border-accent">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Deductions</p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Salary Advances</span>
                <span className="font-mono text-red-500 font-semibold">- LKR {advTotal.toLocaleString()}</span>
              </div>
              {emp.hasEPF && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary font-medium">EPF (8%)</span>
                  <span className="font-mono text-red-500 font-semibold">- LKR {epf.toLocaleString()}</span>
                </div>
              )}
              {bikeInstallment > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary font-medium">Bike Installment</span>
                  <span className="font-mono text-red-500 font-semibold">- LKR {bikeInstallment.toLocaleString()}</span>
                </div>
              )}
              {staffLoan > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary font-medium">Staff Loan</span>
                  <span className="font-mono text-red-500 font-semibold">- LKR {staffLoan.toLocaleString()}</span>
                </div>
              )}
              {alreadyPaid > 0 && (
                <div className="pt-2 border-t border-border-accent/50 space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-primary font-medium">Banked / Transferred Amount</span>
                    <span className="font-mono text-brand-primary font-bold">- LKR {alreadyPaid.toLocaleString()}</span>
                  </div>
                  {data.paidSalaryNotes?.[emp.id]?.[currentMonth] && (
                    <div className="text-[10px] text-text-secondary italic pl-2">
                       (Transferred Components: {data.paidSalaryNotes[emp.id][currentMonth]})
                    </div>
                  )}
                </div>
              )}
              {isAlreadyFinalized && (
                <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-[10px] text-green-700 font-medium text-center">
                  Payroll locked and processed.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-5 border-t border-border-accent">
              <span className="text-sm font-bold text-brand-accent">Estimated Net</span>
              <span className="text-xl font-bold text-brand-accent">LKR {netSalary.toLocaleString()}</span>
            </div>
          </div>

          {Object.keys(data.paidSalaryAmounts?.[emp.id] || {}).length > 0 && (
            <div className="glass-panel p-8">
              <h4 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" /> Payment History
              </h4>
              <div className="space-y-8">
                {Object.keys(data.paidSalaryNotes?.[emp.id] || {})
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                  .map(month => (
                    <div key={month} className="space-y-3">
                      <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest bg-brand-primary/5 px-2 py-1 rounded inline-block">{month}</p>
                      <div className="space-y-3 pl-2 border-l-2 border-emerald-100">
                        {data.paidSalaryNotes?.[emp.id]?.[month]?.split(' | ').map((note: string, idx: number) => {
                          const parts = note.match(/(.+) \(LKR (.+)\)/);
                          const comps = parts ? parts[1] : note;
                          const amt = parts ? parts[2] : '-';
                          return (
                            <div key={idx} className="flex justify-between items-center py-1">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-text-primary">Batch #{idx + 1}</p>
                                <p className="text-[10px] text-text-secondary">{comps}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono font-bold text-emerald-600">LKR {amt}</p>
                                <span className="text-[9px] px-1 bg-emerald-100 text-emerald-700 rounded uppercase font-bold tracking-tight">Paid</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="glass-panel p-8">
            <h4 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
              <PlaneTakeoff className="w-4 h-4 text-brand-accent" /> Leave Balances
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Annual</p>
                <p className="text-lg font-bold text-text-primary">{balances.annual}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Casual</p>
                <p className="text-lg font-bold text-text-primary">{balances.casual}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Sick</p>
                <p className="text-lg font-bold text-text-primary">{balances.sick}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8">
            <h4 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-brand-accent" /> Bank Details
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Bank Name</span>
                <span className="font-semibold text-text-primary">{emp.bankName || 'Not Set'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Branch</span>
                <span className="font-semibold text-text-primary">{emp.bankBranch || 'Not Set'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary font-medium">Account No</span>
                <span className="font-mono font-semibold text-text-primary">{emp.accountNo || 'Not Set'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="table-container">
          <div className="p-6 border-b border-border-accent">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-brand-accent" /> Recent Attendance
            </h4>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check In</th>
              </tr>
            </thead>
            <tbody>
              {myAttendance.map(a => (
                <tr key={a.id}>
                  <td className="font-mono text-sm text-text-secondary">{a.date}</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td className="font-mono text-sm">{a.checkIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-panel p-8">
          <h4 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            <PlaneTakeoff className="w-4 h-4 text-brand-accent" /> Pending Requests
          </h4>
          <div className="space-y-4">
            {pendingLeaves.length === 0 && pendingAdvances.length === 0 && pendingCashRequests.length === 0 ? (
              <p className="text-xs text-text-secondary font-medium text-center py-6">No pending requests</p>
            ) : (
              <>
                {pendingLeaves.map(l => (
                  <div key={l.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-text-primary block">{l.type} Leave</span>
                      <span className="text-xs text-text-secondary font-medium">{l.from} → {l.to}</span>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))}
                {pendingAdvances.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-text-primary block">Salary Advance</span>
                      <span className="text-xs text-text-secondary font-medium">LKR {a.amount.toLocaleString()}</span>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))}
                {pendingCashRequests.map(r => (
                  <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-text-primary block">Cash Request: {r.category}</span>
                      <span className="text-xs text-text-secondary font-medium">LKR {r.amount.toLocaleString()}</span>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="p-6 border-b border-border-accent">
          <h4 className="text-sm font-semibold text-text-primary">Recent Request History</h4>
        </div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentHistory.map((item: any) => {
              const statusCls = item.status === 'Approved' ? 'badge-success' : 'badge-danger';
              return (
                <tr key={item.id}>
                  <td className="text-xs font-bold text-text-primary uppercase tracking-wider">{item.typeCategory}</td>
                  <td className="text-sm text-text-secondary font-medium">
                    {item.typeCategory === 'Leave' ? `${item.type} (${item.from} to ${item.to})` : 
                     item.typeCategory === 'Advance' ? `LKR ${item.amount.toLocaleString()} - ${item.reason}` :
                     `LKR ${item.amount.toLocaleString()} - ${item.originalCategory}`}
                  </td>
                  <td><span className={`badge ${statusCls}`}>{item.status}</span></td>
                </tr>
              );
            })}
            {recentHistory.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-text-secondary font-medium text-xs">No history available</td>
              </tr>
            )}
          </tbody>
        </table>
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
