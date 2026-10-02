import React from 'react';
import { Employee, LeaveCycleInfo, LeaveRequest } from '../types';
import { calculateTenure } from '../utils/leaveCalculator';
import { 
  CheckCircle2, 
  PlusCircle, 
  ShieldCheck 
} from 'lucide-react';

interface EmployeeDashboardProps {
  employee: Employee;
  currentCycle: LeaveCycleInfo | null;
  allCycles: LeaveCycleInfo[];
  requests: LeaveRequest[];
  onOpenRequestModal: () => void;
  onCancelRequest: (requestId: string) => void;
  onViewYearlyDetail: (cycleIndex: number) => void;
  onOpenPrintModal: (req?: LeaveRequest) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  employee,
  currentCycle,
  allCycles,
  onOpenRequestModal,
}) => {
  const tenure = calculateTenure(employee.joinDate);

  // Current active cycle for the dashboard
  const activeCycle = currentCycle || allCycles.find((c) => c.isCurrent) || allCycles[0];

  // Metrics for active cycle
  const totalGranted = activeCycle ? activeCycle.totalGranted : 0;
  const usedDays = activeCycle ? activeCycle.usedDays : 0;
  const pendingDays = activeCycle ? activeCycle.pendingDays : 0;
  const remainingDays = activeCycle ? activeCycle.remainingDays : 0;
  const usageRate = activeCycle ? activeCycle.usageRate : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ============================================================== */}
      {/* 1. Mobile Priority: Large Direct Leave Request Button Card    */}
      {/*    - 간단하고 명확한 "연차 신청하기" 타이틀                     */}
      {/*    - 50~60대 맞춤 크고 시원한 터치 영역 및 잔여 연차 안내      */}
      {/* ============================================================== */}
      <div className="block sm:hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/25 border border-blue-400/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                연차 신청하기
              </h3>
              <p className="text-xs text-blue-100 mt-1">
                현재 잔여 연차: <strong className="text-amber-300 font-bold text-sm">{remainingDays}일</strong> 사용 가능
              </p>
            </div>
            
            <button
              id="mobile-primary-leave-request-btn"
              onClick={onOpenRequestModal}
              className="h-13 px-5 bg-white text-blue-700 hover:bg-blue-50 active:scale-95 font-bold text-base rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all cursor-pointer flex-shrink-0"
              title="클릭하여 연차 신청서 작성"
            >
              <PlusCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span>신청하기</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. Employee Profile & Department (이름과 소속 정보 카드)       */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md shadow-blue-500/20">
            {employee.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {employee.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {employee.position}
              </span>
              {employee.role === 'ADMIN' && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>관리자</span>
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-xs sm:text-sm text-slate-500 mt-1">
              <span>소속: <strong className="text-slate-800 font-semibold">{employee.department || '동작구립 약수데이케어센터'}</strong></span>
              <span className="text-slate-300">·</span>
              <span>입사일: <strong className="text-slate-700 font-medium">{employee.joinDate.replace(/-/g, '.')}</strong></span>
              <span className="text-slate-300">·</span>
              <span>근속: <strong className="text-blue-700 font-bold">{tenure.years}년 {tenure.months}개월</strong> ({tenure.years + 1}년차)</span>
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Prominent Action Button */}
        <div className="hidden sm:flex items-center space-x-2.5 flex-shrink-0">
          <button
            id="desktop-open-leave-request-btn"
            onClick={onOpenRequestModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-base font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-white" />
            <span>신규 연차 신청하기</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. Pure 1-Year Cycle Dashboard (대시보드 칸 안에는 대시보드만)  */}
      {/*    (1년 총 발생 연차, 사용한 연차, 결제 대기, 미사용 잔여 연차) */}
      {/* ============================================================== */}
      {activeCycle && (
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs">
          {/* Dashboard Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  {activeCycle.cycleIndex}년차 연차 현황
                </span>
                {activeCycle.isCurrent && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>현재 주기</span>
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-1.5 tracking-tight">
                {activeCycle.startDate.replace(/-/g, '.')} ~ {activeCycle.endDate.replace(/-/g, '.')} 
                <span className="text-slate-400 font-normal text-xs sm:text-sm ml-1.5">(1년간)</span>
              </h3>
            </div>
          </div>

          {/* 4 Clean Metric Cards - Large fonts for 50~60s readability */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6 pt-5">
            {/* Metric 1: 1년 총 발생 연차 */}
            <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1.5 font-bold">
                  1년 총 발생 연차
                </p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                    {totalGranted}
                  </span>
                  <span className="text-base sm:text-lg font-semibold text-slate-500">일</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-200/60">
                <p className="text-xs text-slate-600 font-medium">
                  기본 {activeCycle.baseGranted || 0}일 {employee.extraGrantedDays ? `+ 가산 ${employee.extraGrantedDays}일` : ''}
                </p>
              </div>
            </div>

            {/* Metric 2: 사용한 연차 (승인) */}
            <div className="p-4 sm:p-5 bg-blue-50/60 rounded-2xl border border-blue-200/80 flex flex-col justify-between">
              <div>
                <p className="text-blue-800 text-xs sm:text-sm mb-1.5 font-bold">
                  사용한 연차 (승인)
                </p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-blue-600">
                    {usedDays}
                  </span>
                  <span className="text-base sm:text-lg font-semibold text-blue-500">일</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-blue-200/60">
                <p className="text-xs text-blue-700 font-semibold">
                  소진율 {usageRate}% (결재 완료 기준)
                </p>
              </div>
            </div>

            {/* Metric 3: 결재 대기 연차 */}
            <div className="p-4 sm:p-5 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex flex-col justify-between">
              <div>
                <p className="text-amber-800 text-xs sm:text-sm mb-1.5 font-bold">
                  결제 대기 연차
                </p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-600">
                    {pendingDays}
                  </span>
                  <span className="text-base sm:text-lg font-semibold text-amber-500">일</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-amber-200/60">
                <p className="text-xs text-amber-700 font-semibold">
                  {pendingDays > 0 ? '관리자 승인 대기 중' : '대기 건 없음'}
                </p>
              </div>
            </div>

            {/* Metric 4: 미사용 잔여 연차 */}
            <div className="p-4 sm:p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex flex-col justify-between">
              <div>
                <p className="text-emerald-800 text-xs sm:text-sm mb-1.5 font-bold">
                  미사용 잔여 연차
                </p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600">
                    {remainingDays}
                  </span>
                  <span className="text-base sm:text-lg font-semibold text-emerald-500">일</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-emerald-200/60">
                <p className="text-xs text-emerald-700 font-semibold">
                  유효기한: ~ {activeCycle.endDate.replace(/-/g, '.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
