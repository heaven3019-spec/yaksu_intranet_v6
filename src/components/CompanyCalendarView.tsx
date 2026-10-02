import React, { useState } from 'react';
import { Employee, LeaveRequest } from '../types';
import { getLeaveTypeBadgeColor, getLeaveTypeLabel } from '../utils/leaveCalculator';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';

interface CompanyCalendarViewProps {
  requests: LeaveRequest[];
  employees: Employee[];
  currentEmployee?: Employee;
}

export const CompanyCalendarView: React.FC<CompanyCalendarViewProps> = ({
  requests,
  employees,
  currentEmployee,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ dateStr: string; items: LeaveRequest[] } | null>(null);
  const [filterMyOnly, setFilterMyOnly] = useState<boolean>(false);

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // First day of current month and last day
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();

  // Prev month navigation
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
    setSelectedDayEvents(null);
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
    setSelectedDayEvents(null);
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (r.status !== 'APPROVED') return false;
    if (filterMyOnly && currentEmployee) {
      return r.employeeId === currentEmployee.id;
    }
    return true;
  });

  // Build days grid
  const calendarCells = [];
  // Empty padding cells for start day
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayLeaves = filteredRequests.filter((r) => r.startDate <= dStr && r.endDate >= dStr);
    calendarCells.push({ day: d, dateStr: dStr, leaves: dayLeaves });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Calendar Header Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span>동작구립 약수데이케어센터 연차 캘린더</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">승인 완료된 연차 및 휴가 일정을 캘린더에서 한눈에 확인하세요.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {currentEmployee && (
            <button
              onClick={() => setFilterMyOnly(!filterMyOnly)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                filterMyOnly
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {filterMyOnly ? '✓ 내 일정만 보기' : '전체 일정 보기'}
            </button>
          )}

          {/* Month Navigation */}
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-white text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 min-w-[90px] text-center">
              {year}년 {month + 1}월
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-white text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-semibold py-3 bg-slate-50">
          <span className="text-rose-500">일</span>
          <span className="text-slate-600">월</span>
          <span className="text-slate-600">화</span>
          <span className="text-slate-600">수</span>
          <span className="text-slate-600">목</span>
          <span className="text-slate-600">금</span>
          <span className="text-blue-500">토</span>
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="h-28 bg-slate-50/30 p-2" />;
            }

            const isToday = cell.dateStr === todayStr;
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDayEvents({ dateStr: cell.dateStr, items: cell.leaves })}
                className={`min-h-[110px] p-2.5 transition-all cursor-pointer group flex flex-col justify-between ${
                  isToday ? 'bg-blue-50/30 ring-1 ring-blue-400 inset-0' : 'hover:bg-slate-50/60'
                } ${isWeekend ? 'bg-slate-50/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : idx % 7 === 0
                        ? 'text-rose-500'
                        : idx % 7 === 6
                        ? 'text-blue-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {cell.leaves.length > 0 && (
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      {cell.leaves.length}명
                    </span>
                  )}
                </div>

                {/* Leaves in this day */}
                <div className="mt-1 space-y-1 overflow-y-auto max-h-16 no-scrollbar">
                  {cell.leaves.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 truncate border border-slate-200/60 flex items-center justify-between"
                      title={`${l.employeeName} (${l.position}) - ${l.reason}`}
                    >
                      <span className="truncate font-medium">{l.employeeName.split(' ')[0]}</span>
                      <span className="text-[9px] text-blue-600 font-medium ml-1 flex-shrink-0">
                        {l.type === 'HALF_AM' ? '오전' : l.type === 'HALF_PM' ? '오후' : l.type === 'HOURLY' ? `${Math.round(l.daysCount * 8)}h` : '연차'}
                      </span>
                    </div>
                  ))}
                  {cell.leaves.length > 3 && (
                    <span className="text-[9px] text-slate-400 block text-right">
                      +{cell.leaves.length - 3}명 더보기
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Leave Drawer / Detail Card */}
      {selectedDayEvents && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{selectedDayEvents.dateStr.replace(/-/g, '.')} 연차 / 휴가자 상세 ({selectedDayEvents.items.length}명)</span>
            </h4>
            <button
              onClick={() => setSelectedDayEvents(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              닫기
            </button>
          </div>

          {selectedDayEvents.items.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">해당 날짜에 예정된 휴가자가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
              {selectedDayEvents.items.map((item) => (
                <div key={item.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">{item.employeeName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                      {getLeaveTypeLabel(item.type)}
                    </span>
                  </div>
                  <p className="text-slate-400">{item.position}</p>
                  <p className="text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
                    {item.reason}
                  </p>
                  {item.contactEmergency && (
                    <p className="text-[11px] text-slate-400">비상연락: {item.contactEmergency}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
