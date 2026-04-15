import React, { useState } from 'react';
import { AppData, Session, AuditLog } from '../types';
import { Search, FileDown, Calendar, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';

interface AuditLogsProps {
  session: Session;
  data: AppData;
}

export default function AuditLogs({ session, data }: AuditLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterDate, setFilterDate] = useState('');

  const logs = data.auditLogs || [];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'All' || log.type === filterType;
    const matchesDate = !filterDate || log.timestamp.startsWith(filterDate);

    return matchesSearch && matchesType && matchesDate;
  });

  const handleExport = (type: 'All' | 'Monthly' | 'Filtered') => {
    let dataToExport = filteredLogs;

    if (type === 'All') {
      dataToExport = logs;
    } else if (type === 'Monthly') {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      dataToExport = logs.filter(l => l.timestamp.startsWith(currentMonth));
    }

    const sheetData = dataToExport.map(l => ({
      Timestamp: new Date(l.timestamp).toLocaleString(),
      User: l.user,
      Action: l.action,
      Type: l.type,
      Details: l.details
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
    XLSX.writeFile(wb, `Audit_Logs_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const logTypes = ['All', 'Employee', 'Attendance', 'Leave', 'Advance', 'Target', 'Settings', 'Auth'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h3 className="text-[11px] uppercase tracking-[3px] text-brand-accent">System Audit Logs</h3>
          <p className="text-[10px] text-text-secondary uppercase tracking-[1px] mt-1">Detailed history of all system actions</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => handleExport('All')} className="btn btn-outline">
            <FileDown className="w-4 h-4" /> Export All
          </button>
          <button onClick={() => handleExport('Monthly')} className="btn btn-outline">
            <Calendar className="w-4 h-4" /> This Month
          </button>
          <button onClick={() => handleExport('Filtered')} className="btn btn-primary">
            <Filter className="w-4 h-4" /> Export Filtered
          </button>
        </div>
      </div>

      <div className="glass-panel p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="form-group">
            <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Search Logs</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input 
                type="text" className="form-control pl-12" 
                placeholder="Search user, action or details..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Filter by Type</label>
            <select 
              className="form-control"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              {logTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="text-[10px] uppercase tracking-[2px] text-text-secondary mb-2 block">Filter by Date</label>
            <input 
              type="date" className="form-control"
              value={filterDate} onChange={e => setFilterDate(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container !p-0 border-none shadow-none">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-48">Timestamp</th>
                <th className="w-48">User</th>
                <th className="w-32">Type</th>
                <th className="w-48">Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="font-mono text-[10px] text-text-secondary">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="text-[11px] font-medium text-text-primary">
                      {log.user}
                    </td>
                    <td>
                      <span className={`badge ${
                        log.type === 'Auth' ? 'badge-danger' :
                        log.type === 'Employee' ? 'badge-info' :
                        log.type === 'Settings' ? 'badge-warning' : 
                        log.type === 'Attendance' ? 'badge-success' : 'badge-primary'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="text-[11px] uppercase tracking-[1px] text-brand-accent">
                      {log.action}
                    </td>
                    <td className="text-[11px] text-text-secondary">
                      {log.details}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-secondary italic">
                    No logs found matching your filters.
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
