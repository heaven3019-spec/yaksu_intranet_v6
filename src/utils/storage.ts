import { Employee, LeaveRequest } from '../types';
import { 
  saveEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  saveLeaveRequestToFirestore, 
  deleteLeaveRequestToFirestore,
  syncEmployeesToFirestore, 
  syncRequestsToFirestore,
  fetchAllFromFirestore,
  cleanupFirestoreUnauthorizedData
} from '../lib/firebase';

const EMPLOYEES_KEY = 'hr_intranet_employees_v3';
const REQUESTS_KEY = 'hr_intranet_requests_v3';
const AUTH_SESSION_KEY = 'hr_intranet_auth_session_v3';
const ADMIN_TOKEN_KEY = 'hr_intranet_admin_token_v3';

export const DEFAULT_ADMIN: Employee = {
  id: 'admin-001',
  loginId: 'admin',
  password: '0410',
  name: '유정',
  position: '센터운영과장 (관리자)',
  department: '센터운영본부',
  email: 'yu.admin@yaksoo.kr',
  phone: '010-9999-8888',
  joinDate: '2020-01-02',
  role: 'ADMIN',
  status: 'ACTIVE',
  avatarColor: 'from-slate-700 to-slate-900',
  calculationMode: 'AUTO',
  extraGrantedDays: 0,
  customNotes: '동작구립 약수데이케어센터 연차 결재 및 전사 인사 관리 총괄',
};

// Only the administrator is initialized if database is completely empty
export const INITIAL_EMPLOYEES: Employee[] = [DEFAULT_ADMIN];

// No mock leave requests
export const INITIAL_REQUESTS: LeaveRequest[] = [];

// Blacklist set of old sample mock IDs & unauthorized test accounts to guarantee they never appear
export const MOCK_EMP_IDS = new Set([
  'emp-001', 
  'emp-002', 
  'emp-003', 
  'emp-004', 
  'emp-1788672814213', 
  'emp-1786779270075'
]);
export const MOCK_LOGIN_IDS = new Set(['hong', 'minsu', 'jieun', 'seojun', 'test']);

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // Ignore
  }
}

// Asynchronously sync to Firestore & backend server DB with Admin authorization
export async function syncToServer(employees?: Employee[], requests?: LeaveRequest[], forceOverwrite = false) {
  try {
    const cleanEmps = employees?.filter(
      (e) => !MOCK_EMP_IDS.has(e.id) && !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && e.name !== '테스트계정'
    );
    
    const validEmpIdSet = new Set(cleanEmps?.map(e => e.id) || []);
    validEmpIdSet.add('admin-001');

    const cleanReqs = requests?.filter(
      (r) => !MOCK_EMP_IDS.has(r.employeeId) && 
             r.employeeName !== '유하늘' &&
             validEmpIdSet.has(r.employeeId) &&
             !r.id?.startsWith('req-10') && 
             !r.id?.startsWith('req-20') && 
             !r.id?.startsWith('req-30') && 
             !r.id?.startsWith('req-today-') &&
             r.id !== 'req-1786779464228'
    );

    // Cloud Firestore Sync
    if (cleanEmps && cleanEmps.length > 0) {
      syncEmployeesToFirestore(cleanEmps).catch((e) => console.warn('Firestore emp sync:', e));
    }
    if (cleanReqs && cleanReqs.length > 0) {
      syncRequestsToFirestore(cleanReqs).catch((e) => console.warn('Firestore req sync:', e));
    }

    const payload: any = { forceOverwrite };
    if (cleanEmps) payload.employees = cleanEmps;
    if (cleanReqs) payload.requests = cleanReqs;

    const token = getAdminToken() || 'adm_master_session_default';
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      notifyBroadcastChannel('DATA_UPDATED');
    }
  } catch (err) {
    console.warn('Backend sync deferred (offline or server starting):', err);
  }
}

