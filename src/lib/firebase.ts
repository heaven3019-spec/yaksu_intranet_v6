import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { Employee, LeaveRequest } from '../types';
import rawFirebaseConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

// Support both static bundled json and environment variables (for Vercel deployments)
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || rawFirebaseConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || rawFirebaseConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || rawFirebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || rawFirebaseConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || rawFirebaseConfig.appId,
  firestoreDatabaseId: (rawFirebaseConfig as any).firestoreDatabaseId || '(default)',
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with specified database ID
export const db = getFirestore(
  app, 
  firebaseConfig.firestoreDatabaseId
);

export const EMPLOYEES_COLLECTION = 'employees';
export const REQUESTS_COLLECTION = 'leave_requests';

// Security blacklist to reject any legacy sample or mock data
const BLOCKED_EMP_IDS = new Set([
  'emp-001', 
  'emp-002', 
  'emp-003', 
  'emp-004', 
  'emp-1788672814213', 
  'emp-1786779270075'
]);
const BLOCKED_REQ_PREFIXES = ['req-10', 'req-20', 'req-30', 'req-today-', 'req-1786779464228'];

/**
 * Utility to strip undefined properties recursively from objects before passing to Firestore
 * Firestore rejects documents containing undefined values with 'Unsupported field value: undefined'
 */
export function sanitizeForFirestore<T>(data: T): Record<string, any> {
  if (data === null || data === undefined) return {};
  return JSON.parse(JSON.stringify(data));
}

/**
 * Save or update a single employee directly in Firestore (setDoc)
 */
export async function saveEmployeeToFirestore(employee: Employee): Promise<void> {
  if (BLOCKED_EMP_IDS.has(employee.id) || employee.name === '테스트계정') {
    console.warn('[Firestore Security] Blocked mock/test employee from being saved:', employee.id);
    return;
  }
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employee.id);
    const cleanData = sanitizeForFirestore(employee);
    await setDoc(docRef, cleanData, { merge: true });
    console.log('[Firestore] Successfully saved employee:', employee.id, employee.loginId);
  } catch (err) {
    console.error('[Firestore] Error saving employee to Firestore:', err);
    throw err;
  }
}

/**
 * Delete a single employee directly from Firestore (deleteDoc)
 */
export async function deleteEmployeeFromFirestore(employeeId: string): Promise<void> {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    await deleteDoc(docRef);
    console.log('[Firestore] Successfully deleted employee:', employeeId);
  } catch (err) {
    console.error('[Firestore] Error deleting employee from Firestore:', err);
    throw err;
  }
}

/**
 * Save single leave request directly to Firestore (setDoc)
 */
export async function saveLeaveRequestToFirestore(request: LeaveRequest): Promise<void> {
  if (
    BLOCKED_EMP_IDS.has(request.employeeId) || 
    request.employeeName === '유하늘' ||
    BLOCKED_REQ_PREFIXES.some((p) => request.id?.startsWith(p))
  ) {
    console.warn('[Firestore Security] Blocked mock/unauthorized leave request from being saved:', request.id);
    return;
  }
  try {
    const docRef = doc(db, REQUESTS_COLLECTION, request.id);
    const cleanData = sanitizeForFirestore(request);
    await setDoc(docRef, cleanData, { merge: true });
    console.log('[Firestore] Successfully saved leave request:', request.id);
  } catch (err) {
    console.error('[Firestore] Error saving leave request to Firestore:', err);
    throw err;
  }
}

/**
 * Delete single leave request directly from Firestore (deleteDoc)
 */
