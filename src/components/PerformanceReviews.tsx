import React, { useState } from 'react';
import { Session, AppData, PerformanceReview, Employee } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  TrendingUp,
  Calendar,
  Star,
  MessageSquare,
  Plus,
  ChevronRight,
  Search,
  Filter,
  X,
  Loader2
} from 'lucide-react';

interface PerformanceReviewsProps {
  session: Session;
  data: AppData;
  onRefresh: () => void;
}

export default function PerformanceReviews({ session, data, onRefresh }: PerformanceReviewsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newReview, setNewReview] = useState<Partial<PerformanceReview>>({
    empId: '',
    reviewDate: new Date().toISOString().split('T')[0],
    rating: 5,
    feedback: '',
    status: 'Scheduled'
  });

  const reviews = data.performanceReviews || [];
  const employees = data.employees || [];

  const filteredReviews = reviews.filter(review => {
    const emp = employees.find(e => e.id === review.empId);
    const matchesSearch =
      (emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      review.feedback.toLowerCase().includes(searchTerm.toLowerCase());

    if (session.isAdmin) return matchesSearch;
    return review.empId === session.empId && matchesSearch;
  });

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.empId || !newReview.feedback) return;

    setIsSubmitting(true);
    try {
      await DataStore.addPerformanceReview({
        ...newReview,
        reviewerId: session.empId
      });
      setIsScheduling(false);
      setNewReview({ empId: '', reviewDate: new Date().toISOString().split('T')[0], rating: 5, feedback: '', status: 'Scheduled' });
      onRefresh();
    } catch (error) {
      console.error('Scheduling failed:', error);
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
            placeholder="Search reviews or employees..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {session.isAdmin && (
          <button
            onClick={() => setIsScheduling(true)}
            className="flex items-center gap-2 bg-brand-accent text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Schedule Review</span>
          </button>
        )}
      </div>

      {isScheduling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border-accent flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-accent" />
                Schedule Performance Review
              </h3>
              <button onClick={() => setIsScheduling(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Employee</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none bg-white"
                  value={newReview.empId}
                  onChange={(e) => setNewReview({ ...newReview, empId: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Review Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none"
                    value={newReview.reviewDate}
                    onChange={(e) => setNewReview({ ...newReview, reviewDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Rating (1-5)</label>
                  <div className="flex items-center gap-2 h-[42px]">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setNewReview({ ...newReview, rating: num })}
                        className={`p-1 transition-colors ${newReview.rating && newReview.rating >= num ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        <Star className={`w-5 h-5 ${newReview.rating && newReview.rating >= num ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Feedback / Notes</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-border-accent focus:ring-2 focus:ring-brand-accent outline-none resize-none"
                  placeholder="Enter performance feedback..."
                  value={newReview.feedback}
                  onChange={(e) => setNewReview({ ...newReview, feedback: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-brand-accent text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                  {isSubmitting ? 'Scheduling...' : 'Schedule Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReviews.map((review) => {
          const emp = employees.find(e => e.id === review.empId);
          return (
            <div key={review.id} className="bg-white p-6 rounded-2xl border border-border-accent hover:shadow-lg transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary">{emp?.name || 'Unknown'}</h3>
                    <p className="text-xs text-text-secondary">{review.reviewDate}</p>
                  </div>
                </div>
                <div className="flex">
                  {getRatingStars(review.rating)}
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-text-secondary italic line-clamp-3">
                    "{review.feedback}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    review.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                    review.status === 'Scheduled' ? 'bg-blue-100 text-blue-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {review.status}
                  </span>

                  <button className="text-brand-accent font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredReviews.length === 0 && (
          <div className="col-span-full py-12 text-center text-text-secondary italic">
            No performance reviews found.
          </div>
        )}
      </div>
    </div>
  );
}
