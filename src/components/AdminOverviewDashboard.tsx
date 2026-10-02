import React, { useState } from 'react';
import { Employee, LeaveRequest } from '../types';
import { 
  calculateEmployeeCycles, 
  calculateTenure, 
  getLeaveTypeLabel, 
  getStatusBadge 
} from '../utils/leaveCalculator';
import { exportAllLeaveRequestsToExcel, exportEmployeesSummaryToExcel } from '../utils/excelExport';
import { 
  Users, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  Download, 
  Upload,
  ShieldCheck, 
  Activity, 
  Search, 
  ArrowUpRight, 
  FileText, 
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface AdminOverviewDashboardProps {
  employees: Employee[];
  requests: LeaveRequest[];
  onOpenAddEmployee: () => void;
  onOpenExcelImport: () => void;
  onSelectEmployeeForYearly: (emp: Employee) => void;
  onNavigateToApproval: () => void;
  onNavigateToEmployeeList: () => void;
}

export const AdminOverviewDashboard: React.FC<AdminOverviewDashboardProps> = ({
  employees,
  requests,
  onOpenAddEmployee,
  onOpenExcelImport,
  onSelectEmployeeForYearly,
  onNavigateToApproval,
  onNavigateToEmployeeList,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RETIRED'>('ACTIVE');

  // Summary computations (시스템 관리자는 전사 직원 연차 명부에서 제외)
  const staffOnly = employees.filter((e) => e.role !== 'ADMIN' && e.id !== 'admin-001');
  const totalEmployees = staffOnly.length;
  const activeEmployeesCount = staffOnly.filter((e) => e.status !== 'RETIRED').length;
  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const approvedRequests = requests.filter((r) => r.status === 'APPROVED');

  const employeeSummaries = staffOnly.map((emp) => {
    const tenure = calculateTenure(emp.joinDate);
    const cycles = calculateEmployeeCycles(emp, requests);
    const currentCycle = cycles.find((c) => c.isCurrent) || cycles[0];
    return {
      emp,
      tenure,
      currentCycle,
    };
  });

  const activeSummaries = employeeSummaries.filter(({ emp }) => emp.status !== 'RETIRED');
  const totalGrantedDays = activeSummaries.reduce((sum, item) => sum + (item.currentCycle?.totalGranted || 0), 0);
  const totalUsedDays = activeSummaries.reduce((sum, item) => sum + (item.currentCycle?.usedDays || 0), 0);
  const totalRemainingDays = activeSummaries.reduce((sum, item) => sum + (item.currentCycle?.remainingDays || 0), 0);
  const avgUsageRate = totalGrantedDays > 0 ? Math.round((totalUsedDays / totalGrantedDays) * 100) : 0;

  // Filtered employees
  const filteredSummaries = employeeSummaries.filter(({ emp }) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && emp.status !== 'RETIRED') ||
      (statusFilter === 'RETIRED' && emp.status === 'RETIRED');

    return matchesSearch && matchesStatus;
  });

  // Recent activity logs (all requests sorted by date)
  const recentActivities = [...requests]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Employees */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">등록 임직원</span>
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-bold text-slate-900">{totalEmployees}</span>
              <span className="text-sm font-medium text-slate-500">명</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>재직 {activeEmployeesCount}명 · 퇴사 {totalEmployees - activeEmployeesCount}명</span>
              <button 
                onClick={onNavigateToEmployeeList}
                className="text-blue-600 hover:underline font-semibold text-[11px] flex items-center cursor-pointer"
              >
                관리 <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </p>
          </div>
        </div>

        {/* Card 2: Total Granted Days */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">총 연차 부여 합계 (재직자)</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-bold text-blue-600">{totalGrantedDays}</span>
              <span className="text-sm font-medium text-slate-500">일</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              입사일 기준 법정 + 수동지정 포함
            </p>
          </div>
        </div>

        {/* Card 3: Total Used Days & Average Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">총 사용 완료 / 소진율</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-bold text-emerald-600">{totalUsedDays}</span>
                <span className="text-sm font-medium text-slate-500">일</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                소진율 {avgUsageRate}%
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${avgUsageRate}%` }} />
            </div>
          </div>
        </div>

        {/* Card 4: Pending Approvals */}
        <div className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all ${
          pendingRequests.length > 0
            ? 'bg-amber-50/70 border-amber-200 ring-2 ring-amber-500/20'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">결재 대기 중 신청</span>
            <span className={`p-2 rounded-xl ${pendingRequests.length > 0 ? 'bg-amber-200/80 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline space-x-1.5">
                <span className={`text-3xl font-bold ${pendingRequests.length > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {pendingRequests.length}
                </span>
                <span className="text-sm font-medium text-slate-500">건</span>
              </div>
              {pendingRequests.length > 0 && (
                <button
                  id="go-to-approval-btn"
                  onClick={onNavigateToApproval}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <span>결재하기</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingRequests.length > 0 ? '신규 결재 요청이 접수되었습니다.' : '모든 결재 처리가 완료되었습니다.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Employee Table), Right (Recent Activity Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Employee Leave Status Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>전사 직원 연차 사용 현황 일람</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                직원별 입사일, 총 부여 일수, 사용 내역 및 잔여 일수 실시간 현황
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-2">
              <select
                id="filter-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
              >
                <option value="ACTIVE">재직자 ({activeEmployeesCount}명)</option>
                <option value="RETIRED">퇴사자 ({totalEmployees - activeEmployeesCount}명)</option>
                <option value="ALL">전체 ({totalEmployees}명)</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="이름, 직급 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">직원 정보</th>
                  <th className="px-4 py-3.5">입사일 (근속)</th>
                  <th className="px-3 py-3.5 text-center">산정 방식</th>
                  <th className="px-3 py-3.5 text-center">총 부여</th>
                  <th className="px-3 py-3.5 text-center">사용 완료</th>
                  <th className="px-3 py-3.5 text-center">잔여 연차</th>
                  <th className="px-4 py-3.5">소진율</th>
                  <th className="px-4 py-3.5 text-center">상세조회</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      검색 조건과 일치하는 직원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map(({ emp, tenure, currentCycle }) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
                            {emp.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900">{emp.name}</span>
                              {emp.status === 'RETIRED' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                  퇴사
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">{emp.position}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-slate-800 font-medium block">{emp.joinDate.replace(/-/g, '.')}</span>
                        <span className="text-[10px] text-slate-500">{tenure.years}년 {tenure.months}개월차</span>
                      </td>

                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {emp.calculationMode === 'MANUAL' ? (
                          <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                            수동 {emp.manualBaseGrantedDays}일
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full border border-blue-200">
                            법정 자동
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold text-slate-900 whitespace-nowrap">
                        {currentCycle?.totalGranted || 0}일
                        {emp.extraGrantedDays ? (
                          <span className="text-[10px] text-purple-600 block font-normal">+{emp.extraGrantedDays}일 가산</span>
                        ) : null}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold text-blue-600 whitespace-nowrap">
                        {currentCycle?.usedDays || 0}일
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold text-emerald-600 whitespace-nowrap">
                        {currentCycle?.remainingDays || 0}일
                      </td>

                      <td className="px-4 py-3.5 w-32 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${currentCycle?.usageRate || 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">
                            {currentCycle?.usageRate || 0}%
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectEmployeeForYearly(emp)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 font-medium rounded-lg border border-slate-200 transition-colors flex items-center space-x-1 mx-auto cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>1년 대장</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Real-time Leave Activity Log Stream */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>실시간 전사 연차 활동 로그</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">직원들의 최신 신청 및 결재 내역</p>
            </div>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              최근 {recentActivities.length}건
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[520px] pr-1">
            {recentActivities.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                연차 신청 활동 내역이 없습니다.
              </div>
            ) : (
              recentActivities.map((req) => {
                const statusBadge = getStatusBadge(req.status);
                return (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">{req.employeeName}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{req.position}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadge.bg}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {getLeaveTypeLabel(req.type, req.daysCount)}
                      </span>
                      <span className="text-slate-600 font-medium text-[11px]">
                        {req.startDate.replace(/-/g, '.')}
                        {req.startDate !== req.endDate && ` ~ ${req.endDate.replace(/-/g, '.')}`}
                        <strong className="text-blue-600 ml-1">({req.daysCount}일)</strong>
                      </span>
                    </div>

                    {req.reason && (
                      <p className="text-[11px] text-slate-600 truncate" title={req.reason}>
                        사유: {req.reason}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{new Date(req.requestedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {req.reviewedBy && <span>결재: {req.reviewedBy}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={onNavigateToApproval}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>관리자 결재 센터 바로가기</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Banner with Excel Import & Export Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-400/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>동작구립 약수데이케어센터 관리자 종합 관제</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            전사 임직원 연차 대장 엑셀 통합 연동
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            표준 서식에 맞춰 작성된 직원별 연도별·날짜별 연차 대장을 엑셀로 한 번에 일괄 업로드하거나 실시간 연차 현황을 백업 다운로드할 수 있습니다.
          </p>
        </div>

        {/* Excel Import & Download Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 flex-shrink-0">
          {/* EXCEL IMPORT BUTTON */}
          <button
            id="open-excel-import-btn"
            onClick={onOpenExcelImport}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-950/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            title="직원별 연도별·날짜별 엑셀 연차 기록 일괄 업로드"
          >
            <Upload className="w-4 h-4 text-slate-950" />
            <span>직원 연차대장 엑셀 일괄 업로드</span>
          </button>

          <button
            id="download-summary-excel-btn"
            onClick={() => exportEmployeesSummaryToExcel(staffOnly, requests)}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            title="임직원별 총부여, 사용, 잔여 연차 요약 엑셀 다운로드"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>전사 연차 현황 엑셀 다운로드</span>
            <Download className="w-3.5 h-3.5 ml-0.5" />
          </button>

          <button
            id="download-requests-excel-btn"
            onClick={() => exportAllLeaveRequestsToExcel(employees, requests)}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            title="전체 직원의 연차 신청 및 사용 상세 내역 엑셀 다운로드"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>연차 사용상세 엑셀 다운로드</span>
            <Download className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
