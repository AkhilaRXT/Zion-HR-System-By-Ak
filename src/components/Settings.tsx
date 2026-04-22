import React, { useState, useEffect } from 'react';
import { AppData, Session, AppSettings } from '../types';
import { DataStore } from '../lib/dataStore';
import { Save, RefreshCw, Palette, ShieldAlert, Clock, Database, Trash2, FileDown, Camera, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';
import { compressImage } from '../lib/imageUtils';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SettingsProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function Settings({ session, data, onRefresh }: SettingsProps) {
  useEffect(() => {
    // Run background maintenance only when admin enters settings
    if (session.isAdmin) {
      DataStore.runMaintenance();
    }
  }, []);

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
      showNotification('Database cleared successfully! You can now start fresh.', 'warning');
      setConfirmReset(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotification('Failed to reset database.', 'error');
    }
  };

  const handleThemeChange = (field: string, val: string) => {
    setSettings({
      ...settings,
      theme: {
        ...(settings.theme || { 
          primary: '#2563eb', 
          accent: '#e5e7eb', 
          background: '#f3f4f6',
          secondary: '#10b981',
          textPrimary: '#111827',
          textSecondary: '#6b7280'
        }),
        [field]: val
      }
    });
  };

  const resetTheme = () => {
    const defaultTheme = {
      primary: '#2563eb',
      accent: '#e5e7eb',
      background: '#f3f4f6',
      secondary: '#10b981',
      textPrimary: '#111827',
      textSecondary: '#6b7280'
    };
    setSettings({ ...settings, theme: defaultTheme });
    showNotification('Theme reset to default.');
  };

  const handleLeaveChange = (field: string, val: number) => {
    const newPolicy = { ...settings.leavePolicy, [field]: val };
    setSettings({ ...settings, leavePolicy: newPolicy });
  };

  const exportExcel = (filename: string, filterFn: (a: any) => boolean) => {
    const rows = (data.attendance || []).filter(filterFn);
    const sheetData = rows.map(a => {
      const emp = (data.employees || []).find(e => e.id === a.empId);
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
    const sheetData = (data.employees || []).map(emp => ({
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

  const [isWiping, setIsWiping] = useState(false);
  const handleWipePaidHistory = async () => {
    if (!window.confirm("Are you SURE you want to factory-reset the entire partial-paid history for all employees? This will clear all paidDeductions and set everyone back to 0.")) return;
    setIsWiping(true);
    try {
      const q = collection(db, 'paidDeductions');
      const snap = await getDocs(q);
      const prs = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(prs);
      showNotification('Successfully factory-reset paid history!');
      if (onRefresh) onRefresh();
    } catch(err) {
      console.error(err);
      showNotification('Failed to wipe paid history. See console.', 'error');
    }
    setIsWiping(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="glass-panel p-10">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">System Configuration</h3>
            <p className="text-xs text-text-secondary font-medium mt-1">Manage core application settings and branding</p>
            <div className="mt-4">
              <button 
                type="button" 
                onClick={handleWipePaidHistory}
                disabled={isWiping}
                className="btn text-red-500 border border-red-500 hover:bg-red-50"
              >
                  <AlertTriangle className="w-4 h-4 mr-2 inline" />
                  {isWiping ? 'Wiping...' : 'Factory Reset Partial Pay History'}
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 bg-bg-primary border border-border-accent flex items-center justify-center overflow-hidden rounded-xl shadow-sm">
                {settings.logo ? (
                  <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-brand-accent/20 text-3xl font-bold">Z</div>
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoChange} />
            </div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Change Logo</span>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Fuel Price (LKR per Litre)</label>
              <input 
                type="number" className="form-control" required 
                value={settings.fuelPrice} onChange={e => setSettings({...settings, fuelPrice: Number(e.target.value)})}
              />
              <p className="text-[10px] text-text-secondary font-medium mt-2">Used for petrol allowance calculations</p>
            </div>

            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Company Name</label>
              <input 
                type="text" className="form-control" required 
                value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Company Subtitle</label>
              <input 
                type="text" className="form-control" required 
                value={settings.companySubtitle} onChange={e => setSettings({...settings, companySubtitle: e.target.value})}
              />
            </div>
          </div>

          <div className="border-t border-border-accent pt-8">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Theme Customization</h4>
              <button 
                type="button" 
                onClick={resetTheme}
                className="text-[10px] font-bold text-text-secondary hover:text-brand-accent uppercase tracking-wider transition-colors"
              >
                Reset to Default
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Primary Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.primary || '#2563eb'} 
                    onChange={e => handleThemeChange('primary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.primary || '#2563eb'} 
                    onChange={e => handleThemeChange('primary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Secondary Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.secondary || '#10b981'} 
                    onChange={e => handleThemeChange('secondary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.secondary || '#10b981'} 
                    onChange={e => handleThemeChange('secondary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Accent Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.accent || '#e5e7eb'} 
                    onChange={e => handleThemeChange('accent', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.accent || '#e5e7eb'} 
                    onChange={e => handleThemeChange('accent', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Background Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.background || '#f3f4f6'} 
                    onChange={e => handleThemeChange('background', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.background || '#f3f4f6'} 
                    onChange={e => handleThemeChange('background', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Text Primary</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.textPrimary || '#111827'} 
                    onChange={e => handleThemeChange('textPrimary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.textPrimary || '#111827'} 
                    onChange={e => handleThemeChange('textPrimary', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Text Secondary</label>
                <div className="flex gap-2">
                  <input 
                    type="color" className="w-10 h-10 bg-transparent border border-border-accent cursor-pointer rounded-md overflow-hidden"
                    value={settings.theme?.textSecondary || '#6b7280'} 
                    onChange={e => handleThemeChange('textSecondary', e.target.value)}
                  />
                  <input 
                    type="text" className="form-control flex-1 font-mono text-xs"
                    value={settings.theme?.textSecondary || '#6b7280'} 
                    onChange={e => handleThemeChange('textSecondary', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-accent pt-8">
            <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-6">Background Decoration</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-3 block">Enable Background Blobs</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.backgroundBlobs?.enabled ?? true}
                    onChange={e => setSettings({
                      ...settings, 
                      backgroundBlobs: { 
                        ...(settings.backgroundBlobs || { blur: 150, opacity: 5 }), 
                        enabled: e.target.checked 
                      }
                    })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
                </label>
              </div>
              
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-3 block">Blur Intensity (px)</label>
                <input 
                  type="range" min="50" max="400" step="10"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                  value={settings.backgroundBlobs?.blur ?? 150}
                  onChange={e => setSettings({
                    ...settings, 
                    backgroundBlobs: { 
                      ...(settings.backgroundBlobs || { enabled: true, opacity: 5 }), 
                      blur: Number(e.target.value) 
                    }
                  })}
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] font-bold text-text-secondary">50px</span>
                  <span className="text-[10px] font-bold text-brand-accent">{settings.backgroundBlobs?.blur ?? 150}px</span>
                  <span className="text-[10px] font-bold text-text-secondary">400px</span>
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-3 block">Opacity (%)</label>
                <input 
                  type="range" min="1" max="30" step="1"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                  value={settings.backgroundBlobs?.opacity ?? 5}
                  onChange={e => setSettings({
                    ...settings, 
                    backgroundBlobs: { 
                      ...(settings.backgroundBlobs || { enabled: true, blur: 150 }), 
                      opacity: Number(e.target.value) 
                    }
                  })}
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] font-bold text-text-secondary">1%</span>
                  <span className="text-[10px] font-bold text-brand-accent">{settings.backgroundBlobs?.opacity ?? 5}%</span>
                  <span className="text-[10px] font-bold text-text-secondary">30%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-accent pt-8">
            <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-6">Login Screen Customization</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="form-group">
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Hero Title Line 1</label>
                  <input 
                    type="text" className="form-control" 
                    value={settings.loginHero?.titleLine1 || 'Empowering Your'} 
                    onChange={e => setSettings({
                      ...settings, 
                      loginHero: { ...(settings.loginHero || { titleLine2: 'Financial Future', stat1Value: '100%', stat1Label: 'Secure', stat2Value: '24/7', stat2Label: 'Access' }), titleLine1: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Hero Title Line 2 (Highlighted)</label>
                  <input 
                    type="text" className="form-control" 
                    value={settings.loginHero?.titleLine2 || 'Financial Future'} 
                    onChange={e => setSettings({
                      ...settings, 
                      loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', stat1Value: '100%', stat1Label: 'Secure', stat2Value: '24/7', stat2Label: 'Access' }), titleLine2: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Background Image URL</label>
                  <input 
                    type="text" className="form-control" placeholder="https://..."
                    value={settings.loginHero?.backgroundImage || ''} 
                    onChange={e => setSettings({
                      ...settings, 
                      loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', titleLine2: 'Financial Future', stat1Value: '100%', stat1Label: 'Secure', stat2Value: '24/7', stat2Label: 'Access' }), backgroundImage: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs font-medium text-text-secondary mb-2 block">Stat 1 Value</label>
                    <input 
                      type="text" className="form-control" placeholder="e.g. 100%"
                      value={settings.loginHero?.stat1Value || '100%'} 
                      onChange={e => setSettings({
                        ...settings, 
                        loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', titleLine2: 'Financial Future', stat1Label: 'Secure', stat2Value: '24/7', stat2Label: 'Access' }), stat1Value: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-medium text-text-secondary mb-2 block">Stat 1 Label</label>
                    <input 
                      type="text" className="form-control" placeholder="e.g. Secure"
                      value={settings.loginHero?.stat1Label || 'Secure'} 
                      onChange={e => setSettings({
                        ...settings, 
                        loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', titleLine2: 'Financial Future', stat1Value: '100%', stat2Value: '24/7', stat2Label: 'Access' }), stat1Label: e.target.value }
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs font-medium text-text-secondary mb-2 block">Stat 2 Value</label>
                    <input 
                      type="text" className="form-control" placeholder="e.g. 24/7"
                      value={settings.loginHero?.stat2Value || '24/7'} 
                      onChange={e => setSettings({
                        ...settings, 
                        loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', titleLine2: 'Financial Future', stat1Value: '100%', stat1Label: 'Secure', stat2Label: 'Access' }), stat2Value: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-medium text-text-secondary mb-2 block">Stat 2 Label</label>
                    <input 
                      type="text" className="form-control" placeholder="e.g. Access"
                      value={settings.loginHero?.stat2Label || 'Access'} 
                      onChange={e => setSettings({
                        ...settings, 
                        loginHero: { ...(settings.loginHero || { titleLine1: 'Empowering Your', titleLine2: 'Financial Future', stat1Value: '100%', stat1Label: 'Secure', stat2Value: '24/7' }), stat2Label: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-accent pt-8">
            <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-6">Leave Policy (Days per Year)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Monthly Limit</label>
                <input type="number" className="form-control" value={settings.leavePolicy.monthlyLimit} onChange={e => handleLeaveChange('monthlyLimit', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Annual Leave</label>
                <input type="number" className="form-control" value={settings.leavePolicy.annualTotal} onChange={e => handleLeaveChange('annualTotal', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Casual</label>
                <input type="number" className="form-control" value={settings.leavePolicy.casualTotal} onChange={e => handleLeaveChange('casualTotal', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Sick</label>
                <input type="number" className="form-control" value={settings.leavePolicy.sickTotal} onChange={e => handleLeaveChange('sickTotal', Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 border border-border-accent rounded-xl">
              <p className="text-xs font-medium text-text-secondary italic">
                Set the total allowed days for each leave category per calendar year.
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

      <div className="glass-panel p-10">
        <h3 className="text-sm font-semibold text-text-primary mb-8">Data Export</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => exportExcel('Daily_Report', r => r.date === new Date().toISOString().split('T')[0])} className="btn btn-outline justify-center py-3 text-xs">
            Daily Attendance
          </button>
          <button onClick={() => exportExcel('Monthly_Report', r => r.date.startsWith(new Date().toISOString().slice(0, 7)))} className="btn btn-outline justify-center py-3 text-xs">
            Monthly Attendance
          </button>
          <button onClick={() => exportExcel('Full_History', () => true)} className="btn btn-outline justify-center py-3 text-xs">
            Full History Export
          </button>
          <button onClick={exportBankDetails} className="btn btn-primary justify-center py-3 text-xs">
            Bank Details Export
          </button>
        </div>
      </div>

      <div className="glass-panel p-10 border-red-100">
        <h3 className="text-sm font-semibold text-red-600 mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-text-secondary font-medium mb-8">
          Warning: Resetting the database will clear all current records and restore initial system data. This action is irreversible.
        </p>
        <button 
          onClick={() => setConfirmReset(true)}
          className="btn bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white justify-center py-4 w-full md:w-auto"
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
