import React, { useState, useMemo, useEffect } from 'react';
import { Session, AppData, Target, PerformanceAllowance } from '../types';
import { Target as TargetIcon, Plus, Trash2, ShieldCheck, Search, CheckCircle2, TrendingUp, Award, CheckCircle, AlertTriangle, Pencil, X } from 'lucide-react';
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

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [scoreData, setScoreData] = useState<{
    targets: Target[];
    totalTarget: number;
    totalAchieved: number;
    overallScore: number;
  } | null>(null);
  const [amountType, setAmountType] = useState<'fixed' | 'percentage'>('fixed');
  const [fixedAmount, setFixedAmount] = useState(0);
  const [pctValue, setPctValue] = useState(0);
  const [allowanceNotes, setAllowanceNotes] = useState('');

  // States for Editing, Deleting, and Direct Progress entry
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | string | null>(null);
  const [progressModalTarget, setProgressModalTarget] = useState<Target | null>(null);
  const [progressValue, setProgressValue] = useState<number>(0);

  const isAdmin = session.isAdmin;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const isMasterAdmin = session.email === 'zioncommercialcreditampara@gmail.com';
  const viewableBranches = session.viewableBranches || [];

  const accessibleEmployees = useMemo(() => {
    if (isMasterAdmin) return (data.employees || []).filter(e => e.status !== 'Dormant');
    if (isAdmin && (viewableBranches.includes('ALL') || viewableBranches.length === 0))
      return (data.employees || []).filter(e => e.status !== 'Dormant');
    if (isAdmin)
      return (data.employees || []).filter(e => e.status !== 'Dormant' && viewableBranches.includes(e.branch));
    return [];
  }, [data.employees, isMasterAdmin, isAdmin, viewableBranches]);

  const calcScore = (empId: string, month: string) => {
    const empTargets = (data.targets || []).filter(t => t.empId === empId && t.month === month);
    const totalTarget = empTargets.reduce((s, t) => s + t.targetCount, 0);
    const totalAchieved = empTargets.reduce((s, t) => s + t.achievedCount, 0);
    const overallScore = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    return { targets: empTargets, totalTarget, totalAchieved, overallScore };
  };

  const existingRecord = useMemo(() => {
    if (!selectedEmpId || !selectedMonth) return null;
    return (data.performanceAllowances || []).find(
      pa => pa.empId === selectedEmpId && pa.month === selectedMonth
    );
  }, [data.performanceAllowances, selectedEmpId, selectedMonth]);

  useEffect(() => {
    if (existingRecord) {
      setAmountType(existingRecord.amountType);
      if (existingRecord.amountType === 'fixed') {
        setFixedAmount(existingRecord.amount);
        setPctValue(0);
      } else {
        setPctValue(existingRecord.percentageOfBase || 0);
        setFixedAmount(0);
      }
      setAllowanceNotes(existingRecord.notes || '');
    } else {
      setAmountType('fixed');
      const emp = (data.employees || []).find(e => e.id === selectedEmpId);
      setFixedAmount(emp?.performanceAllowance || 0);
      setPctValue(0);
      setAllowanceNotes('');
    }
  }, [existingRecord, selectedEmpId, data.employees]);

  const handleEmpOrMonthChange = (empId: string, month: string) => {
    setSelectedEmpId(empId);
    setSelectedMonth(month);
    setScoreData(null);
  };

  const handleViewPerformance = () => {
    if (!selectedEmpId) {
      showNotification('Please select an employee first', 'error');
      return;
    }
    const score = calcScore(selectedEmpId, selectedMonth);
    setScoreData(score);
  };

  const handleSaveAllowance = async () => {
    if (!selectedEmpId) { showNotification('Select an employee', 'error'); return; }
    if (amountType === 'fixed' && (!fixedAmount || fixedAmount <= 0)) {
      showNotification('Enter a valid amount', 'error'); return;
    }
    if (amountType === 'percentage' && (!pctValue || pctValue <= 0 || pctValue > 100)) {
      showNotification('Enter a valid percentage (1–100)', 'error'); return;
    }

    const emp = (data.employees || []).find(e => e.id === selectedEmpId);
    const finalAmount = amountType === 'fixed'
      ? fixedAmount
      : Math.round((pctValue / 100) * (emp?.baseSalary || 0));

    const record: PerformanceAllowance = {
      id: `${selectedEmpId}_${selectedMonth}`,
      empId: selectedEmpId,
      month: selectedMonth,
      score: scoreData ? scoreData.overallScore : 0,
      amount: finalAmount,
      amountType,
      percentageOfBase: amountType === 'percentage' ? pctValue : undefined,
      paid: existingRecord ? existingRecord.paid : false,
      setBy: session.empId,
      setAt: new Date().toISOString(),
      notes: allowanceNotes.trim(),
    };

    try {
      await DataStore.savePerformanceAllowance(record);
      showNotification(`Allowance of Rs.${finalAmount.toLocaleString()} saved for ${emp?.name || selectedEmpId}`);
    } catch (e) {
      showNotification('Failed to save performance allowance', 'error');
    }
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

  const handleEditTargetSave = async () => {
    if (!editingTarget) return;
    if (!editingTarget.category || editingTarget.targetCount <= 0 || editingTarget.achievedCount < 0) {
      showNotification('Please fill all fields correctly', 'error');
      return;
    }
    try {
      await DataStore.addTarget(editingTarget);
      showNotification('Target updated successfully');
      setEditingTarget(null);
    } catch (e) {
      showNotification('Failed to update target', 'error');
    }
  };

  const confirmDeleteTarget = async () => {
    if (!deleteConfirmId) return;
    try {
      await DataStore.deleteTarget(Number(deleteConfirmId));
      showNotification('Target deleted successfully');
      setDeleteConfirmId(null);
    } catch (e) {
      showNotification('Failed to delete target', 'error');
    }
  };

  const saveProgressDirectly = async () => {
    if (!progressModalTarget) return;
    if (progressValue < 0) {
      showNotification('Progress cannot be negative', 'error');
      return;
    }
    try {
      await DataStore.addTarget({
        ...progressModalTarget,
        achievedCount: progressValue
      });
      showNotification('Progress updated successfully');
      setProgressModalTarget(null);
    } catch (e) {
      showNotification('Failed to update progress', 'error');
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
            <div className="mb-8 border-b border-border-accent pb-8">
              <div className="glass-panel p-6 space-y-6 bg-gray-50/50 rounded-xl border border-border-accent">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-accent pb-2">
                  <Award className="w-5 h-5 text-brand-accent animate-pulse" />
                  Individual Performance Allowance
                </h3>
                
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="form-group flex-1 w-full">
                    <label className="form-label text-xs font-semibold text-text-secondary select-none">Employee</label>
                    <select 
                      className="form-control" 
                      value={selectedEmpId} 
                      onChange={e => handleEmpOrMonthChange(e.target.value, selectedMonth)}
                    >
                      <option value="">Select Employee...</option>
                      {accessibleEmployees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id}) - {e.branch}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group flex-1 w-full">
                    <label className="form-label text-xs font-semibold text-text-secondary select-none">Select Month</label>
                    <input 
                      type="month" 
                      className="form-control" 
                      value={selectedMonth} 
                      onChange={e => handleEmpOrMonthChange(selectedEmpId, e.target.value)} 
                    />
                  </div>
                  
                  <button 
                    onClick={handleViewPerformance} 
                    className="btn btn-outline justify-center gap-2 w-full md:w-auto h-[42px] cursor-pointer"
                  >
                    <Search className="w-4 h-4" /> View Performance
                  </button>
                </div>

                {scoreData && (
                  <div className="mt-6 border border-border-accent rounded-xl p-6 bg-white space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-accent pb-4">
                      <div>
                        <h4 className="text-lg font-bold text-text-primary">
                          {getEmpName(selectedEmpId)} — <span className="font-mono text-base text-text-secondary">{selectedMonth}</span>
                        </h4>
                        {existingRecord?.paid && (
                          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Paid ✓
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-text-secondary">Overall Performance:</span>
                        <span className={`text-3xl font-extrabold ${
                          scoreData.overallScore >= 80 ? 'text-emerald-600' : scoreData.overallScore >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {scoreData.overallScore}%
                        </span>
                      </div>
                    </div>

                    {scoreData.targets.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Targets breakdown</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {scoreData.targets.map(t => {
                            const pct = t.targetCount > 0 ? Math.min(100, Math.round((t.achievedCount / t.targetCount) * 100)) : 0;
                            const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={t.id} className="bg-white p-4 rounded-lg border border-border-accent shadow-sm">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-sm font-semibold text-text-primary">{t.category}</span>
                                  <span className="text-xs font-bold text-text-secondary">{t.achievedCount} / {t.targetCount} ({pct}%)</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-amber-200 rounded-lg bg-amber-50/50 flex items-center gap-3 text-amber-800">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">No targets assigned for this month. You can still manually set a fixed performance allowance below.</span>
                      </div>
                    )}

                    {existingRecord?.paid ? (
                      <div className="p-5 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-3">
                        <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" /> Locked performance allowance paid via payroll
                        </p>
                        <div className="text-sm text-text-primary grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <span className="text-xs text-text-secondary block font-semibold mb-0.5">Allowance Amount:</span>
                            <span className="font-bold text-base text-brand-primary">LKR {existingRecord.amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-xs text-text-secondary block font-semibold mb-0.5">Calculation Type:</span>
                            <span className="capitalize font-medium text-text-primary">{existingRecord.amountType}</span>
                          </div>
                          {existingRecord.percentageOfBase && (
                            <div>
                              <span className="text-xs text-text-secondary block font-semibold mb-0.5">Base % Used:</span>
                              <span className="font-semibold text-text-primary">{existingRecord.percentageOfBase}% of Base Salary</span>
                            </div>
                          )}
                        </div>
                        {existingRecord.notes && (
                          <div className="pt-2 border-t border-emerald-100/30 text-xs text-text-secondary p-1">
                            <strong>Admin Notes:</strong> {existingRecord.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t border-border-accent pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-text-primary block">Set Allowance Calculation</label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer select-none">
                                <input 
                                  type="radio" 
                                  name="amountType" 
                                  checked={amountType === 'fixed'} 
                                  onChange={() => setAmountType('fixed')}
                                  className="text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                                />
                                Fixed Amount
                              </label>
                              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer select-none">
                                <input 
                                  type="radio" 
                                  name="amountType" 
                                  checked={amountType === 'percentage'} 
                                  onChange={() => setAmountType('percentage')}
                                  className="text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                                />
                                % of Base Salary
                              </label>
                            </div>

                            {amountType === 'fixed' ? (
                              <div className="form-group">
                                <label className="form-label text-xs font-semibold text-text-secondary">Amount (LKR)</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-secondary">LKR</span>
                                  <input 
                                    type="number" 
                                    min="0"
                                    className="form-control pl-12"
                                    placeholder="e.g. 15000"
                                    value={fixedAmount || ''}
                                    onChange={e => setFixedAmount(Number(e.target.value))}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="form-group space-y-2">
                                <label className="form-label text-xs font-semibold text-text-secondary">Percentage (%) of Base Salary</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    min="1"
                                    max="100"
                                    className="form-control pr-10"
                                    placeholder="e.g. 20"
                                    value={pctValue || ''}
                                    onChange={e => setPctValue(Number(e.target.value))}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-secondary">%</span>
                                </div>
                                {selectedEmpId && (
                                  <p className="text-xs text-text-secondary font-medium">
                                    Base Salary of employee: <strong>LKR {((data.employees || []).find(e => e.id === selectedEmpId)?.baseSalary || 0).toLocaleString()}</strong>
                                    {pctValue > 0 && (
                                      <>
                                        {' ➔ Estimated Allowance: '}<strong className="text-brand-accent">LKR {Math.round((pctValue / 100) * ((data.employees || []).find(e => e.id === selectedEmpId)?.baseSalary || 0)).toLocaleString()}</strong>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="form-group flex flex-col h-full justify-between">
                            <div className="flex-1">
                              <label className="form-label text-sm font-bold text-text-primary mb-2 block">Notes / Reason</label>
                              <textarea 
                                className="form-control h-[90px] resize-none" 
                                placeholder="Describe why or any review notes..."
                                value={allowanceNotes}
                                onChange={e => setAllowanceNotes(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-border-accent pt-4">
                          <button 
                            onClick={() => setScoreData(null)} 
                            className="btn btn-outline"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleSaveAllowance} 
                            className="btn btn-primary gap-2 cursor-pointer"
                          >
                            {existingRecord ? 'Update Allowance' : 'Save Allowance'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingTarget(t)} 
                          className="text-text-secondary hover:text-brand-accent transition-colors p-1"
                          title="Edit Target"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(t.id)} 
                          className="text-text-secondary hover:text-red-500 transition-colors p-1"
                          title="Delete Target"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
                      <button 
                        onClick={() => handleUpdateAchieved(t, false)} 
                        disabled={t.achievedCount <= 0} 
                        className="text-xs text-text-secondary hover:text-red-500 disabled:opacity-50"
                      >
                        - Revert One
                      </button>
                      <button 
                        onClick={() => {
                          setProgressModalTarget(t);
                          setProgressValue(t.achievedCount);
                        }} 
                        className="text-xs font-bold text-brand-accent hover:text-brand-primary"
                      >
                        + Add Progress (Type)
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

      {/* Custom Clean Edit Target Modal to modify targets or type achieved values */}
      {editingTarget && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">Edit Target Details</h3>
              <button onClick={() => setEditingTarget(null)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label text-xs font-semibold text-text-secondary">Employee</label>
                <input 
                  type="text" 
                  className="form-control bg-gray-50 cursor-not-allowed" 
                  value={getEmpName(editingTarget.empId)} 
                  disabled 
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs font-semibold text-text-secondary">Month</label>
                <input 
                  type="month" 
                  className="form-control" 
                  value={editingTarget.month} 
                  onChange={e => setEditingTarget({...editingTarget, month: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs font-semibold text-text-secondary">Category / Goal</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editingTarget.category} 
                  onChange={e => setEditingTarget({...editingTarget, category: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs font-semibold text-text-secondary">Target Amount (Count/Value)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={editingTarget.targetCount} 
                  onChange={e => setEditingTarget({...editingTarget, targetCount: Number(e.target.value)})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs font-semibold text-text-secondary">Achieved Progress Amount</label>
                <input 
                  type="number" 
                  className="form-control font-bold" 
                  value={editingTarget.achievedCount} 
                  onChange={e => setEditingTarget({...editingTarget, achievedCount: Number(e.target.value)})} 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-accent">
                <button onClick={() => setEditingTarget(null)} className="btn btn-outline">Cancel</button>
                <button onClick={handleEditTargetSave} className="btn btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Frame-Friendly Delete Confirmation Modal */}
      {deleteConfirmId && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete Target</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to delete this target? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn btn-outline">Cancel</button>
              <button onClick={confirmDeleteTarget} className="btn bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Progress Typing Modal */}
      {progressModalTarget && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-text-primary">Update Achieved Progress</h3>
              <button onClick={() => setProgressModalTarget(null)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-text-secondary mb-4">
              Category: <strong>{progressModalTarget.category}</strong> for <strong>{getEmpName(progressModalTarget.empId)}</strong> ({progressModalTarget.month})
            </p>
            
            <div className="space-y-4">
              <div className="form-group text-center">
                <label className="form-label text-xs font-semibold text-text-secondary block text-left mb-2">Type Achieved Amount Directly</label>
                <div className="flex items-center justify-center gap-3 bg-gray-50/50 p-4 rounded-xl border border-border-accent mb-2">
                  <input 
                    type="number" 
                    className="form-control font-bold text-2xl text-center w-36 py-2" 
                    value={progressValue} 
                    onChange={e => setProgressValue(Math.max(0, Number(e.target.value)))} 
                  />
                  <span className="text-xl text-text-secondary font-bold">/ {progressModalTarget.targetCount}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center py-2 bg-gray-100/40 p-2 rounded-lg border border-border-accent">
                <button 
                  type="button" 
                  onClick={() => setProgressValue(prev => Math.max(0, prev - 10))} 
                  className="px-3 py-1 bg-white border border-border-accent hover:bg-gray-100 rounded text-text-primary font-medium text-xs shadow-sm cursor-pointer"
                >
                  -10
                </button>
                <button 
                  type="button" 
                  onClick={() => setProgressValue(prev => Math.max(0, prev - 1))} 
                  className="px-3 py-1 bg-white border border-border-accent hover:bg-gray-100 rounded text-text-primary font-medium text-xs shadow-sm cursor-pointer"
                >
                  -1
                </button>
                <button 
                  type="button" 
                  onClick={() => setProgressValue(prev => prev + 1)} 
                  className="px-3 py-1 bg-white border border-border-accent hover:bg-gray-100 rounded text-text-primary font-medium text-xs shadow-sm cursor-pointer"
                >
                  +1
                </button>
                <button 
                  type="button" 
                  onClick={() => setProgressValue(prev => prev + 10)} 
                  className="px-3 py-1 bg-white border border-border-accent hover:bg-gray-100 rounded text-text-primary font-medium text-xs shadow-sm cursor-pointer"
                >
                  +10
                </button>
                <button 
                  type="button" 
                  onClick={() => setProgressValue(progressModalTarget.targetCount)} 
                  className="px-3 py-1 bg-white border border-brand-accent hover:bg-brand-accent/5 rounded text-brand-accent font-semibold text-xs shadow-sm cursor-pointer"
                >
                  Set Max
                </button>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setProgressModalTarget(null)} className="btn btn-outline">Cancel</button>
                <button onClick={saveProgressDirectly} className="btn btn-primary">Save Progress</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
