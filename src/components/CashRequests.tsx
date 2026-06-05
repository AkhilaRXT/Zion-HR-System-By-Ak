import React, { useState } from 'react';
import { AppData, Session, CashRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Check, X, FileText, Paperclip, FileDown, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import Notification, { NotificationType } from './Notification';
import { fileToBase64, handleDownloadAttachment } from '../lib/fileUtils';

interface CashRequestsProps {
  session: Session;
  data: AppData;
}

export default function CashRequests({ session, data }: CashRequestsProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManageCash = isAdmin && (isMasterAdmin || session.permissions?.includes('cash_requests'));
  
  const currentEmpId = session.empId;
  const viewableBranches = session.viewableBranches || [];

  const canViewEmployee = (empId: string) => {
    if (session.email === "zioncommercialcreditampara@gmail.com") return true;
    if (viewableBranches.includes('ALL')) return true;
    const emp = (data.employees || []).find((e: any) => e.id === empId);
    if (!emp) return false;
    if (viewableBranches.length > 0) return viewableBranches.includes(emp.branch);
    if (session.isAdmin) {
      const myEmp = (data.employees || []).find((e: any) => e.id === session.empId);
      return myEmp?.branch === emp.branch;
    }
    return false;
  };
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const [activeTab, setActiveTab] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>(canManageCash ? 'Pending' : 'All');

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dateRange, setDateRange] = useState({
    from: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: formatDateForInput(new Date())
  });

  const [searchedRequests, setSearchedRequests] = useState<CashRequest[]>([]);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await DataStore.searchCashRequests(dateRange.from, dateRange.to);
      setSearchedRequests(results);
      setHasSearched(true);
    } catch(err) {
      showNotification('Failed to fetch cash requests.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    if (!hasSearched) {
      handleSearch();
    }
  }, []);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const [isUploading, setIsUploading] = useState(false);
  const [newRequest, setNewRequest] = useState({
    amount: 0,
    category: 'Petty Cash',
    description: '',
    attachments: [] as string[]
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setIsUploading(true);
      try {
        const base64Files = await Promise.all(files.map(f => fileToBase64(f)));
        setNewRequest(prev => ({ ...prev, attachments: [...prev.attachments, ...base64Files] }));
      } catch (err: any) {
        showNotification(err.message || 'Failed to process files', 'error');
        e.target.value = '';
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRequest.amount <= 0) {
      showNotification('Amount must be greater than 0', 'error');
      return;
    }

    const request: CashRequest = {
      id: Date.now(),
      empId: currentEmpId,
      amount: newRequest.amount,
      category: newRequest.category,
      description: newRequest.description,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      attachments: newRequest.attachments
    };

    try {
      await DataStore.addCashRequest(request);
      showNotification('Cash request submitted successfully!');
      setNewRequest({ amount: 0, category: 'Petty Cash', description: '', attachments: [] });
      setSearchedRequests(prev => [request, ...prev]);
    } catch (err) {
      showNotification('Failed to submit cash request.', 'error');
    }
  };

  const handleStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateCashRequestStatus(id, status, session.name);
      showNotification(`Cash request ${status.toLowerCase()}.`);
      setSearchedRequests(prev => prev.map(r => r.id === id ? { ...r, status, actionedBy: session.name } : r));
    } catch (err) {
      showNotification('Failed to update status.', 'error');
    }
  };

  const filteredRequests = searchedRequests
    .filter(r => {
      const hasBranchMgrAccess = viewableBranches.length > 0;
      const matchesPermission = (canManageCash || hasBranchMgrAccess) ? canViewEmployee(r.empId) : r.empId === currentEmpId;
      const fromTime = new Date(`${dateRange.from}T00:00:00`).getTime();
      const toTime = new Date(`${dateRange.to}T23:59:59`).getTime();
      const matchesDate = r.id >= fromTime && r.id <= toTime;
      const matchesStatus = activeTab === 'All' || r.status === activeTab;
      
      const emp = (data.employees || []).find(e => e.id === r.empId);
      const matchesBranch = branchFilter === 'ALL' || emp?.branch === branchFilter;

      return matchesPermission && matchesDate && matchesStatus && matchesBranch;
    })
    .sort((a, b) => b.id - a.id);

  const exportToExcel = () => {
    const sheetData = filteredRequests.map(r => {
      const emp = (data.employees || []).find(e => e.id === r.empId);
      return {
        Date: r.date,
        'EMP ID': r.empId,
        'Employee Name': emp?.name || 'Unknown',
        Category: r.category,
        Description: r.description,
        Amount: r.amount,
        Status: r.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Requests');
    XLSX.writeFile(wb, `Cash_Requests_${dateRange.from}_to_${dateRange.to}.xlsx`);
    DataStore.logAction('Export Data', `Exported Cash Requests (${dateRange.from} to ${dateRange.to}) to Excel`, 'Cash');
  };

  return (
    <div className="space-y-12">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <div className="w-full lg:w-1/3 glass-panel p-6 md:p-8">
          <h3 className="text-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
            Request Cash
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Category</label>
              <select 
                className="form-control"
                value={newRequest.category}
                onChange={e => setNewRequest({...newRequest, category: e.target.value})}
              >
                <option value="Petty Cash">Petty Cash</option>
                <option value="Water Bill">Water Bill</option>
                <option value="Light Bill">Light Bill</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Amount (LKR)</label>
              <input 
                type="number" className="form-control" required min="1"
                value={newRequest.amount || ''} onChange={e => setNewRequest({...newRequest, amount: Number(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Description</label>
              <textarea 
                className="form-control min-h-[80px]" required 
                placeholder="Details about the request..."
                value={newRequest.description} onChange={e => setNewRequest({...newRequest, description: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="text-xs font-medium text-text-secondary mb-2 block">Attachments (PDF max 3MB, Images auto-compressed)</label>
              <input 
                type="file" 
                multiple
                accept=".pdf,image/*"
                className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-accent file:text-white hover:file:bg-blue-700"
                onChange={handleFileChange}
              />
              {newRequest.attachments.length > 0 && (
                <div className="text-[10px] text-text-secondary mt-1">
                  {newRequest.attachments.length} file(s) attached
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center py-4" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Submit Request'}
            </button>
          </form>
        </div>

        <div className="w-full lg:w-2/3 space-y-8">
          <div className="glass-panel p-4 md:p-6 flex flex-col md:flex-row gap-4 justify-between items-end">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="form-group flex-1 sm:flex-none">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2 block">From Date</label>
                <input 
                  type="date" 
                  className="form-control text-xs py-2.5 bg-background shadow-inner"
                  value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})}
                />
              </div>
              <div className="form-group flex-1 sm:flex-none">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2 block">To Date</label>
                <input 
                  type="date" 
                  className="form-control text-xs py-2.5 bg-background shadow-inner"
                  value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})}
                />
              </div>
              {(canManageCash || viewableBranches.length > 0) && (
                <div className="form-group flex-1 sm:flex-none">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2 block">Branch</label>
                  <select
                    className="form-control text-xs py-2.5 bg-background shadow-inner"
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  >
                    <option value="ALL">All Branches</option>
                    {Array.from(new Set((data.employees || []).filter(e => e.branch).map(e => e.branch))).map(b => (
                      <option key={b as string} value={b as string}>{b as string}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={handleSearch}
                disabled={isSearching}
                className="btn btn-primary py-2.5 px-6 h-auto text-xs flex-1 md:flex-none justify-center"
              >
                <Search className="w-4 h-4 ml-0 mr-2" />
                {isSearching ? '...' : 'Search'}
              </button>
              <button 
                onClick={exportToExcel}
                className="btn btn-outline py-2.5 px-6 h-auto text-xs flex-1 md:flex-none justify-center"
              >
                <FileDown className="w-4 h-4 ml-0 mr-2" />
                Export
              </button>
            </div>
          </div>

          <div className="table-container">
            <div className="p-6 border-b border-border-accent bg-background">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {canManageCash ? 'All Cash Requests' : 'My Cash Requests'}
                  </h3>
                  <p className="text-[10px] text-text-secondary font-medium mt-1 uppercase tracking-widest">
                    {hasSearched ? `Showing results from ${dateRange.from} to ${dateRange.to}` : 'Click search to load cash requests'}
                  </p>
                </div>
              </div>

              <div className="flex gap-6 mt-6 border-b border-border-accent">
                {(['Pending', 'Approved', 'Rejected', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-xs font-semibold tracking-wide capitalize transition-colors relative
                      ${activeTab === tab 
                        ? 'text-brand-primary' 
                        : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-t-full shadow-[0_-2px_8px_rgba(59,130,246,0.5)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {canManageCash && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(r => {
                  const emp = (data.employees || []).find(e => e.id === r.empId);
                  const statusCls = r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                  
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-sm text-text-secondary">{r.date}</td>
                      <td>
                        <div className="font-medium text-text-primary">{emp?.name || r.empId}</div>
                        <div className="text-xs text-text-secondary font-medium mt-1 flex items-center gap-2">
                          {r.description}
                          {r.attachment && (
                            <button onClick={() => handleDownloadAttachment(r.attachment!, `Cash_Request_${r.empId}`)} className="text-brand-accent hover:text-blue-700 flex items-center gap-1" title="View Attachment">
                              <Paperclip className="w-3 h-3" />
                            </button>
                          )}
                          {r.attachments && r.attachments.length > 0 && r.attachments.map((att, idx) => (
                            <button key={idx} onClick={() => handleDownloadAttachment(att, `Cash_Request_${r.empId}_${idx + 1}`)} className="text-brand-accent hover:text-blue-700 flex items-center gap-1" title={`View Attachment ${idx + 1}`}>
                              <Paperclip className="w-3 h-3" />
                              <span className="text-[10px]">{idx + 1}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm text-text-secondary">{r.category}</td>
                      <td className="font-mono text-sm text-brand-accent font-semibold">LKR {r.amount.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${statusCls}`}>{r.status}</span>
                        {r.actionedBy && r.status !== 'Pending' && (
                          <div className="text-[10px] text-text-secondary mt-1">by {r.actionedBy}</div>
                        )}
                      </td>
                      {canManageCash && (
                        <td>
                          {r.status === 'Pending' ? (
                            <div className="flex gap-4">
                              <button 
                                onClick={() => handleStatus(r.id, 'Approved')}
                                className="text-emerald-500 hover:text-white transition-all"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleStatus(r.id, 'Rejected')}
                                className="text-red-500 hover:text-white transition-all"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={canManageCash ? 6 : 5} className="text-center py-12 text-text-secondary font-medium italic">
                      {!hasSearched ? (
                        'Click search to load cash requests.'
                      ) : (
                        `No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} cash requests found for the selected date range.`
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
