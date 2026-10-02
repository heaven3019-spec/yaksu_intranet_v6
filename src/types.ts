export type LeaveType = 'ANNUAL' | 'HALF_AM' | 'HALF_PM' | 'HOURLY' | 'QUARTER' | 'SICK' | 'SPECIAL' | 'OFFICIAL';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type UserRole = 'EMPLOYEE' | 'ADMIN';

export type EmployeeStatus = 'ACTIVE' | 'RETIRED';

export type LeaveCalculationMode = 'AUTO' | 'MANUAL';

export interface Employee {
  id: string;
  loginId: string; // 고유 로그인 아이디 (예: admin, hong, minsu)
  password?: string; // 비밀번호 (기본: 1234)
  name: string;
  position: string;
  department?: string;
  email: string;
  phone: string;
  joinDate: string; // YYYY-MM-DD
  role: UserRole;
  status?: EmployeeStatus; // 'ACTIVE' (재직자) | 'RETIRED' (퇴사자)
  retiredDate?: string; // YYYY-MM-DD
  avatarColor?: string;
  calculationMode?: LeaveCalculationMode; // 'AUTO' (근로기준법 자동) | 'MANUAL' (관리자 수동 지정)
  manualBaseGrantedDays?: number; // 관리자 수동 지정 기본 연차 일수
  extraGrantedDays?: number; // 포상/대체휴가 등 관리자 수동 가산일
  customNotes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number; // 1, 0.5, 0.125 (1h), etc.
  reason: string;
  contactEmergency?: string;
  status: LeaveStatus;
  requestedAt: string; // ISO string
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cycleYearIndex?: number; // 연차 주기 회차 (예: 1년차, 2년차 등)
}

export interface LeaveCycleInfo {
  cycleIndex: number; // 1년차 = 1, 2년차 = 2 ...
  label: string;      // "1년차 (2025.03.01 ~ 2026.02.28)"
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  totalGranted: number; // 기본 부여일(법정 또는 수동) + 수동 가산일
  baseGranted: number;  // 법정 또는 수동 지정 기본 부여일
  isManualBase?: boolean; // 수동으로 기본 부여일이 지정되었는지 여부
  extraGranted: number; // 특별 가산
  usedDays: number;     // 승인된 사용일수
  pendingDays: number;  // 승인 대기중 일수
  remainingDays: number;// 미사용 잔여일수
  usageRate: number;    // 사용률 (%)
  isCurrent: boolean;
}

export interface EmployeeLeaveSummary {
  employee: Employee;
  tenureYears: number;
  tenureMonths: number;
  tenureDays: number;
  currentCycle: LeaveCycleInfo;
  allCycles: LeaveCycleInfo[];
}

