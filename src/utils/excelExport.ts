import { Employee, LeaveRequest } from '../types';
import { calculateEmployeeCycles, calculateTenure, getLeaveTypeLabel } from './leaveCalculator';

/**
 * UTF-8 BOM을 포함한 CSV 다운로드 헬퍼
 * 엑셀(Excel)에서 한글 깨짐 없이 바로 열림
 */
function downloadCSV(csvContent: string, fileName: string) {
  // UTF-8 BOM (\uFEFF) 추가
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return '""';
  const str = String(field);
  // 따옴표 escaping 및 줄바꿈 처리
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * 1. 전사 직원 연차 관리 현황 요약 CSV 다운로드
 */
export function exportEmployeesSummaryToExcel(employees: Employee[], requests: LeaveRequest[]) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `동작구립약수데이케어센터_임직원연차현황_${dateStr}.csv`;

  const headers = [
    '연번',
    '직원ID',
    '로그인ID',
    '성명',
    '직급/직책',
    '입사일자',
    '근속기간',
    '상태',
    '퇴사일자',
    '연차주기(회차)',
    '연차산정방식',
    '기본부여일수(일)',
    '가산부여일수(일)',
    '총부여일수(일)',
    '사용완료일수(일)',
    '승인대기일수(일)',
    '잔여미사용일수(일)',
    '소진율(%)',
    '연락처',
    '이메일',
    '비고'
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  employees.forEach((emp, index) => {
    const tenure = calculateTenure(emp.joinDate);
    const cycles = calculateEmployeeCycles(emp, requests);
    const currentCycle = cycles.find((c) => c.isCurrent) || cycles[0];

    const row = [
      index + 1,
      emp.id,
      emp.loginId || '-',
      emp.name,
      emp.position,
      emp.joinDate,
      `${tenure.years}년 ${tenure.months}개월`,
      emp.status === 'RETIRED' ? '퇴사' : '재직',
      emp.retiredDate || '-',
      currentCycle ? `${currentCycle.cycleIndex}년차 (${currentCycle.startDate} ~ ${currentCycle.endDate})` : '-',
      emp.calculationMode === 'MANUAL' ? '관리자 수동 지정' : '근로기준법 자동 산정',
      currentCycle?.baseGranted || 0,
      currentCycle?.extraGranted || 0,
      currentCycle?.totalGranted || 0,
      currentCycle?.usedDays || 0,
      currentCycle?.pendingDays || 0,
      currentCycle?.remainingDays || 0,
      `${currentCycle?.usageRate || 0}%`,
      emp.phone || '-',
      emp.email || '-',
      emp.customNotes || '-'
    ];

    rows.push(row.map(escapeCSV).join(','));
  });

  const csvContent = rows.join('\r\n');
  downloadCSV(csvContent, fileName);
}

/**
 * 2. 전사 직원 전체 연차 신청 및 사용 상세 내역 CSV 다운로드
 */
export function exportAllLeaveRequestsToExcel(employees: Employee[], requests: LeaveRequest[]) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `동작구립약수데이케어센터_전체연차사용신청상세_${dateStr}.csv`;

  const headers = [
    '신청번호',
    '신청일시',
    '직원명',
    '로그인ID',
    '직급',
    '휴가구분',
    '사용시작일',
    '사용종료일',
    '차감일수(일)',
    '신청사유',
    '비상연락처',
    '결재상태',
    '결재일시',
    '결재자',
    '취소/반려사유'
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  // 최신 신청일 순 정렬
  const sorted = [...requests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  sorted.forEach((req) => {
    const emp = employees.find((e) => e.id === req.employeeId);
    let statusLabel = '승인대기';
    if (req.status === 'APPROVED') statusLabel = '승인완료';
    else if (req.status === 'REJECTED') statusLabel = '반려';
    else if (req.status === 'CANCELLED') statusLabel = '신청취소(승인취소)';

    const row = [
      req.id,
      req.requestedAt ? new Date(req.requestedAt).toLocaleString('ko-KR') : '-',
      req.employeeName,
      emp?.loginId || '-',
      req.position,
      getLeaveTypeLabel(req.type, req.daysCount),
      req.startDate,
      req.endDate,
      req.daysCount,
      req.reason || '-',
      req.contactEmergency || emp?.phone || '-',
      statusLabel,
      req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('ko-KR') : '-',
      req.reviewedBy || '-',
      req.cancelReason || req.rejectReason || '-'
    ];

    rows.push(row.map(escapeCSV).join(','));
  });

  const csvContent = rows.join('\r\n');
  downloadCSV(csvContent, fileName);
}
