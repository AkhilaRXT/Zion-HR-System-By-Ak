import React, { useState } from 'react';
import { Session, AppData, Target } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Target as TargetIcon,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  X,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface TargetManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function TargetManagement({ session, data, onRefresh }: TargetManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));

  const [formData, setFormData] = useState<Omit<Target, 'id'>>({
    empId: '',
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    category: 'Sales',
    targetCount: 0,
    achievedCount: 0
  });

  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManage = isAdmin && (isMasterAdmin || session.permissions?.includes('targets'));

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.empId || !formData.category) return;

    try {
      await DataStore.addTarget({
        ...formData,
        id: Date.now()
      });
      setIsAdding(false);
      showNotification('Target assigned successfully!');
    } catch (err) {
      showNotification('Failed to assign target.', 'error');
    }
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteTarget(confirmDelete);
        setConfirmDelete(null);
        showNotification('Target removed.');
      } catch (err) {
        showNotification('Failed to delete target.', 'error');
      }
    }
  };

  const filteredTargets = (data.targets || []).filter(t => {
    const emp = data.employees.find(e => e.id === t.empId);
    const matchesSearch = !searchQuery ||
      t.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = !monthFilter || t.month === monthFilter;
    return matchesSearch && matchesMonth;
  });

  const uniqueMonths = Array.from(new Set((data.targets || []).map(t => t.month)));
  if (!uniqueMonths.includes(monthFilter)) uniqueMonths.push(monthFilter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-text-primary">Performance Targets</h2>
          <p className="text-text-secondary">Set and track employee goals and achievements.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-5 h-5" />
            Assign Target
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-3 bg-brand-accent/10 rounded-xl text-brand-accent">
            <TargetIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-text-secondary uppercase">Active Targets</div>
            <div className="text-2xl font-bold text-text-primary">{filteredTargets.length}</div>
          </div>
        </div>
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-text-secondary uppercase">Completed</div>
            <div className="text-2xl font-bold text-text-primary">
              {filteredTargets.filter(t => t.achievedCount >= t.targetCount).length}
            </div>
          </div>
        </div>
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-text-secondary uppercase">Avg. Completion</div>
            <div className="text-2xl font-bold text-text-primary">
              {filteredTargets.length > 0
                ? Math.round(filteredTargets.reduce((acc, t) => acc + (t.achievedCount / t.targetCount), 0) / filteredTargets.length * 100)
                : 0}%
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-border-accent flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search employee..."
                className="form-control pl-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <select
                className="form-control pl-10"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
              >
                <option value="">All Months</option>
                {uniqueMonths.sort().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-border-accent">
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Target</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Achieved</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-widest">Progress</th>
                {canManage && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-accent">
              {filteredTargets.map((target) => {
                const emp = data.employees.find(e => e.id === target.empId);
                const progress = Math.min(100, Math.round((target.achievedCount / target.targetCount) * 100));

                return (
                  <tr key={target.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">{emp?.name || 'Unknown'}</span>
                        <span className="text-xs text-brand-accent font-mono">{target.empId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-info">{target.category}</span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-text-primary">
                      {target.targetCount}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-text-primary">
                      {target.achievedCount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[120px] space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className={progress >= 100 ? 'text-emerald-600' : 'text-text-secondary'}>
                            {progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={`h-full rounded-full ${
                              progress >= 100 ? 'bg-emerald-500' :
                              progress >= 50 ? 'bg-brand-accent' : 'bg-amber-500'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setConfirmDelete(target.id)}
                          className="text-text-secondary hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredTargets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    No targets found for the selected filters.
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
              className="bg-white border border-border-accent p-8 rounded-2xl w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-text-primary">Assign New Target</h3>
                <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="form-group">
                  <label className="text-sm font-semibold text-text-secondary mb-2 block">Select Employee</label>
                  <select
                    className="form-control"
                    value={formData.empId}
                    onChange={e => setFormData({...formData, empId: e.target.value})}
                    required
                  >
                    <option value="">Select an employee...</option>
                    {data.employees
                      .filter(e => e.status !== 'Dormant')
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-sm font-semibold text-text-secondary mb-2 block">Month</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. October 2023"
                    value={formData.month}
                    onChange={e => setFormData({...formData, month: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="text-sm font-semibold text-text-secondary mb-2 block">Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. New Loans, Collections, etc."
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Target Count</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.targetCount}
                      onChange={e => setFormData({...formData, targetCount: parseInt(e.target.value) || 0})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-secondary mb-2 block">Initial Achieved</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.achievedCount}
                      onChange={e => setFormData({...formData, achievedCount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn btn-outline flex-1 justify-center">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1 justify-center gap-2">
                    <Save className="w-4 h-4" />
                    Assign Target
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Remove Target"
        message="Are you sure you want to remove this performance target? This action cannot be undone."
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
