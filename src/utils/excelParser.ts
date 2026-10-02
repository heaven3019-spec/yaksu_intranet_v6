import * as XLSX from 'xlsx';
import { Employee, LeaveRequest, LeaveType, LeaveStatus } from '../types';

export interface ParsedExcelResult {
  employees: Employee[];
  requests: LeaveRequest[];
  detectedEmployeeCount: number;
  detectedRequestCount: number;
  yearStats: { [year: string]: number }; // e.g. { '2024': 10, '2025': 25, '2026': 18 }
  employeeStats: { [empName: string]: { total: number; [year: string]: number } };
  sheetNames: string[];
  warnings: string[];
}

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function getDayOfWeekShort(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return KOREAN_DAY_NAMES[d.getDay()] || '';
}

/**
 * Format various date representations into YYYY-MM-DD
 */
export function normalizeExcelDate(val: any, defaultYear?: number | string): string {
  if (val === undefined || val === null || val === '') return '';

  // 1. If numeric (Excel serial date number or numeric string)
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{5}$/.test(val.trim()) ? Number(val.trim()) : NaN);
  if (!isNaN(numVal) && numVal > 25000 && numVal < 60000) {
    const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  let str = String(val).trim();
  if (!str) return '';

  // Clean trailing punctuation or brackets
  str = str.replace(/[()\[\]]/g, '').trim();

  // 2. Korean full format: 2025년 3월 15일, 2024년 10월 2일
  const koreanFull = str.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (koreanFull) {
    const y = koreanFull[1];
    const m = String(koreanFull[2]).padStart(2, '0');
    const d = String(koreanFull[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. Korean month-day format: 3월 15일 (with defaultYear)
  const koreanMD = str.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (koreanMD) {
    const y = defaultYear ? String(defaultYear).slice(0, 4) : '2025';
    const m = String(koreanMD[1]).padStart(2, '0');
    const d = String(koreanMD[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 4. Standard YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY. M. D.
  const standardMatch = str.match(/(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})\.?/);
  if (standardMatch) {
    const y = standardMatch[1];
    const m = String(standardMatch[2]).padStart(2, '0');
    const d = String(standardMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 5. 2-digit year format: 25.03.15, 24/09/25
  const shortYearMatch = str.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (shortYearMatch) {
    const y = `20${shortYearMatch[1]}`;
    const m = String(shortYearMatch[2]).padStart(2, '0');
    const d = String(shortYearMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 6. Month-Day format: "03-15", "3.15", "3/15"
  const mdMatch = str.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (mdMatch) {
    const y = defaultYear ? String(defaultYear).slice(0, 4) : '2025';
    const m = String(mdMatch[1]).padStart(2, '0');
    const d = String(mdMatch[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 7. Fallback try standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

/**
 * Map Korean leave type names to internal enum and default deduction
 */
export function normalizeLeaveType(typeStr: any): { type: LeaveType; daysCount: number } {
  const str = String(typeStr || '').trim().toLowerCase();

  if (str.includes('오전') || str.includes('am')) {
    return { type: 'HALF_AM', daysCount: 0.5 };
  }
  if (str.includes('오후') || str.includes('pm')) {
    return { type: 'HALF_PM', daysCount: 0.5 };
  }
  if (str.includes('반차') || str.includes('0.5')) {
    return { type: 'HALF_PM', daysCount: 0.5 };
  }
  if (str.includes('시간차') || str.includes('시간') || str.includes('외출') || str.includes('조퇴') || str.includes('hour')) {
    const match = str.match(/(\d+)\s*시간/);
    const hours = match ? parseInt(match[1], 10) : 1;
    return { type: 'HOURLY', daysCount: Number((hours * 0.125).toFixed(3)) };
  }
  if (str.includes('병가') || str.includes('sick')) {
    return { type: 'SICK', daysCount: 1 };
  }
  if (str.includes('경조') || str.includes('특별') || str.includes('경조사')) {
    return { type: 'SPECIAL', daysCount: 1 };
  }
  if (str.includes('공가') || str.includes('예비군') || str.includes('훈련')) {
    return { type: 'OFFICIAL', daysCount: 1 };
  }

  return { type: 'ANNUAL', daysCount: 1 };
}

/**
 * Normalize header label by removing spaces, dashes, brackets, etc.
 */
function cleanHeader(s: any): string {
  return String(s || '').replace(/[\s\-_()[\]·]/g, '').toLowerCase();
}

/**
 * Deterministically identify column role based on exact 10 standard columns + synonyms
 * Required 10 columns:
 * 1. 성명
 * 2. 직급
 * 3. 입사일
 * 4. 휴가구분
 * 5. 시작일자
 * 6. 종료일자
 * 7. 사용일수
 * 8. 신청사유
 * 9. 결제상태 (결재상태)
 * 10. 비상연락처
 */
function identifyColumnRole(rawVal: any): string | null {
  const h = cleanHeader(rawVal);
  if (!h) return null;

  // 1. 성명 (이름)
  if (h === '성명' || h === '이름' || h === '직원명' || h === '사원명' || h === '신청자' || h === '근로자' || h === '대상자' || h === '성명직급') {
    return 'name';
  }

  // 2. 직급
  if (h === '직급' || h === '직책' || h === '직위' || h === '부서' || h === '소속') {
    return 'position';
  }

  // 3. 입사일
  if (h === '입사일' || h === '입사일자' || h === '입사년월일' || h === '채용일' || h === '입사') {
    return 'joinDate';
  }

  // 4. 휴가구분
  if (h === '휴가구분' || h === '휴가종류' || h === '연차구분' || h === '연차종류' || h === '구분' || h === '종류' || h === '유형') {
    return 'type';
  }

  // 5. 시작일자
  if (h === '시작일자' || h === '시작일' || h === '휴가시작일' || h === '사용시작일' || h === '시작') {
    return 'startDate';
  }

  // 6. 종료일자
  if (h === '종료일자' || h === '종료일' || h === '휴가종료일' || h === '사용종료일' || h === '종료' || h === '끝일') {
    return 'endDate';
  }

  // Fallback single date column: 사용일자, 일자, 날짜, 휴가일자
  if (h === '사용일자' || h === '사용일' || h === '일자' || h === '날짜' || h === '휴가일자' || h === '휴가일' || h === '연차일자' || h === '기간') {
    return 'singleDate';
  }

  // 7. 사용일수
  if (h === '사용일수' || h === '차감일수' || h === '일수' || h === '사용일수일' || h === '차감일' || h === '일') {
    return 'days';
  }

  // 8. 신청사유
  if (h === '신청사유' || h === '사유' || h === '휴가사유' || h === '비고' || h === '내용' || h === '용무' || h === '목적') {
    return 'reason';
  }

  // 9. 결제상태 (결재상태)
  if (h === '결제상태' || h === '결재상태' || h === '상태' || h === '승인여부' || h === '결재' || h === '결제') {
    return 'status';
  }

  // 10. 비상연락처
  if (h === '비상연락처' || h === '연락처' || h === '전화번호' || h === '휴대폰' || h === '핸드폰') {
    return 'phone';
  }

  // Optional: 연도
  if (h === '연도' || h === '년도' || h === '귀속연도' || h === '기준연도') {
    return 'year';
  }

  return null;
}

/**
 * Universal Year-agnostic Excel Leave File Parser:
 * - Completely agnostic to any year (2024, 2025, 2026, 2027 etc.)
 * - Finds the real header row even if row 1 contains title banners or empty cells
 * - Maps the 10 standard columns accurately
 * - Automatically links or registers employees by name
 */
export async function parseExcelLeaveFile(
  fileData: ArrayBuffer | Uint8Array,
  existingEmployees: Employee[]
): Promise<ParsedExcelResult> {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const warnings: string[] = [];

  const parsedEmployees: Employee[] = [];
  const parsedRequests: LeaveRequest[] = [];
  const yearStats: { [year: string]: number } = {};
  const employeeStats: { [empName: string]: { total: number; [year: string]: number } } = {};

  // Build employee lookup cache
  const empMap = new Map<string, Employee>();
  existingEmployees.forEach((emp) => {
    empMap.set(emp.name.trim(), emp);
    empMap.set(emp.name.replace(/\(.*?\)/g, '').trim(), emp);
    empMap.set(cleanHeader(emp.name), emp);
  });

  const newlyCreatedEmpMap = new Map<string, Employee>();

  // Helper to resolve or auto-create employee
  const resolveEmployee = (rawName: string, position?: string, joinDate?: string, defaultYear?: string): Employee => {
    const trimmed = String(rawName || '').trim();
    const cleanKey = cleanHeader(trimmed);

    let emp = empMap.get(trimmed) || empMap.get(cleanKey);

    // Fuzzy matching
    if (!emp) {
      for (const [key, existing] of empMap.entries()) {
        if (cleanKey.length >= 2 && (key.includes(cleanKey) || cleanKey.includes(key))) {
          emp = existing;
          break;
        }
      }
    }

    if (!emp) {
      emp = newlyCreatedEmpMap.get(cleanKey);
    }

    if (!emp) {
      const cleanName = trimmed.replace(/\(.*?\)/g, '').trim();
      const fallbackJoinYear = defaultYear || '2024';
      const newEmp: Employee = {
        id: `emp-excel-${Date.now()}-${newlyCreatedEmpMap.size}`,
        loginId: `user_${cleanHeader(cleanName)}`,
        password: '1234',
        name: cleanName || trimmed,
        position: position || '직원',
        email: `${cleanHeader(cleanName)}@yaksoo.kr`,
        phone: '010-0000-0000',
        joinDate: joinDate && joinDate.length === 10 ? joinDate : `${fallbackJoinYear}-01-01`,
        role: trimmed.includes('관리자') || trimmed.includes('원장') || trimmed.includes('과장') ? 'ADMIN' : 'EMPLOYEE',
        status: 'ACTIVE',
        avatarColor: 'from-blue-500 to-indigo-600',
        calculationMode: 'AUTO',
        customNotes: '엑셀 연차대장 등록됨',
      };
      parsedEmployees.push(newEmp);
      newlyCreatedEmpMap.set(cleanKey, newEmp);
      empMap.set(cleanKey, newEmp);
      emp = newEmp;
    } else {
      if (joinDate && joinDate.length === 10 && (!emp.joinDate || emp.joinDate === '2025-01-01')) {
        emp.joinDate = joinDate;
      }
      if (position && (!emp.position || emp.position === '직원')) {
        emp.position = position;
      }
    }

    return emp;
  };

  // Process all sheets in the uploaded workbook
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Detect if sheet name contains a year (e.g. "2024", "2025", "2026")
    const sheetYearMatch = sheetName.match(/(20\d\d)/);
    const sheetYear = sheetYearMatch ? sheetYearMatch[1] : undefined;

    // Convert sheet to 2D array
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length === 0) continue;

    // ------------------------------------------------------------------------
    // Step 1: Find the Best Header Row (scan first 20 rows)
    // ------------------------------------------------------------------------
    let bestHeaderRowIdx = -1;
    let maxMatchCount = 0;
    let bestColMap: { [role: string]: number } = {};

    for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
      const row = rawRows[r];
      if (!row || !Array.isArray(row)) continue;

      const currentColMap: { [role: string]: number } = {};
      let matchCount = 0;

      for (let c = 0; c < row.length; c++) {
        const role = identifyColumnRole(row[c]);
        if (role && currentColMap[role] === undefined) {
          currentColMap[role] = c;
          matchCount++;
        }
      }

      // If this row has a 'name' column and at least 1 other recognized column (like date, type, or position)
      if (currentColMap['name'] !== undefined && matchCount >= 2 && matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestHeaderRowIdx = r;
        bestColMap = currentColMap;
      }
    }

    // If no header row found with 'name' and others, check row 0
    if (bestHeaderRowIdx === -1) {
      bestHeaderRowIdx = 0;
      bestColMap = {
        name: 0,
        position: 1,
        joinDate: 2,
        type: 3,
        startDate: 4,
        endDate: 5,
        days: 6,
        reason: 7,
        status: 8,
        phone: 9,
      };
    }

    // Resolve date column mapping
    if (bestColMap['startDate'] === undefined && bestColMap['singleDate'] !== undefined) {
      bestColMap['startDate'] = bestColMap['singleDate'];
    }
    if (bestColMap['endDate'] === undefined && bestColMap['singleDate'] !== undefined) {
      bestColMap['endDate'] = bestColMap['singleDate'];
    }

    // ------------------------------------------------------------------------
    // Step 2: Parse Data Rows
    // ------------------------------------------------------------------------
    const startRow = bestHeaderRowIdx + 1;

    for (let r = startRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const getCell = (role: string): string => {
        const idx = bestColMap[role];
        if (idx === undefined || idx >= row.length) return '';
        return String(row[idx] ?? '').trim();
      };

      const rawName = getCell('name');
      if (!rawName) continue;

      // Skip title, total, or subtotal rows
      if (rawName.includes('합계') || rawName.includes('총계') || rawName.includes('소계') || rawName === '평균' || rawName.includes('연차관리대장')) {
        continue;
      }

      const rawPosition = getCell('position') || '직원';
      const rawJoinDate = getCell('joinDate');
      const normalizedJoinDate = rawJoinDate ? normalizeExcelDate(rawJoinDate, sheetYear) : '';
      const rawType = getCell('type');
      const rawStartDate = getCell('startDate');
      const rawEndDate = getCell('endDate') || rawStartDate;
      const rawDays = parseFloat(getCell('days')) || 0;
      const rawReason = getCell('reason') || '연차 사용';
      const rawStatus = getCell('status');
      const rawPhone = getCell('phone');

      // Attempt to normalize start date
      const normalizedStart = normalizeExcelDate(rawStartDate, sheetYear);
      const normalizedEnd = rawEndDate ? normalizeExcelDate(rawEndDate, sheetYear) : normalizedStart;

      // Determine year
      const detectedYear = normalizedStart && normalizedStart.length === 10
        ? normalizedStart.slice(0, 4)
        : (sheetYear || (normalizedJoinDate ? normalizedJoinDate.slice(0, 4) : '2025'));

      const matchedEmp = resolveEmployee(rawName, rawPosition, normalizedJoinDate, detectedYear);

      // If valid leave usage date is present, register leave request
      if (normalizedStart && normalizedStart.length === 10) {
        const recordYear = normalizedStart.slice(0, 4);
        const { type, daysCount: defaultDays } = normalizeLeaveType(rawType);
        const finalDaysCount = rawDays > 0 ? rawDays : defaultDays;

        let status: LeaveStatus = 'APPROVED';
        if (rawStatus.includes('대기') || rawStatus.includes('신청') || rawStatus.includes('미승인')) {
          status = 'PENDING';
        } else if (rawStatus.includes('반려') || rawStatus.includes('거절') || rawStatus.includes('취소')) {
          status = 'REJECTED';
        }

        const reqId = `req-excel-${recordYear}-${cleanHeader(matchedEmp.name)}-${normalizedStart}-${r}`;
        const newReq: LeaveRequest = {
          id: reqId,
          employeeId: matchedEmp.id,
          employeeName: matchedEmp.name,
          position: matchedEmp.position,
          type: type,
          startDate: normalizedStart,
          endDate: normalizedEnd || normalizedStart,
          daysCount: finalDaysCount,
          reason: rawReason,
          contactEmergency: rawPhone || matchedEmp.phone || '010-0000-0000',
          status: status,
          requestedAt: `${normalizedStart}T09:00:00Z`,
          reviewedAt: status === 'APPROVED' ? `${normalizedStart}T10:00:00Z` : undefined,
          reviewedBy: status === 'APPROVED' ? '관리자 (엑셀 일괄 등록)' : undefined,
        };

        parsedRequests.push(newReq);

        // Update year statistics
        yearStats[recordYear] = (yearStats[recordYear] || 0) + 1;

        // Update employee statistics
        const empDisplayName = matchedEmp.name;
        if (!employeeStats[empDisplayName]) {
          employeeStats[empDisplayName] = { total: 0 };
        }
        employeeStats[empDisplayName].total += 1;
        employeeStats[empDisplayName][recordYear] = (employeeStats[empDisplayName][recordYear] || 0) + 1;
      }
    }
  }

  return {
    employees: parsedEmployees,
    requests: parsedRequests,
    detectedEmployeeCount: parsedEmployees.length,
    detectedRequestCount: parsedRequests.length,
    yearStats,
    employeeStats,
    sheetNames,
    warnings,
  };
}

/**
 * Generate the official, 10-column Excel Template (.xlsx)
 * Exactly matches the requested 10 columns:
 * [ 성명 | 직급 | 입사일 | 휴가구분 | 시작일자 | 종료일자 | 사용일수 | 신청사유 | 결제상태 | 비상연락처 ]
 */
export function generateStandardLeaveTemplate(existingEmployees?: Employee[]): void {
  const wb = XLSX.utils.book_new();

  const staffList = (existingEmployees && existingEmployees.length > 0)
    ? existingEmployees.filter((e) => e.status !== 'RETIRED')
    : [
        { name: '홍길동', position: '선임사회복지사', joinDate: '2024-03-01', phone: '010-1234-5678' },
        { name: '김민수', position: '요양보호사 팀장', joinDate: '2022-07-15', phone: '010-2345-6789' },
        { name: '박서준', position: '행정담당 사원', joinDate: '2023-09-01', phone: '010-4567-8901' },
      ];

  const templateRows: any[] = [];

  // Populate realistic entries for all registered staff
  staffList.forEach((emp, i) => {
    if (i === 0) {
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '연차',
        시작일자: '2025-01-15',
        종료일자: '2025-01-15',
        사용일수: 1,
        신청사유: '개인 사유',
        결제상태: '승인',
        비상연락처: emp.phone || '010-1234-5678',
      });
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '오후반차',
        시작일자: '2025-04-10',
        종료일자: '2025-04-10',
        사용일수: 0.5,
        신청사유: '병원 진료',
        결제상태: '승인',
        비상연락처: emp.phone || '010-1234-5678',
      });
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '연차',
        시작일자: '2025-07-28',
        종료일자: '2025-07-30',
        사용일수: 3,
        신청사유: '하계 정기휴가',
        결제상태: '승인',
        비상연락처: emp.phone || '010-1234-5678',
      });
    } else if (i === 1) {
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '연차',
        시작일자: '2025-05-02',
        종료일자: '2025-05-02',
        사용일수: 1,
        신청사유: '가족 행사',
        결제상태: '승인',
        비상연락처: emp.phone || '010-2345-6789',
      });
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '오전반차',
        시작일자: '2025-08-11',
        종료일자: '2025-08-11',
        사용일수: 0.5,
        신청사유: '개인 용무',
        결제상태: '승인',
        비상연락처: emp.phone || '010-2345-6789',
      });
    } else {
      templateRows.push({
        성명: emp.name,
        직급: emp.position,
        입사일: emp.joinDate,
        휴가구분: '연차',
        시작일자: '2025-06-18',
        종료일자: '2025-06-18',
        사용일수: 1,
        신청사유: '리프레시 휴가',
        결제상태: '승인',
        비상연락처: emp.phone || '010-3456-7890',
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(templateRows);

  // Set standard column widths for clean readability
  ws['!cols'] = [
    { wch: 12 }, // 성명
    { wch: 18 }, // 직급
    { wch: 14 }, // 입사일
    { wch: 12 }, // 휴가구분
    { wch: 14 }, // 시작일자
    { wch: 14 }, // 종료일자
    { wch: 10 }, // 사용일수
    { wch: 24 }, // 신청사유
    { wch: 12 }, // 결제상태
    { wch: 16 }, // 비상연락처
  ];

  XLSX.utils.book_append_sheet(wb, ws, '연차대장');
  XLSX.writeFile(wb, '직원_연차대장_업로드_표준서식.xlsx');
}
