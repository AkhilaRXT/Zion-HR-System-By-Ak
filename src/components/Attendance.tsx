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
  
  const attendances = [...data.attendance].sort((a, b) => b.id - a.id);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleExport = () => {
    const sheetData = attendances.map(a => {
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
    XLSX.writeFile(wb, 'Zion_Attendance_Report.xlsx');
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
          <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent">Attendance Log</h3>
          <p className="text-[10px] text-text-secondary uppercase tracking-[1px] mt-1">Full attendance records history</p>
        </div>
        <button onClick={handleExport} className="btn btn-success w-full sm:w-auto justify-center">
          Export to Excel
        </button>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-bg-secondary border border-border-accent p-6 md:p-10 overflow-hidden"
          >
            <h4 className="text-[10px] uppercase tracking-[2px] text-brand-accent mb-8">Edit Attendance Record</h4>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 items-end">
              <div className="form-group mb-0">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Date</label>
                <input 
                  type="date" className="form-control" 
                  value={editing.date} onChange={e => setEditing({...editing, date: e.target.value})}
                />
              </div>
              <div className="form-group mb-0">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Status</label>
                <select 
                  className="form-control"
                  value={editing.status} onChange={e => setEditing({...editing, status: e.target.value as any})}
                >
                  <option>Present</option>
                  <option>Absent</option>
                  <option>Half Day</option>
                  <option>Late</option>
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Check In</label>
                <input 
                  type="text" className="form-control" 
                  value={editing.checkIn} onChange={e => setEditing({...editing, checkIn: e.target.value})}
                />
              </div>
              <div className="form-group mb-0">
                <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Check Out</label>
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
            {attendances.map(a => {
              const emp = data.employees.find(e => e.id === a.empId);
              const statusCls = 
                a.status === 'Present' ? 'badge-success' : 
                a.status === 'Half Day' ? 'badge-warning' : 
                a.status === 'Late' ? 'badge-info' : 'badge-danger';
              
              return (
                <tr key={a.id}>
                  <td className="font-serif text-text-secondary">{a.date}</td>
                  <td className="uppercase tracking-[1px] text-[12px]">{emp?.name || a.empId}</td>
                  <td><span className={`badge ${statusCls}`}>{a.status}</span></td>
                  <td className="font-serif">{a.checkIn}</td>
                  <td className="font-serif">{a.checkOut}</td>
                  {isAdmin && (
                    <td>
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
