import React, { useState } from 'react';
import { DataStore } from '../lib/dataStore';
import { Session, AppData } from '../types';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (session: Session) => void;
  data: AppData;
}

function Logo({ src }: { src?: string }) {
  return (
    <div className="w-20 h-20 relative mb-8">
      {src ? (
        <img src={src} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full bg-brand-accent rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white text-3xl font-bold">Z</span>
        </div>
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

  const hero = data.settings.loginHero || {
    titleLine1: 'Empowering Your',
    titleLine2: 'Financial Future',
    stat1Value: '100%',
    stat1Label: 'Secure',
    stat2Value: '24/7',
    stat2Label: 'Access',
    backgroundImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop'
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50 font-sans">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex w-1/2 bg-brand-accent relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-accent to-blue-900 opacity-90" />
        <img 
          src={hero.backgroundImage || "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop"} 
          alt="Office" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40" 
          referrerPolicy="no-referrer"
        />
        <div className="relative z-10 p-16 text-white max-w-xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              {hero.titleLine1} <br />
              <span className="text-blue-300">{hero.titleLine2}</span>
            </h1>
            <p className="text-xl text-blue-100/80 font-medium leading-relaxed">
              {data.settings.companySubtitle || 'Professional Human Resource & Payroll Management System'}
            </p>
            <div className="mt-12 flex gap-8">
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{hero.stat1Value}</span>
                <span className="text-sm text-blue-200 uppercase tracking-widest">{hero.stat1Label}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{hero.stat2Value}</span>
                <span className="text-sm text-blue-200 uppercase tracking-widest">{hero.stat2Label}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Logo src={data.settings.logo} />
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-3">Welcome Back</h2>
            <p className="text-sm font-medium text-text-secondary">Please enter your credentials to access your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Username
              </label>
              <input 
                type="text" 
                className="form-control h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" 
                placeholder="Enter your username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Password
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-control h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all pr-12" 
                  placeholder="Enter your password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-brand-accent transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="btn btn-primary w-full h-12 justify-center text-sm font-bold shadow-lg shadow-brand-accent/20"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 flex flex-col gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <span className="relative px-4 bg-white text-xs text-text-secondary font-bold uppercase tracking-widest">Or continue with</span>
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
              className="btn btn-outline w-full h-12 justify-center flex items-center gap-3 text-sm font-bold"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100 text-center">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              © {new Date().getFullYear()} {data.settings.companyName}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
