import React, { useState } from 'react';
import { Session, AppData, Target } from '../types';
import { Target as TargetIcon, Plus, Trash2, ShieldCheck, Search, CheckCircle2 } from 'lucide-react';
import { DataStore } from '../lib/dataStore';
import Notification, { NotificationType } from './Notification';

interface TargetManagementProps {
  session: Session;
  data: AppData;
}

export default function TargetManagement({ session, data }: TargetManagementProps) {
  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTarget, setNewTarget] = useState({ empId: '', month: '', category: '', targetCount: 0 });
  const [search, setSearch] = useState('');

  const isAdmin = session.isAdmin;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleAddTarget = async () => {
    if (!newTarget.empId || !newTarget.month || !newTarget.category || newTarget.targetCount <= 0) {
      showNotification('Please fill all fields correctly', 'error');
      return;
    }
    try {
      const target: Target = {
        id: Date.now(),
        empId: newTarget.empId,
        month: newTarget.month,
        category: newTarget.category,
        targetCount: newTarget.targetCount,
        achievedCount: 0
      };
      await DataStore.addTarget(target);
      showNotification('Target assigned successfully');
      setShowModal(false);
      setNewTarget({ empId: '', month: '', category: '', targetCount: 0 });
    } catch (e) {
      showNotification('Failed to assign target', 'error');
    }
  };

  const handleDeleteTarget = async (id: number) => {
    if (confirm('Delete this target?')) {
      try {
        await DataStore.deleteTarget(id);
        showNotification('Target deleted');
      } catch (e) {
        showNotification('Failed to delete target', 'error');
      }
    }
  };

  const handleUpdateAchieved = async (target: Target, increment: boolean) => {
    try {
      const newCount = increment ? target.achievedCount + 1 : Math.max(0, target.achievedCount - 1);
      await DataStore.addTarget({ ...target, achievedCount: newCount });
    } catch (e) {
      showNotification('Failed to update progress', 'error');
    }
  };

  const getEmpName = (id: string) => (data.employees || []).find(e => e.id === id)?.name || id;

  const filteredTargets = (data.targets || []).filter(t => 
    (!isAdmin ? t.empId === session.empId : true) &&
    (getEmpName(t.empId).toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b) => b.id - a.id);

  return (
    <div className="p-8">
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="bg-white rounded-xl shadow-lg border border-border-accent overflow-hidden">
        <div className="p-6 border-b border-border-accent flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <TargetIcon className="w-6 h-6 text-brand-accent" />
            Performance & Targets
          </h2>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary gap-2">
              <Plus className="w-4 h-4" /> Assign Target
            </button>
          )}
        </div>
        
        <div className="p-6">
          {isAdmin && (
            <div className="mb-6 max-w-md relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Search targets..." 
                className="form-control pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTargets.map(t => {
              const progress = Math.min(100, Math.round((t.achievedCount / t.targetCount) * 100));
              return (
                <div key={t.id} className="p-5 border border-border-accent rounded-xl hover:shadow-md transition-shadow bg-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-text-primary text-sm">{getEmpName(t.empId)}</h3>
                      <span className="text-[10px] text-text-secondary font-mono bg-gray-100 px-2 py-0.5 rounded">{t.month}</span>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeleteTarget(t.id)} className="text-text-secondary hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-text-primary uppercase tracking-wider">{t.category}</p>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-2xl font-bold text-brand-primary">{t.achievedCount} <span className="text-xs text-text-secondary font-normal">/ {t.targetCount}</span></span>
                      {progress >= 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    </div>
                  </div>

                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div className={`h-full transition-all ${progress >= 100 ? 'bg-emerald-500' : 'bg-brand-accent'}`} style={{ width: `${progress}%` }} />
                  </div>

                  {isAdmin && (
                    <div className="flex justify-between border-t border-border-accent pt-4 mt-2">
                      <button onClick={() => handleUpdateAchieved(t, false)} disabled={t.achievedCount <= 0} className="text-xs text-text-secondary hover:text-red-500 disabled:opacity-50">
                        - Revert
                      </button>
                      <button onClick={() => handleUpdateAchieved(t, true)} className="text-xs font-bold text-brand-accent hover:text-brand-primary">
                        + Add Progress
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTargets.length === 0 && (
              <div className="col-span-full py-12 text-center text-text-secondary">
                No targets mapped.
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-text-primary mb-6">Assign New Target</h3>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Employee</label>
                <select className="form-control" value={newTarget.empId} onChange={e => setNewTarget({...newTarget, empId: e.target.value})}>
                  <option value="">Select Employee...</option>
                  {(data.employees || []).filter(e => e.status !== 'Dormant').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Month</label>
                <input type="month" className="form-control" value={newTarget.month} onChange={e => setNewTarget({...newTarget, month: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Category / Goal</label>
                <input type="text" className="form-control" placeholder="e.g. Sales, Recovery, Accounts" value={newTarget.category} onChange={e => setNewTarget({...newTarget, category: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Amount (Count/Value)</label>
                <input type="number" min="1" className="form-control" value={newTarget.targetCount || ''} onChange={e => setNewTarget({...newTarget, targetCount: Number(e.target.value)})} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-accent">
                <button onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button onClick={handleAddTarget} className="btn btn-primary">Save Target</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
