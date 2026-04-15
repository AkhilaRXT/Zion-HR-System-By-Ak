import React, { useState } from 'react';
import { AppData, Session, AppSettings } from '../types';
import { DataStore } from '../lib/dataStore';
import { Save, RefreshCw, Palette, ShieldAlert, Clock, Database, Trash2, FileDown, Camera } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';
import { compressImage } from '../lib/imageUtils';

interface SettingsProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function Settings({ session, data, onRefresh }: SettingsProps) {
  if (!session.isAdmin) return <div className="p-8 text-brand-accent uppercase tracking-[2px]">Access Denied</div>;

  const [settings, setSettings] = useState<AppSettings>(data.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await DataStore.updateSettings(settings);
      showNotification('Settings saved successfully!');
    } catch (err) {
      showNotification('Failed to save settings.', 'error');
    }
  };

  const handleReset = async () => {
    try {
      await DataStore.resetData();
      showNotification('Database reset to initial state.', 'warning');
      setConfirmReset(false);
    } catch (err) {
      showNotification('Failed to reset database.', 'error');
    }
  };

  const handleThemeChange = (field: string, val: string) => {
    setSettings({
      ...settings,
      theme: {
        ...(settings.theme || { 
          primary: '#6366f1', 
          accent: '#818cf8', 
          background: '#0f172a',
          secondary: '#10b981',
          textPrimary: '#f8fafc',
          textSecondary: '#94a3b8'
        }),
        [field]: val
      }
    });
  };

  const resetTheme = () => {
    const defaultTheme = {
      primary: '#6366f1',
      accent: '#818cf8',
      background: '#0f172a',
      secondary: '#10b981',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8'
    };
    setSettings({ ...settings, theme: defaultTheme });
    showNotification('Theme reset to default.');
  };

  const handleLeaveChange = (field: string, val: number) => {
    const newPolicy = { ...settings.leavePolicy, [field]: val };
    if (field === 'casualTotal' || field === 'sickTotal') {
      newPolicy.annualTotal = newPolicy.casualTotal + newPolicy.sickTotal;
    }
    setSettings({ ...settings, leavePolicy: newPolicy });
  };

  const exportExcel = (filename: string, filterFn: (a: any) => boolean) => {
    const rows = data.attendance.filter(filterFn);
    const sheetData = rows.map(a => {
      const emp = data.employees.find(e => e.id === a.empId);
      return {
        Date: a.date,
        'EMP ID': a.empId,
        'Employee Name': emp?.name || 'Unknown',
        Status: a.status,
        'Check In': a.checkIn,
        'Check Out': a.checkOut
      };
    });
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Zion_${filename}.xlsx`);
    DataStore.logAction('Export Data', `Exported ${filename} to Excel`, 'Settings');
    showNotification('Export successful!');
  };

  const exportBankDetails = () => {
    const sheetData = data.employees.map(emp => ({
      'EMP ID': emp.id,
      'Employee Name': emp.name,
      'Designation': emp.role,
      'Department': emp.department,
      'Branch': emp.branch,
      'Bank Name': emp.bankName || '-',
      'Bank Branch': emp.bankBranch || '-',
      'Account No': emp.accountNo || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Details');
    XLSX.writeFile(wb, `Zion_Bank_Details_${new Date().toISOString().split('T')[0]}.xlsx`);
    DataStore.logAction('Export Data', 'Exported Bank Details to Excel', 'Settings');
    showNotification('Bank details exported!');
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const compressed = await compressImage(base64String);
          setSettings({ ...settings, logo: compressed });
          showNotification('Logo updated! Save settings to apply.');
        } catch (err) {
          showNotification('Failed to process image.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="bg-bg-secondary border border-border-accent p-12">
        <div className="flex justify-between items-start mb-10">
          <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent">System Configuration</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 bg-bg-primary border border-border-accent flex items-center justify-center overflow-hidden rounded-xl">
                {settings.logo ? (
                  <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-brand-accent/20 text-4xl font-serif">Z</div>
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoChange} />
            </div>
            <span className="text-[9px] uppercase tracking-[1px] text-text-secondary">Change System Logo</span>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-3 block">Fuel Price (LKR per Litre)</label>
              <input 
                type="number" className="form-control" required 
                value={settings.fuelPrice} onChange={e => setSettings({...settings, fuelPrice: Number(e.target.value)})}
              />
              <p className="text-[9px] text-text-secondary uppercase tracking-[1px] mt-3">Used for petrol allowance calculations</p>
            </div>

            <div className="form-group">
              <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-3 block">Company Name</label>
              <input 
                type="text" className="form-control" required 
                value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-3 block">Company Subtitle</label>
              <input 
                type="text" className="form-control" required 
                value={settings.companySubtitle} onChange={e => setSettings({...settings, companySubtitle: e.target.value})}
              />
            </div>
          </div>

          <div className="border-t border-border-accent pt-10">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[10px] uppercase tracking-[2px] text-brand-accent">Theme Customization</h4>
              <button 
                type="button" 
                onClick={resetTheme}
                className="text-[9px] uppercase tracking-[1px] text-text-secondary hover:text-brand-accent transition-colors"
              >
                Reset to Default
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Primary Color</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.primary || '#6366f1'} 
                    onChange={e => handleThemeChange('primary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.primary || '#6366f1'} 
                    onChange={e => handleThemeChange('primary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Secondary Color</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.secondary || '#10b981'} 
                    onChange={e => handleThemeChange('secondary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.secondary || '#10b981'} 
                    onChange={e => handleThemeChange('secondary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Accent Color</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.accent || '#818cf8'} 
                    onChange={e => handleThemeChange('accent', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.accent || '#818cf8'} 
                    onChange={e => handleThemeChange('accent', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Background Color</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.background || '#0f172a'} 
                    onChange={e => handleThemeChange('background', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.background || '#0f172a'} 
                    onChange={e => handleThemeChange('background', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Text Primary</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.textPrimary || '#f8fafc'} 
                    onChange={e => handleThemeChange('textPrimary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.textPrimary || '#f8fafc'} 
                    onChange={e => handleThemeChange('textPrimary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Text Secondary</label>
                <div className="flex gap-3">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer"
                    value={settings.theme?.textSecondary || '#94a3b8'} 
                    onChange={e => handleThemeChange('textSecondary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-[10px]"
                    value={settings.theme?.textSecondary || '#94a3b8'} 
                    onChange={e => handleThemeChange('textSecondary', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-accent pt-10">
            <h4 className="text-[10px] uppercase tracking-[2px] text-brand-accent mb-6">Leave Policy (Days per Year)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Monthly Limit</label>
                <input type="number" className="form-control" value={settings.leavePolicy.monthlyLimit} onChange={e => handleLeaveChange('monthlyLimit', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Casual</label>
                <input type="number" className="form-control" value={settings.leavePolicy.casualTotal} onChange={e => handleLeaveChange('casualTotal', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="text-[9px] uppercase tracking-[1px] text-text-secondary mb-2 block">Sick</label>
                <input type="number" className="form-control" value={settings.leavePolicy.sickTotal} onChange={e => handleLeaveChange('sickTotal', Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-4 p-4 bg-bg-primary border border-border-accent">
              <p className="text-[10px] uppercase tracking-[2px] text-text-secondary">
                Calculated Annual Total: <span className="text-brand-accent font-bold">{settings.leavePolicy.annualTotal} Days</span>
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button type="submit" className="btn btn-primary w-full justify-center py-4">
              Update System Settings
            </button>
          </div>
        </form>
      </div>

      <div className="bg-bg-secondary border border-border-accent p-12">
        <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent mb-10">Data Export</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button onClick={() => exportExcel('Daily_Report', r => r.date === new Date().toISOString().split('T')[0])} className="btn btn-outline justify-center py-4">
            Daily Attendance
          </button>
          <button onClick={() => exportExcel('Monthly_Report', r => r.date.startsWith(new Date().toISOString().slice(0, 7)))} className="btn btn-outline justify-center py-4">
            Monthly Attendance
          </button>
          <button onClick={() => exportExcel('Full_History', () => true)} className="btn btn-outline justify-center py-4">
            Full History Export
          </button>
          <button onClick={exportBankDetails} className="btn btn-primary justify-center py-4">
            Bank Details Export
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary border border-red-500/30 p-12">
        <h3 className="text-[11px] uppercase tracking-[3px] text-red-500 mb-6 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-[10px] text-text-secondary uppercase tracking-[1px] mb-8">
          Warning: Resetting the database will clear all current records and restore initial system data. This action is irreversible.
        </p>
        <button 
          onClick={() => setConfirmReset(true)}
          className="btn bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white justify-center py-4 w-full md:w-auto"
        >
          <Database className="w-4 h-4" /> Reset System Database
        </button>
      </div>

      <ConfirmModal 
        isOpen={confirmReset}
        title="Reset System Database"
        message="Are you sure you want to reset the entire database? All current employees, attendance, leaves, and payroll records will be replaced with initial data. This cannot be undone."
        confirmText="Reset Everything"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
        type="danger"
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
