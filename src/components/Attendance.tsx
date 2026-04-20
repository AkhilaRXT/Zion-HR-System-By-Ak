import React, { useState } from 'react';
import { AppData, Session, Attendance as AttendanceType } from '../types';
import { DataStore } from '../lib/dataStore';
import { FileDown, Edit3, Save, X, Calendar, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface AttendanceProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function Attendance({ session, data, onRefresh }: AttendanceProps) {
  const isAdmin = session.isAdmin;
  const [editing, setEditing] = useState<AttendanceType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [exportDate, setExportDate] = useState('');
  
  const sortedHistory = [...(data.attendance || [])].sort((a, b) => b.id - a.id);
  
  const displayedAttendance = exportDate 
    ? (data.employees || []).map(emp => {
        const rec = (data.attendance || []).find(a => a.date === exportDate && a.empId === emp.id);
        return rec || {
          id: -1,
          empId: emp.id,
          date: exportDate,
          status: 'Absent' as any,
          checkIn: '--',
          checkOut: '--'
        };
      })
    : sortedHistory;

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleExport = async () => {
    let sheetData: any[] = [];
    
    if (exportDate) {
      // Export for a specific date: Include all employees
      sheetData = displayedAttendance.map(a => {
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
      
      if (sheetData.length === 0) {
        showNotification(`No employees found to export for ${exportDate}`, 'error');
        return;
      }
    } else {
      // General export: Export all existing records only
      if (sortedHistory.length === 0) {
        showNotification(`No attendance records found to export`, 'error');
        return;
      }
      sheetData = sortedHistory.map(a => {
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
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const fileName = exportDate ? `Zion_Attendance_${exportDate}.xlsx` : 'Zion_Attendance_Report.xlsx';
    XLSX.writeFile(wb, fileName);
    await DataStore.logAction('Export Data', `Exported Attendance Report to Excel${exportDate ? ` for ${exportDate}` : ''}`, 'Attendance');
    showNotification('Attendance report exported.');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      try {
        await DataStore.updateAttendance(editing.id, editing);
        setEditing(null);
        showNotification('Attendance record updated.');
      } catch (err) {
        showNotification('Failed to update attendance.', 'error');
      }
    }
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteAttendance(confirmDelete);
        setConfirmDelete(null);
        showNotification('Attendance record deleted.');
      } catch (err) {
        showNotification('Failed to delete attendance.', 'error');
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Attendance Log</h3>
          <p className="text-sm text-text-secondary mt-1">Full attendance records history</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full sm:w-auto">
          <input 
            type="date" 
            className="form-control w-full sm:w-auto" 
            value={exportDate}
            onChange={(e) => setExportDate(e.target.value)}
            title="Select date to export"
          />
          <button onClick={handleExport} className="btn btn-success w-full sm:w-auto justify-center flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Export to Excel
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-panel p-6 md:p-8 overflow-hidden mb-8"
          >
            <h4 className="text-sm font-semibold text-text-primary mb-6">Edit Attendance Record</h4>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 items-end">
              <div className="form-group mb-0">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Date</label>
                <input 
                  type="date" className="form-control" 
                  value={editing.date} onChange={e => setEditing({...editing, date: e.target.value})}
                />
              </div>
              <div className="form-group mb-0">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Status</label>
                <select 
                  className="form-control"
                  value={editing.status} onChange={e => setEditing({...editing, status: e.target.value as any})}
                >
                  <option>Present</option>
                  <option>Absent</option>
                  <option>Half Day</option>
                  <option>Late</option>
                  <option>Leave</option>
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Check In</label>
                <input 
                  type="text" className="form-control" 
                  value={editing.checkIn} onChange={e => setEditing({...editing, checkIn: e.target.value})}
                />
              </div>
              <div className="form-group mb-0">
                <label className="text-xs font-medium text-text-secondary mb-2 block">Check Out</label>
                <input 
                  type="text" className="form-control" 
                  value={editing.checkOut} onChange={e => setEditing({...editing, checkOut: e.target.value})}
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="btn btn-primary flex-1 justify-center">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Check-in</th>
              <th>Check-out</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {displayedAttendance.map(a => {
              const emp = (data.employees || []).find(e => e.id === a.empId);
              const statusCls = 
                a.status === 'Present' ? 'badge-success' : 
                a.status === 'Half Day' ? 'badge-warning' : 
                a.status === 'Late' ? 'badge-info' : 
                a.status === 'Leave' ? 'badge-info' : 'badge-danger';
              
              const isRealRecord = a.id !== -1;
              
              return (
                <tr key={isRealRecord ? a.id : `absent-${a.empId}`}>
                  <td className="font-mono text-sm text-text-secondary">{a.date}</td>
                  <td className="font-medium text-text-primary">{emp?.name || a.empId}</td>
                  <td><span className={`badge ${statusCls}`}>{a.status}</span></td>
                  <td className="font-mono text-sm text-text-secondary">{a.checkIn}</td>
                  <td className="font-mono text-sm text-text-secondary">{a.checkOut}</td>
                  {isAdmin && (
                    <td>
                      {isRealRecord ? (
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setEditing(a)}
                            className="text-text-secondary hover:text-brand-accent transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(a.id)}
                            className="text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-secondary italic">No record</div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record? This action cannot be undone."
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
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
