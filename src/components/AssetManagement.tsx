import React, { useState, useMemo } from 'react';
import { Asset, AppData, Session } from '../types';
import { DataStore } from '../lib/dataStore';
import { Monitor, Smartphone, Car, Package, Search, Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface AssetManagementProps {
  session: Session;
  data: AppData;
}

export const AssetManagement: React.FC<AssetManagementProps> = ({ session, data }) => {
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Asset>>({
    name: '', category: 'Laptop', status: 'Good', branch: '', assignedTo: '', serialNo: '', purchaseDate: '', notes: ''
  });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Context
  const isMasterAdmin = session.email === 'zioncommercialcreditampara@gmail.com';
  const isAdmin = session.isAdmin || isMasterAdmin;
  const viewableBranches = session.viewableBranches || [];

  const branches = data.branches || [];
  const employees = data.employees || [];
  const assets = data.assets || [];

  // Step 1: Branch Access Restriction
  const accessibleAssets = useMemo(() => {
    if (isMasterAdmin) return assets;
    if (isAdmin && (viewableBranches.includes('ALL') || viewableBranches.length === 0)) return assets;
    if (isAdmin) return assets.filter(a => viewableBranches.includes(a.branch));
    return assets.filter(a => a.assignedTo === session.empId);
  }, [assets, isMasterAdmin, isAdmin, viewableBranches, session.empId]);

  // Step 2: UI Filters
  const filteredAssets = useMemo(() => {
    return accessibleAssets.filter(a => {
      const emp = employees.find(e => e.id === a.assignedTo);
      const matchSearch = !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.serialNo?.toLowerCase().includes(search.toLowerCase()) ||
        emp?.name.toLowerCase().includes(search.toLowerCase());
      const matchBranch = !filterBranch || a.branch === filterBranch;
      const matchStatus = !filterStatus || a.status === filterStatus;
      const matchCat = !filterCategory || a.category === filterCategory;
      return matchSearch && matchBranch && matchStatus && matchCat;
    });
  }, [accessibleAssets, search, filterBranch, filterStatus, filterCategory, employees]);

  // Restricted Branches for dropdowns
  const accessibleBranches = useMemo(() => {
    if (isMasterAdmin) return branches;
    if (isAdmin && (viewableBranches.includes('ALL') || viewableBranches.length === 0)) return branches;
    if (isAdmin) return branches.filter(b => viewableBranches.includes(b.name));
    return [];
  }, [branches, isMasterAdmin, isAdmin, viewableBranches]);

  const stats = useMemo(() => ({
    total: accessibleAssets.length,
    new: accessibleAssets.filter(a => a.status === 'New').length,
    good: accessibleAssets.filter(a => a.status === 'Good').length,
    damaged: accessibleAssets.filter(a => a.status === 'Broke' || a.status === 'Bad').length,
  }), [accessibleAssets]);

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = () => {
    const csvContent = [
      ['Asset Name', 'Category', 'Serial No', 'Branch', 'Assigned To', 'Status', 'Purchase Date', 'Notes'],
      ...filteredAssets.map(a => [
        `"${a.name.replace(/"/g, '""')}"`,
        `"${a.category}"`,
        `"${a.serialNo || ''}"`,
        `"${a.branch}"`,
        `"${a.assignedTo ? (employees.find(e => e.id === a.assignedTo)?.name || 'Unknown') : 'Unassigned'}"`,
        `"${a.status}"`,
        `"${a.purchaseDate || ''}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assets_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenModal = (asset?: Asset) => {
    if (asset) {
      setEditingId(asset.id);
      setForm({ ...asset });
    } else {
      setEditingId(null);
      setForm({
        name: '', category: 'Laptop', status: 'Good', branch: accessibleBranches[0]?.name || '', assignedTo: '', serialNo: '', purchaseDate: '', notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.status || !form.branch) {
      showNotification('Please fill all required fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = editingId || `AST-${crypto.randomUUID()}`;
      const payload: Asset = {
        id,
        name: form.name,
        category: form.category as Asset['category'],
        status: form.status as Asset['status'],
        branch: form.branch,
        serialNo: form.serialNo || '',
        assignedTo: form.assignedTo || null,
        purchaseDate: form.purchaseDate || '',
        notes: form.notes || '',
        addedBy: editingId ? (accessibleAssets.find(a => a.id === id)?.addedBy || session.empId) : session.empId,
        createdAt: editingId ? (accessibleAssets.find(a => a.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await DataStore.saveAsset(payload);
      showNotification(`Asset ${editingId ? 'updated' : 'added'} successfully.`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save asset.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await DataStore.deleteAsset(deleteConfirmId);
      showNotification('Asset deleted successfully.', 'success');
      setDeleteConfirmId(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete asset.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return 'badge-info';
      case 'Good': return 'badge-success';
      case 'Used': return 'badge-warning';
      case 'Bad': return 'badge-danger';
      case 'Broke': return 'badge-danger';
      default: return '';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Laptop': case 'Desktop': return <Monitor size={18} />;
      case 'Phone': case 'Tablet': return <Smartphone size={18} />;
      case 'Vehicle': return <Car size={18} />;
      default: return <Package size={18} />;
    }
  };

  // The Assigned Officer dropdown in Add/Edit modal is filtered by selected branch
  const branchEmployees = employees.filter(e => e.branch === form.branch && e.status !== 'Dormant');

  return (
    <div className="space-y-6 pb-24">
      {notification && (
        <Notification type={notification.type} message={notification.message} onClose={() => setNotification(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-text-primary">Asset Management</h2>
          <p className="text-sm text-text-secondary mt-1">Track and manage company physical assets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExport} className="btn btn-outline whitespace-nowrap" disabled={filteredAssets.length === 0}>
            <Download size={18} className="mr-2" /> Export CSV
          </button>
          
          {isAdmin && (
            <button onClick={() => handleOpenModal()} className="btn btn-primary whitespace-nowrap">
              <Plus size={18} className="mr-2" /> Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-text-secondary mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
        </div>
        <div className="stat-card relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
          <p className="text-sm text-text-secondary mb-1 relative">New Condition</p>
          <p className="text-2xl font-bold text-blue-600 relative">{stats.new}</p>
        </div>
        <div className="stat-card relative overflow-hidden">
          <div className="absolute inset-0 bg-green-500/10 pointer-events-none" />
          <p className="text-sm text-text-secondary mb-1 relative">Good/Used</p>
          <p className="text-2xl font-bold text-green-600 relative">{stats.good}</p>
        </div>
        <div className="stat-card relative overflow-hidden">
          <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
          <p className="text-sm text-text-secondary mb-1 relative">Damaged</p>
          <p className="text-2xl font-bold text-red-600 relative">{stats.damaged}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Search assets, serials or officers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control pl-10"
          />
        </div>
        
        {isAdmin && accessibleBranches.length > 1 && (
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="form-control w-full sm:w-40">
            <option value="">All Branches</option>
            {accessibleBranches.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}

        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="form-control w-full sm:w-40">
          <option value="">All Categories</option>
          {['Laptop', 'Desktop', 'Phone', 'Tablet', 'Vehicle', 'Printer', 'Other'].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-control w-full sm:w-40">
          <option value="">All Statuses</option>
          {['New', 'Good', 'Used', 'Bad', 'Broke'].map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        
        {(search || filterBranch || filterCategory || filterStatus) && (
          <button 
            onClick={() => { setSearch(''); setFilterBranch(''); setFilterCategory(''); setFilterStatus(''); }}
            className="text-text-muted hover:text-red-500 px-2 py-1 flex items-center transition-colors"
          >
            <X size={16} className="mr-1" /> Clear
          </button>
        )}
      </div>

      {/* Assets Table */}
      <div className="glass-panel overflow-hidden">
        <div className="table-container">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary border-b border-border-accent text-text-secondary uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-4 font-medium">Asset</th>
                <th className="p-4 font-medium">Serial No</th>
                <th className="p-4 font-medium">Branch</th>
                <th className="p-4 font-medium">Assigned Officer</th>
                <th className="p-4 font-medium">Status</th>
                {isAdmin && <th className="p-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-accent">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    No assets found
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const assignee = employees.find(e => e.id === asset.assignedTo);
                  return (
                    <tr key={asset.id} className="hover:bg-bg-secondary/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                            {getCategoryIcon(asset.category)}
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">{asset.name}</div>
                            <div className="text-xs text-text-secondary">{asset.category} {asset.purchaseDate && <span className="ml-1">• {asset.purchaseDate}</span>}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-text-secondary">{asset.serialNo || '-'}</td>
                      <td className="p-4 text-text-primary">{asset.branch}</td>
                      <td className="p-4">
                        {assignee ? (
                          <div>
                            <div className="text-text-primary">{assignee.name}</div>
                            <div className="text-xs text-text-secondary">{assignee.designation}</div>
                          </div>
                        ) : (
                          <span className="text-text-muted italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`badge ${getStatusBadge(asset.status)}`}>{asset.status}</span>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleOpenModal(asset)} className="p-2 text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => setDeleteConfirmId(asset.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-accent flex justify-between items-center sticky top-0 bg-bg-primary/80 backdrop-blur-md z-10">
              <h2 className="text-xl font-bold font-serif text-text-primary">
                {editingId ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-bg-secondary rounded-full transition-colors">
                <X size={20} className="text-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Asset Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="form-control"
                    placeholder="e.g. Dell Latitude 5420"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Category *</label>
                  <select
                    required
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
                    className="form-control"
                  >
                    {['Laptop', 'Desktop', 'Phone', 'Tablet', 'Vehicle', 'Printer', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Branch *</label>
                  <select
                    required
                    value={form.branch}
                    onChange={e => {
                      setForm(f => ({ ...f, branch: e.target.value, assignedTo: '' }));
                    }}
                    className="form-control"
                  >
                    <option value="" disabled>Select Branch</option>
                    {accessibleBranches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Status *</label>
                  <select
                    required
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="form-control"
                  >
                    {['New', 'Good', 'Used', 'Bad', 'Broke'].map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Assigned Officer</label>
                  <select
                    value={form.assignedTo || ''}
                    onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                    className="form-control"
                    disabled={!form.branch}
                  >
                    <option value="">-- Unassigned --</option>
                    {branchEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Serial Number</label>
                  <input
                    type="text"
                    value={form.serialNo}
                    onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))}
                    className="form-control"
                    placeholder="e.g. SN-123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                    className="form-control"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-2">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="form-control min-h-[80px]"
                    placeholder="Any additional details..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-border-accent">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary min-w-[120px]">
                  {isSubmitting ? 'Saving...' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Asset"
        message="Are you sure you want to delete this asset? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete Asset"
        type="danger"
      />
    </div>
  );
};
