import React, { useState, useEffect } from 'react';
import { Employee, LeaveCycleInfo, LeaveRequest, LeaveType } from '../types';
import { calculateWorkingDays, getLeaveTypeLabel } from '../utils/leaveCalculator';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Send, 
  Info,
  Phone,
  FileEdit,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  currentCycle: LeaveCycleInfo | null;
  onSubmit: (request: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => void;
}

const formatDateStr = (year: number, monthIndex: number, day: number) => {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getTodayStr = () => {
  const now = new Date();
  return formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTomorrowStr = () => {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
};

const getDayOfWeekInfo = (dateStr: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return null;
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const shortDays = ['일', '월', '화', '수', '목', '금', '토'];
  const dayIndex = d.getDay();
  return {
    dayName: days[dayIndex],
    shortName: shortDays[dayIndex],
    isWeekend: dayIndex === 0 || dayIndex === 6,
    isSunday: dayIndex === 0,
    isSaturday: dayIndex === 6,
  };
};

interface SingleDateRangeCalendarProps {
  isRange: boolean;
  startDate: string;
  endDate: string;
  onDatesChange: (start: string, end: string) => void;
}

const SingleDateRangeCalendar: React.FC<SingleDateRangeCalendarProps> = ({
  isRange,
  startDate,
  endDate,
  onDatesChange,
}) => {
  // Calendar popover is closed (null) by default. Opens as 'START' or 'END' when user clicks the date button.
  const [activeCalendar, setActiveCalendar] = useState<'START' | 'END' | null>(null);

  // Year & Month viewing state
  const parts = startDate ? startDate.split('-') : [];
  const currentY = parts.length === 3 ? parseInt(parts[0], 10) : new Date().getFullYear();
  const currentM = parts.length === 3 ? parseInt(parts[1], 10) - 1 : new Date().getMonth();

  const [viewYear, setViewYear] = useState<number>(currentY);
  const [viewMonth, setViewMonth] = useState<number>(currentM);

  // Sync view year/month when activeCalendar opens or changes
  const syncViewDate = (dateStr: string) => {
    if (dateStr) {
      const p = dateStr.split('-');
      if (p.length === 3) {
        setViewYear(parseInt(p[0], 10));
        setViewMonth(parseInt(p[1], 10) - 1);
      }
    }
  };

  const handleOpenStart = () => {
    if (activeCalendar === 'START') {
      setActiveCalendar(null);
    } else {
      setActiveCalendar('START');
      syncViewDate(startDate);
    }
  };

  const handleOpenEnd = () => {
    if (activeCalendar === 'END') {
      setActiveCalendar(null);
    } else {
      setActiveCalendar('END');
      syncViewDate(endDate || startDate);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const startInfo = getDayOfWeekInfo(startDate);
  const endInfo = getDayOfWeekInfo(endDate);
  const todayStr = getTodayStr();

  const handleDayClick = (y: number, m: number, d: number) => {
    const clickedStr = formatDateStr(y, m, d);

    if (!isRange) {
      onDatesChange(clickedStr, clickedStr);
      setActiveCalendar(null); // Click to select and automatically close!
      return;
    }

    if (activeCalendar === 'START') {
      if (clickedStr > endDate) {
        onDatesChange(clickedStr, clickedStr);
      } else {
        onDatesChange(clickedStr, endDate);
      }
      setActiveCalendar(null); // Click to select and automatically close!
    } else if (activeCalendar === 'END') {
      if (clickedStr < startDate) {
        onDatesChange(clickedStr, clickedStr);
      } else {
        onDatesChange(startDate, clickedStr);
      }
      setActiveCalendar(null); // Click to select and automatically close!
    }
  };

  return (
    <div className="space-y-3">
      {/* Date Field Buttons - Always visible and clean */}
      {isRange ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. Start Date Field Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>
                시작일자 <span className="text-rose-500">*</span>
              </span>
              {startInfo && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    startInfo.isSunday
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : startInfo.isSaturday
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {startInfo.dayName} {startInfo.isWeekend ? '(주말 근무)' : '(평일)'}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={handleOpenStart}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer bg-white text-left shadow-2xs ${
                activeCalendar === 'START'
                  ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40'
                  : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm sm:text-base font-extrabold text-slate-900">{startDate}</span>
                {startInfo && (
                  <span
                    className={`text-xs font-extrabold ${
                      startInfo.isSunday
                        ? 'text-rose-600'
                        : startInfo.isSaturday
                        ? 'text-blue-600'
                        : 'text-slate-600'
                    }`}
                  >
                    ({startInfo.shortName})
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                  activeCalendar === 'START'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                {activeCalendar === 'START' ? '달력 닫기 ▲' : '📅 달력 열기 ▼'}
              </span>
            </button>
          </div>

          {/* 2. End Date Field Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>
                종료일자 <span className="text-rose-500">*</span>
              </span>
              {endInfo && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    endInfo.isSunday
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : endInfo.isSaturday
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {endInfo.dayName} {endInfo.isWeekend ? '(주말 근무)' : '(평일)'}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={handleOpenEnd}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer bg-white text-left shadow-2xs ${
                activeCalendar === 'END'
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40'
                  : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-sm sm:text-base font-extrabold text-slate-900">{endDate}</span>
                {endInfo && (
                  <span
                    className={`text-xs font-extrabold ${
                      endInfo.isSunday
                        ? 'text-rose-600'
                        : endInfo.isSaturday
                        ? 'text-blue-600'
                        : 'text-slate-600'
                    }`}
                  >
                    ({endInfo.shortName})
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                  activeCalendar === 'END'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {activeCalendar === 'END' ? '달력 닫기 ▲' : '📅 달력 열기 ▼'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Single-Day Leave (반차, 시간차, 분기 등) */
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>
              사용일자 <span className="text-rose-500">*</span>
            </span>
            {startInfo && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  startInfo.isSunday
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : startInfo.isSaturday
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {startInfo.dayName} {startInfo.isWeekend ? '(주말 근무 가능)' : '(평일)'}
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={handleOpenStart}
            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer bg-white text-left shadow-2xs ${
              activeCalendar === 'START'
                ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40'
                : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm sm:text-base font-extrabold text-slate-900">{startDate}</span>
              {startInfo && (
                <span
                  className={`text-xs font-extrabold ${
                    startInfo.isSunday
                      ? 'text-rose-600'
                      : startInfo.isSaturday
                      ? 'text-blue-600'
                      : 'text-slate-600'
                  }`}
                >
                  ({startInfo.shortName}요일)
                </span>
              )}
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                activeCalendar === 'START'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              {activeCalendar === 'START' ? '달력 닫기 ▲' : '📅 달력 열기 ▼'}
            </span>
          </button>
        </div>
      )}

      {/* Interactive Visual Calendar Dropdown Panel: ONLY shown when activeCalendar is open */}
      {activeCalendar !== null && (
        <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-xl p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150 relative">
          {/* Header with Title and Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-2">
            <div className="flex items-center space-x-2">
              <div
                className={`p-1.5 rounded-lg text-white font-black text-xs ${
                  activeCalendar === 'START' ? 'bg-blue-600' : 'bg-indigo-600'
                }`}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {activeCalendar === 'START'
                    ? (isRange ? '시작일자 선택' : '사용일자 선택')
                    : '종료일자 선택'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  달력에서 원하는 날짜를 클릭하면 즉시 적용 후 닫힙니다.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              {/* Quick switch between Start and End tabs inside calendar if Range */}
              {isRange && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCalendar('START');
                      syncViewDate(startDate);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeCalendar === 'START'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    시작일자
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCalendar('END');
                      syncViewDate(endDate);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activeCalendar === 'END'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    종료일자
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveCalendar(null)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer transition-colors"
                title="달력 닫기"
              >
                ✕ 닫기
              </button>
            </div>
          </div>

          {/* Month Navigation Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer shadow-2xs transition-colors"
              title="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-sm sm:text-base font-extrabold text-slate-900">
                {viewYear}년 {viewMonth + 1}월
              </span>
              <button
                type="button"
                onClick={handleGoToday}
                className="text-[11px] font-bold text-slate-600 hover:text-blue-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 cursor-pointer hover:border-blue-300"
              >
                오늘
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 border border-transparent hover:border-slate-200 cursor-pointer shadow-2xs transition-colors"
              title="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold mb-2">
            <span className="text-rose-600 py-1">일</span>
            <span className="text-slate-600 py-1">월</span>
            <span className="text-slate-600 py-1">화</span>
            <span className="text-slate-600 py-1">수</span>
            <span className="text-slate-600 py-1">목</span>
            <span className="text-slate-600 py-1">금</span>
            <span className="text-blue-600 py-1">토</span>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous Month trailing days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfWeek + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="py-2 text-xs text-slate-300 font-medium select-none"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Current Month days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = formatDateStr(viewYear, viewMonth, dayNum);
              const dayOfWeek = (firstDayOfWeek + i) % 7;
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;
              const isToday = dateStr === todayStr;

              const isStart = dateStr === startDate;
              const isEnd = isRange ? dateStr === endDate : dateStr === startDate;
              const isInRange = isRange && dateStr > startDate && dateStr < endDate;
              const isSameDayRange = isRange && isStart && isEnd;

              return (
                <button
                  type="button"
                  key={`cur-${dayNum}`}
                  onClick={() => handleDayClick(viewYear, viewMonth, dayNum)}
                  className={`py-2 text-xs rounded-xl font-bold transition-all cursor-pointer flex flex-col items-center justify-center min-h-[44px] relative ${
                    isSameDayRange
                      ? 'bg-blue-600 text-white font-black shadow-md ring-2 ring-blue-600 z-10'
                      : isStart
                      ? 'bg-blue-600 text-white font-black shadow-md ring-2 ring-blue-600 z-10'
                      : isEnd
                      ? 'bg-indigo-600 text-white font-black shadow-md ring-2 ring-indigo-600 z-10'
                      : isInRange
                      ? 'bg-blue-100 text-blue-900 font-extrabold hover:bg-blue-200'
                      : isToday
                      ? 'border-2 border-blue-400 bg-white font-extrabold text-blue-900 hover:bg-blue-50'
                      : isSunday
                      ? 'text-rose-600 hover:bg-rose-50 bg-white border border-slate-100'
                      : isSaturday
                      ? 'text-blue-600 hover:bg-blue-50 bg-white border border-slate-100'
                      : 'text-slate-800 hover:bg-slate-100 bg-white border border-slate-100'
                  }`}
                >
                  <span>{dayNum}</span>
                  {isSameDayRange ? (
                    <span className="text-[9px] font-black leading-none mt-0.5 text-blue-100">
                      당일
                    </span>
                  ) : isStart && isRange ? (
                    <span className="text-[9px] font-black leading-none mt-0.5 text-blue-100">
                      시작
                    </span>
                  ) : isEnd && isRange ? (
                    <span className="text-[9px] font-black leading-none mt-0.5 text-indigo-100">
                      종료
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Calendar Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <span className="text-emerald-700 font-bold flex items-center space-x-1">
              <span>✨ 주말(토/일)도 정상 근무일로 연차/휴가 신청이 가능합니다.</span>
            </span>
            {isRange && (
              <span className="font-semibold text-blue-800">
                현재 설정 기간: {startDate} ~ {endDate}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  employee,
  currentCycle,
  onSubmit,
}) => {
  const tomorrowStr = getTomorrowStr();

  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL');
  const [startDate, setStartDate] = useState<string>(tomorrowStr);
  const [endDate, setEndDate] = useState<string>(tomorrowStr);
  const [hourlyHours, setHourlyHours] = useState<number>(1); // 1시간 단위 (1~8시간)
  const [timeSchedule, setTimeSchedule] = useState<string>(''); // 비어있는 기본값 (회색 placeholder로 안내)
  const [reason, setReason] = useState<string>('');
  const [contactEmergency, setContactEmergency] = useState<string>(employee.phone || '');
  const [calculatedDays, setCalculatedDays] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Day of week calculations for summary
  const startDayInfo = getDayOfWeekInfo(startDate);
  const endDayInfo = getDayOfWeekInfo(endDate);

  // Reset or initialize dates on modal open
  useEffect(() => {
    if (isOpen) {
      const tomorrow = getTomorrowStr();
      setStartDate(tomorrow);
      setEndDate(tomorrow);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Re-calculate working days whenever dates or type change
  useEffect(() => {
    if (leaveType === 'HALF_AM' || leaveType === 'HALF_PM') {
      setEndDate(startDate);
      setCalculatedDays(0.5);
    } else if (leaveType === 'HOURLY') {
      setEndDate(startDate);
      // 1시간 = 0.125일 (8시간 = 1일)
      const days = Number((hourlyHours / 8).toFixed(3));
      setCalculatedDays(days);
    } else if (leaveType === 'QUARTER') {
      setEndDate(startDate);
      setCalculatedDays(0.25);
    } else {
      const days = calculateWorkingDays(startDate, endDate, leaveType);
      setCalculatedDays(days);
    }
  }, [startDate, endDate, leaveType, hourlyHours]);

  if (!isOpen) return null;

  const remaining = currentCycle ? currentCycle.remainingDays : 0;
  const isExceeding = (leaveType === 'ANNUAL' || leaveType === 'HALF_AM' || leaveType === 'HALF_PM' || leaveType === 'HOURLY' || leaveType === 'QUARTER') && calculatedDays > remaining;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (calculatedDays <= 0) {
      setErrorMsg('유효한 연차 사용 일수(최소 1시간 이상)를 선택해주세요.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('신청 사유를 입력해주세요.');
      return;
    }

    if (isExceeding) {
      if (!confirm(`신청 일수(${calculatedDays}일)가 현재 잔여 연차(${remaining}일)를 초과합니다. 계속 신청하시겠습니까?`)) {
        return;
      }
    }

    const formattedReason = leaveType === 'HOURLY' 
      ? `[시간차 ${hourlyHours}시간${timeSchedule.trim() ? ` / ${timeSchedule.trim()}` : ''}] ${reason.trim()}`
      : reason.trim();

    onSubmit({
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      type: leaveType,
      startDate,
      endDate: (leaveType === 'HALF_AM' || leaveType === 'HALF_PM' || leaveType === 'HOURLY' || leaveType === 'QUARTER') ? startDate : endDate,
      daysCount: calculatedDays,
      reason: formattedReason,
      contactEmergency: contactEmergency.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex flex-col justify-start sm:justify-center items-center">
      {/* Modal Box with clean viewport constraint to avoid top-cutting on mobile screens */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 flex flex-col max-h-[94dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Pinned at the top */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">연차 / 휴가 신청서 작성</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                신청자: <strong className="text-slate-800 font-semibold">{employee.name}</strong> ({employee.position} {employee.department ? `· ${employee.department}` : ''})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Leave Balance Info Box */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-5 sm:px-6 py-2.5 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center space-x-2 text-slate-700">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              현재 잔여 연차: <strong className="text-blue-700 font-extrabold text-sm">{remaining}일</strong>
              <span className="text-slate-500 ml-1.5 hidden sm:inline">(총 {currentCycle?.totalGranted || 0}일 중 {currentCycle?.usedDays || 0}일 사용)</span>
            </span>
          </div>
          <span className="bg-white px-2 py-0.5 rounded-md border border-blue-200 text-xs font-bold text-blue-800 shadow-2xs">
            {currentCycle?.label?.split(' ')[0] || '현재 주기'}
          </span>
        </div>

        {/* Form Body - Scrollable inside so header & footer are never lost */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Leave Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              휴가 구분 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'ANNUAL' as LeaveType, label: '전일 연차', sub: '1.0일 차감' },
                { type: 'HALF_AM' as LeaveType, label: '오전 반차', sub: '0.5일 (오전)' },
                { type: 'HALF_PM' as LeaveType, label: '오후 반차', sub: '0.5일 (오후)' },
                { type: 'HOURLY' as LeaveType, label: '시간차', sub: '1시간 단위 차감' },
                { type: 'SPECIAL' as LeaveType, label: '경조사 휴가', sub: '특별 유급' },
                { type: 'SICK' as LeaveType, label: '병가', sub: '진단서 첨부' },
                { type: 'OFFICIAL' as LeaveType, label: '공가/예비군', sub: '증빙 제출' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setLeaveType(item.type)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    leaveType === item.type
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="font-bold text-xs sm:text-sm">{item.label}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Date and Time Selection with Single Unified Visual Calendar */}
          <div className="space-y-3.5">
            <SingleDateRangeCalendar
              isRange={leaveType === 'ANNUAL' || leaveType === 'SPECIAL' || leaveType === 'SICK' || leaveType === 'OFFICIAL'}
              startDate={startDate}
              endDate={endDate}
              onDatesChange={(newStart, newEnd) => {
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
            />

            {/* Hourly leave specific controls */}
            {leaveType === 'HOURLY' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    외출/시간차 사용 시간 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={hourlyHours}
                    onChange={(e) => setHourlyHours(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((h) => (
                      <option key={h} value={h}>
                        {h}시간 ({Number((h / 8).toFixed(3))}일 차감)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    사용 예정 시간 기재
                  </label>
                  <input
                    type="text"
                    value={timeSchedule}
                    onChange={(e) => setTimeSchedule(e.target.value)}
                    placeholder="예: 14:00 ~ 15:00 (또는 오후 2시~3시)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Deducted Days Calculation Summary Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 block">신청 차감 일수</span>
                {startDayInfo && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {startDate.replace(/-/g, '.')} ({startDayInfo.shortName})
                    {(leaveType === 'ANNUAL' || leaveType === 'SPECIAL' || leaveType === 'SICK' || leaveType === 'OFFICIAL') && startDate !== endDate && endDayInfo 
                      ? ` ~ ${endDate.replace(/-/g, '.')} (${endDayInfo.shortName})` 
                      : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-extrabold text-blue-600">
                {calculatedDays}일
              </span>
              {leaveType === 'HOURLY' && (
                <span className="text-xs text-slate-400 ml-1">({hourlyHours}시간)</span>
              )}
              {isExceeding && (
                <p className="text-[11px] text-rose-500 font-bold mt-0.5">잔여 연차 초과</p>
              )}
            </div>
          </div>

          {/* 3. Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              신청 사유 <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="leave-reason-input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="구체적인 사유를 입력하세요 (예: 개인 일정 및 휴식)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              required
            />
          </div>

          {/* 4. Emergency Contact */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>비상 연락처</span>
            </label>
            <input
              id="emergency-contact-input"
              type="text"
              value={contactEmergency}
              onChange={(e) => setContactEmergency(e.target.value)}
              placeholder="휴가 중 연락 가능한 전화번호"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* Footer Actions - Pinned at bottom of the modal */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              id="submit-leave-request-btn"
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>연차 신청서 제출</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
