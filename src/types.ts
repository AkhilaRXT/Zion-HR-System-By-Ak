export interface Employee {
  id: string;
  name: string;
  email?: string;
  role: string;
  department: string;
  branch: string;
  baseSalary: number;
  travelingAllowance: number;
  vehicleAllowance: number;
  performanceAllowance: number;
  petrolLitres: number;
  attendanceBonus: number;
  overtime: number;
  bikeInstallment: number;
  staffLoan: number;
  bankName?: string;
  bankBranch?: string;
  accountNo?: string;
  profilePic?: string;
  hasEPF?: boolean;
}

export interface Credential {
  empId: string;
  username: string;
  password?: string;
  isAdmin: boolean;
  permissions?: string[];
}

export interface Attendance {
  id: number;
  empId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Late';
  checkIn: string;
  checkOut: string;
}

export interface LeaveRequest {
  id: number;
  empId: string;
  type: 'Annual' | 'Casual' | 'Sick';
  from: string;
  to: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
  attachment?: string;
}

export interface Target {
  id: number;
  empId: string;
  month: string;
  category: string;
  targetCount: number;
  achievedCount: number;
}

export interface AdvanceRequest {
  id: number;
  empId: string;
  amount: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
  isPaid?: boolean;
  attachment?: string;
}

export interface CashRequest {
  id: number;
  empId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  attachment?: string;
}

export interface LeaveBalances {
  [empId: string]: {
    annual: number;
    casual: number;
    sick: number;
  };
}

export interface AppSettings {
  companyName: string;
  companySubtitle: string;
  logo?: string;
  leavePolicy: {
    monthlyLimit: number;
    annualTotal: number;
    casualTotal: number;
    sickTotal: number;
  };
  workSchedule: {
    weekdays: { start: string; end: string };
    saturdays: { start: string; end: string };
    sundays: boolean;
  };
  fuelPrice: number;
  theme?: {
    primary: string;
    accent: string;
    background: string;
    secondary: string;
    textPrimary: string;
    textSecondary: string;
  };
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: 'Employee' | 'Attendance' | 'Leave' | 'Advance' | 'Target' | 'Settings' | 'Auth' | 'Cash' | 'Payroll';
}

export interface AppData {
  employees: Employee[];
  credentials: Credential[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  targets: Target[];
  advances: AdvanceRequest[];
  cashRequests: CashRequest[];
  leaveBalances: LeaveBalances;
  settings: AppSettings;
  auditLogs: AuditLog[];
  paidDeductions?: { [empId: string]: string[] };
}

export interface Session {
  empId: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  permissions?: string[];
}
