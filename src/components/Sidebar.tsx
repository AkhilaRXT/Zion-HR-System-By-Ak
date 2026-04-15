import React from 'react';
import { Session, AppData } from '../types';
import { 
  PieChart, 
  Users, 
  CalendarCheck, 
  PlaneTakeoff, 
  Target, 
  FileText, 
  Settings, 
  UserCircle, 
  LogOut,
  ChevronRight,
  X,
  History
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  session: Session;
  data: AppData;
  activeRoute: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function Logo({ src }: { src?: string }) {
  return (
    <div className="w-10 h-10 relative mb-4">
      {src ? (
        <img src={src} alt="Logo" className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-accent)" />
              <stop offset="100%" stopColor="var(--brand-secondary)" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="80" height="80" rx="20" fill="url(#logoGradient)" />
          <path d="M35 35 L65 35 L35 65 L65 65" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export default function Sidebar({ session, data, activeRoute, onNavigate, onLogout, isOpen, onClose }: SidebarProps) {
  const isAdmin = session.isAdmin;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'staff', label: 'Staff Mgmt', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'leave', label: 'Leave Mgmt', icon: PlaneTakeoff },
    { id: 'payroll', label: isAdmin ? 'Payroll' : 'Salary Advance', icon: FileText },
    { id: 'cash_requests', label: 'Cash Requests', icon: FileText },
    { id: 'audit', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'Control Panel', icon: Settings },
    { id: 'myprofile', label: 'My Profile', icon: UserCircle },
  ];

  const hasPermission = (id: string) => {
    // Always accessible for everyone
    if (id === 'dashboard' || id === 'myprofile' || id === 'leave' || id === 'payroll' || id === 'cash_requests') return true;
    
    // Master Admin (Google Login) gets everything
    const isMasterAdmin = session.email === "zioncommercialcreditampara@gmail.com";
    if (isMasterAdmin) return true;

    // Regular members cannot see anything else
    if (!isAdmin) return false;
    
    // Staff Admins must have the specific permission for other areas
    if (session.permissions && session.permissions.length > 0) {
      return session.permissions.includes(id);
    }
    
    // If an admin has no permissions defined, they get nothing else
    return false;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[40] md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed md:relative w-[280px] bg-bg-secondary flex flex-col p-8 z-[50] border-r border-border-accent h-screen transition-transform duration-300 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex justify-between items-start mb-12">
          <div>
            <Logo src={data.settings.logo} />
            <div className="font-serif text-2xl italic tracking-[2px] text-brand-accent mb-1">{data.settings.companyName}</div>
            <p className="text-[9px] text-text-secondary uppercase tracking-[3px] font-sans">{data.settings.companySubtitle}</p>
          </div>
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-text-secondary hover:text-brand-accent"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

      <nav className="flex-1">
        <ul className="space-y-4">
          {menuItems.filter(item => hasPermission(item.id)).map((item) => (
            <li 
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "group px-4 py-3 cursor-pointer font-sans text-[11px] uppercase tracking-[1.5px] transition-all duration-300 flex items-center gap-3 rounded-lg",
                activeRoute === item.id 
                  ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20" 
                  : "text-text-secondary hover:text-brand-accent hover:bg-brand-accent/5"
              )}
            >
              <item.icon className={cn("w-4 h-4", activeRoute === item.id ? "text-brand-accent" : "text-text-secondary group-hover:text-brand-accent")} />
              <span className="flex-1">{item.label}</span>
              {activeRoute === item.id && <ChevronRight className="w-3 h-3" />}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto pt-8 border-t border-border-accent flex items-center gap-4">
        <div className="flex-1 overflow-hidden">
          <strong className="block text-[11px] uppercase tracking-[1px] truncate text-text-primary">{session.name}</strong>
          <span className="text-[9px] text-text-secondary uppercase tracking-[2px]">{isAdmin ? 'Administrator' : 'Member'}</span>
        </div>
        <button 
          onClick={onLogout}
          title="Logout"
          className="p-2 text-text-secondary hover:text-brand-accent transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  </>
  );
}
