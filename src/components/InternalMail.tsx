import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Inbox, Send, Edit, Trash2, Mail, Users, ArrowLeft,
  CheckCircle2, CornerUpLeft, Search, Plus
} from 'lucide-react';
import { Session, AppData, InternalMessage } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

interface InternalMailProps {
  session: Session;
  data: AppData;
}

type MailView = 'inbox' | 'sent' | 'compose' | 'read';

export default function InternalMail({ session, data }: InternalMailProps) {
  const [view, setView] = useState<MailView>('inbox');
  const [selectedMail, setSelectedMail] = useState<InternalMessage | null>(null);
  
  // Compose states
  const [toStr, setToStr] = useState('');
  const [ccStr, setCcStr] = useState('');
  const [bccStr, setBccStr] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Derive mail lists
  const myMessages = data.internalMessages || [];
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
    const empFallback = data.employees.find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    return empFallback ? empFallback.name : identifier;
  };

  const getEmpId = (identifier: string) => {
    const dirList = data.directory || [];
    const emp = dirList.find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
    if (emp) return emp.id;

    const empFallback = data.employees.find(e => e.id === identifier || e.name.toLowerCase() === identifier.toLowerCase());
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
      alert("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const openMessage = async (msg: InternalMessage) => {
    setSelectedMail(msg);
    setView('read');
    
    // Mark as read if not read
    if (!msg.readBy.includes(session.empId) && msg.senderId !== session.empId) {
      const readRef = doc(db, 'messages', msg.id);
      await updateDoc(readRef, {
        readBy: [...msg.readBy, session.empId]
      }).catch(console.error);
    }
  };

  const deleteMessage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Delete this message for everyone? (Admin only action)')) {
      await deleteDoc(doc(db, 'messages', id)).catch(console.error);
      if (selectedMail && selectedMail.id === id) {
        setView('inbox');
        setSelectedMail(null);
      }
    }
  };

  const renderList = (messages: InternalMessage[], label: string) => (
    <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-border-accent flex lg:flex-row flex-col overflow-hidden shadow-sm h-[calc(100vh-12rem)]">
      {/* Sidebar */}
      <div className="w-full lg:w-64 border-r border-border-accent bg-gray-50/50 p-4 flex flex-col gap-2">
        <button
          onClick={() => setView('compose')}
          className="flex items-center gap-2 w-full justify-center bg-brand-primary text-white py-3 px-4 rounded-xl font-medium hover:bg-brand-secondary transition-colors mb-4 shadow-sm"
        >
          <Edit className="w-4 h-4" /> Compose
        </button>
        <button
          onClick={() => setView('inbox')}
          className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${view === 'inbox' ? 'bg-brand-accent/10 text-brand-accent' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'}`}
        >
          <Inbox className="w-4 h-4" /> Inbox
          {inbox.filter(m => !m.readBy.includes(session.empId) && m.senderId !== session.empId).length > 0 && (
            <span className="ml-auto bg-brand-accent text-white text-[10px] px-2 py-0.5 rounded-full">
              {inbox.filter(m => !m.readBy.includes(session.empId) && m.senderId !== session.empId).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView('sent')}
          className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${view === 'sent' ? 'bg-brand-accent/10 text-brand-accent' : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'}`}
        >
          <Send className="w-4 h-4" /> Sent
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border-accent bg-white flex justify-between items-center z-10 sticky top-0">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            {view === 'inbox' ? <Inbox className="text-brand-accent w-5 h-5"/> : <Send className="text-brand-accent w-5 h-5"/>}
            {label}
          </h2>
          <div className="relative">
             <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
             <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 border border-border-accent rounded-full text-sm bg-gray-50 focus:bg-white focus:outline-brand-accent transition-colors" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary p-8 text-center">
              <Mail className="w-12 h-12 mb-4 text-gray-300" />
              <p>Your {view} is empty.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-accent">
              {messages.map(msg => (
                <li 
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors flex gap-4 ${!msg.readBy.includes(session.empId) && msg.senderId !== session.empId ? 'bg-brand-accent/5' : ''}`}
                >
                  <div className="mt-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {msg.senderName.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <strong className={`truncate block text-sm ${!msg.readBy.includes(session.empId) && msg.senderId !== session.empId ? 'text-brand-primary' : 'text-text-primary'}`}>{msg.senderName}</strong>
                      <span className="text-xs text-text-secondary whitespace-nowrap ml-2">
                        {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-text-primary mb-1 truncate">{msg.subject || '(No Subject)'}</div>
                    <div className="text-sm text-text-secondary truncate">{msg.body.substring(0, 80)}{msg.body.length > 80 ? '...' : ''}</div>
                  </div>
                  {session.isAdmin && (
                    <button onClick={(e) => deleteMessage(msg.id, e)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 mt-1 self-start">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full">
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
              <div className="w-full lg:w-64 border-r border-border-accent bg-gray-50/50 p-4 flex flex-col gap-2">
                <button
                  onClick={() => setView('inbox')}
                  className="flex items-center gap-2 w-full justify-center bg-white border border-border-accent text-text-primary py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors mb-4 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Discard
                </button>
              </div>
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
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
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent"
                      value={toStr}
                      onFocus={() => setActiveInput('to')}
                      onChange={e => handleRecipientInput(e, setToStr)}
                    />
                  </div>
                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <span className="text-sm font-medium text-text-secondary w-12">Cc:</span>
                    <input 
                      type="text" 
                      disabled={isSending}
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent"
                      value={ccStr}
                      onFocus={() => setActiveInput('cc')}
                      onChange={e => handleRecipientInput(e, setCcStr)}
                    />
                  </div>
                  <div className="flex bg-white border border-border-accent rounded-lg items-center px-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent transition-all">
                    <span className="text-sm font-medium text-text-secondary w-12">Bcc:</span>
                    <input 
                      type="text" 
                      disabled={isSending}
                      className="flex-1 py-3 text-sm focus:outline-none bg-transparent"
                      value={bccStr}
                      onFocus={() => setActiveInput('bcc')}
                      onChange={e => handleRecipientInput(e, setBccStr)}
                    />
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
              <div className="w-full lg:w-64 border-r border-border-accent bg-gray-50/50 p-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setView('inbox');
                    setSelectedMail(null);
                  }}
                  className="flex items-center gap-2 w-full justify-center bg-white border border-border-accent text-text-primary py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors mb-4 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Inbox
                </button>
              </div>
              <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-white">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">{selectedMail.subject}</h2>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center text-white font-bold">
                        {selectedMail.senderName.charAt(0)}
                      </div>
                      <div>
                        <strong className="block text-sm text-text-primary">{selectedMail.senderName}</strong>
                        <span className="text-xs text-text-secondary">
                          {new Date(selectedMail.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setToStr(getEmpName(selectedMail.senderId));
                        setSubject(`Re: ${selectedMail.subject}`);
                        setCcStr(''); setBccStr(''); setBody('');
                        setView('compose');
                      }}
                      className="p-3 text-text-secondary hover:text-brand-accent bg-gray-50 rounded-xl hover:bg-brand-accent/10 transition-colors shadow-sm"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-5 h-5" />
                    </button>
                    {session.isAdmin && (
                      <button 
                        onClick={() => deleteMessage(selectedMail.id)}
                        className="p-3 text-text-secondary hover:text-red-500 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
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

                <div className="text-text-primary leading-relaxed whitespace-pre-wrap flex-1">
                  {selectedMail.body}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
