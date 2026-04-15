import React, { useState } from 'react';
import { DataStore } from '../lib/dataStore';
import { Session, AppData } from '../types';
import { User, Lock, Eye, EyeOff, LogIn, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (session: Session) => void;
  data: AppData;
}

function Logo({ src }: { src?: string }) {
  return (
    <div className="w-16 h-16 relative mb-8">
      {src ? (
        <img src={src} alt="Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M50 0 A50 50 0 0 0 50 100 L50 0" fill="#1B4384" />
          <path d="M50 0 A50 50 0 0 1 50 100 L50 0" fill="#27A745" />
          <path d="M30 30 L70 30 L30 70 L70 70" fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export default function Login({ onLogin, data }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await DataStore.login(username, password);
      if ('error' in result && result.error) {
        setError(result.error);
        setPassword('');
      } else if (result.success && result.session) {
        onLogin(result.session);
      }
    } catch (err) {
      setError('An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-bg-primary overflow-hidden font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[440px] p-16 bg-bg-secondary border border-border-accent"
      >
        <div className="mb-12">
          <Logo src={data.settings.logo} />
          <div className="font-serif text-3xl italic tracking-[3px] text-brand-accent mb-2">{data.settings.companyName}</div>
          <p className="text-[11px] text-text-secondary uppercase tracking-[4px]">{data.settings.companySubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] text-brand-accent uppercase tracking-[2px] flex items-center gap-2">
              Username
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Enter your username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
              autoComplete="off"
            />
          </div>

          <div className="space-y-2 relative">
            <label className="text-[10px] text-brand-accent uppercase tracking-[2px] flex items-center gap-2">
              Password
            </label>
            <input 
              type={showPassword ? "text" : "password"} 
              className="form-control" 
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-10 text-text-secondary hover:text-brand-accent transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-red-500/20 text-red-500 text-[11px] uppercase tracking-[1px] p-4 bg-red-500/5"
            >
              {error}
            </motion.div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary w-full justify-center py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Signing In...</span>
              </div>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-accent"></div>
            </div>
            <span className="relative px-4 bg-bg-secondary text-[10px] text-text-secondary uppercase tracking-[2px]">Or continue with</span>
          </div>

          <button 
            onClick={async () => {
              setIsLoading(true);
              setError('');
              try {
                const result = await DataStore.loginWithGoogle();
                if (result.success && result.session) {
                  onLogin(result.session);
                } else {
                  setError(result.error || 'Google login failed.');
                }
              } catch (err: any) {
                console.error('Login component error:', err);
                setError(err.message || 'Google login failed.');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className="btn btn-outline w-full justify-center py-4 flex items-center gap-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-border-accent text-center">
          <p className="text-[10px] text-text-secondary uppercase tracking-[2px]">
            Market Status: <span className="text-emerald-500">Open</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
