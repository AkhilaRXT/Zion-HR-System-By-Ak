import React, { useState, useEffect } from 'react';
import { Session, AppData, Announcement } from '../types';
import { Megaphone, Plus, Trash2, Edit2, X } from 'lucide-react';
import { DataStore } from '../lib/dataStore';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';

interface AnnouncementManagementProps {
  session: Session;
  data: AppData;
}

export default function AnnouncementManagement({ session, data }: AnnouncementManagementProps) {
  const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
  const [notification, setNotification] = useState<{message: string, type: NotificationType} | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', daysToStay: 7, priority: 'Medium' as const });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  const currentEmpId = session.empId || session.email || 'Admin';

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      showNotification('Title and content are required', 'error');
      return;
    }
    try {
      if (editingId) {
        const existingData = data.announcements?.find(a => a.id === editingId);
        await DataStore.addAnnouncement({ // reuses add logic (setDoc) to update
          ...existingData,
          id: editingId,
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          daysToStay: newAnnouncement.daysToStay,
          priority: newAnnouncement.priority
        });
        showNotification('Announcement updated successfully!');
        setEditingId(null);
      } else {
        await DataStore.addAnnouncement({
          id: Date.now().toString(),
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          authorId: currentEmpId,
          date: new Date().toISOString(),
          daysToStay: newAnnouncement.daysToStay,
          priority: newAnnouncement.priority
        });
        showNotification('Announcement posted successfully!');
      }
      setNewAnnouncement({ title: '', content: '', daysToStay: 7, priority: 'Medium' });
    } catch (e) {
      showNotification(editingId ? 'Failed to update announcement' : 'Failed to post announcement', 'error');
    }
  };

  const startEditing = (ann: Announcement) => {
    setEditingId(ann.id);
    setNewAnnouncement({
      title: ann.title,
      content: ann.content,
      daysToStay: ann.daysToStay || 7,
      priority: ann.priority || 'Medium'
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewAnnouncement({ title: '', content: '', daysToStay: 7, priority: 'Medium' });
  };

  const confirmDeleteAction = async () => {
    if (confirmDelete) {
      try {
        await DataStore.deleteAnnouncement(confirmDelete);
        showNotification('Announcement deleted');
        setConfirmDelete(null);
      } catch (e) {
        showNotification('Failed to delete announcement', 'error');
      }
    }
  };

  const announcements = [...(data.announcements || [])].sort((a,b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="p-8 space-y-8">
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
      
      <div className="bg-white rounded-xl shadow-lg border border-border-accent overflow-hidden">
        <div className="p-6 border-b border-border-accent bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-brand-accent" />
            {isMasterAdmin ? 'Announcement Management' : 'Company Announcements'}
          </h2>
        </div>
        
        {isMasterAdmin ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingId ? 'Edit Announcement' : 'Post New Announcement'}
                </h3>
                {editingId && (
                  <button onClick={cancelEditing} className="text-xs text-text-secondary hover:text-red-500 font-bold flex items-center gap-1">
                    <X className="w-3 h-3" /> Cancel Edit
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. End of Month Sales Goal" 
                    value={newAnnouncement.title}
                    onChange={e => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Content</label>
                  <textarea 
                    className="form-control min-h-[100px] resize-y" 
                    placeholder="Announcement details..."
                    value={newAnnouncement.content}
                    onChange={e => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Days to Stay</label>
                    <input 
                      type="number" min="1" max="365"
                      className="form-control" 
                      value={newAnnouncement.daysToStay}
                      onChange={e => setNewAnnouncement(prev => ({ ...prev, daysToStay: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select 
                      className="form-control"
                      value={newAnnouncement.priority}
                      onChange={e => setNewAnnouncement(prev => ({ ...prev, priority: e.target.value as any }))}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button onClick={handlePostAnnouncement} className="btn btn-primary flex-1 gap-2">
                    <Plus className="w-4 h-4" /> {editingId ? 'Save Changes' : 'Broadcast Announcement'}
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-4">All Announcements</h3>
              {announcements.length === 0 ? (
                <p className="text-xs text-text-secondary">No announcements found.</p>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {announcements.map(ann => {
                    const postDate = ann.date ? new Date(ann.date) : new Date();
                    const expirationDate = new Date(postDate);
                    expirationDate.setDate(expirationDate.getDate() + (ann.daysToStay || 7));
                    const isExpired = new Date() > expirationDate;
                    const priorityColors = {
                      High: 'text-red-600 bg-red-50',
                      Medium: 'text-brand-accent bg-brand-accent/10',
                      Low: 'text-blue-600 bg-blue-50'
                    };
                    return (
                      <div key={ann.id} className={`p-4 rounded-lg border border-border-accent relative group ${isExpired ? 'opacity-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm text-text-primary">{ann.title}</h4>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${priorityColors[ann.priority || 'Medium']}`}>
                              {ann.priority || 'Medium'}
                            </span>
                            <button 
                              onClick={() => startEditing(ann)}
                              className="p-1 text-text-secondary hover:text-brand-primary hover:bg-white rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(ann.id)}
                              className="p-1 text-text-secondary hover:text-red-500 hover:bg-white rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap">{ann.content}</p>
                        <span className="text-[9px] text-text-tertiary mt-2 block tracking-wider uppercase">
                          Posted: {isNaN(postDate.getTime()) ? 'N/A' : postDate.toLocaleDateString()} • Expires: {isNaN(expirationDate.getTime()) ? 'N/A' : expirationDate.toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-4xl mx-auto">
            {announcements.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="w-12 h-12 text-text-tertiary mx-auto mb-4 opacity-40 animate-pulse" />
                <p className="text-sm text-text-secondary font-medium">No announcements found right now.</p>
                <p className="text-xs text-text-tertiary mt-1">Please check back later for company updates.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {announcements.map(ann => {
                  const postDate = ann.date ? new Date(ann.date) : new Date();
                  const expirationDate = new Date(postDate);
                  expirationDate.setDate(expirationDate.getDate() + (ann.daysToStay || 7));
                  const isExpired = new Date() > expirationDate;
                  const priorityColors = {
                    High: 'text-red-600 bg-red-50 border-red-100',
                    Medium: 'text-brand-accent bg-brand-accent/5 border-brand-accent/10',
                    Low: 'text-blue-600 bg-blue-50 border-blue-100'
                  };
                  return (
                    <div 
                      key={ann.id} 
                      className={`p-6 rounded-xl border border-border-accent bg-white shadow-sm transition-all hover:shadow-md relative group ${isExpired ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}
                    >
                      <div className="flex justify-between items-start mb-3 gap-4">
                        <h4 className="font-extrabold text-base text-text-primary tracking-tight">{ann.title}</h4>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${priorityColors[ann.priority || 'Medium']}`}>
                          {ann.priority || 'Medium'} {isExpired ? '(Expired)' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed mb-4 text-justify">{ann.content}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">
                        <span>Posted on: {isNaN(postDate.getTime()) ? 'N/A' : postDate.toLocaleDateString()}</span>
                        {!isExpired && (
                          <span className="text-emerald-600">Active until: {isNaN(expirationDate.getTime()) ? 'N/A' : expirationDate.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
