import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Inbox, Send, Edit, Trash2, Mail, Users, ArrowLeft,
  CheckCircle2, CornerUpLeft, Search, Plus, RefreshCw,
  Check, X, MailOpen, Filter
} from 'lucide-react';
import { Session, AppData, InternalMessage } from '../types';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/dataStore';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where, limit, arrayUnion, arrayRemove } from 'firebase/firestore';

interface InternalMailProps {
  session: Session;
  data: AppData;
  onUpdatePart?: (part: Partial<AppData>) => void;
}

type MailView = 'inbox' | 'sent' | 'compose' | 'read';

export default function InternalMail({ session, data, onUpdatePart }: InternalMailProps) {
  const [view, setView] = useState<MailView>('inbox');
  const [selectedMail, setSelectedMail] = useState<InternalMessage | null>(null);
  
  // Compose states
  const [toStr, setToStr] = useState('');
  const [ccStr, setCcStr] = useState('');
  const [bccStr, setBccStr] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Search & Filter states
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');

  // Directory picker states
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<'to' | 'cc' | 'bcc'>('to');
  const [pickerSearch, setPickerSearch] = useState('');

  // Mail states
  const [myMessages, setMyMessages] = useState<InternalMessage[]>(data.internalMessages || []);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const [localUnreadIds, setLocalUnreadIds] = useState<Set<string>>(new Set());

  // Sync state in real time with the globally loaded mail from App listener
  useEffect(() => {
    if (data.internalMessages) {
      setMyMessages(
        data.internalMessages.map(incoming => {
          if (localReadIds.has(incoming.id) && !incoming.readBy?.includes(session.empId)) {
            return { ...incoming, readBy: [...(incoming.readBy || []), session.empId] };
          }
          if (localUnreadIds.has(incoming.id) && incoming.readBy?.includes(session.empId)) {
            return { ...incoming, readBy: incoming.readBy.filter((id) => id !== session.empId) };
          }
          return incoming;
        })
      );
    }
  }, [data.internalMessages, localReadIds, localUnreadIds, session.empId]);

  // Keep selectedMail updated with the latest live status from myMessages
  useEffect(() => {
    if (selectedMail) {
      const updatedMail = myMessages.find(m => m.id === selectedMail.id);
      if (updatedMail) {
        setSelectedMail(updatedMail);
      }
    }
  }, [myMessages, selectedMail?.id]);

  const updateMail = async () => {
    setIsUpdating(true);
    try {
      const q = query(
        collection(db, 'messages'), 
        where('participants', 'array-contains', session.empId), 
        limit(50)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }) as any);
      docs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setMyMessages(docs);
    } catch (err) {
      console.error("Failed to fetch mail:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    // Only fetch if we don't have globally cached mail yet
    if (!data.internalMessages || data.internalMessages.length === 0) {
      updateMail();
    }
  }, [session.empId]);

  // Derive mail lists
  const inbox = myMessages.filter(m => 
    (m.to && m.to.includes(session.empId)) || 
    (m.cc && m.cc.includes(session.empId)) || 
    (m.bcc && m.bcc.includes(session.empId))
  );
  const sent = myMessages.filter(m => m.senderId === session.empId);

  // Utility to get employee name by ID or matched string
  const getEmpName = (identifier: string) => {
    // Check directory first for names if regular users don't have full employee list
    const dirList = data.directory || [];
    const emp = dirList.find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    if (emp) return emp.name;
    
    // Fallback to employees just in case
    const empFallback = (data.employees || []).find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    return empFallback ? empFallback.name : identifier;
  };

  const getEmpId = (identifier: string) => {
    const dirList = data.directory || [];
    const emp = dirList.find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    if (emp) return emp.id;

    const empFallback = (data.employees || []).find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    return empFallback ? empFallback.id : identifier;
  };

  const parseRecipients = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(s => s !== '').map(getEmpId);
  };

  // State for autocomplete
  const [activeInput, setActiveInput] = useState<'to' | 'cc' | 'bcc' | null>(null);
  
  const handleRecipientInput = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(e.target.value);
  };

  const currentInputValue = activeInput === 'to' ? toStr : activeInput === 'cc' ? ccStr : activeInput === 'bcc' ? bccStr : '';
  
  // Find current typing segment
  const segments = currentInputValue.split(',');
  const lastSegment = segments[segments.length - 1].trim();
  
  const suggestions = (data.directory || []).filter(e => {
    if (lastSegment.length === 0) return false;
    return e.name.toLowerCase().includes(lastSegment.toLowerCase()) || e.id.toLowerCase().includes(lastSegment.toLowerCase());
  }).slice(0, 5);

  const applySuggestion = (suggestion: { id: string, name: string }) => {
    if (!activeInput) return;
    
    const setter = activeInput === 'to' ? setToStr : activeInput === 'cc' ? setCcStr : setBccStr;
    const currentVal = activeInput === 'to' ? toStr : activeInput === 'cc' ? ccStr : bccStr;
    
    const parts = currentVal.split(',');
    parts.pop(); // Remove the partial typo
    parts.push(` ${suggestion.name} `); // Add full name
    
    setter(parts.join(',').trim());
    
    // Attempt to keep focus on input... 
    // In a sophisticated app, you might use refs. Here we just update string.
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    const to = parseRecipients(toStr);
    const cc = parseRecipients(ccStr);
    const bcc = parseRecipients(bccStr);

    const newMsg = {
      senderId: session.empId,
      senderName: session.name,
      to,
      cc,
      bcc,
      subject,
      body,
      timestamp: new Date().toISOString(),
      readBy: [],
      participants: Array.from(new Set([session.empId, ...to, ...cc, ...bcc]))
    };

    try {
      await addDoc(collection(db, 'messages'), newMsg);
      setView('sent');
      setToStr('');
      setCcStr('');
      setBccStr('');
      setSubject('');
      setBody('');
    } catch (err) {
      console.error("Failed to send message:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'messages');
      } catch (nested) {
        // Suppress or alert according to UX
        alert("Failed to send message: " + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setIsSending(false);
    }
  };

  const openMessage = async (msg: InternalMessage) => {
    const readByArr = msg.readBy || [];
    const isNewRead = !readByArr.includes(session.empId) && msg.senderId !== session.empId;

    if (isNewRead) {
      // Record locally
      setLocalReadIds(prev => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      setLocalUnreadIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });

      const updatedReadBy = [...readByArr, session.empId];
      const updatedMail = { ...msg, readBy: updatedReadBy };

      setSelectedMail(updatedMail);
      setView('read');

      // Optimistic update so list & Sidebar update instantly
      setMyMessages(prev => prev.map(m => m.id === msg.id ? updatedMail : m));

      if (onUpdatePart) {
        onUpdatePart({
          internalMessages: myMessages.map(m => m.id === msg.id ? updatedMail : m)
        });
      }

      try {
        const readRef = doc(db, 'messages', msg.id);
        await updateDoc(readRef, {
          readBy: arrayUnion(session.empId)
        });
      } catch (err) {
        console.error("Failed to mark message as read in Firestore:", err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, `messages/${msg.id}`);
        } catch (nested) {}
      }
    } else {
      setSelectedMail(msg);
      setView('read');
    }
  };

  const toggleMessageReadStatus = async (msg: InternalMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    const readByArr = msg.readBy || [];
    const isRead = ((readByArr.includes(session.empId)) || localReadIds.has(msg.id)) && !localUnreadIds.has(msg.id);
    
    let updatedReadBy: string[];
    if (isRead) {
      updatedReadBy = readByArr.filter(id => id !== session.empId);
      setLocalUnreadIds(prev => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      setLocalReadIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    } else {
      updatedReadBy = [...readByArr, session.empId];
      setLocalReadIds(prev => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      setLocalUnreadIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }

    // Optimistic update
    const updatedMail = { ...msg, readBy: updatedReadBy };
    setMyMessages(prev => prev.map(m => m.id === msg.id ? updatedMail : m));

    if (onUpdatePart) {
      onUpdatePart({
        internalMessages: myMessages.map(m => m.id === msg.id ? updatedMail : m)
      });
    }

    try {
      const readRef = doc(db, 'messages', msg.id);
      await updateDoc(readRef, {
        readBy: isRead ? arrayRemove(session.empId) : arrayUnion(session.empId)
      });
    } catch (err) {
      console.error("Failed to toggle read status in Firestore:", err);
      if (data.internalMessages) {
        setMyMessages(data.internalMessages);
      }
      try {
        handleFirestoreError(err, OperationType.UPDATE, `messages/${msg.id}`);
      } catch (nested) {}
    }
  };

  // Directory picker helpers
  const togglePickRecipient = (name: string) => {
    const currentVal = pickerField === 'to' ? toStr : pickerField === 'cc' ? ccStr : bccStr;
    const setter = pickerField === 'to' ? setToStr : pickerField === 'cc' ? setCcStr : setBccStr;

    const names = currentVal.split(',').map(s => s.trim()).filter(Boolean);
    const index = names.findIndex(n => n.toLowerCase() === name.toLowerCase());

    if (index > -1) {
      names.splice(index, 1);
    } else {
      names.push(name);
    }

    setter(names.join(', '));
  };

  const isSelectedInPicker = (name: string, id: string) => {
    const currentVal = pickerField === 'to' ? toStr : pickerField === 'cc' ? ccStr : bccStr;
    const names = currentVal.split(',').map(s => s.trim().toLowerCase());
    return names.includes(name.toLowerCase()) || names.includes(id.toLowerCase());
  };

  const openDirectoryPicker = (field: 'to' | 'cc' | 'bcc') => {
    setPickerField(field);
    setPickerSearch('');
    setIsPickerOpen(true);
  };

  const deleteMessage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Delete this message for everyone? (Admin only action)')) {
      try {
        await deleteDoc(doc(db, 'messages', id));
        if (selectedMail && selectedMail.id === id) {
          setView('inbox');
          setSelectedMail(null);
        }
      } catch (err) {
        console.error("Failed to delete message from Firestore:", err);
        try {
          handleFirestoreError(err, OperationType.DELETE, `messages/${id}`);
        } catch (nested) {}
      }
    }
  };

  // Get filtered messages with local search capabilities
  const getFilteredMessages = (baseMessages: InternalMessage[]) => {
    return baseMessages.filter(m => {
      // 1. Search Query filter (matches senderName, subject, or body)
      const q = searchText.toLowerCase().trim();
      const matchesSearch = !q || 
        m.senderName.toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Filter tabs (only for inbox)
      if (view === 'inbox') {
        const isRead = ((m.readBy && m.readBy.includes(session.empId)) || localReadIds.has(m.id)) && !localUnreadIds.has(m.id);
        const isFromMe = m.senderId === session.empId;

        if (filterType === 'unread') {
          return !isRead && !isFromMe;
        }
        if (filterType === 'read') {
          return isRead || isFromMe;
        }
      }

      return true;
    });
  };

  const renderList = (messages: InternalMessage[], label: string) => {
    const filtered = getFilteredMessages(messages);
    
    return (
      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-border-accent flex lg:flex-row flex-col overflow-hidden shadow-sm h-[calc(100vh-12rem)]">
        {/* Sidebar for Desktop, Top Row for Mobile */}
        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border-accent bg-gray-50/50 p-3 sm:p-4 flex lg:flex-col flex-row gap-2 items-center lg:items-stretch overflow-x-auto sticky top-0 shrink-0 select-none custom-scrollbar">
          <button
            onClick={() => setView('compose')}
            className="flex items-center gap-2 justify-center bg-brand-primary text-white py-2 sm:py-3 px-4 rounded-xl font-medium hover:bg-brand-secondary transition-all lg:mb-4 shadow-sm text-xs sm:text-sm whitespace-nowrap shrink-0 active:scale-95"
          >
            <Edit className="w-4 h-4" /> Compose
          </button>
          <button
            onClick={() => { setView('inbox'); setFilterType('all'); }}
            className={`flex items-center gap-2 lg:gap-3 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 active:scale-95 ${view === 'inbox' ? 'bg-brand-accent/10 text-brand-accent font-semibold' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'}`}
          >
            <Inbox className="w-4 h-4" /> Inbox
            {inbox.filter(m => {
              const r = ((m.readBy && m.readBy.includes(session.empId)) || localReadIds.has(m.id)) && !localUnreadIds.has(m.id);
              return !r && m.senderId !== session.empId;
            }).length > 0 && (
              <span className="lg:ml-auto bg-brand-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {inbox.filter(m => {
                  const r = ((m.readBy && m.readBy.includes(session.empId)) || localReadIds.has(m.id)) && !localUnreadIds.has(m.id);
                  return !r && m.senderId !== session.empId;
                }).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('sent')}
            className={`flex items-center gap-2 lg:gap-3 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 active:scale-95 ${view === 'sent' ? 'bg-brand-accent/10 text-brand-accent font-semibold' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'}`}
          >
            <Send className="w-4 h-4" /> Sent
          </button>
          <button
            onClick={updateMail}
            disabled={isUpdating}
            className={`flex items-center gap-2 lg:gap-3 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors text-text-secondary hover:bg-gray-100 hover:text-text-primary lg:mt-auto whitespace-nowrap shrink-0 active:scale-95 disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin text-brand-accent' : ''}`} /> 
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="p-4 border-b border-border-accent bg-gray-50/20 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {view === 'inbox' ? <Inbox className="text-brand-accent w-5 h-5"/> : <Send className="text-brand-accent w-5 h-5"/>}
                {label}
              </h2>
              {/* Inbox status filtering tabs */}
              {view === 'inbox' && (
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-border-accent">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${filterType === 'all' ? 'bg-white text-brand-accent font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('unread')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5 ${filterType === 'unread' ? 'bg-white text-brand-accent font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Unread
                    {inbox.filter(m => {
                      const r = ((m.readBy && m.readBy.includes(session.empId)) || localReadIds.has(m.id)) && !localUnreadIds.has(m.id);
                      return !r && m.senderId !== session.empId;
                    }).length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={() => setFilterType('read')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${filterType === 'read' ? 'bg-white text-brand-accent font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Opened
                  </button>
                </div>
              )}
            </div>
            
            <div className="relative">
               <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
               <input 
                 type="text" 
                 value={searchText}
                 onChange={e => setSearchText(e.target.value)}
                 placeholder="Search sender, subject, body..." 
                 className="w-full sm:w-64 pl-9 pr-8 py-2 border border-border-accent rounded-full text-sm bg-gray-50 focus:bg-white focus:outline-brand-accent transition-all shadow-inner" 
               />
               {searchText && (
                 <button 
                   onClick={() => setSearchText('')}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                 >
                   <X className="w-3.5 h-3.5" />
                 </button>
               )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary p-8 text-center bg-gray-50/30">
                <Mail className="w-12 h-12 mb-4 text-gray-300" />
                <p className="font-semibold text-gray-400">No messages found.</p>
                {searchText && <p className="text-xs text-gray-400 mt-1">Try clearing your search query.</p>}
              </div>
            ) : (
              <ul className="divide-y divide-border-accent">
                {filtered.map(msg => {
                  const isReadByMe = ((msg.readBy && msg.readBy.includes(session.empId)) || localReadIds.has(msg.id)) && !localUnreadIds.has(msg.id);
                  const isFromMe = msg.senderId === session.empId;
                  const isUnread = !isReadByMe && !isFromMe;
                  
                  return (
                    <li 
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-all flex gap-4 border-l-4 ${isUnread ? 'bg-brand-accent/5 border-l-brand-accent' : 'border-l-transparent'}`}
                    >
                      <div className="mt-1 flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                          {msg.senderName.charAt(0)}
                        </div>
                        {view === 'inbox' && (
                          <button
                            onClick={(e) => toggleMessageReadStatus(msg, e)}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${isUnread ? 'text-brand-accent' : 'text-gray-350 hover:text-brand-accent'}`}
                            title={isUnread ? "Mark as Read" : "Mark as Unread"}
                          >
                            {isUnread ? (
                              <span className="w-2.5 h-2.5 bg-brand-accent rounded-full block" />
                            ) : (
                              <MailOpen className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 font-sans">
                        <div className="flex justify-between items-baseline mb-1">
                          <strong className={`truncate block text-sm ${isUnread ? 'text-brand-primary font-bold' : 'text-text-primary'}`}>
                            {isFromMe ? 'To: ' + (msg.to && msg.to.map(getEmpName).join(', ')) : msg.senderName}
                          </strong>
                          <span className="text-xs text-text-secondary whitespace-nowrap ml-2">
                            {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`text-sm mb-1 truncate ${isUnread ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                          {msg.subject || '(No Subject)'}
                        </div>
                        <div className="text-sm text-text-secondary truncate">{msg.body.substring(0, 80)}{msg.body.length > 80 ? '...' : ''}</div>
                      </div>
                      {session.isAdmin && (
                        <button onClick={(e) => deleteMessage(msg.id, e)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 mt-1 self-start">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'inbox' && renderList(inbox, 'Inbox')}
          {view === 'sent' && renderList(sent, 'Sent Messages')}
          {view === 'compose' && (
             <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-border-accent flex lg:flex-row flex-col overflow-hidden shadow-sm h-[calc(100vh-12rem)]">
              {/* Compose Sidebar */}
              <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border-accent bg-gray-50/50 p-3 sm:p-4 flex lg:flex-col flex-row gap-2 shrink-0">
                <button
                  onClick={() => setView('inbox')}
                  className="flex items-center gap-2 justify-center bg-white border border-border-accent text-text-primary py-2.5 lg:py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" /> Discard
                </button>
              </div>
              <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-white">
                <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-brand-accent" /> New Message
                </h2>
                <form onSubmit={handleSend} className="flex flex-col gap-4 flex-1 relative">
                  
                  {/* Suggestions Popover */}
                  {activeInput && suggestions.length > 0 && (
                    <div className="absolute z-10 w-64 bg-white border border-border-accent rounded-xl shadow-xl overflow-hidden" 
                          style={{ top: activeInput === 'to' ? '50px' : activeInput === 'cc' ? '106px' : '162px', left: '16px' }}>
                      {suggestions.map((s, idx) => (
                        <div 
                          key={`sugg-${s.id}-${idx}`} 
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex flex-col"
                          onClick={() => applySuggestion(s)}
                        >
                          <span className="text-sm font-medium text-text-primary">{s.name}</span>
                          <span className="text-xs text-text-secondary">{s.id}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <span className="text-sm font-medium text-text-secondary w-12">To:</span>
                    <input 
                      type="text" 
                      required 
                      disabled={isSending}
                      placeholder="Employee names or IDs separated by commas"
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent min-w-0"
                      value={toStr}
                      onFocus={() => setActiveInput('to')}
                      onChange={e => handleRecipientInput(e, setToStr)}
                    />
                    <button
                      type="button"
                      onClick={() => openDirectoryPicker('to')}
                      className="p-1 px-2.5 text-xs text-brand-primary border border-brand-accent rounded-lg bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-all ml-2 flex items-center gap-1 font-semibold whitespace-nowrap active:scale-95 shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" /> Select Members
                    </button>
                  </div>
                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <span className="text-sm font-medium text-text-secondary w-12">Cc:</span>
                    <input 
                      type="text" 
                      disabled={isSending}
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent min-w-0"
                      value={ccStr}
                      onFocus={() => setActiveInput('cc')}
                      onChange={e => handleRecipientInput(e, setCcStr)}
                    />
                    <button
                      type="button"
                      onClick={() => openDirectoryPicker('cc')}
                      className="p-1 px-2.5 text-xs text-brand-primary border border-brand-accent rounded-lg bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-all ml-2 flex items-center gap-1 font-semibold whitespace-nowrap active:scale-95 shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" /> Select Cc
                    </button>
                  </div>
                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <span className="text-sm font-medium text-text-secondary w-12">Bcc:</span>
                    <input 
                      type="text" 
                      disabled={isSending}
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent min-w-0"
                      value={bccStr}
                      onFocus={() => setActiveInput('bcc')}
                      onChange={e => handleRecipientInput(e, setBccStr)}
                    />
                    <button
                      type="button"
                      onClick={() => openDirectoryPicker('bcc')}
                      className="p-1 px-2.5 text-xs text-brand-primary border border-brand-accent rounded-lg bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-all ml-2 flex items-center gap-1 font-semibold whitespace-nowrap active:scale-95 shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" /> Select Bcc
                    </button>
                  </div>
                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <input 
                      type="text" 
                      required
                      placeholder="Subject"
                      disabled={isSending}
                      className="flex-1 py-3 font-medium focus:outline-none bg-transparent"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-h-[200px] flex bg-white border border-border-accent rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <textarea 
                      required
                      disabled={isSending}
                      placeholder="Write your message here..."
                      className="flex-1 p-4 text-sm focus:outline-none bg-transparent resize-none"
                      value={body}
                      onChange={e => setBody(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button 
                      type="submit" 
                      disabled={isSending}
                      className="flex items-center gap-2 bg-brand-primary text-white py-3 px-8 rounded-xl font-medium hover:bg-brand-secondary transition-all disabled:opacity-50"
                    >
                      {isSending ? 'Sending...' : <><Send className="w-4 h-4" /> Send Message</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {view === 'read' && selectedMail && (
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-border-accent flex lg:flex-row flex-col overflow-hidden shadow-sm h-[calc(100vh-12rem)]">
              {/* Read Sidebar */}
              <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border-accent bg-gray-50/50 p-3 sm:p-4 flex lg:flex-col flex-row gap-2 shrink-0">
                <button
                  onClick={() => {
                    setView('inbox');
                    setSelectedMail(null);
                    setFilterType('all');
                  }}
                  className="flex items-center gap-2 justify-center bg-white border border-border-accent text-text-primary py-2.5 lg:py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Inbox
                </button>
              </div>
              <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2 break-words">{selectedMail.subject}</h2>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold shrink-0">
                        {selectedMail.senderName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-sm text-text-primary truncate">{selectedMail.senderName}</strong>
                        <span className="text-[11px] sm:text-xs text-text-secondary block">
                          {new Date(selectedMail.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-start">
                    <button 
                      onClick={() => {
                        setToStr(getEmpName(selectedMail.senderId));
                        setSubject(`Re: ${selectedMail.subject}`);
                        setCcStr(''); setBccStr(''); setBody('');
                        setView('compose');
                      }}
                      className="p-2.5 sm:p-3 text-text-secondary hover:text-brand-accent bg-gray-50 rounded-xl hover:bg-brand-accent/10 transition-colors shadow-sm"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-5 h-5" />
                    </button>
                    {session.isAdmin && (
                      <button 
                        onClick={() => deleteMessage(selectedMail.id)}
                        className="p-2.5 sm:p-3 text-text-secondary hover:text-red-500 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50/80 p-4 rounded-xl border border-border-accent mb-8 text-sm">
                  <div className="flex mb-1">
                    <span className="w-12 text-text-secondary font-medium">To:</span>
                    <span className="flex-1 text-text-primary">{selectedMail.to.map(getEmpName).join(', ')}</span>
                  </div>
                  {selectedMail.cc.length > 0 && (
                    <div className="flex mb-1">
                      <span className="w-12 text-text-secondary font-medium">Cc:</span>
                      <span className="flex-1 text-text-primary">{selectedMail.cc.map(getEmpName).join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="text-text-primary leading-relaxed whitespace-pre-wrap flex-1 font-sans">
                  {selectedMail.body}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Directory Picker Modal Overlay */}
      <AnimatePresence>
        {isPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-border-accent shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] font-sans"
            >
              <div className="p-4 border-b border-border-accent bg-gray-50/50 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                <div>
                  <h3 className="font-bold text-text-primary text-base flex items-center gap-1.5">
                    <Users className="w-5 h-5 text-brand-primary" /> Select Recipients
                  </h3>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Select team members for <span className="font-semibold text-brand-primary uppercase">{pickerField}</span>
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1 px-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 font-medium"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>

              {/* Picker Search and Quick Controls */}
              <div className="p-3 border-b border-border-accent bg-white flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search company subdirectory..."
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    className="pl-8.5 pr-4 py-1.5 w-full text-xs border border-border-accent bg-gray-50 focus:bg-white rounded-lg focus:outline-brand-accent focus:border-brand-accent"
                  />
                </div>
                
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const dirList = data.directory || [];
                      const formatted = dirList.map(e => e.name).join(', ');
                      if (pickerField === 'to') setToStr(formatted);
                      else if (pickerField === 'cc') setCcStr(formatted);
                      else setBccStr(formatted);
                    }}
                    className="px-2.5 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors text-brand-primary text-[11px] font-bold rounded-lg"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pickerField === 'to') setToStr('');
                      else if (pickerField === 'cc') setCcStr('');
                      else setBccStr('');
                    }}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-250 transition-colors text-text-primary text-[11px] font-bold rounded-lg"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Scrollable list of members */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 max-h-[50vh] custom-scrollbar bg-gray-50/20">
                {(data.directory || []).filter(emp => {
                  const search = pickerSearch.toLowerCase().trim();
                  return !search || emp.name.toLowerCase().includes(search) || emp.id.toLowerCase().includes(search);
                }).length === 0 ? (
                  <div className="p-8 text-center text-xs text-text-secondary">
                    No matching team members found.
                  </div>
                ) : (
                  (data.directory || []).filter(emp => {
                    const search = pickerSearch.toLowerCase().trim();
                    return !search || emp.name.toLowerCase().includes(search) || emp.id.toLowerCase().includes(search);
                  }).map(emp => {
                    const selected = isSelectedInPicker(emp.name, emp.id);
                    return (
                      <div 
                        key={`pick-${emp.id}`}
                        onClick={() => togglePickRecipient(emp.name)}
                        className={`p-2.5 px-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${selected ? 'bg-brand-primary/5 hover:bg-brand-primary/10' : 'hover:bg-gray-50 bg-white shadow-sm border border-gray-100/10 mb-1'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-gray-100 to-gray-50 text-text-primary font-bold text-xs flex items-center justify-center border border-border-accent">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-text-primary block">{emp.name}</span>
                            <span className="text-[10px] text-text-secondary block">{emp.id}</span>
                          </div>
                        </div>
                        
                        <div>
                          {selected ? (
                            <span className="p-1 px-1.5 bg-brand-primary text-white rounded-md flex items-center justify-center font-bold">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 border border-border-accent rounded-md block bg-white hover:border-brand-primary/55" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-border-accent bg-gray-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="px-5 py-2 bg-brand-primary text-white rounded-xl text-xs font-semibold hover:bg-brand-secondary transition-colors shadow-sm active:scale-95"
                >
                  Apply Selections
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