// Post single request directly to backend & Firestore for instant real-time recording
export async function postSingleRequestToServer(newReq: LeaveRequest) {
  try {
    // 1. Write directly to Firestore first for instant cloud persistence
    await saveLeaveRequestToFirestore(newReq);
  } catch (e) {
    console.error('[Storage] Firestore direct write error:', e);
  }

  try {
    // 2. Also notify backend server
    const token = getAdminToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['x-admin-token'] = token;

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers,
      body: JSON.stringify(newReq),
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '연차 신청 서버 접수에 실패했습니다.');
    }

    notifyBroadcastChannel('NEW_REQUEST_SUBMITTED', newReq);
  } catch (err) {
    console.warn('[Storage] Direct request post deferred to background sync:', err);
    throw err;
  }
}

// Post single employee directly to backend & Firestore for instant real-time registration
export async function postSingleEmployeeToServer(newEmp: Employee) {
  try {
    // 1. Write directly to Firestore first for instant cloud persistence
    await saveEmployeeToFirestore(newEmp);
  } catch (e) {
    console.error('[Storage] Firestore direct employee write error:', e);
    throw e;
  }

  try {
    // 2. Also notify backend server with Admin Token
    const token = getAdminToken() || 'adm_master_session_default';
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify(newEmp),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '직원 등록 서버 처리에 실패했습니다.');
    }

    notifyBroadcastChannel('EMPLOYEE_UPDATED', newEmp);
  } catch (err) {
    console.warn('[Storage] Direct employee post error:', err);
    throw err;
  }
}

// Direct authentication check against backend server
export async function authenticateWithServer(loginId: string, password: string): Promise<{
  success: boolean;
  employee?: Employee;
  allEmployees?: Employee[];
  requests?: LeaveRequest[];
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || '로그인에 실패했습니다.' };
    }
    if (data.token) {
      saveAdminToken(data.token);
    }
    return {
      success: true,
      employee: data.employee,
      allEmployees: data.allEmployees,
      requests: data.requests,
      token: data.token,
    };
  } catch (err) {
    return { success: false, error: '서버와 통신할 수 없습니다.' };
  }
}

// BroadcastChannel for instant multi-tab communication on the same device
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('yaksoo_hr_realtime_sync');
  }
} catch {
  syncChannel = null;
}

export function notifyBroadcastChannel(type: string, payload?: any) {
  try {
    if (syncChannel) {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }
}

export function subscribeToBroadcastChannel(callback: (msg: { type: string; payload?: any }) => void): () => void {
  try {
    if (syncChannel) {
      const handler = (e: MessageEvent) => {
        if (e.data) {
          callback(e.data);
        }
      };
      syncChannel.addEventListener('message', handler);
      return () => {
        syncChannel?.removeEventListener('message', handler);
      };
    }
  } catch {
    // Fallback
  }
  return () => {};
}

// Fetch persisted data from backend server DB
export async function fetchServerData(): Promise<{ employees: Employee[]; requests: LeaveRequest[] } | null> {
  try {
    const res = await fetch('/api/data?t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.employees) && Array.isArray(data.requests)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch from backend API, using local cache:', err);
  }
  return null;
}

export function getStoredEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(EMPLOYEES_KEY);
    if (!raw) {
      localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(INITIAL_EMPLOYEES));
      return INITIAL_EMPLOYEES;
    }
    const parsed: Employee[] = JSON.parse(raw);
    const sanitized: Employee[] = parsed
      .filter((e) => !MOCK_EMP_IDS.has(e.id) && !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && e.name !== '테스트계정')
      .map((e): Employee => {
        // Migrate admin name to 유정 and ensure admin password is 0410
        if (e.id === 'admin-001' || e.role === 'ADMIN' || e.name === '유과장님' || e.name?.includes('박센터장')) {
          return {
            ...e,
            name: '유정',
            password: e.password === '1234' ? '0410' : (e.password || '0410'),
            position: '센터운영과장 (관리자)',
            status: e.status || 'ACTIVE',
          };
        }
        return {
          ...e,
          loginId: e.loginId || e.id.replace('emp-', 'user'),
          password: e.password || '1234',
          calculationMode: e.calculationMode || 'AUTO',
          status: e.status || 'ACTIVE',
        };
      });

    // Ensure admin exists
    if (!sanitized.some((e) => e.role === 'ADMIN')) {
      sanitized.unshift(DEFAULT_ADMIN);
    }

    // Persist cleaned list back to localStorage
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return INITIAL_EMPLOYEES;
  }
}

