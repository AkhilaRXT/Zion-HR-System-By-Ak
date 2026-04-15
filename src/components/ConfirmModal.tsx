import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-bg-secondary border border-border-accent p-8 md:p-10 w-full max-w-md shadow-2xl"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-full ${
                type === 'danger' ? 'bg-red-500/10 text-red-500' : 
                type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                'bg-brand-accent/10 text-brand-accent'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button onClick={onCancel} className="text-text-secondary hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-[14px] uppercase tracking-[3px] text-text-primary font-serif mb-4">{title}</h3>
            <p className="text-[12px] text-text-secondary leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex gap-4">
              <button
                onClick={onCancel}
                className="btn btn-outline flex-1 justify-center py-3"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`btn flex-1 justify-center py-3 ${
                  type === 'danger' ? 'btn-danger' : 
                  type === 'warning' ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600' : 
                  'btn-primary'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
