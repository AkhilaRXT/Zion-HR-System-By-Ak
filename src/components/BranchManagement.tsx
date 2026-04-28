import React, { useState } from 'react';
import { AppData, Branch } from '../types';
import { DataStore } from '../lib/dataStore';
import { MapPin, Plus, Save, Trash2, Edit2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';
import { motion, AnimatePresence } from 'motion/react';

interface BranchManagementProps {
  data: AppData;
  onRefresh: () => void;
}

export default function BranchManagement({ data, onRefresh }: BranchManagementProps) {
  const [branches, setBranches] = useState<Branch[]>(data.branches || []);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ code: '', name: '', location: '', managerId: '', status: 'Active' as 'Active' | 'Inactive' });
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleOpenAdd = () => {
    setFormData({ code: '', name: '', location: '', managerId: '', status: 'Active' });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleOpenEdit = (branch: Branch) => {
    setFormData({ code: branch.code, name: branch.name, location: branch.location || '', managerId: branch.managerId || '', status: branch.status || 'Active' });
    setEditingId(branch.id);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      showNotification('Branch Name and Code are required.', 'error');
      return;
    }

    try {
      if (editingId) {
        await DataStore.updateBranch(editingId, formData);
        showNotification('Branch updated successfully.');
      } else {
        await DataStore.addBranch(formData);
        showNotification('Branch added successfully.');
      }
      setIsAdding(false);
      setEditingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotification('Failed to save branch.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await DataStore.deleteBranch(deleteConfirm);
      showNotification('Branch deleted successfully.');
      setDeleteConfirm(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotification('Failed to delete branch.', 'error');
    }
  };

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
          title="Delete Branch"
          message={`Are you sure you want to delete this branch? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          confirmText="Delete"
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Branch Management</h2>
          <p className="text-xs text-text-secondary mt-1">Manage company branches and locations</p>
        </div>
        {!isAdding && (
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Add Branch
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-panel p-6 mb-8 border border-brand-accent/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider">
                  {editingId ? 'Edit Branch' : 'Create New Branch'}
                </h3>
                <button onClick={handleCancel} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. BR001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Branch Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Main Branch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="City or Address"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Manager</label>
                  <select
                    className="form-control"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  >
                    <option value="">No Manager Assigned</option>
                    {(data.employees || []).filter(e => e.status !== 'Dormant').map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Status</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={handleCancel} className="btn border border-border-accent text-text-secondary hover:bg-bg-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Save className="w-4 h-4 mr-2" /> {editingId ? 'Save Changes' : 'Create Branch'}
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
                <th className="w-24">Branch Code</th>
                <th>Branch Name</th>
                <th>Location</th>
                <th>Manager</th>
                <th>Staff Count</th>
                <th>Status</th>
                <th className="w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.branches && data.branches.length > 0 ? (
                data.branches.map((branch) => {
                  const manager = (data.employees || []).find(e => e.id === branch.managerId);
                  const staffCount = (data.employees || []).filter(e => e.branch === branch.name && e.status !== 'Dormant').length;
                  return (
                  <tr key={branch.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-brand-accent bg-brand-accent/5 px-2 py-1 rounded">
                        {branch.code}
                      </span>
                    </td>
                    <td className="font-medium text-text-primary">{branch.name}</td>
                    <td className="text-text-secondary text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {branch.location || '-'}
                      </div>
                    </td>
                    <td className="text-sm">
                      {manager ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{manager.name}</span>
                          <span className="text-[10px] text-text-secondary">{manager.role}</span>
                        </div>
                      ) : (
                        <span className="text-text-secondary opacity-50">-</span>
                      )}
                    </td>
                    <td className="text-sm">
                      <span className="bg-brand-primary/10 text-brand-primary font-semibold px-2 py-1 rounded-full text-xs">
                        {staffCount} Emp{staffCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                       <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        !branch.status || branch.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {branch.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(branch)}
                          className="p-1.5 hover:bg-brand-primary/10 rounded-lg transition-colors text-brand-primary tooltip"
                          data-tip="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(branch.id)}
                          className="p-1.5 hover:bg-status-error/10 rounded-lg transition-colors text-status-error tooltip"
                          data-tip="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );})
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-secondary">
                    <MapPin className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    <p>No branches defined.</p>
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