export async function deleteLeaveRequestToFirestore(requestId: string): Promise<void> {
  try {
    const docRef = doc(db, REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
    console.log('[Firestore] Successfully deleted leave request:', requestId);
  } catch (err) {
    console.error('[Firestore] Error deleting leave request from Firestore:', err);
    throw err;
  }
}

/**
 * Real-time Firestore synchronization subscription for Employees
 */
export function subscribeToFirestoreEmployees(
  onUpdate: (employees: Employee[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const collRef = collection(db, EMPLOYEES_COLLECTION);
    return onSnapshot(
      collRef,
      (snapshot) => {
        const emps: Employee[] = [];
        snapshot.forEach((docSnap) => {
          const emp = docSnap.data() as Employee;
          if (!BLOCKED_EMP_IDS.has(emp.id) && emp.name !== '테스트계정') {
            emps.push(emp);
          }
        });
        if (emps.length > 0) {
          onUpdate(emps);
        }
      },
      (error) => {
        console.warn('Firestore employees snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.warn('Failed to init Firestore employees subscription:', e);
    return () => {};
  }
}

/**
 * Real-time Firestore synchronization subscription for Leave Requests
 */
export function subscribeToFirestoreRequests(
  onUpdate: (requests: LeaveRequest[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const collRef = collection(db, REQUESTS_COLLECTION);
    return onSnapshot(
      collRef,
      (snapshot) => {
        const reqs: LeaveRequest[] = [];
        snapshot.forEach((docSnap) => {
          const req = docSnap.data() as LeaveRequest;
          if (
            !BLOCKED_EMP_IDS.has(req.employeeId) && 
            req.employeeName !== '유하늘' &&
            !BLOCKED_REQ_PREFIXES.some((p) => req.id?.startsWith(p))
          ) {
            reqs.push(req);
          }
        });
        // Sort descending by requestedAt
        reqs.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
        onUpdate(reqs);
      },
      (error) => {
        console.warn('Firestore requests snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.warn('Failed to init Firestore requests subscription:', e);
    return () => {};
  }
}

/**
 * Batch sync all employees to Firestore
 */
export async function syncEmployeesToFirestore(employees: Employee[]): Promise<void> {
  const cleanEmployees = employees?.filter(
    (e) => !BLOCKED_EMP_IDS.has(e.id) && e.name !== '테스트계정'
  );
  if (!cleanEmployees || cleanEmployees.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const emp of cleanEmployees) {
      const docRef = doc(db, EMPLOYEES_COLLECTION, emp.id);
      const cleanData = sanitizeForFirestore(emp);
      batch.set(docRef, cleanData, { merge: true });
    }
    await batch.commit();
    console.log('[Firestore] Batch synced employees count:', cleanEmployees.length);
  } catch (err) {
    console.error('[Firestore] Error batch syncing employees to Firestore:', err);
  }
}

/**
 * Batch sync all requests to Firestore
 */
export async function syncRequestsToFirestore(requests: LeaveRequest[]): Promise<void> {
  const cleanRequests = requests?.filter(
    (r) => !BLOCKED_EMP_IDS.has(r.employeeId) && 
           r.employeeName !== '유하늘' &&
           !BLOCKED_REQ_PREFIXES.some((p) => r.id?.startsWith(p))
  );
  if (!cleanRequests || cleanRequests.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const req of cleanRequests) {
      const docRef = doc(db, REQUESTS_COLLECTION, req.id);
      const cleanData = sanitizeForFirestore(req);
      batch.set(docRef, cleanData, { merge: true });
    }
    await batch.commit();
    console.log('[Firestore] Batch synced requests count:', cleanRequests.length);
  } catch (err) {
    console.error('[Firestore] Error batch syncing requests to Firestore:', err);
  }
}

/**
 * Cleanup any residual unauthorized test documents from Firestore
 */
export async function cleanupFirestoreUnauthorizedData(): Promise<void> {
  try {
    const toDeleteReqs = ['req-1786779464228'];
    const toDeleteEmps = ['emp-1788672814213', 'emp-1786779270075', 'emp-001', 'emp-002', 'emp-003', 'emp-004'];

    for (const reqId of toDeleteReqs) {
      deleteDoc(doc(db, REQUESTS_COLLECTION, reqId)).catch(() => {});
    }
    for (const empId of toDeleteEmps) {
      deleteDoc(doc(db, EMPLOYEES_COLLECTION, empId)).catch(() => {});
    }
  } catch (e) {
    console.warn('[Firestore] Cleanup warning:', e);
  }
}

/**
 * Fetch all employees and requests from Firestore at once
 */
export async function fetchAllFromFirestore(): Promise<{ employees: Employee[]; requests: LeaveRequest[] } | null> {
  try {
    const empSnap = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const reqSnap = await getDocs(collection(db, REQUESTS_COLLECTION));

    const employees: Employee[] = [];
    empSnap.forEach((docSnap) => {
      const emp = docSnap.data() as Employee;
      if (!BLOCKED_EMP_IDS.has(emp.id) && emp.name !== '테스트계정') {
        employees.push(emp);
      }
    });

    // Build valid emp id set
    const validEmpIdSet = new Set(employees.map(e => e.id));
    validEmpIdSet.add('admin-001');

    const requests: LeaveRequest[] = [];
    reqSnap.forEach((docSnap) => {
      const req = docSnap.data() as LeaveRequest;
      if (
        !BLOCKED_EMP_IDS.has(req.employeeId) && 
        req.employeeName !== '유하늘' &&
        validEmpIdSet.has(req.employeeId) &&
        !BLOCKED_REQ_PREFIXES.some((p) => req.id?.startsWith(p))
      ) {
        requests.push(req);
      }
    });
    requests.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());

    if (employees.length === 0 && requests.length === 0) {
      return null;
    }

    return { employees, requests };
  } catch (err) {
    console.warn('Error fetching all from Firestore:', err);
    return null;
  }
}
