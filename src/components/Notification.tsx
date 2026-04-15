import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

export default function Notification({ message, type, onClose, duration = 3000 }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-brand-accent" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500" />
  };

  const colors = {
    success: 'border-emerald-500/30 bg-emerald-500/5',
    error: 'border-red-500/30 bg-red-500/5',
    info: 'border-brand-accent/30 bg-brand-accent/5',
    warning: 'border-amber-500/30 bg-amber-500/5'
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`fixed bottom-8 right-8 z-[300] flex items-center gap-4 px-6 py-4 border rounded-lg shadow-2xl backdrop-blur-md ${colors[type]}`}
    >
      {icons[type]}
      <span className="text-[11px] uppercase tracking-[1.5px] font-medium text-text-primary">
        {message}
      </span>
      <button onClick={onClose} className="ml-4 text-text-secondary hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
