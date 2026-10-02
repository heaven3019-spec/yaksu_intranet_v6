import React, { useState } from 'react';
import { Employee, LeaveCycleInfo, LeaveRequest } from '../types';
import { 
  getLeaveTypeBadgeColor, 
  getLeaveTypeLabel, 
  getStatusBadge 
} from '../utils/leaveCalculator';
import { 
  Calendar, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  User, 
  Filter, 
  FileSpreadsheet, 
  ChevronRight, 
  PieChart, 
  BarChart3,
  CalendarCheck2
} from 'lucide-react';

interface YearlyLeaveViewProps {
  employees: Employee[];
  selectedEmployee: Employee;
  onSelectEmployee: (emp: Employee) => void;
  cycles: LeaveCycleInfo[];
  requests: LeaveRequest[];
  initialCycleIndex?: number;
  onOpenPrintModal: (req?: LeaveRequest) => void;
  currentUserRole?: 'EMPLOYEE' | 'ADMIN';
}

export const YearlyLeaveView: React.FC<YearlyLeaveViewProps> = ({
  employees,
  selectedEmployee,
  onSelectEmployee,
  cycles,
  requests,
  initialCycleIndex,
  onOpenPrintModal,
  currentUserRole = 'EMPLOYEE',
}) => {
  // Find currently active cycle or default to latest/initial
  const currentCycleItem = cycles.find((c) => c.isCurrent) || cycles[0];
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(
    initialCycleIndex || (currentCycleItem ? currentCycleItem.cycleIndex : 1)
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');

  const activeCycle = cycles.find((c) => c.cycleIndex === selectedCycleIndex) || currentCycleItem;
  const isAdmin = currentUserRole === 'ADMIN';

  // Filter requests belonging to this employee AND this 1-year cycle
  const cycleRequests = requests.filter((r) => {
    if (r.employeeId !== selectedEmployee.id) return false;
    if (!activeCycle) return false;
    // Check if within cycle period
    const isInCycle = r.startDate >= activeCycle.startDate && r.startDate <= activeCycle.endDate;
    if (!isInCycle) return false;

    if (statusFilter === 'APPROVED') return r.status === 'APPROVED';
    if (statusFilter === 'PENDING') return r.status === 'PENDING';
    return true;
  });

  // Calculate 12-month usage breakdown for this cycle
  const monthlyUsage: { [key: string]: number } = {};
  if (activeCycle) {
    const cycleStart = new Date(activeCycle.startDate + 'T00:00:00');
    for (let i = 0; i < 12; i++) {
      const d = new Date(cycleStart);
      d.setMonth(cycleStart.getMonth() + i);
      const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyUsage[key] = 0;
    }

    requests
      .filter((r) => r.employeeId === selectedEmployee.id && r.status === 'APPROVED')
      .filter((r) => r.startDate >= activeCycle.startDate && r.startDate <= activeCycle.endDate)
      .forEach((r) => {
        const monthKey = r.startDate.slice(0, 7).replace('-', '.');
        if (monthlyUsage[monthKey] !== undefined) {
          monthlyUsage[monthKey] += r.daysCount;
        } else {
          monthlyUsage[monthKey] = r.daysCount;
        }
      });
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!activeCycle) return;
    const headers = ['번호', '직원명', '직급', '휴가구분', '시작일', '종료일', '사용일수', '사유', '결재상태', '신청일시', '승인자'];
    const rows = cycleRequests.map((r, idx) => [
      idx + 1,
      r.employeeName,
      r.position,
      getLeaveTypeLabel(r.type, r.daysCount),
      r.startDate,
      r.endDate,
      r.daysCount,
      `"${r.reason.replace(/"/g, '""')}"`,
      getStatusBadge(r.status).label,
      r.requestedAt.split('T')[0],
      r.reviewedBy || '-',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `동작구립약수데이케어센터_${selectedEmployee.name}_${activeCycle.cycleIndex}년차_연차대장.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const staffOnly = employees.filter((e) => e.role !== 'ADMIN' && e.id !== 'admin-001');

  return (
    <div className="space-y-6">
      {/* Top Filter & Employee Selector Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
          {isAdmin ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">조회 대상:</span>
              <select
                id="yearly-employee-select"
                value={selectedEmployee.id}
                onChange={(e) => {
                  const emp = staffOnly.find((x) => x.id === e.target.value);
                  if (emp) onSelectEmployee(emp);
                }}
                className="w-full sm:w-auto text-xs sm:text-sm font-semibold bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 sm:py-2 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer shadow-2xs"
              >
                {staffOnly.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position}) [입사: {emp.joinDate}]
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="w-full sm:w-auto flex items-center space-x-2 bg-blue-50 px-3.5 py-2.5 rounded-xl border border-blue-200 text-blue-900 font-extrabold text-sm sm:text-base shadow-2xs">
              <User className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{selectedEmployee.name}님의 1년 연차 관리대장</span>
            </div>
          )}

          {/* 연차 주기: 모바일에서 한 줄 엔터(줄바꿈) 후 크기에 맞춘 큼직한 선택창 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full sm:w-auto mt-1 sm:mt-0">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <CalendarCheck2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>연차 주기:</span>
            </span>
            <select
              id="yearly-cycle-select"
              value={selectedCycleIndex}
              onChange={(e) => setSelectedCycleIndex(Number(e.target.value))}
              className="w-full sm:w-auto text-xs sm:text-sm font-extrabold bg-blue-50 text-blue-950 border-2 border-blue-300 rounded-xl px-3.5 py-2.5 sm:py-2 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs leading-snug"
            >
              {cycles.map((c) => (
                <option key={c.cycleIndex} value={c.cycleIndex}>
                  {c.label} {c.isCurrent ? '⭐ [현재 주기]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export & Actions */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center space-x-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>엑셀 다운로드</span>
          </button>
          <button
            id="print-yearly-summary-btn"
            onClick={() => onOpenPrintModal()}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>연차 대장 인쇄</span>
          </button>
        </div>
      </div>

      {/* Main 1-Year Cycle Metrics Highlight */}
      {activeCycle && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {selectedEmployee.name} · {activeCycle.cycleIndex}년차 연차 관리대장
                </span>
                {activeCycle.isCurrent && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    현재 유효 주기
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-2">
                {activeCycle.startDate.replace(/-/g, '.')} ~ {activeCycle.endDate.replace(/-/g, '.')} <span className="text-slate-400 font-normal text-sm ml-1">(1년간)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                입사일({selectedEmployee.joinDate.replace(/-/g, '.')}) 기준 산출된 법정 연차 부여 및 사용 통계입니다.
              </p>
            </div>
          </div>

          {/* 4 Clean Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
            <div>
              <p className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">1년 총 발생 연차</p>
              <h3 className="text-3xl font-bold text-slate-900">
                {activeCycle.totalGranted}<span className="text-lg font-normal text-slate-400 ml-1">일</span>
              </h3>
              <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-300 w-full"></div>
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">사용한 연차 (승인)</p>
              <h3 className="text-3xl font-bold text-blue-600">
                {activeCycle.usedDays}<span className="text-lg font-normal text-slate-400 ml-1">일</span>
              </h3>
              <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, activeCycle.usageRate)}%` }}></div>
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">결재 대기</p>
              <h3 className="text-3xl font-bold text-amber-600">
                {activeCycle.pendingDays}<span className="text-lg font-normal text-slate-400 ml-1">일</span>
              </h3>
              <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${activeCycle.totalGranted > 0 ? (activeCycle.pendingDays / activeCycle.totalGranted) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wider">미사용 잔여 연차</p>
              <h3 className="text-3xl font-bold text-green-600">
                {activeCycle.remainingDays}<span className="text-lg font-normal text-slate-400 ml-1">일</span>
              </h3>
              <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${activeCycle.totalGranted > 0 ? (activeCycle.remainingDays / activeCycle.totalGranted) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Distribution Visual Bar Graph */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">1년간 월별 연차 사용 추이</h3>
          </div>
          <span className="text-xs text-slate-400">
            총 {activeCycle?.usedDays || 0}일 소진 (소진율 {activeCycle?.usageRate || 0}%)
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
          {Object.entries(monthlyUsage).map(([monthStr, days]) => {
            const heightPercent = Math.min(100, (days / 5) * 100);
            const hasUsage = days > 0;
            return (
              <div key={monthStr} className="flex flex-col items-center">
                <div className="w-full bg-slate-50 h-24 rounded-lg flex flex-col justify-end p-1 relative border border-slate-100">
                  {hasUsage && (
                    <div
                      className="bg-blue-600 hover:bg-blue-700 w-full rounded transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                      style={{ height: `${Math.max(24, heightPercent)}%` }}
                    >
                      {days}
                    </div>
                  )}
                  {!hasUsage && (
                    <div className="w-full h-1 bg-slate-200 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-1.5">
                  {monthStr.split('.')[1]}월
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Leave Usage Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">
              {selectedEmployee.name}님의 {activeCycle?.cycleIndex}년차 상세 사용 기록
            </h3>
            <p className="text-xs text-slate-500">
              해당 1년 기간({activeCycle?.startDate.replace(/-/g, '.')} ~ {activeCycle?.endDate.replace(/-/g, '.')}) 동안의 승인 및 신청 내역입니다.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              전체 ({cycleRequests.length})
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'APPROVED' ? 'bg-white text-green-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              승인 완료 ({cycleRequests.filter((r) => r.status === 'APPROVED').length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              대기 중 ({cycleRequests.filter((r) => r.status === 'PENDING').length})
            </button>
          </div>
        </div>

        {cycleRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">해당 1년 주기에 등록된 연차 사용 내역이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">상단 연차 주기를 변경하거나 새 연차를 신청해보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs text-center">No</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs">구분</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs">사용 기간</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs text-center">사용일수</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs">사유</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs">신청일</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs">승인자</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs text-center">상태</th>
                  <th className="px-6 py-3 font-semibold text-slate-500 text-xs text-center">출력</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycleRequests.map((req, idx) => {
                  const isApproved = req.status === 'APPROVED';
                  const isPending = req.status === 'PENDING';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 text-center text-slate-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                        {getLeaveTypeLabel(req.type, req.daysCount)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 whitespace-nowrap text-xs">
                        {req.startDate.replace(/-/g, '.')}
                        {req.startDate !== req.endDate && (
                          <span className="text-slate-400"> ~ {req.endDate.replace(/-/g, '.')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-blue-600 whitespace-nowrap">
                        {req.type === 'HOURLY' ? `${req.daysCount}일 (${Math.round(req.daysCount * 8)}h)` : `${req.daysCount}일`}
                      </td>
                      <td className="px-6 py-4 max-w-sm truncate text-slate-600 text-xs" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap text-xs">
                        {req.startDate.replace(/-/g, '.')}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap text-xs">
                        {req.reviewedBy ? req.reviewedBy.split(' ')[0] : '-'}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {isApproved ? (
                          <span className="text-green-600 font-medium italic text-xs">승인완료</span>
                        ) : isPending ? (
                          <span className="text-amber-600 font-medium text-xs">심사대기</span>
                        ) : (
                          <span className="text-rose-500 font-medium text-xs">반려됨</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenPrintModal(req)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                          title="서식 출력"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
