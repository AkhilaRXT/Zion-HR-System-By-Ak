import React, { useState } from 'react';
import { AppData, Session, CashRequest } from '../types';
import { DataStore } from '../lib/dataStore';
import { Check, X, FileText, Paperclip, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import Notification, { NotificationType } from './Notification';
import { fileToBase64 } from '../lib/fileUtils';

interface CashRequestsProps {
  session: Session;
  data: AppData;
}

export default function CashRequests({ session, data }: CashRequestsProps) {
  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManageCash = isAdmin && (isMasterAdmin || session.permissions?.includes('cash_requests'));
  
  const currentEmpId = session.empId;
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const [newRequest, setNewRequest] = useState({
    amount: 0,
    category: 'Petty Cash',
    description: '',
    attachment: ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setNewRequest({ ...newRequest, attachment: base64 });
      } catch (err: any) {
        showNotification(err.message || 'Failed to process file', 'error');
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
      attachment: newRequest.attachment
    };

    try {
      await DataStore.addCashRequest(request);
      showNotification('Cash request submitted successfully!');
      setNewRequest({ amount: 0, category: 'Petty Cash', description: '', attachment: '' });
    } catch (err) {
      showNotification('Failed to submit cash request.', 'error');
    }
  };

  const handleStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    try {
      await DataStore.updateCashRequestStatus(id, status);
      showNotification(`Cash request ${status.toLowerCase()}.`);
    } catch (err) {
      showNotification('Failed to update status.', 'error');
    }
  };

  const filteredRequests = data.cashRequests
    .filter(r => canManageCash || r.empId === currentEmpId)
    .sort((a, b) => b.id - a.id);

  const exportToExcel = (type: 'full' | 'monthly' | 'weekly' | 'by_member') => {
    let requestsToExport = [...filteredRequests];
    const now = new Date();

    if (type === 'monthly') {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      requestsToExport = requestsToExport.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (type === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      requestsToExport = requestsToExport.filter(r => new Date(r.date) >= oneWeekAgo);
    } else if (type === 'by_member') {
      requestsToExport.sort((a, b) => a.empId.localeCompare(b.empId));
    }

    const sheetData = requestsToExport.map(r => {
      const emp = data.employees.find(e => e.id === r.empId);
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
    XLSX.writeFile(wb, `Cash_Requests_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
    DataStore.logAction('Export Data', `Exported Cash Requests (${type}) to Excel`, 'Cash');
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
              <label className="text-xs font-medium text-text-secondary mb-2 block">Attachment (PDF/Image, max 700KB)</label>
              <input 
                type="file" 
                accept=".pdf,image/*"
                className="form-control file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-accent file:text-white hover:file:bg-blue-700"
                onChange={handleFileChange}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center py-4">
              Submit Request
            </button>
          </form>
        </div>

        <div className="w-full lg:w-2/3 space-y-8">
          {canManageCash && (
            <div className="flex flex-wrap gap-3">
              <button onClick={() => exportToExcel('full')} className="btn btn-outline flex items-center gap-2 text-xs py-2 px-4 h-auto">
                <FileDown className="w-3.5 h-3.5" /> Full History
              </button>
              <button onClick={() => exportToExcel('monthly')} className="btn btn-outline flex items-center gap-2 text-xs py-2 px-4 h-auto">
                <FileDown className="w-3.5 h-3.5" /> Monthly
              </button>
              <button onClick={() => exportToExcel('weekly')} className="btn btn-outline flex items-center gap-2 text-xs py-2 px-4 h-auto">
                <FileDown className="w-3.5 h-3.5" /> Weekly
              </button>
              <button onClick={() => exportToExcel('by_member')} className="btn btn-outline flex items-center gap-2 text-xs py-2 px-4 h-auto">
                <FileDown className="w-3.5 h-3.5" /> By Member
              </button>
            </div>
          )}

          <div className="table-container">
            <div className="p-6 border-b border-border-accent">
              <h3 className="text-sm font-semibold text-text-primary">
                {canManageCash ? 'All Cash Requests' : 'My Cash Requests'}
              </h3>
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
                  const emp = data.employees.find(e => e.id === r.empId);
                  const statusCls = r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning';
                  
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-sm text-text-secondary">{r.date}</td>
                      <td>
                        <div className="font-medium text-text-primary">{emp?.name || r.empId}</div>
                        <div className="text-xs text-text-secondary font-medium mt-1 flex items-center gap-2">
                          {r.description}
                          {r.attachment && (
                            <a href={r.attachment} download={`Cash_Request_${r.empId}.pdf`} className="text-brand-accent hover:text-blue-700 flex items-center gap-1" title="View Attachment">
                              <Paperclip className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="text-sm text-text-secondary">{r.category}</td>
                      <td className="font-mono text-sm text-brand-accent font-semibold">LKR {r.amount.toLocaleString()}</td>
                      <td><span className={`badge ${statusCls}`}>{r.status}</span></td>
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
                    <td colSpan={canManageCash ? 6 : 5} className="text-center py-8 text-text-secondary text-[11px] uppercase tracking-[2px]">
                      No cash requests found
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
