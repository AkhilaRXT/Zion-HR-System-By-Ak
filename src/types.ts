export interface Employee {
  id: string;
  name: string;
  email?: string;
  role: string;
  department: string;
  branch: string;
  branchCode?: string;
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
  status?: 'Active' | 'Dormant';
  dateOfBirth?: string;
  joinDate?: string;
  salaryStatus?: 'Active' | 'Held_1' | 'Held_2' | 'Held_Forever' | 'Custom';
  heldFrom?: string;
  heldTo?: string;
  heldComponents?: string[];
  passkeyRawId?: string;
}

export interface UserCredential {
  empId: string;
  username: string;
  password?: string;
  isAdmin: boolean;
  permissions?: string[];
  viewableBranches?: string[];
}

export interface Attendance {
  id: number;
  empId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Late' | 'Leave' | 'Holiday';
  checkIn: string;
  checkOut: string;
  checkInLocation?: string;
  checkOutLocation?: string;
  timestamp: string;
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

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  authorId: string;
  daysToStay?: number;
  priority?: 'High' | 'Medium' | 'Low';
}

export interface AdvanceRequest {
  id: number;
  empId: string;
  amount: number;
  date: string;
  approvedDate?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
  isPaid?: boolean;
  paidAmount?: number;
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
  attachments?: string[];
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
  epfPercentage?: number;
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
  type: 'Employee' | 'Attendance' | 'Leave' | 'Advance' | 'Target' | 'Settings' | 'Auth' | 'Cash' | 'Payroll' | 'Asset' | 'PerformanceAllowance';
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

export interface CustomNet {
  id: string; // month_empId
  empId: string;
  month: string;
  amount: number;
  addedBy: string;
  timestamp: string;
}

export interface DCCollection {
  id: string;
  date: string;
  receiptNo: string;
  customerName: string;
  nic: string;
  documentCharge: number;
  loanAmount: number;
  paymentMethod: string;
  collectionType: string;
  collectedBy: string; 
  empId: string;
  branch: string;
  timestamp: string;
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  status?: string;
}

export interface SystemReport {
  id: string;
  empId: string;
  empName: string;
  subject: string;
  message: string;
  timestamp: string;
  status: 'New' | 'Read' | 'Resolved';
}

export interface SystemReport {
  id: string;
  empId: string;
  empName: string;
  subject: string;
  message: string;
  timestamp: string;
  status: 'New' | 'Read' | 'Resolved';
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location?: string;
  createdAt?: string;
  managerId?: string;
  status?: 'Active' | 'Inactive';
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'National' | 'Regional' | 'Company';
}

export interface Asset {
  id: string;
  name: string;
  category: 'Laptop' | 'Desktop' | 'Phone' | 'Vehicle' | 'Tablet' | 'Printer' | 'Other';
  serialNo?: string;
  branch: string;
  assignedTo: string | null;
  status: 'New' | 'Good' | 'Used' | 'Bad' | 'Broke';
  notes?: string;
  purchaseDate?: string;
  createdAt: string;
  updatedAt: string;
  addedBy: string;
}

export interface PerformanceAllowance {
  id: string;            // format: "${empId}_${month}"  e.g. "EMP001_2026-05"
  empId: string;
  month: string;         // "YYYY-MM"
  score: number;         // overall % score (0–100) calculated at time of setting
  amount: number;        // Rs. amount approved to pay
  amountType: 'fixed' | 'percentage';  // how it was calculated
  percentageOfBase?: number;           // if amountType is 'percentage', store the % used
  paid: boolean;         // true once payroll marks it as paid
  setBy: string;         // empId of admin who set it
  setAt: string;         // ISO timestamp
  notes?: string;
}

export interface AppData {
  branches?: Branch[];
  holidays?: Holiday[];
  employees: Employee[];
  credentials: UserCredential[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  targets: Target[];
  announcements?: Announcement[];
  assets?: Asset[];
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
  customNets?: CustomNet[];
  dcCollections: DCCollection[];
  systemReports: SystemReport[];
  performanceAllowances?: PerformanceAllowance[];
  ownAttendance?: Attendance[];
  ownLeaves?: LeaveRequest[];
  ownAdvances?: AdvanceRequest[];
  ownCashRequests?: CashRequest[];
  ownTargets?: Target[];
  ownAdhocBonuses?: AdhocBonus[];
}

export interface Session {
  empId: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  permissions?: string[];
  viewableBranches?: string[];
  username?: string;
  passToken?: string;
}
