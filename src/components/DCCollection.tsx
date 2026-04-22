import React, { useState, useMemo } from 'react';
import { AppData, Session, DCCollection as DCCollectionType } from '../types';
import { DataStore } from '../lib/dataStore';
import { 
  Plus, 
  Search, 
  FileDown, 
  Trash2, 
  Filter, 
  PieChart, 
  Users, 
  HandCoins,
  FileText,
  Printer,
  ChevronDown,
  X,
  CreditCard,
  Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface DCCollectionProps {
  session: Session;
  data: AppData;
}

export default function DCCollection({ session, data }: DCCollectionProps) {
  const isAdmin = session.isAdmin;
  const [activeTab, setActiveTab] = useState(isAdmin ? 'report' : 'receipt');
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    nic: '',
    referenceNo: '',
    documentCharge: '',
    loanAmount: '',
    paymentMethod: 'Cash',
    collectionType: 'Loan'
  });

  // Filter State
  const todayStr = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    startDate: todayStr,
    endDate: todayStr,
    paymentMethod: 'All',
    collectionType: 'All',
    branch: 'All'
  });

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.documentCharge) {
      showNotification('Customer Name and Document Charge are required', 'error');
      return;
    }

    try {
      const id = `DC-${Date.now()}`;
      const receiptNo = `DC-RCP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      
      const newCollection: DCCollectionType = {
        id,
        receiptNo,
        date: todayStr,
        customerName: formData.customerName,
        nic: formData.nic,
        documentCharge: Number(formData.documentCharge),
        loanAmount: Number(formData.loanAmount),
        paymentMethod: formData.paymentMethod,
        collectionType: formData.collectionType,
        collectedBy: session.name,
        empId: session.empId,
        branch: (data.employees || []).find(e => e.id === session.empId)?.branch || 'Main Branch',
        timestamp: new Date().toISOString()
      };

      await DataStore.addDCCollection(newCollection);
      showNotification('Receipt generated successfully!');
      setFormData({
        customerName: '',
        nic: '',
        referenceNo: '',
        documentCharge: '',
        loanAmount: '',
        paymentMethod: 'Cash',
        collectionType: 'Loan'
      });
      if (isAdmin) setActiveTab('report');
    } catch (err) {
      showNotification('Failed to create receipt', 'error');
    }
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteDCCollection(confirmDelete);
        setConfirmDelete(null);
        showNotification('Collection record deleted');
      } catch (err) {
        showNotification('Failed to delete record', 'error');
      }
    }
  };

  const filteredHistory = useMemo(() => {
    return (data.dcCollections || [])
      .filter(c => {
        const dateMatch = c.date >= filters.startDate && c.date <= filters.endDate;
        const methodMatch = filters.paymentMethod === 'All' || c.paymentMethod === filters.paymentMethod;
        const typeMatch = filters.collectionType === 'All' || c.collectionType === filters.collectionType;
        const branchMatch = filters.branch === 'All' || c.branch === filters.branch;
        return dateMatch && methodMatch && typeMatch && branchMatch;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data.dcCollections, filters]);

  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const amount = filteredHistory.reduce((s, c) => s + c.documentCharge, 0);
    
    const byMethod: { [key: string]: { count: number, amount: number } } = {};
    const byUser: { [key: string]: { count: number, amount: number } } = {};

    filteredHistory.forEach(c => {
      byMethod[c.paymentMethod] = byMethod[c.paymentMethod] || { count: 0, amount: 0 };
      byMethod[c.paymentMethod].count++;
      byMethod[c.paymentMethod].amount += c.documentCharge;

      byUser[c.collectedBy] = byUser[c.collectedBy] || { count: 0, amount: 0 };
      byUser[c.collectedBy].count++;
      byUser[c.collectedBy].amount += c.documentCharge;
    });

    return { total, amount, byMethod, byUser };
  }, [filteredHistory]);

  const handleExport = () => {
    if (filteredHistory.length === 0) {
      showNotification('No records to export', 'error');
      return;
    }

    const summaryData = [
      ['Collection Report'],
      [`Generated on: ${new Date().toLocaleString()}`],
      [],
      ['Summary'],
      ['Total Collections', stats.total],
      ['Total Amount', `Rs. ${stats.amount.toFixed(2)}`],
      [],
      ['Collection Details'],
      ['Date', 'Receipt #', 'Type', 'NIC', 'Customer Name', 'Loan Amount', 'DC Amount', 'Method', 'Collected By']
    ];

    const detailData = filteredHistory.map(c => [
      c.date,
      c.receiptNo,
      c.collectionType,
      c.nic,
      c.customerName,
      c.loanAmount,
      c.documentCharge,
      c.paymentMethod,
      c.collectedBy
    ]);

    const totalRow = ['', '', '', '', 'TOTAL', '', stats.amount, '', ''];
    
    const ws = XLSX.utils.aoa_to_sheet([...summaryData, ...detailData, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DC Collections');
    XLSX.writeFile(wb, `DC_Collections_${filters.startDate}_to_${filters.endDate}.xlsx`);
    DataStore.logAction('Export Data', `Exported DC Collections for period ${filters.startDate} to ${filters.endDate}`, 'Cash');
    showNotification('Report exported to Excel');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tabs */}
      <div className="flex gap-4 p-1 bg-gray-100/50 backdrop-blur-sm rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('receipt')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${
            activeTab === 'receipt' 
              ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Receipt Entry
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${
              activeTab === 'report' 
                ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Collection Report
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'receipt' ? (
          <motion.div 
            key="receipt-form"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-border-accent p-8 shadow-xl shadow-gray-100/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                
                <h3 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-3">
                  <span className="p-2 bg-brand-accent/10 rounded-lg">
                    <HandCoins className="w-5 h-5 text-brand-accent" />
                  </span>
                  New Receipt Entry
                </h3>

                <form onSubmit={handleCreateReceipt} className="space-y-6 relative z-10 text-text-primary font-medium">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-group col-span-full">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Customer Name</label>
                      <input 
                        type="text" required className="form-control"
                        value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})}
                        placeholder="Full name as per identification"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Customer NIC</label>
                      <input 
                        type="text" className="form-control"
                        value={formData.nic} onChange={e => setFormData({...formData, nic: e.target.value})}
                        placeholder="e.g. 199012345678"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Collection Type</label>
                      <select 
                        className="form-control"
                        value={formData.collectionType} onChange={e => setFormData({...formData, collectionType: e.target.value})}
                      >
                        <option value="Loan">Loan</option>
                        <option value="Savings">Savings</option>
                        <option value="Inquiry">Inquiry</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Loan Amount (Reference)</label>
                      <input 
                        type="number" step="0.01" className="form-control"
                        value={formData.loanAmount} onChange={e => setFormData({...formData, loanAmount: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-emerald-600 mb-2 block font-bold">Document Charge (DC)</label>
                      <input 
                        type="number" step="0.01" required className="form-control border-emerald-200 focus:border-emerald-500"
                        value={formData.documentCharge} onChange={e => setFormData({...formData, documentCharge: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Payment Method</label>
                      <select 
                        className="form-control"
                        value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Card">Card</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      className="w-full bg-brand-accent text-white py-4 rounded-xl font-bold uppercase tracking-[2px] text-xs hover:shadow-xl hover:shadow-brand-accent/30 transition-all flex items-center justify-center gap-3"
                    >
                      <Plus className="w-5 h-5" />
                      Generate & Print Receipt
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Recent History Sidebar */}
            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-border-accent p-6 shadow-lg shadow-gray-100/10">
                <h4 className="text-sm font-bold text-text-primary mb-6 flex items-center justify-between">
                  My Recent Receipts
                  <span className="text-[10px] font-medium text-brand-accent px-2 py-0.5 bg-brand-accent/10 rounded-full">Today</span>
                </h4>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {(data.dcCollections || [])
                    .filter(c => c.empId === session.empId && c.date === todayStr)
                    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(c => (
                      <div key={c.id} className="p-4 bg-gray-50/50 rounded-xl border border-border-accent hover:border-brand-accent/30 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono text-brand-accent">{c.receiptNo}</span>
                          <span className="text-[9px] font-bold text-text-secondary">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs font-bold text-text-primary mb-1 truncate">{c.customerName}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-text-secondary">{c.paymentMethod} • {c.collectionType}</span>
                          <span className="font-bold text-brand-accent">Rs. {c.documentCharge.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  {!(data.dcCollections || []).some(c => c.empId === session.empId && c.date === todayStr) && (
                    <div className="py-12 text-center">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest">No entries today</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="report-view"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="space-y-8"
          >
            {/* Admin Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/80 rounded-2xl border border-border-accent p-6 shadow-sm group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-brand-accent/10 rounded-xl group-hover:bg-brand-accent group-hover:text-white transition-colors duration-300">
                    <HandCoins className="w-5 h-5 text-brand-accent group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Total Collections</p>
                    <p className="text-2xl font-black text-text-primary">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 rounded-2xl border border-emerald-100 p-6 shadow-sm group hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                    <Wallet className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Total Amount</p>
                    <p className="text-2xl font-black text-emerald-600">Rs. {stats.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white/80 rounded-2xl border border-border-accent p-8">
              <div className="flex items-center gap-2 mb-8 text-text-primary">
                <Filter className="w-5 h-5" />
                <h4 className="text-sm font-bold uppercase tracking-[2px]">Advanced Filters</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Start Date</label>
                  <input 
                    type="date" className="form-control"
                    value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">End Date</label>
                  <input 
                    type="date" className="form-control"
                    value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Branch</label>
                  <select 
                    className="form-control"
                    value={filters.branch} onChange={e => setFilters({...filters, branch: e.target.value})}
                  >
                    <option value="All">All Branches</option>
                    {Array.from(new Set((data.employees || []).map(e => e.branch))).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block font-bold">Method</label>
                  <select 
                    className="form-control"
                    value={filters.paymentMethod} onChange={e => setFilters({...filters, paymentMethod: e.target.value})}
                  >
                    <option value="All">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={handleExport}
                    className="w-full bg-brand-secondary text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Excel
                  </button>
                </div>
              </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Method Summary */}
              <div className="table-container">
                <div className="p-6 border-b border-border-accent bg-gray-50/50">
                  <h5 className="text-[10px] font-bold text-text-primary uppercase tracking-[2px] flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-brand-accent" />
                    Collections by Payment Method
                  </h5>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Count</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byMethod).map(([method, s]: [string, any]) => (
                      <tr key={method}>
                        <td className="font-bold text-text-primary uppercase tracking-wider text-[10px]">{method}</td>
                        <td className="text-text-secondary">{s.count}</td>
                        <td className="text-right font-mono font-bold text-emerald-600">Rs. {s.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* User Summary */}
              <div className="table-container">
                <div className="p-6 border-b border-border-accent bg-gray-50/50">
                  <h5 className="text-[10px] font-bold text-text-primary uppercase tracking-[2px] flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-accent" />
                    Collections by User
                  </h5>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Collected By</th>
                      <th>Count</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byUser).map(([user, s]: [string, any]) => (
                      <tr key={user}>
                        <td className="font-bold text-text-primary uppercase tracking-wider text-[10px]">{user}</td>
                        <td className="text-text-secondary">{s.count}</td>
                        <td className="text-right font-mono font-bold text-brand-accent">Rs. {s.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed History Table */}
            <div className="table-container">
              <div className="p-6 border-b border-border-accent bg-gray-50/50 flex justify-between items-center">
                <h5 className="text-[10px] font-bold text-text-primary uppercase tracking-[2px] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-accent" />
                  Detailed Collection Log
                </h5>
                <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-border-accent">{filteredHistory.length} Records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt #</th>
                      <th>Type</th>
                      <th>Customer Name</th>
                      <th>NIC</th>
                      <th>Branch</th>
                      <th className="text-right">DC Amount</th>
                      <th>Collected By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(c => (
                      <tr key={c.id}>
                        <td className="text-[11px] font-bold text-text-secondary tracking-widest uppercase">{c.date}</td>
                        <td className="font-mono text-[10px] text-brand-accent font-bold">{c.receiptNo}</td>
                        <td>
                          <span className="px-2 py-1 bg-gray-100 rounded text-[9px] font-bold tracking-tighter uppercase">{c.collectionType}</span>
                        </td>
                        <td className="font-bold text-text-primary text-xs">{c.customerName}</td>
                        <td className="text-[11px] font-medium text-text-secondary">{c.nic}</td>
                        <td className="text-[10px] font-medium uppercase">{c.branch}</td>
                        <td className="text-right font-mono font-bold text-emerald-600">Rs. {c.documentCharge.toLocaleString()}</td>
                        <td className="text-[10px] font-bold text-text-secondary uppercase">{c.collectedBy}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                             {session.email === "zioncommercialcreditampara@gmail.com" && (
                               <button 
                                 onClick={() => setConfirmDelete(c.id)}
                                 className="p-2 hover:bg-red-50 text-text-secondary hover:text-red-500 rounded-lg transition-all"
                                 title="Delete Receipt"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>
                             )}
                             <button className="p-2 hover:bg-brand-accent/5 text-text-secondary hover:text-brand-accent rounded-lg transition-all" title="Print Receipt">
                                <Printer className="w-4 h-4" />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-text-secondary text-sm">
                           No collections found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredHistory.length > 0 && (
                    <tfoot className="bg-gray-50/50">
                      <tr>
                        <td colSpan={6} className="text-right font-bold text-text-primary p-4">GRAND TOTAL</td>
                        <td className="text-right font-mono font-black text-emerald-600 text-lg p-4">Rs. {stats.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Delete Collection Record"
        message="Are you sure you want to permanently delete this document charge receipt? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        type="danger"
      />

      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  );
}
