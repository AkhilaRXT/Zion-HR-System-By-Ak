import React, { useState } from 'react';
import { AppData, Session, Employee } from '../types';
import { DataStore } from '../lib/dataStore';
import { compressImage } from '../lib/imageUtils';
import { 
  Trash2, 
  Edit, 
  X,
  Save,
  Search,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface StaffManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function StaffManagement({ session, data, onRefresh }: StaffManagementProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const fuelPrice = data.settings?.fuelPrice || 398;
  const [searchTerm, setSearchTerm] = useState('');
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<(Employee & { username?: string, password?: string, isSystemAdmin?: boolean, permissions?: string[] }) | null>(null);
  
  // Modal & Notification State
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmIdChange, setConfirmIdChange] = useState<{ oldId: string, newId: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const [newEmp, setNewEmp] = useState({
    empNo: '',
    name: '',
    email: '',
    role: '',
    department: 'Lending',
    branch: '',
    baseSalary: 0,
    travelingAllowance: 0,
    vehicleAllowance: 0,
    performanceAllowance: 0,
    petrolLitres: 0,
    attendanceBonus: 0,
    overtime: 0,
    bikeInstallment: 0,
    staffLoan: 0,
    bankName: '',
    bankBranch: '',
    accountNo: '',
    profilePic: '',
    hasEPF: true,
    status: 'Active' as const,
    salaryStatus: 'Active' as const,
    heldFrom: '',
    heldTo: '',
    heldComponents: [] as string[],
    username: '',
    password: '',
    isSystemAdmin: false,
    permissions: [] as string[]
  });

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const compressed = await compressImage(base64String);
          if (isEdit && isEditing) {
            setIsEditing({ ...isEditing, profilePic: compressed });
          } else {
            setNewEmp({ ...newEmp, profilePic: compressed });
          }
        } catch (err) {
          console.error('Failed to compress image:', err);
          showNotification('Failed to process image. Ensure file is an image under 3MB.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newEmp.empNo || `EMP${String((data.employees || []).length + 1).padStart(3, '0')}`;
    
    const employee: Employee = {
      id,
      name: newEmp.name,
      email: newEmp.email,
      role: newEmp.role,
      department: newEmp.department,
      branch: newEmp.branch,
      baseSalary: newEmp.baseSalary,
      travelingAllowance: newEmp.travelingAllowance,
      vehicleAllowance: newEmp.vehicleAllowance,
      performanceAllowance: newEmp.performanceAllowance,
      petrolLitres: newEmp.petrolLitres,
      attendanceBonus: newEmp.attendanceBonus,
      overtime: newEmp.overtime,
      bikeInstallment: newEmp.bikeInstallment,
      staffLoan: newEmp.staffLoan,
      bankName: newEmp.bankName,
      bankBranch: newEmp.bankBranch,
      accountNo: newEmp.accountNo,
      profilePic: newEmp.profilePic,
      hasEPF: newEmp.hasEPF,
      status: newEmp.status,
      salaryStatus: newEmp.salaryStatus,
      heldFrom: newEmp.heldFrom,
      heldTo: newEmp.heldTo,
      heldComponents: newEmp.heldComponents
    };

    const cred = {
      empId: id,
      username: newEmp.username || id.toLowerCase(),
      password: newEmp.password || 'pass123',
      isAdmin: newEmp.isSystemAdmin,
      permissions: newEmp.isSystemAdmin ? newEmp.permissions : []
    };

    try {
      await DataStore.addEmployee(employee, cred);
      showNotification(`Employee ${employee.name} added successfully!`);
      setNewEmp({
        empNo: '', name: '', email: '', role: '', department: 'Lending', branch: '',
        baseSalary: 0, travelingAllowance: 0, vehicleAllowance: 0, performanceAllowance: 0,
        petrolLitres: 0, attendanceBonus: 0, overtime: 0, bikeInstallment: 0, staffLoan: 0,
        bankName: '', bankBranch: '', accountNo: '', profilePic: '', hasEPF: true,
        status: 'Active', salaryStatus: 'Active',
        heldFrom: '', heldTo: '',
        heldComponents: [],
        username: '', password: '', isSystemAdmin: false, permissions: []
      });
    } catch (err: any) {
      console.error('Add Staff Error:', err);
      showNotification(err.message || 'Failed to add employee. Please try again.', 'error');
    }
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteEmployee(confirmDelete);
        showNotification('Employee deleted successfully.');
        setConfirmDelete(null);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete employee.', 'error');
      }
    }
  };

  const handleUpdate = async (e?: React.FormEvent, forceIdChange = false) => {
    if (e) e.preventDefault();
    if (isEditing && originalId) {
      if (isEditing.id !== originalId && !forceIdChange) {
        setConfirmIdChange({ oldId: originalId, newId: isEditing.id });
        return;
      }

      const { username, password, isSystemAdmin, permissions, ...empUpdates } = isEditing;
      const credUpdates: any = {};
      if (username) credUpdates.username = username;
      if (password) credUpdates.password = password;
      credUpdates.isAdmin = isSystemAdmin;
      credUpdates.permissions = isSystemAdmin ? permissions : [];
      
      try {
        if (forceIdChange) {
          showNotification('Migrating records... Please wait.', 'info');
        }
        await DataStore.updateEmployee(originalId, empUpdates, credUpdates);
        showNotification(isEditing.id !== originalId ? 'Employee ID and records migrated successfully.' : 'Employee details updated.');
        setIsEditing(null);
        setOriginalId(null);
        setConfirmIdChange(null);
      } catch (err: any) {
        console.error('Update Staff Error:', err);
        showNotification(err.message || 'Failed to update employee.', 'error');
      }
    }
  };

  const startEditing = (emp: Employee) => {
    const cred = (data.credentials || []).find(c => c.empId === emp.id);
    setOriginalId(emp.id);
    setIsEditing({
      ...emp,
      username: cred?.username || '',
      password: cred?.password || '',
      isSystemAdmin: cred?.isAdmin || false,
      permissions: cred?.permissions || [],
      heldComponents: emp.heldComponents || [],
      heldFrom: emp.heldFrom || '',
      heldTo: emp.heldTo || ''
    });
  };

  const filteredEmployees = (data.employees || []).filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePermissionToggle = (perm: string) => {
    setNewEmp(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-12 items-start">
        {isAdmin && (
          <div className="flex-1 min-w-[400px] bg-bg-secondary border border-border-accent p-10">
            <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-8">Add New Employee</h3>
            
            <form onSubmit={handleAddStaff} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group col-span-1 md:col-span-2">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Full Name *</label>
                  <input 
                    type="text" className="form-control" required 
                    value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">EMP No</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. EMP010"
                    value={newEmp.empNo} onChange={e => setNewEmp({...newEmp, empNo: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Email Address</label>
                  <input 
                    type="email" className="form-control" placeholder="e.g. employee@gmail.com"
                    value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Department</label>
                  <select 
                    className="form-control"
                    value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value})}
                  >
                    <option>Lending</option>
                    <option>Collections</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Operations</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Role *</label>
                  <input 
                    type="text" className="form-control" required 
                    value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch *</label>
                  <input 
                    type="text" className="form-control" required 
                    value={newEmp.branch} onChange={e => setNewEmp({...newEmp, branch: e.target.value})}
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Profile Picture</label>
                  <input 
                    type="file" className="form-control" accept="image/*"
                    onChange={(e) => handleProfilePicChange(e)}
                  />
                </div>
              </div>

              <div className="border border-border-accent p-8 space-y-8">
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                  Login Credentials
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Username *</label>
                    <input 
                      type="text" className="form-control" required 
                      value={newEmp.username} onChange={e => setNewEmp({...newEmp, username: e.target.value})}
                      placeholder="e.g. akila.v"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Password *</label>
                    <input 
                      type="password" className="form-control" required 
                      value={newEmp.password} onChange={e => setNewEmp({...newEmp, password: e.target.value})}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-border-accent p-8 space-y-8">
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                  Salary, Allowances & Deductions
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Basic Salary (LKR) *</label>
                    <input 
                      type="number" className="form-control" required 
                      value={newEmp.baseSalary} onChange={e => setNewEmp({...newEmp, baseSalary: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Petrol (Litres)</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.petrolLitres} onChange={e => setNewEmp({...newEmp, petrolLitres: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Traveling Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.travelingAllowance} onChange={e => setNewEmp({...newEmp, travelingAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Vehicle Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.vehicleAllowance} onChange={e => setNewEmp({...newEmp, vehicleAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Performance Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.performanceAllowance} onChange={e => setNewEmp({...newEmp, performanceAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Attendance Bonus</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.attendanceBonus} onChange={e => setNewEmp({...newEmp, attendanceBonus: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Overtime (LKR)</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.overtime} onChange={e => setNewEmp({...newEmp, overtime: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Bike Installment</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.bikeInstallment} onChange={e => setNewEmp({...newEmp, bikeInstallment: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group col-span-1 md:col-span-2">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Staff Loan Deduction</label>
                    <input 
                      type="number" className="form-control" 
                      value={newEmp.staffLoan} onChange={e => setNewEmp({...newEmp, staffLoan: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group col-span-1 md:col-span-2 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-brand-accent"
                        checked={newEmp.hasEPF} 
                        onChange={e => setNewEmp({...newEmp, hasEPF: e.target.checked})} 
                      />
                      <span className="text-[10px] uppercase tracking-[1px] text-text-secondary group-hover:text-text-primary transition-colors">Enable EPF Deduction (8%)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border border-border-accent p-8 space-y-8">
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                  Bank Details
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Bank Name</label>
                    <input 
                      type="text" className="form-control" 
                      value={newEmp.bankName} onChange={e => setNewEmp({...newEmp, bankName: e.target.value})}
                      placeholder="e.g. Commercial Bank"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch</label>
                    <input 
                      type="text" className="form-control" 
                      value={newEmp.bankBranch} onChange={e => setNewEmp({...newEmp, bankBranch: e.target.value})}
                      placeholder="e.g. Colombo 07"
                    />
                  </div>
                  <div className="form-group col-span-1 md:col-span-2">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Account Number</label>
                    <input 
                      type="text" className="form-control" 
                      value={newEmp.accountNo} onChange={e => setNewEmp({...newEmp, accountNo: e.target.value})}
                      placeholder="e.g. 8001234567"
                    />
                  </div>
                </div>
              </div>

              {isMasterAdmin && (
                <div className="border border-red-200 bg-red-50/10 p-8 space-y-8">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-[2px] flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                    Master Admin Controls
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Account Status</label>
                      <select 
                        className="form-control border-red-200 focus:border-red-500"
                        value={newEmp.status} onChange={e => setNewEmp({...newEmp, status: e.target.value as any})}
                      >
                        <option value="Active">Active (Working)</option>
                        <option value="Dormant">Dormant (Resigned/Terminated)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Salary Hold Status</label>
                      <select 
                        className="form-control border-red-200 focus:border-red-500"
                        value={newEmp.salaryStatus} onChange={e => setNewEmp({...newEmp, salaryStatus: e.target.value as any})}
                      >
                        <option value="Active">No Hold</option>
                        <option value="Held_1">Hold for 1 Month</option>
                        <option value="Held_2">Hold for 2 Months</option>
                        <option value="Held_Forever">Hold Forever</option>
                        <option value="Custom">Hold Specific Dates</option>
                      </select>
                    </div>

                    {newEmp.salaryStatus === 'Custom' && (
                      <div className="form-group col-span-1 md:col-span-2 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-2 block font-bold">From Date</label>
                          <input 
                            type="date" className="form-control border-red-200" 
                            value={newEmp.heldFrom} onChange={e => setNewEmp({...newEmp, heldFrom: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-2 block font-bold">To Date</label>
                          <input 
                            type="date" className="form-control border-red-200" 
                            value={newEmp.heldTo} onChange={e => setNewEmp({...newEmp, heldTo: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {newEmp.salaryStatus !== 'Active' && (
                      <div className="form-group col-span-1 md:col-span-2">
                        <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-4 block font-bold">Select Components to Hold</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { id: 'Basic', label: 'Basic Salary' },
                            { id: 'Travel', label: 'Travel Allowance' },
                            { id: 'Vehicle', label: 'Vehicle Allowance' },
                            { id: 'Performance', label: 'Performance Allowance' },
                            { id: 'Petrol', label: 'Petrol' },
                            { id: 'Attendance', label: 'Attendance Bonus' },
                            { id: 'Overtime', label: 'Overtime' },
                            { id: 'CustomBonus', label: 'Custom Bonus' }
                          ].map(cmp => (
                            <label key={cmp.id} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-3 h-3 accent-red-600"
                                checked={newEmp.heldComponents.includes(cmp.id)}
                                onChange={e => {
                                  const next = e.target.checked 
                                    ? [...newEmp.heldComponents, cmp.id]
                                    : newEmp.heldComponents.filter(id => id !== cmp.id);
                                  setNewEmp({...newEmp, heldComponents: next});
                                }}
                              />
                              <span className="text-[9px] uppercase tracking-[1px] text-text-secondary group-hover:text-red-600 transition-colors">
                                {cmp.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-border-accent p-8 space-y-8">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                    System Access
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-brand-accent"
                      checked={newEmp.isSystemAdmin}
                      onChange={e => setNewEmp({...newEmp, isSystemAdmin: e.target.checked})}
                    />
                    <span className="text-[10px] uppercase tracking-[1px] text-text-primary">Grant Admin Access</span>
                  </label>
                </div>

                {newEmp.isSystemAdmin && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary block">Area Permissions</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { id: 'staff', label: 'Staff Management' },
                          { id: 'attendance', label: 'Attendance' },
                          { id: 'leave', label: 'Leave Management' },
                          { id: 'payroll', label: 'Payroll' },
                          { id: 'cash_requests', label: 'Cash Requests' }
                        ].map(perm => (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-brand-accent"
                              checked={newEmp.permissions.includes(perm.id)}
                              onChange={() => handlePermissionToggle(perm.id)}
                            />
                            <span className="text-[9px] uppercase tracking-[1px] text-text-secondary group-hover:text-text-primary transition-colors">
                              {perm.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary w-full justify-center py-4">
                Add Member
              </button>
            </form>
          </div>
        )}

        <div className="flex-[2] min-w-[320px] space-y-8">
          <div className="flex items-center gap-4 bg-bg-secondary border border-border-accent px-6 py-4">
            <Search className="w-4 h-4 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Search by name or ID..." 
              className="bg-transparent border-none outline-none flex-1 text-[12px] uppercase tracking-[1px] py-1"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="table-container">
            <div className="p-6 border-b border-border-accent flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Staff Roster
              </h3>
              <span className="text-xs font-medium text-text-secondary">{filteredEmployees.length} members</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>EMP No</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Dept</th>
                  {isAdmin && (
                    <>
                      <th>Gross Salary</th>
                      <th>Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const petrolLKR = (emp.petrolLitres || 0) * fuelPrice;
                  const gross = (emp.baseSalary || 0) + (emp.travelingAllowance || 0) + (emp.vehicleAllowance || 0) + (emp.performanceAllowance || 0) + petrolLKR + (emp.attendanceBonus || 0) + (emp.overtime || 0);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 border border-border-accent flex items-center justify-center overflow-hidden rounded-full shadow-sm">
                            {emp.profilePic ? (
                              <img src={emp.profilePic} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-5 h-5 text-text-secondary" />
                            )}
                          </div>
                          <span className="font-mono text-sm text-brand-accent">{emp.id}</span>
                        </div>
                      </td>
                      <td className="font-medium text-text-primary">
                        {emp.name}
                        {emp.status === 'Dormant' && (
                          <span className="ml-2 text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 uppercase font-bold tracking-tighter">Dormant</span>
                        )}
                        {emp.salaryStatus && emp.salaryStatus !== 'Active' && (
                          <span 
                            title={(emp.heldComponents || []).length > 0 ? `Holding: ${emp.heldComponents?.join(', ')}` : "All components held"}
                            className="ml-2 text-[8px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 uppercase font-bold tracking-tighter cursor-help"
                          >
                            {(emp.heldComponents || []).length > 0 ? 'Partial Hold' : 'Full Hold'} ({
                              emp.salaryStatus === 'Custom' 
                                ? `${new Date(emp.heldFrom!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(emp.heldTo!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                                : emp.salaryStatus?.replace('Held_', '').replace('Forever', '∞')
                            })
                          </span>
                        )}
                      </td>
                      <td className="text-sm text-text-secondary">{emp.role}</td>
                      <td><span className="badge badge-info">{emp.department}</span></td>
                      {isAdmin && (
                        <>
                          <td className="font-mono text-sm text-text-primary">LKR {gross.toLocaleString()}</td>
                          <td>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => startEditing(emp)}
                                className="text-text-secondary hover:text-brand-accent transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete(emp.id)}
                                className="text-text-secondary hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary border border-border-accent p-12 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-bg-primary border border-border-accent flex items-center justify-center overflow-hidden rounded-full shadow-lg">
                    {isEditing.profilePic ? (
                      <img src={isEditing.profilePic} alt={isEditing.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-8 h-8 text-text-secondary" />
                    )}
                  </div>
                  <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent">Edit Employee</h3>
                </div>
                <button onClick={() => setIsEditing(null)} className="text-text-secondary hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group col-span-1 md:col-span-2">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Full Name</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.name} onChange={e => setIsEditing({...isEditing, name: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">EMP No</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.id} onChange={e => setIsEditing({...isEditing, id: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Email Address</label>
                    <input 
                      type="email" className="form-control"
                      value={isEditing.email || ''} onChange={e => setIsEditing({...isEditing, email: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Role</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.role} onChange={e => setIsEditing({...isEditing, role: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Username</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.username} onChange={e => setIsEditing({...isEditing, username: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Password</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.password} onChange={e => setIsEditing({...isEditing, password: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Department</label>
                    <select 
                      className="form-control"
                      value={isEditing.department} onChange={e => setIsEditing({...isEditing, department: e.target.value})}
                    >
                      <option>Lending</option>
                      <option>Collections</option>
                      <option>HR</option>
                      <option>Finance</option>
                      <option>Operations</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch</label>
                    <input 
                      type="text" className="form-control" required 
                      value={isEditing.branch} onChange={e => setIsEditing({...isEditing, branch: e.target.value})}
                    />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Profile Picture</label>
                    <input 
                      type="file" className="form-control" accept="image/*"
                      onChange={(e) => handleProfilePicChange(e, true)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Basic Salary</label>
                    <input 
                      type="number" className="form-control" required 
                      value={isEditing.baseSalary} onChange={e => setIsEditing({...isEditing, baseSalary: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Petrol (Litres)</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.petrolLitres} onChange={e => setIsEditing({...isEditing, petrolLitres: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Traveling Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.travelingAllowance} onChange={e => setIsEditing({...isEditing, travelingAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Vehicle Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.vehicleAllowance} onChange={e => setIsEditing({...isEditing, vehicleAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Performance Allowance</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.performanceAllowance} onChange={e => setIsEditing({...isEditing, performanceAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Attendance Bonus</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.attendanceBonus} onChange={e => setIsEditing({...isEditing, attendanceBonus: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Overtime (LKR)</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.overtime} onChange={e => setIsEditing({...isEditing, overtime: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Bike Installment</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.bikeInstallment} onChange={e => setIsEditing({...isEditing, bikeInstallment: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Staff Loan</label>
                    <input 
                      type="number" className="form-control" 
                      value={isEditing.staffLoan} onChange={e => setIsEditing({...isEditing, staffLoan: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group col-span-2 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-brand-accent"
                        checked={isEditing.hasEPF} 
                        onChange={e => setIsEditing({...isEditing, hasEPF: e.target.checked})} 
                      />
                      <span className="text-[10px] uppercase tracking-[1px] text-text-secondary group-hover:text-text-primary transition-colors">Enable EPF Deduction (8%)</span>
                    </label>
                  </div>
                </div>

                <div className="border border-border-accent p-8 space-y-8">
                  <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                    Bank Details
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Bank Name</label>
                      <input 
                        type="text" className="form-control" 
                        value={isEditing.bankName} onChange={e => setIsEditing({...isEditing, bankName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch</label>
                      <input 
                        type="text" className="form-control" 
                        value={isEditing.bankBranch} onChange={e => setIsEditing({...isEditing, bankBranch: e.target.value})}
                      />
                    </div>
                    <div className="form-group col-span-2">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Account Number</label>
                      <input 
                        type="text" className="form-control" 
                        value={isEditing.accountNo} onChange={e => setIsEditing({...isEditing, accountNo: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {isMasterAdmin && (
                  <div className="border border-red-200 bg-red-50/10 p-8 space-y-8">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-[2px] flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                      Master Admin Controls
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="form-group">
                        <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Account Status</label>
                        <select 
                          className="form-control border-red-200 focus:border-red-500"
                          value={isEditing.status || 'Active'} onChange={e => setIsEditing({...isEditing, status: e.target.value as any})}
                        >
                          <option value="Active">Active (Working)</option>
                          <option value="Dormant">Dormant (Resigned/Terminated)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Salary Hold Status</label>
                        <select 
                          className="form-control border-red-200 focus:border-red-500"
                          value={isEditing.salaryStatus || 'Active'} onChange={e => setIsEditing({...isEditing, salaryStatus: e.target.value as any})}
                        >
                          <option value="Active">No Hold</option>
                          <option value="Held_1">Hold for 1 Month</option>
                          <option value="Held_2">Hold for 2 Months</option>
                          <option value="Held_Forever">Hold Forever</option>
                          <option value="Custom">Hold Specific Dates</option>
                        </select>
                      </div>

                      {isEditing.salaryStatus === 'Custom' && (
                        <div className="form-group col-span-1 md:col-span-2 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-2 block font-bold">From Date</label>
                            <input 
                              type="date" className="form-control border-red-200" 
                              value={isEditing.heldFrom} onChange={e => setIsEditing({...isEditing, heldFrom: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-2 block font-bold">To Date</label>
                            <input 
                              type="date" className="form-control border-red-200" 
                              value={isEditing.heldTo} onChange={e => setIsEditing({...isEditing, heldTo: e.target.value})}
                            />
                          </div>
                        </div>
                      )}

                      {isEditing.salaryStatus && isEditing.salaryStatus !== 'Active' && (
                        <div className="form-group col-span-1 md:col-span-2">
                          <label className="text-[10px] uppercase tracking-[2px] text-red-600 mb-4 block font-bold">Select Components to Hold</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              { id: 'Basic', label: 'Basic Salary' },
                              { id: 'Travel', label: 'Travel Allowance' },
                              { id: 'Vehicle', label: 'Vehicle Allowance' },
                              { id: 'Performance', label: 'Performance Allowance' },
                              { id: 'Petrol', label: 'Petrol' },
                              { id: 'Attendance', label: 'Attendance Bonus' },
                              { id: 'Overtime', label: 'Overtime' },
                              { id: 'CustomBonus', label: 'Custom Bonus' }
                            ].map(cmp => (
                              <label key={cmp.id} className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 accent-red-600"
                                  checked={(isEditing.heldComponents || []).includes(cmp.id)}
                                  onChange={e => {
                                    const current = isEditing.heldComponents || [];
                                    const next = e.target.checked 
                                      ? [...current, cmp.id]
                                      : current.filter(id => id !== cmp.id);
                                    setIsEditing({...isEditing, heldComponents: next});
                                  }}
                                />
                                <span className="text-[9px] uppercase tracking-[1px] text-text-secondary group-hover:text-red-600 transition-colors">
                                  {cmp.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border border-border-accent p-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">
                      System Access
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-brand-accent"
                        checked={isEditing.isSystemAdmin}
                        onChange={e => setIsEditing({...isEditing, isSystemAdmin: e.target.checked})}
                      />
                      <span className="text-[10px] uppercase tracking-[1px] text-text-primary">Grant Admin Access</span>
                    </label>
                  </div>

                  {isEditing.isSystemAdmin && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[2px] text-text-secondary block">Area Permissions</label>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: 'staff', label: 'Staff Management' },
                            { id: 'attendance', label: 'Attendance' },
                            { id: 'leave', label: 'Leave Management' },
                            { id: 'payroll', label: 'Payroll' },
                            { id: 'cash_requests', label: 'Cash Requests' }
                          ].map(perm => (
                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-3 h-3 accent-brand-accent"
                                checked={isEditing.permissions?.includes(perm.id)}
                                onChange={() => {
                                  const current = isEditing.permissions || [];
                                  const next = current.includes(perm.id)
                                    ? current.filter(p => p !== perm.id)
                                    : [...current, perm.id];
                                  setIsEditing({...isEditing, permissions: next});
                                }}
                              />
                              <span className="text-[9px] uppercase tracking-[1px] text-text-secondary group-hover:text-text-primary transition-colors">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary w-full justify-center py-4">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete employee ${confirmDelete}? This action cannot be undone and will remove all associated records.`}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal 
        isOpen={!!confirmIdChange}
        title="Critical ID Change Migration"
        message={`You are changing the biological identifier of this employee from ${confirmIdChange?.oldId} to ${confirmIdChange?.newId}. This will automatically trigger a cascading update across ALL historical data (Attendance, Leaves, Payments, etc). This process is intensive. Do you wish to proceed?`}
        confirmText="Migrate Everything"
        cancelText="Cancel"
        type="warning"
        onConfirm={() => handleUpdate(undefined, true)}
        onCancel={() => setConfirmIdChange(null)}
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
