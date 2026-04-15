import React, { useRef, useState } from 'react';
import { AppData, Session } from '../types';
import { User, Wallet, CalendarCheck, PlaneTakeoff, Camera, Landmark } from 'lucide-react';
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

  const emp = data.employees.find(e => e.id === session.empId);
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
          showNotification('Failed to process image. Please try a smaller file.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fuelPrice = data.settings.fuelPrice;
  const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
  
  // Calculate leave balances dynamically based on current policy and approved leaves
  const policy = data.settings.leavePolicy;
  const approvedLeaves = data.leaves.filter(l => l.empId === emp.id && l.status === 'Approved');
  
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

  const myAttendance = data.attendance.filter(a => a.empId === emp.id).sort((a, b) => b.id - a.id).slice(0, 5);
  const myLeaves = data.leaves.filter(l => l.empId === emp.id).sort((a, b) => b.id - a.id);
  const myAdvances = data.advances.filter(a => a.empId === emp.id).sort((a, b) => b.id - a.id);
  const myCashRequests = data.cashRequests?.filter(r => r.empId === emp.id).sort((a, b) => b.id - a.id) || [];
  
  const pendingLeaves = myLeaves.filter(l => l.status === 'Pending');
  const pendingAdvances = myAdvances.filter(a => a.status === 'Pending');
  const pendingCashRequests = myCashRequests.filter(r => r.status === 'Pending');
  
  const recentHistory = [
    ...myLeaves.filter(l => l.status !== 'Pending').map(l => ({ ...l, typeCategory: 'Leave' as const })),
    ...myAdvances.filter(a => a.status !== 'Pending').map(a => ({ ...a, typeCategory: 'Advance' as const })),
    ...myCashRequests.filter(r => r.status !== 'Pending').map(r => ({ ...r, typeCategory: 'Cash' as const, originalCategory: r.category }))
  ].sort((a, b) => b.id - a.id).slice(0, 5);

  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const advTotal = data.advances
    .filter(a => {
      const advanceMonth = new Date(a.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      return a.empId === emp.id && a.status === 'Approved' && advanceMonth === currentMonth;
    })
    .reduce((s, a) => s + a.amount, 0);
  
  const epf = emp.hasEPF ? (emp.baseSalary || 0) * 0.08 : 0;
  const totalDeductions = advTotal + (emp.bikeInstallment || 0) + (emp.staffLoan || 0) + epf;
  
  const gross = (emp.baseSalary || 0) + (emp.travelingAllowance || 0) + (emp.vehicleAllowance || 0) +
                (emp.performanceAllowance || 0) + petrolLKR + (emp.attendanceBonus || 0) + (emp.overtime || 0);
  const netSalary = gross - totalDeductions;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="bg-bg-secondary border border-border-accent p-12">
        <div className="flex flex-col md:flex-row gap-12 items-center md:items-start">
          <div 
            onClick={handlePhotoClick}
            className="w-40 h-40 bg-bg-primary border border-border-accent flex items-center justify-center relative group cursor-pointer overflow-hidden rounded-full shadow-2xl"
          >
            {emp.profilePic ? (
              <img src={emp.profilePic} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-20 h-20 text-brand-accent/50" />
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
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
            <h3 className="text-[24px] font-serif text-text-primary mb-2">{emp.name}</h3>
            <p className="text-[12px] uppercase tracking-[3px] text-brand-accent mb-6">{emp.role}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[1px] text-text-secondary">Employee ID</p>
                <p className="text-[14px] font-serif text-text-primary">{emp.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[1px] text-text-secondary">Department</p>
                <p className="text-[14px] font-serif text-text-primary">{emp.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[1px] text-text-secondary">Branch</p>
                <p className="text-[14px] font-serif text-text-primary">{emp.branch}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-bg-secondary border border-border-accent p-10">
          <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Salary Breakdown
          </h4>
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-[2px] text-text-secondary mb-4">Earnings</p>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Basic Salary</span>
                <span className="font-serif text-text-primary">LKR {emp.baseSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Allowances (Fuel/Travel/Veh)</span>
                <span className="font-serif text-text-primary">LKR {(petrolLKR + (emp.travelingAllowance || 0) + (emp.vehicleAllowance || 0)).toLocaleString()}</span>
              </div>
              {(emp.performanceAllowance || 0) > 0 && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">Performance Bonus</span>
                  <span className="font-serif text-text-primary">LKR {emp.performanceAllowance.toLocaleString()}</span>
                </div>
              )}
              {(emp.attendanceBonus || 0) > 0 && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">Attendance Bonus</span>
                  <span className="font-serif text-text-primary">LKR {emp.attendanceBonus.toLocaleString()}</span>
                </div>
              )}
              {(emp.overtime || 0) > 0 && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">Overtime</span>
                  <span className="font-serif text-text-primary">LKR {emp.overtime.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border-accent/30">
              <p className="text-[9px] uppercase tracking-[2px] text-text-secondary mb-4">Deductions</p>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-text-secondary">Salary Advances ({currentMonth})</span>
                <span className="font-serif text-rose-400">- LKR {advTotal.toLocaleString()}</span>
              </div>
              {emp.hasEPF && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">EPF (8%)</span>
                  <span className="font-serif text-rose-400">- LKR {epf.toLocaleString()}</span>
                </div>
              )}
              {((emp.bikeInstallment || 0) + (emp.staffLoan || 0)) > 0 && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">Loans/Installments</span>
                  <span className="font-serif text-rose-400">- LKR {((emp.bikeInstallment || 0) + (emp.staffLoan || 0)).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-border-accent">
              <span className="text-[11px] uppercase tracking-[1px] text-brand-accent font-bold">Estimated Net</span>
              <span className="text-[20px] font-serif text-brand-accent">LKR {netSalary.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-accent p-10">
          <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            <PlaneTakeoff className="w-4 h-4" /> Leave Balances
          </h4>
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Annual</span>
              <span className="font-serif text-text-primary">{balances.annual} days</span>
            </div>
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Casual</span>
              <span className="font-serif text-text-primary">{balances.casual} days</span>
            </div>
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Sick</span>
              <span className="font-serif text-text-primary">{balances.sick} days</span>
            </div>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-accent p-10">
          <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Bank Details
          </h4>
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Bank Name</span>
              <span className="font-serif text-text-primary">{emp.bankName || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Branch</span>
              <span className="font-serif text-text-primary">{emp.bankBranch || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border-accent pb-4">
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">Account No</span>
              <span className="font-serif text-text-primary">{emp.accountNo || 'Not Set'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="table-container">
          <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" /> Recent Attendance
          </h4>
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
                  <td className="font-serif text-text-secondary">{a.date}</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td className="font-serif">{a.checkIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-bg-secondary border border-border-accent p-10">
          <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8 flex items-center gap-2">
            <PlaneTakeoff className="w-4 h-4" /> Pending Requests
          </h4>
          <div className="space-y-6">
            {pendingLeaves.length === 0 && pendingAdvances.length === 0 && pendingCashRequests.length === 0 ? (
              <p className="text-[10px] text-text-secondary uppercase tracking-[1px] text-center py-4">No pending requests</p>
            ) : (
              <>
                {pendingLeaves.map(l => (
                  <div key={l.id} className="flex justify-between items-center border-b border-border-accent pb-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-[1px] text-text-primary block">{l.type} Leave</span>
                      <span className="text-[9px] text-text-secondary uppercase tracking-[1px]">{l.from} → {l.to}</span>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))}
                {pendingAdvances.map(a => (
                  <div key={a.id} className="flex justify-between items-center border-b border-border-accent pb-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-[1px] text-text-primary block">Salary Advance</span>
                      <span className="text-[9px] text-text-secondary uppercase tracking-[1px]">LKR {a.amount.toLocaleString()}</span>
                    </div>
                    <span className="badge badge-warning">Pending</span>
                  </div>
                ))}
                {pendingCashRequests.map(r => (
                  <div key={r.id} className="flex justify-between items-center border-b border-border-accent pb-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-[1px] text-text-primary block">Cash Request: {r.category}</span>
                      <span className="text-[9px] text-text-secondary uppercase tracking-[1px]">LKR {r.amount.toLocaleString()}</span>
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
        <h4 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8">Recent Request History</h4>
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
                  <td className="text-[11px] uppercase tracking-[1px] font-bold">{item.typeCategory}</td>
                  <td className="text-[11px] text-text-secondary">
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
                <td colSpan={3} className="text-center py-8 text-text-secondary uppercase tracking-[1px] text-[10px]">No history available</td>
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
