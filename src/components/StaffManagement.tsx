import React, { useState } from 'react';
import { AppData, Session, Employee } from '../types';
import { DataStore } from '../lib/dataStore';
import { compressImage } from '../lib/imageUtils';
import { db } from '../lib/firebase';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { 
  Trash2, 
  Edit, 
  X,
  Save,
  Search,
  User,
  FileDown,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [activeTab, setActiveTab] = useState<'directory' | 'roster'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRoster, setShowAllRoster] = useState(false);
  const [rosterBranchFilter, setRosterBranchFilter] = useState('ALL');
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<(Employee & { username?: string, password?: string, isSystemAdmin?: boolean, permissions?: string[], viewableBranches?: string[] }) | null>(null);

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
    branchCode: '',
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
    dateOfBirth: '',
    joiningDate: '',
    status: 'Active' as const,
    salaryStatus: 'Active' as const,
    heldFrom: '',
    heldTo: '',
    heldComponents: [] as string[],
    username: '',
    password: '',
    isSystemAdmin: false,
    permissions: [] as string[],
    viewableBranches: [] as string[]
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
      branchCode: newEmp.branchCode,
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
      dateOfBirth: newEmp.dateOfBirth,
      joiningDate: newEmp.joiningDate,
      status: newEmp.status,
      salaryStatus: newEmp.salaryStatus,
      heldFrom: newEmp.heldFrom,
      heldTo: newEmp.heldTo,
      heldComponents: newEmp.heldComponents
    };

    const cred = {
      empId: id,
      username: (newEmp.username || id.toLowerCase()).trim(),
      password: (newEmp.password || 'pass123').trim(),
      isAdmin: newEmp.isSystemAdmin,
      permissions: newEmp.isSystemAdmin ? newEmp.permissions : [],
      viewableBranches: newEmp.isSystemAdmin ? newEmp.viewableBranches : []
    };

    try {
      await DataStore.addEmployee(employee, cred);
      showNotification(`Employee ${employee.name} added successfully!`);
      setNewEmp({
        empNo: '', name: '', email: '', role: '', department: 'Lending', branch: '', branchCode: '',
        baseSalary: 0, travelingAllowance: 0, vehicleAllowance: 0, performanceAllowance: 0,
        petrolLitres: 0, attendanceBonus: 0, overtime: 0, bikeInstallment: 0, staffLoan: 0,
        bankName: '', bankBranch: '', accountNo: '', profilePic: '', hasEPF: true,
        dateOfBirth: '', joiningDate: '',
        status: 'Active', salaryStatus: 'Active',
        heldFrom: '', heldTo: '',
        heldComponents: [],
        username: '', password: '', isSystemAdmin: false, permissions: [], viewableBranches: []
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

      const { username, password, isSystemAdmin, permissions, viewableBranches, ...empUpdates } = isEditing;
      let credUpdates: any = undefined;
      if (isMasterAdmin) {
        credUpdates = {};
        if (username) credUpdates.username = username.trim();
        if (password) credUpdates.password = password.trim();
        credUpdates.isAdmin = isSystemAdmin;
        credUpdates.permissions = isSystemAdmin ? permissions : [];
        credUpdates.viewableBranches = isSystemAdmin ? viewableBranches : [];
      }
      
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

  const startEditing = async (emp: Employee) => {
    let cred = (data.credentials || []).find(c => c.empId === emp.id);
    
    // In case there are duplicates, prefer the one with isAdmin if any
    const allCreds = (data.credentials || []).filter(c => c.empId === emp.id);
    if (allCreds.length > 1) {
      cred = allCreds.find(c => c.isAdmin) || cred;
      console.warn('Multiple credentials found for', emp.id, allCreds);
    }
    
    // If not found in memory, try fetching directly from DB in case sync is slow
    if (!cred) {
      try {
        const snap = await getDocs(query(collection(db, 'credentials'), where('empId', '==', emp.id)));
        if (!snap.empty) {
          const docs = snap.docs.map(d => d.data() as any);
          cred = docs.find(c => c.isAdmin) || docs[0];
          console.log('Fetched missing credential from DB:', cred);
        }
      } catch (e) {
        console.warn('Failed to direct fetch credentials', e);
      }
    }
    
    console.log('Editing', emp.id, 'Found cred:', cred);

    setOriginalId(emp.id);
    setIsEditing({
      ...emp,
      username: cred?.username || '',
      password: cred?.password || '',
      isSystemAdmin: cred?.isAdmin || false,
      permissions: cred?.permissions || [],
      viewableBranches: cred?.viewableBranches || [],
      heldComponents: emp.heldComponents || [],
      heldFrom: emp.heldFrom || '',
      heldTo: emp.heldTo || ''
    });
  };

  const viewableBranches = session.viewableBranches || [];

  const canViewEmployee = (empId: string) => {
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (session.isAdmin && (viewableBranches.length === 0 || viewableBranches.includes('ALL'))) return true;
    if (viewableBranches.includes('ALL')) return true;
    const emp = (data.employees || []).find(e => e.id === empId);
    return emp ? viewableBranches.includes(emp.branch) : false;
  };

  const filteredEmployees = (data.employees || [])
    .filter(e => e.id !== 'EMP003' && canViewEmployee(e.id))
    .filter(e => rosterBranchFilter === 'ALL' ? true : e.branch === rosterBranchFilter)
    .filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const displayedEmployees = (searchTerm.trim() || showAllRoster)
    ? filteredEmployees 
    : filteredEmployees.slice(0, 10);

  const exportStaffDataToExcel = () => {
    const exportData = filteredEmployees.map(emp => {
       const grossSalary = (emp.baseSalary || 0) + 
          (emp.performanceAllowance || 0) + 
          (emp.travelingAllowance || 0) + 
          (emp.vehicleAllowance || 0) + 
          (emp.attendanceBonus || 0) + 
          (emp.overtime || 0) + 
          ((emp.petrolLitres || 0) * (data.settings?.fuelPrice || 398));
          
       return {
          "EMP NO": emp.id,
          "Full Name": emp.name,
          "Email": emp.email,
          "Role": emp.role,
          "Department": emp.department,
          "Branch": emp.branch,
          "Status": emp.status,
          "Gross Salary (LKR)": grossSalary,
          "Base Salary (LKR)": emp.baseSalary || 0,
          "Bank Name": emp.bankName || '',
          "Bank Branch": emp.bankBranch || '',
          "Account No": emp.accountNo || ''
       };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Details");
    XLSX.writeFile(workbook, `Staff_Details_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePermissionToggle = (perm: string) => {
    setNewEmp(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const handleBranchToggle = (branchId: string, isEditingForm: boolean = false) => {
    const updateBranches = (current: string[]) => {
      if (branchId === 'ALL') {
        return current.includes('ALL') ? [] : ['ALL'];
      }
      return current.includes(branchId) 
        ? current.filter(b => b !== branchId) 
        : [...current.filter(b => b !== 'ALL'), branchId];
    };

    if (isEditingForm && isEditing) {
      setIsEditing(prev => prev ? { ...prev, viewableBranches: updateBranches(prev.viewableBranches || []) } : prev);
    } else {
      setNewEmp(prev => ({ ...prev, viewableBranches: updateBranches(prev.viewableBranches || []) }));
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex gap-4 border-b border-border-accent pb-4">
        <button 
          onClick={() => setActiveTab('directory')}
          className={`px-6 py-3 text-[11px] uppercase tracking-[2px] transition-colors ${activeTab === 'directory' ? 'bg-brand-accent text-bg-primary' : 'text-text-secondary hover:text-text-primary bg-bg-secondary'}`}
        >
          Employee Directory
        </button>
        <button 
          onClick={() => setActiveTab('roster')}
          className={`px-6 py-3 text-[11px] uppercase tracking-[2px] transition-colors ${activeTab === 'roster' ? 'bg-brand-accent text-bg-primary' : 'text-text-secondary hover:text-text-primary bg-bg-secondary'}`}
        >
          Staff Roster
        </button>
      </div>

      {activeTab === 'directory' && (
      <div className="flex flex-wrap gap-12 items-start justify-center">
        {isAdmin && (
          <div className="flex-1 max-w-[800px] w-full bg-bg-secondary border border-border-accent p-10">
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
                <div className="form-group grid grid-cols-2 gap-4 col-span-1 md:col-span-2 lg:col-span-1">
                  <div>
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Name *</label>
                    {(data.branches || []).length > 0 ? (
                      <select 
                        className="form-control" required
                        value={newEmp.branch} 
                        onChange={e => {
                          const branch = (data.branches || []).find(b => b.name === e.target.value);
                          setNewEmp({...newEmp, branch: e.target.value, branchCode: branch?.code || ''});
                        }}
                      >
                        <option value="">Select Branch...</option>
                        {(data.branches || []).map(b => (
                          <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" className="form-control" required placeholder="e.g. Main Branch"
                        value={newEmp.branch} onChange={e => setNewEmp({...newEmp, branch: e.target.value})}
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Code</label>
                    <input 
                      type="text" className="form-control" placeholder="e.g. BR001"
                      value={newEmp.branchCode} onChange={e => setNewEmp({...newEmp, branchCode: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Date of Birth</label>
                  <input
                    type="date" className="form-control"
                    value={newEmp.dateOfBirth} onChange={e => setNewEmp({...newEmp, dateOfBirth: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Joining Date</label>
                  <input
                    type="date" className="form-control"
                    value={newEmp.joiningDate} onChange={e => setNewEmp({...newEmp, joiningDate: e.target.value})}
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
                          { id: 'cash_requests', label: 'Cash Requests' },
                          { id: 'Dc Resipt Edit', label: 'DC Receipt Edit' }
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
                    
                    <div className="space-y-4 pt-4 border-t border-border-accent/30 mt-4">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary block">Viewable Branches</label>
                      <p className="text-[10px] text-text-secondary mb-2 leading-relaxed">
                        Select which branches this user is allowed to view and manage.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            className="w-3 h-3 accent-brand-accent"
                            checked={newEmp.viewableBranches.includes('ALL')}
                            onChange={() => handleBranchToggle('ALL', false)}
                          />
                          <span className="text-[9px] uppercase tracking-[1px] text-brand-primary font-bold group-hover:opacity-80 transition-opacity">
                            ALL BRANCHES
                          </span>
                        </label>
                        {(data.branches || []).map(b => (
                          <label key={b.name} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-brand-accent disabled:opacity-50"
                              checked={newEmp.viewableBranches.includes(b.name) || newEmp.viewableBranches.includes('ALL')}
                              disabled={newEmp.viewableBranches.includes('ALL')}
                              onChange={() => handleBranchToggle(b.name, false)}
                            />
                            <span className={`text-[9px] uppercase tracking-[1px] ${newEmp.viewableBranches.includes('ALL') ? 'text-text-secondary opacity-50' : 'text-text-secondary group-hover:text-text-primary'} transition-colors`}>
                              {b.name}
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

        </div>
      )}

      {activeTab === 'roster' && (
        <div className="bg-bg-secondary border border-border-accent p-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
               <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent">Staff Roster</h3>
               <span className="text-xs bg-bg-primary border border-border-accent px-2 py-1 flex items-center gap-1 text-text-secondary"><Users className="w-3 h-3" /> {filteredEmployees.length} Total</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                 <select 
                    className="bg-white border border-border-accent px-3 py-2 text-[11px] uppercase tracking-[1px] outline-none text-text-secondary"
                    value={rosterBranchFilter}
                    onChange={(e) => setRosterBranchFilter(e.target.value)}
                 >
                    <option value="ALL">All Branches</option>
                    {Array.from(new Set((data.employees || []).filter(e => e.branch).map(e => e.branch))).map(b => (
                       <option key={b} value={b}>{b}</option>
                    ))}
                 </select>
              </div>
              <div className="flex items-center gap-4 bg-white border border-border-accent px-4 py-2">
                <Search className="w-4 h-4 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-transparent border-none outline-none text-[11px] uppercase tracking-[1px] w-[150px]"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowAllRoster(!showAllRoster)}
                className={`px-4 py-2 border border-border-accent text-[11px] uppercase tracking-[1px] transition-colors ${showAllRoster ? 'bg-brand-accent text-white' : 'bg-white text-text-secondary hover:text-text-primary'}`}
              >
                {showAllRoster ? 'Show Less' : 'View All'}
              </button>
              {isAdmin && (
                <button 
                  onClick={exportStaffDataToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors text-[11px] uppercase tracking-[1px]"
                  title="Download Details (Excel)"
                >
                  <FileDown className="w-4 h-4" /> Export
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedEmployees.map(emp => {
              const grossSalary = (emp.baseSalary || 0) + 
                (emp.performanceAllowance || 0) + 
                (emp.travelingAllowance || 0) + 
                (emp.vehicleAllowance || 0) + 
                (emp.attendanceBonus || 0) + 
                (emp.overtime || 0) + 
                ((emp.petrolLitres || 0) * (data.settings.fuelPrice || 0));

              return (
              <div key={emp.id} className="border border-border-accent p-6 flex flex-col items-center text-center hover:border-brand-accent transition-colors relative group">
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => startEditing(emp)}
                      className="p-1.5 bg-gray-100 text-text-secondary hover:text-brand-accent hover:bg-brand-accent/10 rounded-md transition-colors"
                      title="Edit Employee"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(emp.id)}
                      className="p-1.5 bg-gray-100 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                
                <div className="w-20 h-20 bg-gray-100 border border-border-accent flex flex-col items-center justify-center overflow-hidden rounded-full shadow-sm mb-4">
                  {emp.profilePic ? (
                    <img src={emp.profilePic} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-gray-400" />
                  )}
                </div>
                <h4 className="text-[14px] font-medium text-text-primary mb-1">
                  {emp.name}
                  {emp.status === 'Dormant' && (
                    <span className="block mt-1 text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 uppercase font-bold tracking-tighter">Dormant</span>
                  )}
                </h4>
                <p className="text-[11px] text-brand-accent tracking-[1px] uppercase mb-1">{emp.role}</p>
                <p className="text-[10px] text-text-secondary uppercase tracking-[1px]">{emp.branch || 'Head Office'}</p>
                
                <div className="mt-6 w-full pt-4 border-t border-border-accent text-left space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-text-secondary uppercase tracking-[1px]">EMP ID</span>
                    <span className="font-mono text-text-primary">{emp.id}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-text-secondary uppercase tracking-[1px]">Department</span>
                    <span className="text-text-primary badge badge-info">{emp.department}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-text-secondary uppercase tracking-[1px]">Gross Salary</span>
                    <span className="font-mono text-emerald-600 font-semibold">LKR {grossSalary.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )})}
            {filteredEmployees.length === 0 && (
              <div className="col-span-full py-12 text-center text-text-secondary text-[12px] uppercase tracking-[2px]">
                No staff found for roster view
              </div>
            )}
          </div>
        </div>
      )}

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
                      type="text" className="form-control" 
                      value={isEditing.username || ''} onChange={e => setIsEditing({...isEditing, username: e.target.value})}
                      placeholder={isMasterAdmin ? "" : "Hidden"}
                      disabled={!isMasterAdmin}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Password</label>
                    <input 
                      type="text" className="form-control" 
                      value={isEditing.password || ''} onChange={e => setIsEditing({...isEditing, password: e.target.value})}
                      placeholder={isMasterAdmin ? "••••••••" : "Hidden"}
                      disabled={!isMasterAdmin}
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
                  <div className="form-group grid grid-cols-2 gap-4 col-span-1 md:col-span-2 lg:col-span-1">
                    <div>
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Name</label>
                      {(data.branches || []).length > 0 ? (
                        <select 
                          className="form-control" required
                          value={isEditing.branch} 
                          onChange={e => {
                            const branch = (data.branches || []).find(b => b.name === e.target.value);
                            setIsEditing({...isEditing, branch: e.target.value, branchCode: branch?.code || ''});
                          }}
                        >
                          <option value="">Select Branch...</option>
                          {(data.branches || []).map(b => (
                            <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" className="form-control" required 
                          value={isEditing.branch} onChange={e => setIsEditing({...isEditing, branch: e.target.value})}
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Code</label>
                      <input 
                        type="text" className="form-control" placeholder="e.g. BR001"
                        value={isEditing.branchCode || ''} onChange={e => setIsEditing({...isEditing, branchCode: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Date of Birth</label>
                    <input
                      type="date" className="form-control"
                      value={isEditing.dateOfBirth || ''} onChange={e => setIsEditing({...isEditing, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Joining Date</label>
                    <input
                      type="date" className="form-control"
                      value={isEditing.joiningDate || ''} onChange={e => setIsEditing({...isEditing, joiningDate: e.target.value})}
                    />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Profile Picture</label>
                    <input 
                      type="file" className="form-control" accept="image/*"
                      onChange={(e) => handleProfilePicChange(e, true)}
                    />
                  </div>
                  {isMasterAdmin && isEditing.passkeyRawId && (
                    <div className="form-group col-span-2 border border-red-100 p-4 rounded-lg bg-red-50/5">
                      <label className="text-[10px] uppercase tracking-[2px] text-red-500 mb-2 block font-bold">Hardware Biometrics</label>
                      <p className="text-xs text-text-secondary mb-4">
                        This employee has a device registered for Login/Check-in. Resetting it will allow them to register a new phone.
                      </p>
                      <button 
                        type="button" 
                        className="btn btn-outline border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs py-2" 
                        onClick={async () => {
                          if (confirm('Are you sure you want to reset the biometric device for this employee?')) {
                            try {
                              await DataStore.updateEmployee(isEditing.id, { passkeyRawId: '' });
                              const next = {...isEditing};
                              next.passkeyRawId = '';
                              setIsEditing(next);
                              showNotification('Biometrics reset successfully.');
                            } catch (err: any) {
                              showNotification(err.message, 'error');
                            }
                          }
                        }}
                      >
                        Reset Device Registration
                      </button>
                    </div>
                  )}
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
                            { id: 'cash_requests', label: 'Cash Requests' },
                            { id: 'Dc Resipt Edit', label: 'DC Receipt Edit' }
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

                      <div className="space-y-4 pt-4 border-t border-border-accent/30 mt-4">
                        <label className="text-[10px] uppercase tracking-[2px] text-text-secondary block">Viewable Branches</label>
                        <p className="text-[10px] text-text-secondary mb-2 leading-relaxed">
                          Select which branches this user is allowed to view and manage.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-brand-accent"
                              checked={(isEditing.viewableBranches || []).includes('ALL')}
                              onChange={() => handleBranchToggle('ALL', true)}
                            />
                            <span className="text-[9px] uppercase tracking-[1px] text-brand-primary font-bold group-hover:opacity-80 transition-opacity">
                              ALL BRANCHES
                            </span>
                          </label>
                          {(data.branches || []).map(b => (
                            <label key={b.name} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-3 h-3 accent-brand-accent disabled:opacity-50"
                                checked={(isEditing.viewableBranches || []).includes(b.name) || (isEditing.viewableBranches || []).includes('ALL')}
                                disabled={(isEditing.viewableBranches || []).includes('ALL')}
                                onChange={() => handleBranchToggle(b.name, true)}
                              />
                              <span className={`text-[9px] uppercase tracking-[1px] ${(isEditing.viewableBranches || []).includes('ALL') ? 'text-text-secondary opacity-50' : 'text-text-secondary group-hover:text-text-primary'} transition-colors`}>
                                {b.name}
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
