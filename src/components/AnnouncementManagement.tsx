import React, { useState } from 'react';
import { Session, AppData, Announcement } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Megaphone,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  Info,
  AlertCircle,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface AnnouncementManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function AnnouncementManagement({ session, data, onRefresh }: AnnouncementManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Announcement, 'id' | 'timestamp' | 'authorId' | 'authorName'>>({
    title: '',
    content: '',
    priority: 'Medium',
    expiresAt: ''
  });

  const isAdmin = session.isAdmin;
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const canManage = isAdmin && (isMasterAdmin || session.permissions?.includes('settings') || session.permissions?.includes('announcements'));

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    try {
      await DataStore.addAnnouncement({
        ...formData,
        authorId: session.empId,
        authorName: session.name
      });
      setIsAdding(false);
      setFormData({ title: '', content: '', priority: 'Medium', expiresAt: '' });
      showNotification('Announcement posted successfully!');
    } catch (err) {
      showNotification('Failed to post announcement.', 'error');
    }
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteAnnouncement(confirmDelete);
        setConfirmDelete(null);
        showNotification('Announcement deleted.');
      } catch (err) {
        showNotification('Failed to delete announcement.', 'error');
      }
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'Medium': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const announcements = [...(data.announcements || [])].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-serif font-bold text-text-primary">Company Announcements</h2>
          <p className="text-text-secondary">Stay updated with the latest news and alerts.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-5 h-5" />
            New Announcement
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {announcements.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-text-secondary">No announcements at this time.</p>
          </div>
        ) : (
          announcements.map((ann) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-panel p-6 border-l-4 ${
                ann.priority === 'High' ? 'border-l-red-500' :
                ann.priority === 'Medium' ? 'border-l-amber-500' : 'border-l-blue-500'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(ann.priority)}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      ann.priority === 'High' ? 'text-red-600' :
                      ann.priority === 'Medium' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {ann.priority} Priority
                    </span>
                    <span className="text-text-secondary text-xs">•</span>
                    <span className="text-text-secondary text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ann.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">{ann.title}</h3>
                  <div className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
                    {ann.content}
                  </div>
                  <div className="pt-4 flex items-center gap-2 text-xs text-text-secondary">
                    <div className="w-6 h-6 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold">
                      {ann.authorName[0]}
                    </div>
                    <span>Posted by <span className="font-semibold text-text-primary">{ann.authorName}</span></span>
                    {ann.expiresAt && (
                       <>
                         <span>•</span>
                         <span className="text-amber-600">Expires: {new Date(ann.expiresAt).toLocaleDateString()}</span>
                       </>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => setConfirmDelete(ann.id)}
                    className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-border-accent p-8 rounded-2xl w-full max-w-2xl shadow-xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-accent/10 rounded-lg">
                    <Megaphone className="w-6 h-6 text-brand-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">Create Announcement</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="form-group">
                  <label className="text-sm font-semibold text-text-primary mb-2 block">Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. Important Policy Update"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-primary mb-2 block">Priority</label>
                    <select
                      className="form-control"
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value as any})}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold text-text-primary mb-2 block">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.expiresAt}
                      onChange={e => setFormData({...formData, expiresAt: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-sm font-semibold text-text-primary mb-2 block">Content</label>
                  <textarea
                    className="form-control min-h-[200px] resize-none"
                    placeholder="Write your announcement message here..."
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn btn-outline flex-1 justify-center">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1 justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Post Announcement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This cannot be undone."
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
