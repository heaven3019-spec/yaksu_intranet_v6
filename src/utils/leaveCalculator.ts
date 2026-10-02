import { Employee, LeaveCycleInfo, LeaveRequest, LeaveType } from '../types';

/**
 * 대한민국 근로기준법 제60조 기준 연차 산출
 * - 1년차 (입사 1년 미만): 매월 개근 시 1일씩, 최대 11일
 * - 2년차 (만 1년 근무): 15일
 * - 3년차 (만 2년 근무): 15일
 * - 4년차 (만 3년 근무): 16일 (+1일 가산)
 * - 5년차 (만 4년 근무): 16일
 * - 6년차 (만 5년 근무): 17일 (+1일 가산)
 * ... 매 2년마다 1일씩 가산, 한도 최대 25일
 */
export function getLegalBaseDays(cycleIndex: number): number {
  if (cycleIndex <= 0) return 0;
  if (cycleIndex === 1) {
    return 11; // 1년 미만 매월 1일 (최대 11일)
  }
  // cycleIndex >= 2:
  // cycle 2: 15
  // cycle 3: 15
  // cycle 4: 16
  // cycle 5: 16
  // cycle 6: 17
  const yearsAfterFirst = cycleIndex - 2; // 0 for 2nd year, 1 for 3rd, 2 for 4th
  const addition = Math.floor(yearsAfterFirst / 2);
  const total = 15 + addition;
  return Math.min(total, 25);
}

export const calculateLegalAnnualLeaveDays = getLegalBaseDays;

/**
 * 날짜 문자열 포맷팅 YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜 더하기 (년/월/일)
 */
