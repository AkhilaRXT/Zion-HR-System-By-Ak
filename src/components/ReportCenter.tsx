import React, { useState } from 'react';
import { Session, AppData, SystemReport } from '../types';
import { DataStore } from '../lib/dataStore';
import { 
  AlertCircle, 
  Send, 
  CheckCircle, 
  Clock, 
  MessageSquare,
  User,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ReportCenterProps {
  session: Session;
  data: AppData;
}

export default function ReportCenter({ session, data }: ReportCenterProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<'All' | 'New' | 'Read' | 'Resolved'>('All');

  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await DataStore.submitSystemReport({
        empId: session.empId,
        empName: session.name,
        subject: subject.trim(),
        message: message.trim(),
        timestamp: new Date().toISOString()
      });

      if (result.success) {
        showNotification('Report submitted successfully! The admin will look into it.', 'success');
        setSubject('');
        setMessage('');
      } else {
        showNotification('Failed to submit report. Please try again.', 'error');
      }
    } catch (error) {
      showNotification('An error occurred.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: SystemReport['status']) => {
    try {
      await DataStore.updateSystemReportStatus(id, status);
      showNotification(`Report marked as ${status.toLowerCase()}`, 'success');
    } catch (error) {
      showNotification('Failed to update status', 'error');
    }
  };

  const filteredReports = data.systemReports
    ? data.systemReports
        .filter(r => filter === 'All' || r.status === filter)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand-accent">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Support</span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-text-primary">Report Center</h1>
          <p className="text-text-secondary">Report issues or suggest improvements to the Master Admin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Submission Form */}
        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-border-accent sticky top-8"
          >
            <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-accent" />
              New Report
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-text-primary mb-1 block">Subject</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's the issue?"
                  className="w-full h-12 px-4 rounded-xl border border-border-accent focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-text-primary mb-1 block">Message</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detailed description of the problem or suggestion..."
                  rows={6}
                  className="w-full p-4 rounded-xl border border-border-accent focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all text-sm outline-none resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-brand-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-accent/20 hover:bg-brand-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Clock className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Report
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Master Admin View - Manage Reports */}
        <div className="lg:col-span-2 space-y-6">
          {isMasterAdmin ? (
            <>
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border-accent shadow-sm">
                <div className="flex items-center gap-4">
                  <Filter className="w-5 h-5 text-text-secondary" />
                  <div className="flex gap-2">
                    {['All', 'New', 'Read', 'Resolved'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                          filter === f 
                            ? "bg-brand-accent text-white shadow-md shadow-brand-accent/20" 
                            : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                  {filteredReports.length} Reports Found
                </span>
              </div>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout text-xs">
                  {filteredReports.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-20 bg-white rounded-2xl border border-dashed border-border-accent"
                    >
                      <CheckCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-text-secondary font-medium">No reports matching the filter.</p>
                    </motion.div>
                  ) : (
                    filteredReports.map((report) => (
                      <motion.div
                        key={report.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "bg-white rounded-2xl p-6 border transition-all duration-300 group",
                          report.status === 'New' ? "border-brand-accent border-l-4" : "border-border-accent"
                        )}
                      >
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                report.status === 'New' ? "bg-red-100 text-red-600" :
                                report.status === 'Read' ? "bg-amber-100 text-amber-600" :
                                "bg-emerald-100 text-emerald-600"
                              )}>
                                {report.status}
                              </span>
                              <h3 className="font-bold text-text-primary text-lg">{report.subject}</h3>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-text-secondary">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {report.empName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(report.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {report.status !== 'Resolved' && (
                              <button 
                                onClick={() => handleUpdateStatus(report.id, 'Resolved')}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                title="Mark as Resolved"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                            )}
                            {report.status === 'New' && (
                              <button 
                                onClick={() => handleUpdateStatus(report.id, 'Read')}
                                className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                title="Mark as Read"
                              >
                                <Clock className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-text-primary whitespace-pre-wrap flex items-start gap-3">
                          <div className="mt-1">
                            <MoreVertical className="w-4 h-4 text-gray-300" />
                          </div>
                          {report.message}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-3xl border border-border-accent shadow-sm">
              <div className="w-20 h-20 bg-brand-accent/10 rounded-3xl flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-brand-accent" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">Your Feedback Matters</h2>
              <p className="text-text-secondary max-w-md mx-auto">
                Found a bug? Have an idea for a new feature? 
                Submit a report and the Master Admin will receive it directly.
              </p>
              
              <div className="mt-12 w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="p-4 bg-gray-50 rounded-2xl border border-border-accent">
                  <div className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-1">Direct Access</div>
                  <p className="text-xs text-text-secondary leading-relaxed">Your message goes straight to the high-level management for prioritized review.</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-border-accent">
                  <div className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-1">Confidential</div>
                  <p className="text-xs text-text-secondary leading-relaxed">Reports are encrypted and visible only to the Master Admin.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border",
              notification.type === 'success' 
                ? "bg-emerald-500/90 text-white border-white/20" 
                : "bg-red-500/90 text-white border-white/20"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="font-bold text-sm tracking-wide">{notification.message}</span>
          </motion.div>
        </div>
      )}
    </div>
  );
}
