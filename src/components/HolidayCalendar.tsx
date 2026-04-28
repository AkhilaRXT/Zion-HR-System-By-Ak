import React, { useState } from 'react';
import { AppData, Holiday, Session } from '../types';
import { DataStore } from '../lib/dataStore';
import { Calendar, Plus, Save, Trash2, Edit2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';
import { motion, AnimatePresence } from 'motion/react';

interface HolidayCalendarProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function HolidayCalendar({ session, data, onRefresh }: HolidayCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(data.holidays || []);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ name: '', date: '', type: 'National' as 'National' | 'Regional' | 'Company' });
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', date: '', type: 'National' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleOpenEdit = (holiday: Holiday) => {
    setFormData({ name: holiday.name, date: holiday.date, type: holiday.type });
    setEditingId(holiday.id);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.date) {
      showNotification('Holiday Name and Date are required.', 'error');
      return;
    }

    try {
      if (editingId) {
        await DataStore.updateHoliday(editingId, formData);
        showNotification('Holiday updated successfully.');
      } else {
        await DataStore.addHoliday(formData);
        showNotification('Holiday added successfully.');
      }
      setIsAdding(false);
      setEditingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotification('Failed to save holiday.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await DataStore.deleteHoliday(deleteConfirm);
      showNotification('Holiday deleted successfully.');
      setDeleteConfirm(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotification('Failed to delete holiday.', 'error');
    }
  };

  const sortedHolidays = [...(data.holidays || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-8">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Delete Holiday"
          message={`Are you sure you want to delete this holiday?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          confirmText="Delete"
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Holiday Calendar</h2>
          <p className="text-xs text-text-secondary mt-1">Manage company holidays and non-working days</p>
        </div>
        {!isAdding && session.isAdmin && (
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Add Holiday
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && session.isAdmin && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-panel p-6 mb-8 border border-brand-accent/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider">
                  {editingId ? 'Edit Holiday' : 'Add New Holiday'}
                </h3>
                <button onClick={handleCancel} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Holiday Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. New Year"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Type</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="National">National Holiday</option>
                    <option value="Regional">Regional</option>
                    <option value="Company">Company Leave</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={handleCancel} className="btn border border-border-accent text-text-secondary hover:bg-bg-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Save className="w-4 h-4 mr-2" /> {editingId ? 'Save Changes' : 'Add Holiday'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-panel overflow-hidden">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th>Holiday Name</th>
                <th>Date</th>
                <th>Type</th>
                {session.isAdmin && <th className="w-32 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedHolidays && sortedHolidays.length > 0 ? (
                sortedHolidays.map((holiday) => (
                  <tr key={holiday.id}>
                    <td className="font-medium text-text-primary">{holiday.name}</td>
                    <td>
                      <span className="font-mono text-sm text-text-secondary">
                        {new Date(holiday.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        holiday.type === 'National' ? 'bg-blue-100 text-blue-700' :
                        holiday.type === 'Regional' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {holiday.type}
                      </span>
                    </td>
                    {session.isAdmin && (
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(holiday)}
                            className="p-1.5 hover:bg-brand-primary/10 rounded-lg transition-colors text-brand-primary tooltip"
                            data-tip="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(holiday.id)}
                            className="p-1.5 hover:bg-status-error/10 rounded-lg transition-colors text-status-error tooltip"
                            data-tip="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={session.isAdmin ? 4 : 3} className="text-center py-12 text-text-secondary">
                    <Calendar className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    <p>No holidays have been defined.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