export function addYears(dateStr: string, years: number): Date {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * 근속 기간 계산 (년, 개월, 일)
 */
export function calculateTenure(joinDateStr: string, targetDateStr = formatDate(new Date())) {
  const join = new Date(joinDateStr + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  
  if (target < join) {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  const diffTime = Math.abs(target.getTime() - join.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let years = target.getFullYear() - join.getFullYear();
  let months = target.getMonth() - join.getMonth();
  let days = target.getDate() - join.getDate();

  if (days < 0) {
    months -= 1;
    // 이전 달의 마지막 날짜
    const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalDays,
  };
}

/**
 * 직원의 입사일 기준 모든 연차 주기(Cycle) 및 통계 계산
 * - 2025, 2026, 2027, 2028 ... 2100년까지 연도가 바뀔 때마다 신규 연차주기 자동 생성 및 활성화
 */
export function calculateEmployeeCycles(
  employee: Employee,
  requests: LeaveRequest[],
  referenceDate = new Date()
): LeaveCycleInfo[] {
  if (!employee.joinDate) return [];

  const joinDate = new Date(employee.joinDate + 'T00:00:00');
  const now = referenceDate;
  
  // Find highest year mentioned in employee's leave requests (if any)
  let maxRequestYear = now.getFullYear();
  requests.forEach((r) => {
    if (r.employeeId === employee.id && r.startDate && r.startDate.length >= 4) {
      const y = parseInt(r.startDate.slice(0, 4), 10);
      if (!isNaN(y) && y > maxRequestYear) {
        maxRequestYear = y;
      }
    }
  });

  const cycles: LeaveCycleInfo[] = [];
  let cycleIdx = 1;
  let hasMore = true;

  // Supports cycles safely up to 100 years (well into 2100+)
  while (hasMore && cycleIdx <= 100) {
    const cycleStart = new Date(joinDate);
    cycleStart.setFullYear(joinDate.getFullYear() + (cycleIdx - 1));

    const nextStart = new Date(joinDate);
    nextStart.setFullYear(joinDate.getFullYear() + cycleIdx);
    
    const cycleEnd = new Date(nextStart);
    cycleEnd.setDate(cycleEnd.getDate() - 1);

    const startStr = formatDate(cycleStart);
    const endStr = formatDate(cycleEnd);

    const isCurrent = now >= cycleStart && now <= cycleEnd;
    const isFuture = cycleStart > now;

    // 기본 법정 연차 or 관리자 수동 지정 연차
    const isManual = isCurrent && (employee.calculationMode === 'MANUAL' || (employee.manualBaseGrantedDays !== undefined && employee.manualBaseGrantedDays !== null));
    const baseGranted = isManual && employee.manualBaseGrantedDays !== undefined
      ? employee.manualBaseGrantedDays
      : getLegalBaseDays(cycleIdx);

    // 현재 주기일 경우에만 직원의 extraGrantedDays 반영
    const extra = isCurrent ? (employee.extraGrantedDays || 0) : 0;
    const totalGranted = baseGranted + extra;

    // 해당 주기에 속하는 휴가 신청 건들 필터링
    const cycleRequests = requests.filter(req => {
      if (req.employeeId !== employee.id) return false;
      return req.startDate >= startStr && req.startDate <= endStr;
    });

    let usedDays = 0;
    let pendingDays = 0;

    cycleRequests.forEach(req => {
      if (req.status === 'APPROVED') {
        usedDays += req.daysCount;
      } else if (req.status === 'PENDING') {
        pendingDays += req.daysCount;
      }
    });

    const remainingDays = Math.max(0, Number((totalGranted - usedDays).toFixed(2)));
    const usageRate = totalGranted > 0 ? Math.min(100, Math.round((usedDays / totalGranted) * 100)) : 0;

    const labelPrefix = isCurrent
      ? `${cycleIdx}년차 (현재 주기)`
      : isFuture
        ? `${cycleIdx}년차 (예정)`
        : `${cycleIdx}년차`;

    cycles.push({
      cycleIndex: cycleIdx,
      label: `${labelPrefix} [${startStr.replace(/-/g, '.')} ~ ${endStr.replace(/-/g, '.')}]`,
      startDate: startStr,
      endDate: endStr,
      baseGranted,
      isManualBase: isManual,
      extraGranted: extra,
      totalGranted,
      usedDays: Number(usedDays.toFixed(2)),
      pendingDays: Number(pendingDays.toFixed(2)),
      remainingDays,
      usageRate,
      isCurrent,
    });

    // Check continuation:
    // Keep generating past cycles, current cycle, at least 1 upcoming cycle (next year),
    // and any future cycles covering future booked leave requests up to maxRequestYear
    if (isFuture) {
      if (cycleStart.getFullYear() >= maxRequestYear && cycleIdx > 1) {
        hasMore = false;
      } else {
        cycleIdx++;
      }
    } else {
      cycleIdx++;
    }
  }

  return cycles;
}

/**
 * 근무일수 계산 (동작구립 약수데이케어센터는 주말(토/일)에도 교대근무를 진행하므로 모든 일수를 정상 산정)
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string, type: LeaveType, hoursCount = 1): number {
  if (type === 'HALF_AM' || type === 'HALF_PM') {
    return 0.5;
  }
  if (type === 'HOURLY') {
    // 1일 8시간 기준: 1시간 = 0.125일 (1/8)
    return Number((hoursCount / 8).toFixed(3));
  }
  if (type === 'QUARTER') {
    return 0.25;
  }

  if (!startDateStr || !endDateStr) return 0;
  
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (start > end) return 0;

  // 약수데이케어센터는 주말(토/일) 어르신 케어 교대근무를 하므로 선택된 기간의 일수 전체를 휴가 일수로 계산
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * 휴가 유형 한국어 라벨
 */
export function getLeaveTypeLabel(type: LeaveType, daysCount?: number): string {
  switch (type) {
    case 'ANNUAL':
      return '전일 연차 (1일)';
    case 'HALF_AM':
      return '오전 반차 (0.5일)';
    case 'HALF_PM':
      return '오후 반차 (0.5일)';
    case 'HOURLY': {
      if (daysCount) {
        const hours = Math.round(daysCount * 8);
        return `시간차 (${hours}시간 / ${daysCount}일)`;
      }
      return '시간차 (1시간 단위)';
    }
    case 'QUARTER':
      return '시간차 (2시간)';
    case 'SICK':
      return '병가';
    case 'SPECIAL':
      return '경조사 / 특별휴가';
    case 'OFFICIAL':
      return '공가 / 예비군';
    default:
      return '연차';
  }
}

export function getLeaveTypeBadgeColor(type: LeaveType): string {
  switch (type) {
    case 'ANNUAL':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'HALF_AM':
    case 'HALF_PM':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'HOURLY':
    case 'QUARTER':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'SICK':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'SPECIAL':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'OFFICIAL':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return { label: '승인 완료', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20' };
    case 'PENDING':
      return { label: '승인 대기', bg: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/20' };
    case 'REJECTED':
      return { label: '반려됨', bg: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20' };
    case 'CANCELLED':
      return { label: '신청 취소', bg: 'bg-gray-100 text-gray-600 border-gray-200 ring-gray-600/20' };
    default:
      return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200 ring-gray-600/20' };
  }
}
