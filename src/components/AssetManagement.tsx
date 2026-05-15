import React, { useState } from 'react';
import { Session, AppData, Asset } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Package,
  Plus,
  Trash2,
  Search,
  User,
  Monitor,
  Smartphone,
  Car,
  Box,
  X,
  Save,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface AssetManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function AssetManagement({ session, data, onRefresh }: AssetManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<Omit<Asset, 'id'>>({
    name: '',
    type: 'Laptop',
    serialNumber: '',
    status: 'Available',
    condition: 'Good',
    assignedTo: '',
    assignedDate: '',
    notes: ''
  });

  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManage = isAdmin && (isMasterAdmin || session.permissions?.includes('settings'));

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingAsset) {
        await DataStore.updateAsset(editingAsset.id, formData);
        showNotification('Asset updated successfully!');
      } else {
        await DataStore.addAsset(formData);
        showNotification('Asset added successfully!');
      }
      setIsAdding(false);
      setEditingAsset(null);
      resetForm();
    } catch (err) {
      showNotification('Failed to save asset.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'Laptop',
      serialNumber: '',
      status: 'Available',
      condition: 'Good',
      assignedTo: '',
      assignedDate: '',
      notes: ''
    });
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteAsset(confirmDelete);
        setConfirmDelete(null);
        showNotification('Asset removed.');
      } catch (err) {
        showNotification('Failed to delete asset.', 'error');
      }
    }
  };

  const startEditing = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      type: asset.type,
      serialNumber: asset.serialNumber || '',
      status: asset.status,
      condition: asset.condition,
      assignedTo: asset.assignedTo || '',
      assignedDate: asset.assignedDate || '',
      notes: asset.notes || ''
    });
    setIsAdding(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Laptop': return <Monitor className="w-4 h-4" />;
      case 'Phone': return <Smartphone className="w-4 h-4" />;
      case 'Vehicle': return <Car className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  const filteredAssets = (data.assets || []).filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.assignedTo && data.employees.find(e => e.id === a.assignedTo)?.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-text-primary">Asset Tracking</h2>
          <p className="text-text-secondary">Manage and track company equipment assigned to staff.</p>
        </div>
        {canManage && (
          <button
            onClick={() => { resetForm(); setEditingAsset(null); setIsAdding(true); }}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Asset
          </button>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-border-accent">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search assets, serial numbers or staff..."
              className="form-control pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-border-accent">
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Asset</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Serial No</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Assigned To</th>
                {canManage && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-accent">
              {filteredAssets.map((asset) => {
                const assignedEmp = data.employees.find(e => e.id === asset.assignedTo);

                return (
                  <tr key={asset.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-text-primary">{asset.name}</div>
                      <div className="text-[10px] text-text-secondary uppercase">{asset.condition} condition</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-text-secondary">
                        {getTypeIcon(asset.type)}
                        <span className="text-sm">{asset.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-primary">
                      {asset.serialNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        asset.status === 'Available' ? 'badge-success' :
                        asset.status === 'Assigned' ? 'badge-info' :
                        asset.status === 'Maintenance' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {assignedEmp ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent text-[10px] font-bold">
                            {assignedEmp.name[0]}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-primary">{assignedEmp.name}</div>
                            <div className="text-[10px] text-text-secondary">{asset.assignedDate}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-secondary text-xs italic">Unassigned</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEditing(asset)}
                            className="p-1.5 text-text-secondary hover:text-brand-accent transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(asset.id)}
                            className="p-1.5 text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    No assets found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border-accent p-8 rounded-2xl w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-text-primary">{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingAsset(null); }} className="text-text-secondary hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group col-span-2">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Asset Name *</label>
                    <input
                      type="text" className="form-control" required
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. MacBook Pro 14"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Type</label>
                    <select
                      className="form-control"
                      value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="Laptop">Laptop</option>
                      <option value="Phone">Phone</option>
                      <option value="Vehicle">Vehicle</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Serial Number</label>
                    <input
                      type="text" className="form-control"
                      value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Condition</label>
                    <select
                      className="form-control"
                      value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value as any})}
                    >
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Status</label>
                    <select
                      className="form-control"
                      value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="Available">Available</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>

                  <div className={`form-group col-span-2 space-y-6 pt-4 border-t border-border-accent ${formData.status !== 'Assigned' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[2px]">Assignment Info</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-text-secondary mb-2 block">Assign To</label>
                        <select
                          className="form-control"
                          value={formData.assignedTo}
                          onChange={e => setFormData({...formData, assignedTo: e.target.value})}
                          required={formData.status === 'Assigned'}
                        >
                          <option value="">Unassigned</option>
                          {data.employees
                            .filter(e => e.status !== 'Dormant')
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))
                          }
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-text-secondary mb-2 block">Assigned Date</label>
                        <input
                          type="date" className="form-control"
                          value={formData.assignedDate}
                          onChange={e => setFormData({...formData, assignedDate: e.target.value})}
                          required={formData.status === 'Assigned'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group col-span-2">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Notes</label>
                    <textarea
                      className="form-control min-h-[80px]"
                      value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setIsAdding(false); setEditingAsset(null); }} className="btn btn-outline flex-1 justify-center">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1 justify-center gap-2">
                    <Save className="w-4 h-4" />
                    {editingAsset ? 'Update Asset' : 'Add Asset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Remove Asset"
        message="Are you sure you want to remove this asset from the system? This action cannot be undone."
        onConfirm={handleDelete}
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