export function saveStoredEmployees(employees: Employee[]) {
  try {
    const clean = employees.filter((e) => !MOCK_EMP_IDS.has(e.id) && !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && e.name !== '테스트계정');
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(clean));
    syncEmployeesToFirestore(clean).catch((e) => console.warn('Firestore employee sync error:', e));
    const reqs = getStoredRequests();
    syncToServer(clean, reqs);
  } catch (e) {
    console.error('Failed to save employees to localStorage', e);
  }
}

export function getStoredRequests(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    if (!raw) {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: LeaveRequest[] = JSON.parse(raw);
    const currentEmps = getStoredEmployees();
    const validEmpIds = new Set(currentEmps.map((e) => e.id));
    validEmpIds.add('admin-001');

    const sanitized = parsed
      .filter((r) => 
        !MOCK_EMP_IDS.has(r.employeeId) && 
        r.employeeName !== '유하늘' &&
        validEmpIds.has(r.employeeId) &&
        r.id !== 'req-1786779464228' &&
        !r.id?.startsWith('req-10') && 
        !r.id?.startsWith('req-20') && 
        !r.id?.startsWith('req-30') && 
        !r.id?.startsWith('req-today-')
      )
      .map((r) => {
        if (r.reviewedBy && (r.reviewedBy.includes('박센터장') || r.reviewedBy === '유과장님')) {
          return { ...r, reviewedBy: '유정' };
        }
        return r;
      });
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return [];
  }
}

export function saveStoredRequests(requests: LeaveRequest[]) {
  try {
    const currentEmps = getStoredEmployees();
    const validEmpIds = new Set(currentEmps.map((e) => e.id));
    validEmpIds.add('admin-001');

    const clean = requests.filter(
      (r) => 
        !MOCK_EMP_IDS.has(r.employeeId) && 
        r.employeeName !== '유하늘' &&
        validEmpIds.has(r.employeeId) &&
        r.id !== 'req-1786779464228' &&
        !r.id?.startsWith('req-10') && 
        !r.id?.startsWith('req-20') && 
        !r.id?.startsWith('req-30') && 
        !r.id?.startsWith('req-today-')
    );
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(clean));
    syncRequestsToFirestore(clean).catch((e) => console.warn('Firestore request sync error:', e));
    const emps = getStoredEmployees();
    syncToServer(emps, clean);
  } catch (e) {
    console.error('Failed to save requests to localStorage', e);
  }
}

export function getStoredCurrentUserId(): string | null {
  try {
    // Purge old persistent localStorage admin session so initial load is always Login Screen
    localStorage.removeItem(AUTH_SESSION_KEY);
    return sessionStorage.getItem(AUTH_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function saveStoredCurrentUserId(id: string | null) {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    if (id) {
      sessionStorage.setItem(AUTH_SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to save session user', e);
  }
}

export function resetAllData() {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(INITIAL_EMPLOYEES));
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(INITIAL_REQUESTS));
  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  cleanupFirestoreUnauthorizedData().catch(() => {});
  syncEmployeesToFirestore(INITIAL_EMPLOYEES).catch(() => {});
  syncRequestsToFirestore(INITIAL_REQUESTS).catch(() => {});
  fetch('/api/reset', { method: 'POST' }).catch(() => {});
}

// Security Audit & Clean Tool
export async function runSecurityAuditAndClean(): Promise<{ success: boolean; message: string }> {
  try {
    cleanupFirestoreUnauthorizedData().catch(() => {});
    const token = getAdminToken() || 'adm_master_session_default';
    const res = await fetch('/api/admin/clean-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
    });
    const data = await res.json();
    return { success: true, message: data.message || '데이터 보안 정화가 완료되었습니다.' };
  } catch (err: any) {
    return { success: false, message: err.message || '보안 정화 처리 중 오류가 발생했습니다.' };
  }
}
