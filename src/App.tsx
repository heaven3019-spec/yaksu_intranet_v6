import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Employee, LeaveRequest } from './types';
import { 
  getStoredCurrentUserId, 
  getStoredEmployees, 
  getStoredRequests, 
  resetAllData, 
  saveStoredCurrentUserId, 
  saveStoredEmployees, 
  saveStoredRequests,
  fetchServerData,
  postSingleRequestToServer,
  postSingleEmployeeToServer,
  subscribeToBroadcastChannel,
  syncToServer,
  runSecurityAuditAndClean,
  MOCK_EMP_IDS,
  MOCK_LOGIN_IDS
} from './utils/storage';
import {
  saveEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  saveLeaveRequestToFirestore, 
  deleteLeaveRequestToFirestore,
  subscribeToFirestoreEmployees,
  subscribeToFirestoreRequests,
  syncEmployeesToFirestore,
  syncRequestsToFirestore,
  fetchAllFromFirestore,
  cleanupFirestoreUnauthorizedData
} from './lib/firebase';
import { calculateEmployeeCycles } from './utils/leaveCalculator';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { AdminOverviewDashboard } from './components/AdminOverviewDashboard';
import { TodayLeaveStatusView } from './components/TodayLeaveStatusView';
import { YearlyLeaveView } from './components/YearlyLeaveView';
import { AdminApprovalView } from './components/AdminApprovalView';
import { AdminEmployeeList } from './components/AdminEmployeeList';
import { CompanyCalendarView } from './components/CompanyCalendarView';
import { LeaveRequestModal } from './components/LeaveRequestModal';
import { LeaveDocumentPrintModal } from './components/LeaveDocumentPrintModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { CheckCircle2, AlertCircle, X, FileText } from 'lucide-react';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [printTargetRequest, setPrintTargetRequest] = useState<LeaveRequest | undefined>(undefined);

  // Yearly view targeted employee and cycle
  const [selectedYearlyEmployeeId, setSelectedYearlyEmployeeId] = useState<string>('');
  const [targetedCycleIndex, setTargetedCycleIndex] = useState<number | undefined>(undefined);
  const [adminYearlyModalEmp, setAdminYearlyModalEmp] = useState<Employee | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronized refs to avoid stale state in polling loop
  const requestsRef = useRef<LeaveRequest[]>([]);
  const employeesRef = useRef<Employee[]>([]);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Server sync function with real-time change detection & alerts
  const syncWithServer = useCallback(async (isInitial = false) => {
    const serverData = await fetchServerData();
    if (!serverData || !Array.isArray(serverData.requests) || !Array.isArray(serverData.employees)) {
      return;
    }

    const prevReqs = requestsRef.current;
    const prevEmps = employeesRef.current;
    const currentUid = currentUserIdRef.current;
    const currentUser = prevEmps.find((e) => e.id === currentUid);

    const reqsChanged = JSON.stringify(prevReqs) !== JSON.stringify(serverData.requests);
    const empsChanged = JSON.stringify(prevEmps) !== JSON.stringify(serverData.employees);

    if (reqsChanged || empsChanged) {
      if (!isInitial) {
        // If logged-in user is ADMIN, detect and alert on new pending requests in real time
        if (currentUser?.role === 'ADMIN') {
          const newPending = serverData.requests.filter(
            (sr) => sr.status === 'PENDING' && !prevReqs.some((pr) => pr.id === sr.id)
          );
          if (newPending.length > 0) {
            const latest = newPending[0];
            showToast(
              `🔔 [실시간 신청] ${latest.employeeName}님이 ${latest.startDate} 연차(${latest.daysCount}일)를 신청했습니다!`,
              'info'
            );
          }
        } else if (currentUser?.role === 'EMPLOYEE') {
          // If logged-in user is EMPLOYEE, alert when their pending request status changes
          const myResolved = serverData.requests.find(
            (sr) =>
              sr.employeeId === currentUid &&
              prevReqs.some((pr) => pr.id === sr.id && pr.status === 'PENDING' && sr.status !== 'PENDING')
          );
          if (myResolved) {
            showToast(
              `🔔 [결재 완료] ${myResolved.startDate} 연차 신청이 ${myResolved.status === 'APPROVED' ? '승인' : '반려'}되었습니다!`,
              myResolved.status === 'APPROVED' ? 'success' : 'info'
            );
          }
        }
      }

      if (reqsChanged) {
        setRequests(serverData.requests);
        try {
          localStorage.setItem('hr_intranet_requests_v3', JSON.stringify(serverData.requests));
        } catch {}
      }
      if (empsChanged) {
        setEmployees(serverData.employees);
        try {
          localStorage.setItem('hr_intranet_employees_v3', JSON.stringify(serverData.employees));
        } catch {}
      }
    }
  }, [showToast]);

  // Load initial data from Firestore & establish real-time background sync
  useEffect(() => {
    let isMounted = true;
    let unsubFirestoreEmps: (() => void) | null = null;
    let unsubFirestoreReqs: (() => void) | null = null;

    const initializeAppData = async () => {
      try {
        // Step 1: Query Cloud Firestore and Backend Express DB in parallel
        let cloudData: { employees: Employee[]; requests: LeaveRequest[] } | null = null;
        try {
          cloudData = await fetchAllFromFirestore();
        } catch (e) {
          console.warn('Firestore initialization fetch warning:', e);
        }

        let serverData: { employees?: Employee[]; requests?: LeaveRequest[] } | null = null;
        try {
          serverData = await fetchServerData();
        } catch (e) {
          console.warn('Server initialization fetch warning:', e);
        }

        // Step 0: Purge residual unauthorized test documents from Firestore
        cleanupFirestoreUnauthorizedData().catch(() => {});

        // Prioritize authoritative Cloud Firestore data, then Server, then local
        const empMap = new Map<string, Employee>();
        const isCleanEmp = (e: Employee) => 
          !MOCK_EMP_IDS.has(e.id) && 
          !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && 
          e.name !== '테스트계정';

        if (cloudData?.employees && Array.isArray(cloudData.employees) && cloudData.employees.length > 0) {
          cloudData.employees.filter(isCleanEmp).forEach((e) => empMap.set(e.id, e));
        } else if (serverData?.employees && Array.isArray(serverData.employees) && serverData.employees.length > 0) {
          serverData.employees.filter(isCleanEmp).forEach((e) => empMap.set(e.id, e));
        } else {
          getStoredEmployees().filter(isCleanEmp).forEach((e) => empMap.set(e.id, e));
        }

        let currentEmps = Array.from(empMap.values());
        if (currentEmps.length === 0) {
          currentEmps = getStoredEmployees();
        }

        // Migrate admin name to '유정'
        currentEmps = currentEmps.map((e) => {
          if (e.id === 'admin-001' || e.role === 'ADMIN' || e.name === '유과장님' || e.name?.includes('박센터장')) {
            return { ...e, name: '유정', position: '센터운영과장 (관리자)' };
          }
          return e;
        });

        // Valid employee ID set for relational integrity
        const validEmpIdSet = new Set(currentEmps.map((e) => e.id));
        validEmpIdSet.add('admin-001');

        // Filter valid requests - only requests belonging to recognized, registered employees
        const isCleanReq = (r: LeaveRequest) => 
          !MOCK_EMP_IDS.has(r.employeeId) && 
          r.employeeName !== '유하늘' &&
          r.id !== 'req-1786779464228' &&
          validEmpIdSet.has(r.employeeId) &&
          !r.id?.startsWith('req-10') && 
          !r.id?.startsWith('req-20') && 
          !r.id?.startsWith('req-30') && 
          !r.id?.startsWith('req-today-');

        // Prioritize authoritative Cloud Firestore requests
        const reqMap = new Map<string, LeaveRequest>();
        if (cloudData?.requests && Array.isArray(cloudData.requests)) {
          cloudData.requests.filter(isCleanReq).forEach((r) => reqMap.set(r.id, r));
        } else if (serverData?.requests && Array.isArray(serverData.requests)) {
          serverData.requests.filter(isCleanReq).forEach((r) => reqMap.set(r.id, r));
        } else {
          getStoredRequests().filter(isCleanReq).forEach((r) => reqMap.set(r.id, r));
        }

        let currentReqs = Array.from(reqMap.values());

        if (!isMounted) return;

        setEmployees(currentEmps);
        setRequests(currentReqs);
        saveStoredEmployees(currentEmps);
        saveStoredRequests(currentReqs);

        // Step 2: Resolve authentication session
        const loadedUserId = getStoredCurrentUserId();
        if (loadedUserId && currentEmps.some((e) => e.id === loadedUserId)) {
          setCurrentUserId(loadedUserId);
          const user = currentEmps.find((e) => e.id === loadedUserId);
          if (user?.role === 'ADMIN') {
            setActiveTab('approval');
          } else {
            setActiveTab('dashboard');
          }
          setSelectedYearlyEmployeeId(loadedUserId);
        } else {
          setCurrentUserId(null);
          saveStoredCurrentUserId(null);
        }
      } catch (err) {
        console.warn('Initialization failed, using local cache:', err);
        const localEmps = getStoredEmployees().filter((e) => !MOCK_EMP_IDS.has(e.id) && !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && e.name !== '테스트계정');
        const validLocalIds = new Set(localEmps.map((e) => e.id));
        validLocalIds.add('admin-001');

        const localReqs = getStoredRequests().filter((r) => 
          !MOCK_EMP_IDS.has(r.employeeId) && 
          r.employeeName !== '유하늘' &&
          r.id !== 'req-1786779464228' &&
          validLocalIds.has(r.employeeId)
        );
        setEmployees(localEmps);
        setRequests(localReqs);
        const loadedUserId = getStoredCurrentUserId();
        if (loadedUserId && localEmps.some((e) => e.id === loadedUserId)) {
          setCurrentUserId(loadedUserId);
          setSelectedYearlyEmployeeId(loadedUserId);
        }
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }

      // Step 3: Establish Real-time Firestore Listeners for multi-device sync
      unsubFirestoreEmps = subscribeToFirestoreEmployees((cloudEmps) => {
        if (!isMounted) return;
        if (cloudEmps && cloudEmps.length > 0) {
          const cleanEmps = cloudEmps.filter((e) => !MOCK_EMP_IDS.has(e.id) && !MOCK_LOGIN_IDS.has(e.loginId?.toLowerCase()) && e.name !== '테스트계정');
          setEmployees(cleanEmps);
          try {
            localStorage.setItem('hr_intranet_employees_v3', JSON.stringify(cleanEmps));
          } catch {}
        }
      });

      unsubFirestoreReqs = subscribeToFirestoreRequests((cloudReqs) => {
        if (!isMounted) return;
        if (cloudReqs) {
          const currentValidEmps = employeesRef.current;
          const validEmpIds = new Set(currentValidEmps.map((e) => e.id));
          validEmpIds.add('admin-001');

          const cleanReqs = cloudReqs.filter(
            (r) => 
              !MOCK_EMP_IDS.has(r.employeeId) && 
              r.employeeName !== '유하늘' &&
              r.id !== 'req-1786779464228' &&
              validEmpIds.has(r.employeeId) &&
              !r.id?.startsWith('req-10') && 
              !r.id?.startsWith('req-20') && 
              !r.id?.startsWith('req-30') && 
              !r.id?.startsWith('req-today-')
          );
          const prevReqs = requestsRef.current;
          const currentUid = currentUserIdRef.current;
          const currentUser = currentValidEmps.find((e) => e.id === currentUid);

          // Check for new requests in real time
          if (currentUser?.role === 'ADMIN') {
            const newPending = cleanReqs.filter(
              (cr) => cr.status === 'PENDING' && !prevReqs.some((pr) => pr.id === cr.id)
            );
            if (newPending.length > 0) {
              const latest = newPending[0];
              showToast(
                `🔔 [실시간 연차 신청] ${latest.employeeName}님이 ${latest.startDate} 연차(${latest.daysCount}일)를 신청했습니다!`,
                'info'
              );
            }
          } else if (currentUser?.role === 'EMPLOYEE') {
            const myResolved = cleanReqs.find(
              (cr) =>
                cr.employeeId === currentUid &&
                prevReqs.some((pr) => pr.id === cr.id && pr.status === 'PENDING' && cr.status !== 'PENDING')
            );
            if (myResolved) {
              showToast(
                `🔔 [결재 완료] ${myResolved.startDate} 연차 신청이 ${myResolved.status === 'APPROVED' ? '승인' : '반려'}되었습니다!`,
                myResolved.status === 'APPROVED' ? 'success' : 'info'
              );
            }
          }

          setRequests(cleanReqs);
          try {
            localStorage.setItem('hr_intranet_requests_v3', JSON.stringify(cleanReqs));
          } catch {}
        }
      });
    };

    initializeAppData();

    // Subscribe to BroadcastChannel for instant multi-tab sync on same machine
    const unsubBroadcast = subscribeToBroadcastChannel(() => {
      syncWithServer(false);
    });

    // Cross-tab storage event listener
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'hr_intranet_requests_v3' || e.key === 'hr_intranet_employees_v3') {
        syncWithServer(false);
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      isMounted = false;
      if (unsubFirestoreEmps) unsubFirestoreEmps();
      if (unsubFirestoreReqs) unsubFirestoreReqs();
      unsubBroadcast();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [syncWithServer, showToast]);

  // Sync to localStorage and backend
  const updateEmployees = (newEmps: Employee[]) => {
    setEmployees(newEmps);
    saveStoredEmployees(newEmps);
  };

  const updateRequests = (newReqs: LeaveRequest[]) => {
    setRequests(newReqs);
    saveStoredRequests(newReqs);
  };

  // Login handler
  const handleLoginSuccess = (emp: Employee, syncedEmployees?: Employee[], syncedRequests?: LeaveRequest[]) => {
    if (syncedEmployees && syncedEmployees.length > 0) {
      setEmployees(syncedEmployees);
      saveStoredEmployees(syncedEmployees);
    } else {
      setEmployees((prev) => {
        if (!prev.some((e) => e.id === emp.id)) {
          const next = [...prev, emp];
          saveStoredEmployees(next);
          return next;
        }
        return prev;
      });
    }

    if (syncedRequests && syncedRequests.length > 0) {
      setRequests(syncedRequests);
      saveStoredRequests(syncedRequests);
    }

    setCurrentUserId(emp.id);
    saveStoredCurrentUserId(emp.id);
    setSelectedYearlyEmployeeId(emp.id);
    if (emp.role === 'ADMIN') {
      setActiveTab('approval');
    } else {
      setActiveTab('dashboard');
    }
    showToast(`${emp.name}님, 환영합니다! 정상적으로 로그인되었습니다.`, 'success');
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUserId(null);
    saveStoredCurrentUserId(null);
    showToast('안전하게 로그아웃되었습니다.', 'info');
  };

  // Reset demo data
  const handleResetData = async () => {
    resetAllData();
    const emps = getStoredEmployees();
    const reqs = getStoredRequests();
    setEmployees(emps);
    setRequests(reqs);
    try {
      await syncEmployeesToFirestore(emps);
      await syncRequestsToFirestore(reqs);
    } catch (err) {
      console.error('Error resetting Firestore data:', err);
    }
    setCurrentUserId(null);
    saveStoredCurrentUserId(null);
    setSelectedYearlyEmployeeId('');
    showToast('초기 약수데이케어센터 샘플 데이터로 복원되었습니다. 로그인해주세요.', 'success');
  };

  // Apply Excel Imported Data (Requirement 2)
  const handleApplyExcelImport = async (newEmps: Employee[], newReqs: LeaveRequest[]) => {
    updateEmployees(newEmps);
    updateRequests(newReqs);
    try {
      await syncEmployeesToFirestore(newEmps);
      await syncRequestsToFirestore(newReqs);
      showToast(
        `기존 엑셀 연차대장이 Firestore 클라우드에 일괄 영구 저장되었습니다! (직원 ${newEmps.length}명, 사용기록 ${newReqs.length}건)`,
        'success'
      );
    } catch (err) {
      console.error('Error syncing excel to Firestore:', err);
      showToast('엑셀 데이터 반영 완료 (클라우드 동기화 확인 필요)', 'info');
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-base font-bold text-white mb-1">동작구립 약수데이케어센터</h3>
          <p className="text-xs text-blue-300 font-medium mb-3">연차 관리시스템</p>
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-700/60 rounded-full text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Firestore 데이터베이스 동기화 중...</span>
          </div>
        </div>
      </div>
    );
  }

  // Find currently authenticated employee
  const currentEmployee = employees.find((e) => e.id === currentUserId);

  // If not logged in, show login page
  if (!currentEmployee) {
    return (
      <>
        <LoginView employees={employees} onLoginSuccess={handleLoginSuccess} />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div
              className={`px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-xs font-medium ${
                toastMessage.type === 'success'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-blue-600 text-white border-blue-700'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  const isAdmin = currentEmployee.role === 'ADMIN';

  // Role guard: if employee is on admin-only tab, redirect to dashboard
  if (!isAdmin && (
    activeTab === 'admin-overview' || 
    activeTab === 'approval' || 
    activeTab === 'employees' || 
    activeTab === 'retired-employees' || 
    activeTab === 'today-status' || 
    activeTab === 'calendar'
  )) {
    setActiveTab('dashboard');
  }

  // Admin guard: if admin is on removed tabs, redirect to admin-overview
  if (isAdmin && (
    activeTab === 'calendar' || 
    activeTab === 'dashboard' || 
    activeTab === 'retired-employees' ||
    activeTab === 'yearly'
  )) {
    setActiveTab('admin-overview');
  }

  // Filter requests according to User Privacy Rule:
  // - EMPLOYEE can ONLY see their own requests in personal views
  // - ADMIN can see ALL requests
  const userVisibleRequests = isAdmin
    ? requests
    : requests.filter((r) => r.employeeId === currentEmployee.id);

  // Target employee for 1-year view (Employee personal view)
  const yearlyEmployee = isAdmin
    ? employees.find((e) => e.id === selectedYearlyEmployeeId) || currentEmployee
    : currentEmployee;

  // Leave cycles calculation
  const currentEmpCycles = calculateEmployeeCycles(currentEmployee, requests);
  const currentEmpActiveCycle = currentEmpCycles.find((c) => c.isCurrent) || currentEmpCycles[0] || null;

  const yearlyEmpCycles = calculateEmployeeCycles(yearlyEmployee, requests);

  // Pending requests count for badge
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  // Submit Leave Request (with strict validation)
  const handleSubmitLeaveRequest = async (data: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => {
    // 1. Strict relational check: Target employee must be registered in the system
    const targetEmp = employees.find((e) => e.id === data.employeeId);
    if (!targetEmp) {
      showToast('등록되지 않은 직원은 연차를 신청할 수 없습니다. 관리자에게 먼저 등록을 요청하세요.', 'error');
      return;
    }

    if (targetEmp.status === 'RETIRED') {
      showToast('퇴사 처리된 직원은 연차를 신청할 수 없습니다.', 'error');
      return;
    }

    const newReq: LeaveRequest = {
      ...data,
      employeeName: targetEmp.name, // Guarantee name integrity with registered record
      id: `req-${Date.now()}`,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    const newReqs = [newReq, ...requests];
    updateRequests(newReqs);

    try {
      await postSingleRequestToServer(newReq);
      showToast(`연차 신청이 완료되었습니다! 관리자 승인 대기 중입니다.`, 'success');
    } catch (err: any) {
      console.error('Error saving leave request:', err);
      // Revert optimistic update on failure
      setRequests(requests);
      showToast(err?.message || '연차 신청 서버 접수에 실패했습니다.', 'error');
    }
  };

  // Admin Approve Request
  const handleApproveRequest = async (requestId: string, adminName: string) => {
    const target = requests.find((r) => r.id === requestId);
    const updatedReq: LeaveRequest | undefined = target
      ? {
          ...target,
          status: 'APPROVED' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy: adminName,
        }
      : undefined;

    const updated = requests.map((r) => (r.id === requestId && updatedReq ? updatedReq : r));
    updateRequests(updated);

    if (updatedReq) {
      try {
        await saveLeaveRequestToFirestore(updatedReq);
      } catch (err) {
        console.error('Error updating leave request in Firestore:', err);
      }
    }
    showToast(`연차 신청 건이 성공적으로 결재 승인되었습니다.`, 'success');
  };

  // Admin Reject Request
  const handleRejectRequest = async (requestId: string, adminName: string, reason: string) => {
    const target = requests.find((r) => r.id === requestId);
    const updatedReq: LeaveRequest | undefined = target
      ? {
          ...target,
          status: 'REJECTED' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy: adminName,
          rejectReason: reason,
        }
      : undefined;

    const updated = requests.map((r) => (r.id === requestId && updatedReq ? updatedReq : r));
    updateRequests(updated);

    if (updatedReq) {
      try {
        await saveLeaveRequestToFirestore(updatedReq);
      } catch (err) {
        console.error('Error updating leave request in Firestore:', err);
      }
    }
    showToast(`연차 신청 건이 반려 처리되었습니다.`, 'info');
  };

  // Cancel Approved Request (Admin only - individual)
  const handleCancelApproved = async (requestId: string, adminName: string, reason?: string) => {
    const target = requests.find((r) => r.id === requestId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const updatedReq: LeaveRequest = {
      ...target,
      status: 'CANCELLED',
      reviewedBy: adminName,
      cancelledAt: nowIso,
      cancelReason: reason || '관리자 연차 승인 취소',
    };

    const updated = requests.map((r) => (r.id === requestId ? updatedReq : r));
    updateRequests(updated);

    try {
      await saveLeaveRequestToFirestore(updatedReq);
    } catch (err) {
      console.error('Error cancelling approved leave request in Firestore:', err);
    }
    showToast(`승인된 연차가 취소되었습니다. (연차 잔여일수 자동 복구)`, 'info');
  };

  // Bulk Cancel Approved Requests (Admin only - multiple)
  const handleBulkCancelApproved = async (requestIds: string[], adminName: string, reason?: string) => {
    if (!requestIds || requestIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const updatedList: LeaveRequest[] = [];
    const updated = requests.map((r) => {
      if (requestIds.includes(r.id)) {
        const item: LeaveRequest = {
          ...r,
          status: 'CANCELLED',
          reviewedBy: adminName,
          cancelledAt: nowIso,
          cancelReason: reason || '관리자 일괄 승인 취소',
        };
        updatedList.push(item);
        return item;
      }
      return r;
    });

    updateRequests(updated);

    for (const item of updatedList) {
      try {
        await saveLeaveRequestToFirestore(item);
      } catch (err) {
        console.error('Error bulk cancelling leave request in Firestore:', err);
      }
    }
    showToast(`선택된 ${requestIds.length}건이 일괄 승인 취소되었습니다.`, 'info');
  };

  // Delete a single leave request record (Admin only - e.g. from cancelled history)
  const handleDeleteRequest = async (requestId: string) => {
    const updated = requests.filter((r) => r.id !== requestId);
    updateRequests(updated);

    try {
      await deleteLeaveRequestToFirestore(requestId);
    } catch (err) {
      console.error('Error deleting leave request from Firestore:', err);
    }
    showToast('취소 내역이 영구 삭제되었습니다.', 'info');
  };

  // Bulk delete leave request records (Admin only - e.g. from cancelled history)
  const handleBulkDeleteRequests = async (requestIds: string[]) => {
    if (!requestIds || requestIds.length === 0) return;
    const updated = requests.filter((r) => !requestIds.includes(r.id));
    updateRequests(updated);

    for (const id of requestIds) {
      try {
        await deleteLeaveRequestToFirestore(id);
      } catch (err) {
        console.error('Error bulk deleting leave requests from Firestore:', err);
      }
    }
    showToast(`${requestIds.length}건의 취소 내역이 영구 삭제되었습니다.`, 'info');
  };

  // Cancel Request (by Employee)
  const handleCancelRequest = async (requestId: string) => {
    const target = requests.find((r) => r.id === requestId);
    const updatedReq: LeaveRequest | undefined = target
      ? {
          ...target,
          status: 'CANCELLED' as const,
        }
      : undefined;

    const updated = requests.map((r) => (r.id === requestId && updatedReq ? updatedReq : r));
    updateRequests(updated);

    if (updatedReq) {
      try {
        await saveLeaveRequestToFirestore(updatedReq);
      } catch (err) {
        console.error('Error cancelling leave request in Firestore:', err);
      }
    }
    showToast(`연차 신청이 취소되었습니다.`, 'info');
  };

  // Add Employee (Admin only)
  const handleAddEmployee = async (newEmpData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}`,
    };
    const newEmps = [...employees, newEmp];
    updateEmployees(newEmps);
    try {
      await postSingleEmployeeToServer(newEmp);
      showToast(`'${newEmp.name}' 직원이 클라우드 및 시스템 데이터베이스에 안전하게 등록되었습니다. (로그인 ID: ${newEmp.loginId})`, 'success');
    } catch (err) {
      console.error('Save employee error:', err);
      showToast(`'${newEmp.name}' 직원이 등록되었습니다.`, 'info');
    }
  };

  // Update Employee (Admin only)
  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    const newEmps = employees.map((e) => (e.id === updatedEmp.id ? updatedEmp : e));
    updateEmployees(newEmps);
    try {
      await postSingleEmployeeToServer(updatedEmp);
      showToast(`'${updatedEmp.name}' 직원 정보가 클라우드 및 시스템 데이터베이스에 성공적으로 수정되었습니다.`, 'success');
    } catch (err) {
      console.error('Update employee error:', err);
      showToast(`'${updatedEmp.name}' 직원 정보가 수정되었습니다.`, 'info');
    }
  };

  // Delete Employee (Admin only)
  const handleDeleteEmployee = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    const newEmps = employees.filter((e) => e.id !== empId);
    const newReqs = requests.filter((r) => r.employeeId !== empId);
    updateEmployees(newEmps);
    updateRequests(newReqs);
    try {
      await deleteEmployeeFromFirestore(empId);
      const targetReqs = requests.filter((r) => r.employeeId === empId);
      for (const req of targetReqs) {
        await deleteLeaveRequestToFirestore(req.id).catch(() => {});
      }
      showToast(`'${target?.name || ''}' 직원이 클라우드에서 완전히 삭제되었습니다.`, 'info');
    } catch (err) {
      console.error('Firestore delete employee error:', err);
      showToast(`'${target?.name || ''}' 직원이 삭제되었습니다.`, 'info');
    }
  };

  // Retire Employee (Admin only)
  const handleRetireEmployee = async (empId: string, retiredDate: string) => {
    const target = employees.find((e) => e.id === empId);
    const updatedEmp: Employee | undefined = target
      ? { ...target, status: 'RETIRED' as const, retiredDate }
      : undefined;

    if (updatedEmp) {
      const newEmps = employees.map((e) => (e.id === empId ? updatedEmp : e));
      updateEmployees(newEmps);
      try {
        await saveEmployeeToFirestore(updatedEmp);
      } catch (err) {
        console.error('Firestore retire employee error:', err);
      }
      showToast(`'${target?.name || ''}' 직원이 퇴사자로 분류되었습니다.`, 'info');
    }
  };

  // Restore Employee (Admin only)
  const handleRestoreEmployee = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    const updatedEmp: Employee | undefined = target
      ? { ...target, status: 'ACTIVE' as const, retiredDate: undefined }
      : undefined;

    if (updatedEmp) {
      const newEmps = employees.map((e) => (e.id === empId ? updatedEmp : e));
      updateEmployees(newEmps);
      try {
        await saveEmployeeToFirestore(updatedEmp);
      } catch (err) {
        console.error('Firestore restore employee error:', err);
      }
      showToast(`'${target?.name || ''}' 직원이 재직자로 정상 복원되었습니다.`, 'success');
    }
  };

  // Switch to Yearly Detail View with cycle
  const handleViewYearlyDetail = (cycleIndex: number) => {
    setSelectedYearlyEmployeeId(currentEmployee.id);
    setTargetedCycleIndex(cycleIndex);
    setActiveTab('yearly');
  };

  // Open Print Modal
  const handleOpenPrintModal = (req?: LeaveRequest) => {
    setPrintTargetRequest(req);
    setIsPrintModalOpen(true);
  };

  // Manual Sync trigger (Pulls fresh from Firestore & backend with Security Audit)
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await runSecurityAuditAndClean();
      const cloudData = await fetchAllFromFirestore();
      if (cloudData && cloudData.employees && cloudData.employees.length > 0) {
        setEmployees(cloudData.employees);
        setRequests(cloudData.requests || []);
        saveStoredEmployees(cloudData.employees);
        saveStoredRequests(cloudData.requests || []);
      }
    } catch (e) {
      console.warn('Firestore manual fetch warning:', e);
    }
    await syncWithServer(false);
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
    showToast('보안 감사 완료: 비인가 데이터 정화 및 최신 데이터 동기화가 완료되었습니다.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation with Auth state and tabs */}
      <Navbar
        currentEmployee={currentEmployee}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingCount={pendingCount}
        onLogout={handleLogout}
        onResetData={handleResetData}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Tab: 전사 종합 대시보드 (Admin only) */}
        {isAdmin && activeTab === 'admin-overview' && (
          <AdminOverviewDashboard
            employees={employees}
            requests={requests}
            onOpenAddEmployee={() => setActiveTab('employees')}
            onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
            onSelectEmployeeForYearly={(emp) => {
              setAdminYearlyModalEmp(emp);
            }}
            onNavigateToApproval={() => setActiveTab('approval')}
            onNavigateToEmployeeList={() => setActiveTab('employees')}
          />
        )}

        {/* Tab: 오늘의 연차 사용 현황 (Admin only) */}
        {isAdmin && activeTab === 'today-status' && (
          <TodayLeaveStatusView
            requests={requests}
            employees={employees}
            currentEmployee={currentEmployee}
            onOpenLeaveRequest={() => setIsRequestModalOpen(true)}
          />
        )}

        {/* Tab: 내 연차 현황 & 신청 (Employee personal view) */}
        {!isAdmin && activeTab === 'dashboard' && (
          <EmployeeDashboard
            employee={currentEmployee}
            currentCycle={currentEmpActiveCycle}
            allCycles={currentEmpCycles}
            requests={userVisibleRequests}
            onOpenRequestModal={() => setIsRequestModalOpen(true)}
            onCancelRequest={handleCancelRequest}
            onViewYearlyDetail={handleViewYearlyDetail}
            onOpenPrintModal={handleOpenPrintModal}
          />
        )}

        {/* Tab: 내 1년 연차대장 조회 (Employee personal view) */}
        {!isAdmin && activeTab === 'yearly' && (
          <YearlyLeaveView
            employees={[currentEmployee]}
            selectedEmployee={currentEmployee}
            onSelectEmployee={(emp) => setSelectedYearlyEmployeeId(emp.id)}
            cycles={yearlyEmpCycles}
            requests={userVisibleRequests}
            initialCycleIndex={targetedCycleIndex}
            onOpenPrintModal={handleOpenPrintModal}
            currentUserRole={currentEmployee.role}
          />
        )}

        {/* Tab: 관리자 결재 승인 (Admin only) */}
        {isAdmin && activeTab === 'approval' && (
          <AdminApprovalView
            requests={requests}
            employees={employees}
            currentAdmin={currentEmployee}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onCancelApproved={handleCancelApproved}
            onBulkCancelApproved={handleBulkCancelApproved}
            onDeleteRequest={handleDeleteRequest}
            onBulkDeleteRequests={handleBulkDeleteRequests}
          />
        )}

        {/* Tab: 전사 직원 연차 및 입사일 관리 & 퇴사자 관리 (Admin only) */}
        {isAdmin && activeTab === 'employees' && (
          <AdminEmployeeList
            employees={employees}
            requests={requests}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onRetireEmployee={handleRetireEmployee}
            onRestoreEmployee={handleRestoreEmployee}
            onSelectEmployeeForYearly={(emp) => {
              setAdminYearlyModalEmp(emp);
            }}
          />
        )}
      </main>

      {/* Admin Quick Employee 1-Year Ledger Modal */}
      {isAdmin && adminYearlyModalEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 my-4 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base">
                    '{adminYearlyModalEmp.name}' 직원의 1년 연차유급휴가 관리대장
                  </h3>
                  <p className="text-xs text-slate-300">
                    직급: {adminYearlyModalEmp.position} · 입사일: {adminYearlyModalEmp.joinDate.replace(/-/g, '.')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setAdminYearlyModalEmp(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50">
              <YearlyLeaveView
                employees={employees}
                selectedEmployee={adminYearlyModalEmp}
                onSelectEmployee={(emp) => setAdminYearlyModalEmp(emp)}
                cycles={calculateEmployeeCycles(adminYearlyModalEmp, requests)}
                requests={requests}
                onOpenPrintModal={handleOpenPrintModal}
                currentUserRole="ADMIN"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center">
          <p>© 2026 동작구립 약수데이케어센터 · 입사일 기준 법정 연차유급휴가 관리 시스템</p>
        </div>
      </footer>

      {/* Leave Request Modal */}
      {isRequestModalOpen && (
        <LeaveRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          employee={currentEmployee}
          currentCycle={currentEmpActiveCycle}
          onSubmit={handleSubmitLeaveRequest}
        />
      )}

      {/* Document Print Modal */}
      {isPrintModalOpen && (
        <LeaveDocumentPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          employee={yearlyEmployee}
          currentCycle={currentEmpActiveCycle}
          selectedRequest={printTargetRequest}
        />
      )}

      {/* Excel Import Modal (Requirement 2) */}
      {isExcelImportModalOpen && (
        <ExcelImportModal
          isOpen={isExcelImportModalOpen}
          onClose={() => setIsExcelImportModalOpen(false)}
          existingEmployees={employees}
          existingRequests={requests}
          onApplyImport={handleApplyExcelImport}
        />
      )}

      {/* Interactive Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-xs font-medium ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-blue-600 text-white border-blue-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/70 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
