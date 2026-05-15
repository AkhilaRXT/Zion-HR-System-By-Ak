import React, { useState } from 'react';
import { Session, AppData, EmployeeDocument, Employee } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  Files,
  Upload,
  Trash2,
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  X,
  Loader2
} from 'lucide-react';

interface DocumentManagementProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function DocumentManagement({ session, data, onRefresh }: DocumentManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<EmployeeDocument>>({
    title: '',
    category: 'Contract',
    empId: '',
    fileUrl: ''
  });

  const documents = data.documents || [];
  const employees = data.employees || [];

  const filteredDocs = documents.filter(doc => {
    const emp = employees.find(e => e.id === doc.empId);
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'All' || doc.category === categoryFilter;

    if (session.isAdmin) return matchesSearch && matchesCategory;
    return doc.empId === session.empId && matchesSearch && matchesCategory;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await DataStore.deleteDocument(id);
      onRefresh();
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title || !newDoc.empId) return;

    setIsSubmitting(true);
    try {
      await DataStore.addDocument({
        ...newDoc,
        uploadDate: new Date().toISOString().split('T')[0]
      });
      setIsUploading(false);
      setNewDoc({ title: '', category: 'Contract', empId: '', fileUrl: '' });
      onRefresh();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-border-accent flex-1 w-full md:max-w-md">
          <Search className="w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search documents or employees..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-border-accent">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              className="bg-transparent border-none focus:ring-0 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Contract">Contract</option>
              <option value="ID">ID/Passport</option>
              <option value="Certificate">Certificate</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {session.isAdmin && (
            <button
              onClick={() => setIsUploading(true)}
              className="flex items-center gap-2 bg-brand-accent text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
            >
              <Upload className="w-5 h-5" />
              <span>Upload</span>
            </button>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border-accent flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-accent" />
                Upload Document
              </h3>
              <button onClick={() => setIsUploading(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Document Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none"
                  placeholder="e.g. Employment Contract 2024"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Category</label>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none bg-white"
                    value={newDoc.category}
                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as any })}
                  >
                    <option value="Contract">Contract</option>
                    <option value="ID">ID/Passport</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Employee</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none bg-white"
                    value={newDoc.empId}
                    onChange={(e) => setNewDoc({ ...newDoc, empId: e.target.value })}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Document URL/Link</label>
                <input
                  type="url"
                  className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none"
                  placeholder="https://..."
                  value={newDoc.fileUrl}
                  onChange={(e) => setNewDoc({ ...newDoc, fileUrl: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-brand-accent text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {isSubmitting ? 'Uploading...' : 'Add Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border-accent overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-border-accent">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase">Document</th>
              <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase">Upload Date</th>
              <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-accent">
            {filteredDocs.map((doc) => {
              const emp = employees.find(e => e.id === doc.empId);
              return (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-text-primary">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {emp?.name || 'Unknown Employee'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {doc.uploadDate}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-text-secondary hover:text-brand-accent transition-colors">
                        <Download className="w-5 h-5" />
                      </button>
                      {session.isAdmin && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-secondary italic">
                  No documents found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
