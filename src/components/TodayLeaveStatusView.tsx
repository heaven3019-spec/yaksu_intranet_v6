import React, { useState } from 'react';
import { Employee, LeaveRequest } from '../types';
import { getLeaveTypeBadgeColor, getLeaveTypeLabel } from '../utils/leaveCalculator';
import { 
  Calendar, 
  Clock, 
  Users, 
  UserCheck, 
  Phone, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  CalendarDays,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface TodayLeaveStatusViewProps {
  requests: LeaveRequest[];
  employees: Employee[];
  currentEmployee: Employee;
  onOpenLeaveRequest?: () => void;
}

export const TodayLeaveStatusView: React.FC<TodayLeaveStatusViewProps> = ({
  requests,
  employees,
  currentEmployee,
  onOpenLeaveRequest,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Day of week with parentheses e.g. "(금)"
  const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const getDayOfWeekWithParen = (dateStr: string): string => {
    if (!dateStr || dateStr.length < 10) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayName = KOREAN_DAY_NAMES[d.getDay()] || '';
      return `(${dayName})`;
    }
    return '';
  };

  const selectedDayParen = getDayOfWeekWithParen(selectedDate);

  // Format date display
  const dateParts = selectedDate.split('-');
  const dateObj = dateParts.length === 3 
    ? new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10))
    : new Date(selectedDate);

  const formattedDateStr = isNaN(dateObj.getTime())
    ? `${selectedDate}${selectedDayParen}`
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(dateObj);

  const isToday = selectedDate === todayStr;

  // Quick navigation
  const handleShiftDate = (days: number) => {
    const parts = selectedDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  // Find all approved leaves covering this date
  const targetDateLeaves = requests.filter((r) => {
    if (r.status !== 'APPROVED') return false;
    return r.startDate <= selectedDate && r.endDate >= selectedDate;
  });

  // Filtered leaves
  const filteredLeaves = targetDateLeaves.filter((r) => {
    if (selectedType !== 'ALL') {
      if (selectedType === 'HOURLY' && r.type !== 'HOURLY') return false;
      if (selectedType === 'HALF' && r.type !== 'HALF_AM' && r.type !== 'HALF_PM') return false;
      if (selectedType === 'ANNUAL' && r.type !== 'ANNUAL') return false;
    }
    return true;
  });

  // Exclude System Admin from staff headcounts (전사 직원 연차 산출 대상에서 관리자 제외)
  const staffOnly = employees.filter((e) => e.role !== 'ADMIN' && e.id !== 'admin-001' && e.status !== 'RETIRED');
  const totalEmployees = staffOnly.length;
  const onLeaveCount = targetDateLeaves.length;
  const workingCount = Math.max(0, totalEmployees - onLeaveCount);
  const attendanceRate = totalEmployees > 0 ? Math.round((workingCount / totalEmployees) * 100) : 100;

  const fullDayLeaves = targetDateLeaves.filter((r) => r.type === 'ANNUAL' || r.type === 'SPECIAL' || r.type === 'SICK' || r.type === 'OFFICIAL');
  const halfDayLeaves = targetDateLeaves.filter((r) => r.type === 'HALF_AM' || r.type === 'HALF_PM');
  const hourlyLeaves = targetDateLeaves.filter((r) => r.type === 'HOURLY');

  // Print Daily Attendance Sheet
  const handlePrintDailySheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              오늘의 연차 & 휴가 사용 현황
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            동작구립 약수데이케어센터 임직원의 당일 연차, 반차, 시간차 사용 현황을 실시간으로 확인합니다.
          </p>
        </div>

        {/* Date Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleShiftDate(-1)}
              title="이전 날짜"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="relative flex items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                {selectedDate}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-blue-700 ml-1">
                {selectedDayParen}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                title="날짜 선택"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              title="다음 날짜"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={handleSetToday}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              오늘로 이동
            </button>
          )}

          <button
            onClick={handlePrintDailySheet}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>일일 현황 인쇄</span>
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">
              {isToday ? 'TODAY · 오늘 실시간 현황' : '선택 일자 연차 현황'}
            </span>
            {isToday && (
              <span className="bg-emerald-400 text-emerald-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                실시간
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight flex flex-wrap items-baseline gap-2">
            <span>
              {selectedDate} <strong className="text-amber-300 font-extrabold">{selectedDayParen}</strong>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-blue-200">
              · {formattedDateStr}
            </span>
          </h3>
          <p className="text-xs text-blue-100 mt-1">
            전체 직원 {totalEmployees}명 중 <strong className="text-white underline">{onLeaveCount}명</strong>이 오늘 휴가(연차/반차/시간차)를 사용 중입니다.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
          <div className="text-center px-2">
            <span className="text-[10px] text-blue-200 font-bold block">정상 출근</span>
            <span className="text-lg font-black text-white">{workingCount}명</span>
          </div>
          <span className="h-7 w-px bg-white/20"></span>
          <div className="text-center px-2">
            <span className="text-[10px] text-blue-200 font-bold block">휴가 사용</span>
            <span className="text-lg font-black text-amber-300">{onLeaveCount}명</span>
          </div>
          <span className="h-7 w-px bg-white/20"></span>
          <div className="text-center px-2">
            <span className="text-[10px] text-blue-200 font-bold block">출근율</span>
            <span className="text-lg font-black text-emerald-300">{attendanceRate}%</span>
          </div>
        </div>
      </div>

      {/* Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Full Day */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">종일 연차자</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              종일
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-900">{fullDayLeaves.length}</span>
            <span className="text-xs text-slate-400 font-semibold">명</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">종일 휴무 (09:00~18:00)</p>
        </div>

        {/* Half Day */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">반차 사용자</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              반차
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-900">{halfDayLeaves.length}</span>
            <span className="text-xs text-slate-400 font-semibold">명</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">오전(09~13) 또는 오후(14~18)</p>
        </div>

        {/* Hourly */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">시간차 사용자</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              시간
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-900">{hourlyLeaves.length}</span>
            <span className="text-xs text-slate-400 font-semibold">명</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">1시간 단위 자유 유연 사용</p>
        </div>

        {/* Total Working */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">정상 근무 인원</span>
            <span className="w-8 h-8 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center font-bold text-xs">
              근무
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-900">{workingCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {totalEmployees}명</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">업무 및 케어 정상 가동</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-700">휴가 필터</span>
          <span className="text-xs text-slate-400">총 {filteredLeaves.length}건 조회</span>
        </div>

        {/* Type Filter */}
        <div className="flex items-center space-x-1.5">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">휴가 구분: 전체</option>
            <option value="ANNUAL">종일 연차</option>
            <option value="HALF">반차 (오전/오후)</option>
            <option value="HOURLY">시간차</option>
          </select>
        </div>
      </div>

      {/* Main Leave Cards & Details */}
      {filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-2xs">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-800">
            {selectedDate === todayStr 
              ? `오늘 ${selectedDate}${selectedDayParen} 휴가 중인 직원이 없습니다.` 
              : `${selectedDate}${selectedDayParen} 휴가자가 없습니다.`}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            해당 일자에는 전 임직원이 정상 근무 중이거나 승인된 연차 일정이 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaves.map((req) => {
            const emp = employees.find((e) => e.id === req.employeeId);
            const isSingleDay = req.startDate === req.endDate;

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        {req.employeeName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h4 className="text-sm font-bold text-slate-900">{req.employeeName}</h4>
                          <span className="text-xs text-slate-500 font-medium">{req.position}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${getLeaveTypeBadgeColor(req.type)}`}>
                      {getLeaveTypeLabel(req.type, req.daysCount)}
                    </span>
                  </div>

                  {/* Leave Details Box */}
                  <div className="mt-4 bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>사용 기간</span>
                      </span>
                      <span className="font-bold text-slate-800 font-mono">
                        {isSingleDay ? req.startDate : `${req.startDate} ~ ${req.endDate}`} ({req.daysCount}일)
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 font-semibold shrink-0">휴가 사유</span>
                      <span className="text-slate-700 font-medium text-right line-clamp-2">{req.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Contact & Approval Status */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{req.contactEmergency || emp?.phone || '010-0000-0000'}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-emerald-600 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>결재 완료 ({req.reviewedBy || '유정'})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
