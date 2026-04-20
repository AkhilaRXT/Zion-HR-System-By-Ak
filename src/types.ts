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

export interface UserCredential {
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
  status: 'Present' | 'Absent' | 'Half Day' | 'Late' | 'Leave';
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
  actionedBy?: string;
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
  actionedBy?: string;
  actionHistory?: {
    action: string;
    by: string;
    date: string;
  }[];
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
  actionedBy?: string;
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
  backgroundBlobs?: {
    enabled: boolean;
    blur: number;
    opacity: number;
  };
  loginHero?: {
    titleLine1: string;
    titleLine2: string;
    stat1Value: string;
    stat1Label: string;
    stat2Value: string;
    stat2Label: string;
    backgroundImage?: string;
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

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  timestamp: string;
  readBy: string[];
  participants: string[]; // flattened array for easy querying (sender, to, cc, bcc)
}

export interface DirectoryEntry {
  id: string;
  name: string;
}

export interface PayrollReceipt {
  id: string;
  month: string;
  timestamp: string;
  totalPayout: number;
  employeesPaid: number;
  transactions: {
    empId: string;
    net: number;
    notes: string;
    components: string[];
  }[];
  actionedBy: string;
}

export interface AdhocBonus {
  id: string; // month_empId
  empId: string;
  month: string;
  amount: number;
  addedBy: string;
  timestamp: string;
}

export interface AppData {
  employees: Employee[];
  credentials: UserCredential[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  targets: Target[];
  advances: AdvanceRequest[];
  cashRequests: CashRequest[];
  leaveBalances: LeaveBalances;
  settings: AppSettings;
  auditLogs: AuditLog[];
  payrollReceipts: PayrollReceipt[];
  paidDeductions?: { [empId: string]: string[] };
  paidSalaryAmounts?: { [empId: string]: { [month: string]: number } };
  paidSalaryNotes?: { [empId: string]: { [month: string]: string } };
  paidComponents?: { [empId: string]: { [month: string]: string[] } };
  internalMessages: InternalMessage[];
  directory?: DirectoryEntry[];
  adhocBonuses: AdhocBonus[];
}

export interface Session {
  empId: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  permissions?: string[];
}
