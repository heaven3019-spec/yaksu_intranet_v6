import React from 'react';
import { Employee } from '../types';
import { 
  Building2, 
  Calendar, 
  Clock, 
  User, 
  ShieldCheck, 
  Users, 
  CalendarDays, 
  RotateCcw,
  FileText,
  LogOut,
  LayoutDashboard,
  UserCheck,
  RefreshCw
} from 'lucide-react';

interface NavbarProps {
  currentEmployee: Employee;
  activeTab: string;
  onChangeTab: (tab: string) => void;
  pendingCount: number;
  onLogout: () => void;
  onResetData: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentEmployee,
  activeTab,
  onChangeTab,
  pendingCount,
  onLogout,
  onResetData,
  onManualSync,
  isSyncing,
}) => {
  const isAdmin = currentEmployee.role === 'ADMIN';

  const todayStr = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Intranet Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ========================================================= */}
        {/* MOBILE VIEW (< sm): 2-line layout for 50-60대 readability */}
        {/* ========================================================= */}
        <div className="block sm:hidden py-2.5">
          {/* Line 1: Logo & Center Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                약수
              </div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                동작구립 약수데이케어센터
              </h1>
            </div>
            {onManualSync && (
              <button
                onClick={onManualSync}
                className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                title="새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Line 2 (Enter / 줄바꿈): Employee Name & Big Easy Logout Button */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-2xs ${
                isAdmin ? 'bg-slate-900' : 'bg-blue-600'
              }`}>
                {currentEmployee.name.slice(0, 1)}
              </div>
              <div className="leading-tight">
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-extrabold text-slate-900">
                    {currentEmployee.name}
                  </span>
                  <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                    {currentEmployee.position}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded">
                      관리자
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Prominent, touch-friendly Logout Button for 50-60대 */}
            <button
              id="mobile-logout-btn"
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DESKTOP VIEW (>= sm): Standard single-line header */}
        {/* ========================================================= */}
        <div className="hidden sm:flex items-center justify-between h-16">
          {/* Logo & System Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                약수
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>동작구립 약수데이케어센터</span>
              </h1>
            </div>
            <span className="h-4 w-px bg-slate-200 hidden sm:block"></span>
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                연차 관리 시스템
              </span>
              <span className="text-xs text-slate-400 font-normal hidden lg:inline">
                {isAdmin ? '관리자 권한 접속중' : '직원 보안 로그인'}
              </span>
            </div>
          </div>

          {/* Right Section: User Profile, Live Sync Status & Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Sync Status Indicator & Manual Sync Button */}
            {onManualSync && (
              <button
                id="manual-sync-btn"
                onClick={onManualSync}
                className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                title="클릭하여 최신 연차 신청 내역 즉시 새로고침"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline font-semibold">실시간 동기화</span>
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Today Date Badge */}
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{todayStr}</span>
            </div>

            {/* Current Logged In User Info */}
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
                isAdmin ? 'bg-slate-900' : 'bg-blue-600'
              }`}>
                {currentEmployee.name.slice(0, 1)}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-900">{currentEmployee.name}</span>
                  {isAdmin ? (
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded">
                      관리자
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                      ID: {currentEmployee.loginId}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">{currentEmployee.position}</p>
              </div>

              {/* Logout Button */}
              <button
                id="logout-btn"
                onClick={onLogout}
                className="ml-1 sm:ml-2 p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>

            {/* Reset seed data button (Subtle) */}
            <button
              id="reset-data-btn"
              onClick={() => {
                if (confirm('초기 샘플 데이터로 복원하시겠습니까?')) {
                  onResetData();
                }
              }}
              title="데이터 초기화"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Filtered by Role */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-100 pt-1 -mb-px overflow-x-auto no-scrollbar touch-pan-x">
          {isAdmin ? (
            /* ADMIN TABS - Priority 1: 관리자 결재 승인 */
            <>
              <button
                id="tab-approval"
                onClick={() => onChangeTab('approval')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap relative cursor-pointer min-h-[44px] ${
                  activeTab === 'approval'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>관리자 결재 승인</span>
                {pendingCount > 0 && (
                  <span className="ml-1 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse shadow-xs">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                id="tab-admin-overview"
                onClick={() => onChangeTab('admin-overview')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer min-h-[44px] ${
                  activeTab === 'admin-overview'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                <span>전사 종합 대시보드</span>
              </button>

              <button
                id="tab-today-status"
                onClick={() => onChangeTab('today-status')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer min-h-[44px] ${
                  activeTab === 'today-status'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <span>오늘의 연차 사용 현황</span>
              </button>

              <button
                id="tab-employee-list"
                onClick={() => onChangeTab('employees')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer min-h-[44px] ${
                  activeTab === 'employees'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>전사 직원 관리</span>
              </button>
            </>
          ) : (
            /* EMPLOYEE TABS */
            <>
              <button
                id="tab-my-dashboard"
                onClick={() => onChangeTab('dashboard')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer min-h-[44px] ${
                  activeTab === 'dashboard'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span>내 연차 현황 & 신청</span>
              </button>

              <button
                id="tab-yearly-view"
                onClick={() => onChangeTab('yearly')}
                className={`flex items-center space-x-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer min-h-[44px] ${
                  activeTab === 'yearly'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 sm:bg-transparent rounded-t-lg sm:rounded-none'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span>내 1년 연차대장</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
