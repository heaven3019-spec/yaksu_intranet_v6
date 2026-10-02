import React, { useState } from 'react';
import { Employee, LeaveCalculationMode, LeaveRequest } from '../types';
import { 
  calculateEmployeeCycles, 
  calculateLegalAnnualLeaveDays, 
  calculateTenure 
} from '../utils/leaveCalculator';
import { exportEmployeesSummaryToExcel } from '../utils/excelExport';
import { 
  Users, 
  UserPlus, 
  Edit3, 
  Calendar, 
  Clock, 
  Award, 
  ChevronRight, 
  Search, 
  X, 
  Check,
  TrendingUp,
  FileText,
  KeyRound,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Sliders,
  Trash2,
  UserMinus,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';

interface AdminEmployeeListProps {
  employees: Employee[];
  requests: LeaveRequest[];
  onAddEmployee: (emp: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (empId: string) => void;
  onRetireEmployee: (empId: string, retiredDate: string) => void;
  onRestoreEmployee: (empId: string) => void;
  onSelectEmployeeForYearly: (emp: Employee) => void;
  initialTab?: 'ACTIVE' | 'RETIRED';
}

type SortField = 'NAME' | 'JOIN_DATE' | 'GRANT_DAYS' | 'USAGE_RATE';
type SortDirection = 'ASC' | 'DESC';

export const AdminEmployeeList: React.FC<AdminEmployeeListProps> = ({
  employees,
  requests,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onRetireEmployee,
  onRestoreEmployee,
  onSelectEmployeeForYearly,
  initialTab = 'ACTIVE',
}) => {
  const [currentTab, setCurrentTab] = useState<'ACTIVE' | 'RETIRED'>(initialTab);
  const [search, setSearch] = useState('');
  
  // Sorting states (Name alphabetical vs Join Date by default)
  const [sortField, setSortField] = useState<SortField>('NAME');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editEmpModal, setEditEmpModal] = useState<Employee | null>(null);

  // Modals for Retire & Delete
  const [retireTargetEmp, setRetireTargetEmp] = useState<Employee | null>(null);
  const [retireDateInput, setRetireDateInput] = useState<string>(new Date().toISOString().split('T')[0]);

  const [deleteTargetEmp, setDeleteTargetEmp] = useState<Employee | null>(null);

  // Form states for Add
  const [newName, setNewName] = useState('');
  const [newLoginId, setNewLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [newPosition, setNewPosition] = useState('사회복지사');
  const [newJoinDate, setNewJoinDate] = useState('2025-01-02');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('010-0000-0000');
  const [newCalculationMode, setNewCalculationMode] = useState<LeaveCalculationMode>('AUTO');
  const [newManualDays, setNewManualDays] = useState<number>(15);
  const [newExtraDays, setNewExtraDays] = useState<number>(0);

  // Separate Active and Retired employees (시스템 관리자는 전사 직원 연차 관리 명부에서 제외)
  const staffOnly = employees.filter((e) => e.role !== 'ADMIN' && e.id !== 'admin-001');
  const activeEmployees = staffOnly.filter((e) => e.status !== 'RETIRED');
  const retiredEmployees = staffOnly.filter((e) => e.status === 'RETIRED');

  // Filtered list
  const filteredEmployees = (currentTab === 'ACTIVE' ? activeEmployees : retiredEmployees).filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      e.loginId.toLowerCase().includes(q)
    );
  });

  // Calculate summaries and sorting
  const employeeSummaries = filteredEmployees.map((emp) => {
    const tenure = calculateTenure(emp.joinDate);
    const cycles = calculateEmployeeCycles(emp, requests);
    const currentCycle = cycles.find((c) => c.isCurrent) || cycles[0];
    return {
      emp,
      tenure,
      currentCycle,
    };
  });

  // Apply sorting
  const sortedSummaries = [...employeeSummaries].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'NAME') {
      cmp = a.emp.name.localeCompare(b.emp.name, 'ko-KR');
    } else if (sortField === 'JOIN_DATE') {
      cmp = a.emp.joinDate.localeCompare(b.emp.joinDate);
    } else if (sortField === 'GRANT_DAYS') {
      cmp = (a.currentCycle?.totalGranted || 0) - (b.currentCycle?.totalGranted || 0);
    } else if (sortField === 'USAGE_RATE') {
      cmp = (a.currentCycle?.usageRate || 0) - (b.currentCycle?.usageRate || 0);
    }
    return sortDirection === 'ASC' ? cmp : -cmp;
  });

  const totalActiveCount = activeEmployees.length;
  const totalRetiredCount = retiredEmployees.length;

  const totalGrantedSum = activeEmployees.reduce((sum, emp) => {
    const cycles = calculateEmployeeCycles(emp, requests);
    const curr = cycles.find((c) => c.isCurrent) || cycles[0];
    return sum + (curr?.totalGranted || 0);
  }, 0);

  const totalUsedSum = activeEmployees.reduce((sum, emp) => {
    const cycles = calculateEmployeeCycles(emp, requests);
    const curr = cycles.find((c) => c.isCurrent) || cycles[0];
    return sum + (curr?.usedDays || 0);
  }, 0);

  const totalRemainingSum = activeEmployees.reduce((sum, emp) => {
    const cycles = calculateEmployeeCycles(emp, requests);
    const curr = cycles.find((c) => c.isCurrent) || cycles[0];
    return sum + (curr?.remainingDays || 0);
  }, 0);

  const avgUsageRate = totalGrantedSum > 0 ? Math.round((totalUsedSum / totalGrantedSum) * 100) : 0;

  // Toggle sort from table header
  const handleToggleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDirection('ASC');
    }
  };

  // Auto-calculated legal leave hint when setting join date
  const estimatedTenure = calculateTenure(newJoinDate);
  const estimatedLegalDays = calculateLegalAnnualLeaveDays(newJoinDate);

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newJoinDate) return;

    const generatedLoginId = newLoginId.trim() || `emp${Date.now().toString().slice(-4)}`;

    onAddEmployee({
      loginId: generatedLoginId,
      password: newPassword.trim() || '1234',
      name: newName.trim(),
      position: newPosition.trim(),
      email: newEmail.trim() || `${generatedLoginId}@yaksoo.kr`,
      phone: newPhone.trim(),
      joinDate: newJoinDate,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      calculationMode: newCalculationMode,
      manualBaseGrantedDays: newCalculationMode === 'MANUAL' ? Number(newManualDays) : undefined,
      extraGrantedDays: Number(newExtraDays) || 0,
      avatarColor: 'from-blue-500 to-indigo-600',
    });

    setIsAddModalOpen(false);
    setNewName('');
    setNewLoginId('');
    setNewPassword('1234');
    setNewCalculationMode('AUTO');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmpModal) return;
    onUpdateEmployee(editEmpModal);
    setEditEmpModal(null);
  };

  const handleConfirmRetire = () => {
    if (!retireTargetEmp) return;
    onRetireEmployee(retireTargetEmp.id, retireDateInput);
    setRetireTargetEmp(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetEmp) return;
    onDeleteEmployee(deleteTargetEmp.id);
    setDeleteTargetEmp(null);
  };

  return (
    <div className="space-y-4">
      {/* Compact Stat Bar Optimized for 13 Employees View */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[11px] font-semibold">재직 임직원</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{totalActiveCount}</span>
              <span className="text-xs text-slate-400">명</span>
              {totalRetiredCount > 0 && (
                <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                  (퇴사 {totalRetiredCount}명)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[11px] font-semibold">총 부여 일수</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-bold text-blue-600">{totalGrantedSum}</span>
              <span className="text-xs text-slate-400">일</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[11px] font-semibold">총 사용 일수</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-bold text-emerald-600">{totalUsedSum}</span>
              <span className="text-xs text-slate-400">일 ({avgUsageRate}%)</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[11px] font-semibold">잔여 미사용 연차</p>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-bold text-slate-800">{totalRemainingSum}</span>
              <span className="text-xs text-slate-400">일</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Container - Compact & Single-Screen Oriented */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Header & Segmentation */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>전사 직원 및 퇴사자 관리</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {currentTab === 'ACTIVE' ? `재직 ${sortedSummaries.length}명` : `퇴사 ${sortedSummaries.length}명`}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportEmployeesSummaryToExcel(staffOnly, requests)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="임직원 연차 현황 엑셀 다운로드"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>엑셀 다운로드</span>
              </button>

              <button
                id="add-employee-btn"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>직원 신규 등록</span>
              </button>
            </div>
          </div>

          {/* Active/Retired Tabs, Sorting Selector & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            {/* Tab switchers: Active vs Retired */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentTab('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  currentTab === 'ACTIVE'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>재직자 목록 ({activeEmployees.length}명)</span>
              </button>

              <button
                onClick={() => setCurrentTab('RETIRED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  currentTab === 'RETIRED'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>퇴사자 분류 관리 ({retiredEmployees.length}명)</span>
              </button>
            </div>

            {/* Sorting Controls & Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort selector */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">정렬:</span>
                <select
                  value={`${sortField}_${sortDirection}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split('_') as [SortField, SortDirection];
                    setSortField(field);
                    setSortDirection(dir);
                  }}
                  className="text-xs bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="NAME_ASC">이름순 (가나다 ㄱ→ㅎ)</option>
                  <option value="NAME_DESC">이름 역순 (ㅎ→ㄱ)</option>
                  <option value="JOIN_DATE_ASC">입사일순 (선임·오래된순)</option>
                  <option value="JOIN_DATE_DESC">입사일순 (신입·최신순)</option>
                  <option value="GRANT_DAYS_DESC">부여일수 많은순</option>
                  <option value="USAGE_RATE_DESC">소진율 높은순</option>
                </select>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="이름, 직급 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Compact Employee Table Optimized for ~13 Employees */}
        <div className="overflow-x-auto">
          {sortedSummaries.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">
                {currentTab === 'ACTIVE' ? '등록된 재직자가 없습니다.' : '등록된 퇴사자가 없습니다.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {currentTab === 'ACTIVE' ? '상단의 [직원 신규 등록]을 통해 직원을 추가해보세요.' : '직원 관리에서 [퇴사 처리]를 진행하면 이곳에서 별도 관리됩니다.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 text-slate-600 font-semibold border-b border-slate-100 text-[11px]">
                <tr>
                  <th 
                    onClick={() => handleToggleHeaderSort('NAME')}
                    className="px-4 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="클릭하여 이름순 정렬"
                  >
                    <div className="flex items-center space-x-1">
                      <span>직원 성명 (ID)</span>
                      {sortField === 'NAME' ? (
                        sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleToggleHeaderSort('JOIN_DATE')}
                    className="px-4 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="클릭하여 입사일순 정렬"
                  >
                    <div className="flex items-center space-x-1">
                      <span>입사일자</span>
                      {sortField === 'JOIN_DATE' ? (
                        sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>

                  {currentTab === 'RETIRED' ? (
                    <th className="px-4 py-2.5 text-rose-600">퇴사일자</th>
                  ) : (
                    <th className="px-4 py-2.5">근속기간</th>
                  )}
                  <th className="px-3 py-2.5 text-center">산정 방식</th>
                  <th 
                    onClick={() => handleToggleHeaderSort('GRANT_DAYS')}
                    className="px-3 py-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="클릭하여 총부여일 정렬"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>총 부여</span>
                      {sortField === 'GRANT_DAYS' && (
                        sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-center">사용일수</th>
                  <th className="px-3 py-2.5 text-center">잔여일수</th>
                  <th 
                    onClick={() => handleToggleHeaderSort('USAGE_RATE')}
                    className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="클릭하여 소진율 정렬"
                  >
                    <div className="flex items-center space-x-1">
                      <span>소진율</span>
                      {sortField === 'USAGE_RATE' && (
                        sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-center">관리 액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSummaries.map(({ emp, tenure, currentCycle }) => (
                  <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Employee Name & Position */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                          emp.status === 'RETIRED'
                            ? 'bg-slate-100 text-slate-500 border-slate-300'
                            : emp.role === 'ADMIN'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {emp.name.slice(0, 1)}
                        </div>
                        <div className="leading-tight">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                            <span className="font-bold text-slate-900 text-xs">{emp.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono border border-slate-200">
                              ID: <strong className="text-blue-700">{emp.loginId}</strong>
                            </span>
                            {emp.role === 'ADMIN' && (
                              <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">
                                관리자
                              </span>
                            )}
                            {emp.status === 'RETIRED' && (
                              <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                퇴사
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">{emp.position}</span>
                        </div>
                      </div>
                    </td>

                    {/* Join Date */}
                    <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap text-xs">
                      {emp.joinDate.replace(/-/g, '.')}
                    </td>

                    {/* Tenure / Retired Date */}
                    {currentTab === 'RETIRED' ? (
                      <td className="px-4 py-2.5 text-rose-600 font-semibold whitespace-nowrap text-xs">
                        {emp.retiredDate ? emp.retiredDate.replace(/-/g, '.') : '퇴사'}
                      </td>
                    ) : (
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                        <span className="text-slate-800 font-medium">
                          {tenure.years}년 {tenure.months}개월
                        </span>
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1 font-bold">
                          {tenure.years + 1}년차
                        </span>
                      </td>
                    )}

                    {/* Calculation Mode */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {emp.calculationMode === 'MANUAL' ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200 inline-flex items-center space-x-1">
                          <Sliders className="w-2.5 h-2.5" />
                          <span>수동 ({emp.manualBaseGrantedDays}일)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded border border-blue-200 inline-flex items-center space-x-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-blue-500" />
                          <span>법정 자동</span>
                        </span>
                      )}
                    </td>

                    {/* Granted */}
                    <td className="px-3 py-2.5 text-center font-bold text-slate-900 whitespace-nowrap text-xs">
                      {currentCycle?.totalGranted || 0}일
                      {emp.extraGrantedDays ? (
                        <span className="text-[9px] text-purple-600 block font-normal">+{emp.extraGrantedDays}일</span>
                      ) : null}
                    </td>

                    {/* Used */}
                    <td className="px-3 py-2.5 text-center font-bold text-blue-600 whitespace-nowrap text-xs">
                      {currentCycle?.usedDays || 0}일
                    </td>

                    {/* Remaining */}
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-600 whitespace-nowrap text-xs">
                      {currentCycle?.remainingDays || 0}일
                    </td>

                    {/* Usage Progress */}
                    <td className="px-3 py-2.5 w-28 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${currentCycle?.usageRate || 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 shrink-0">
                          {currentCycle?.usageRate || 0}%
                        </span>
                      </div>
                    </td>

                    {/* Management Actions */}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onSelectEmployeeForYearly(emp)}
                          className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                          title="1년 연차대장 조회"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>1년 대장</span>
                        </button>

                        <button
                          onClick={() => setEditEmpModal(emp)}
                          className="px-2 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors flex items-center space-x-1 cursor-pointer"
                          title="정보 수정"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>수정</span>
                        </button>

                        {emp.status === 'RETIRED' ? (
                          <button
                            onClick={() => onRestoreEmployee(emp.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
                            title="재직자로 복원"
                          >
                            <RotateCcw className="w-3 h-3 text-emerald-600" />
                            <span>복원</span>
                          </button>
                        ) : (
                          emp.role !== 'ADMIN' && (
                            <button
                              onClick={() => {
                                setRetireTargetEmp(emp);
                                setRetireDateInput(new Date().toISOString().split('T')[0]);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 transition-colors flex items-center space-x-1 cursor-pointer"
                              title="퇴사자로 변경 처리"
                            >
                              <UserMinus className="w-3 h-3 text-amber-600" />
                              <span>퇴사</span>
                            </button>
                          )
                        )}

                        {emp.role !== 'ADMIN' && (
                          <button
                            onClick={() => setDeleteTargetEmp(emp)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="직원 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Retire Employee Modal */}
      {retireTargetEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserMinus className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">직원 퇴사 처리</h3>
              </div>
              <button onClick={() => setRetireTargetEmp(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-bold">'{retireTargetEmp.name}' 직원을 퇴사자로 변경하시겠습니까?</p>
                <p className="text-[11px] text-amber-800">
                  퇴사자로 분류되면 [퇴사자 관리] 메뉴에서 별도 보관되며, 언제든지 재직자로 복원하거나 과거 연차 내역을 조회할 수 있습니다.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  퇴사일자 지정 *
                </label>
                <input
                  type="date"
                  required
                  value={retireDateInput}
                  onChange={(e) => setRetireDateInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRetireTargetEmp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRetire}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm cursor-pointer"
                >
                  퇴사 처리 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Modal */}
      {deleteTargetEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">직원 삭제 확인</h3>
              </div>
              <button onClick={() => setDeleteTargetEmp(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-2">
                <p className="font-bold text-rose-700 text-sm">
                  정말로 '{deleteTargetEmp.name}' 직원을 삭제하시겠습니까?
                </p>
                <p className="text-[11px] text-rose-800">
                  직원을 삭제하면 해당 직원의 계정 및 연차 내역이 시스템에서 완전히 제거됩니다. (단순 퇴직인 경우 '퇴사 처리'를 권장합니다.)
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetEmp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  영구 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal (Admin Only) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  <span>신규 직원 등록 및 연차 산정 설정</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  직원의 기본 인적사항과 법정/수동 연차 산정 방식을 지정합니다.
                </p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
              {/* Account Credentials */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>로그인 계정 설정 (필수)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">로그인 ID (고유 아이디) *</label>
                    <input
                      type="text"
                      required
                      value={newLoginId}
                      onChange={(e) => setNewLoginId(e.target.value)}
                      placeholder="예: kang, user001"
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">비밀번호 *</label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="기본: 1234"
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">직원 이름 *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="예: 강하늘"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">직급 / 직책 *</label>
                  <input
                    type="text"
                    required
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    placeholder="예: 사회복지사, 간호조무사"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">입사일자 (기준일) *</label>
                <input
                  type="date"
                  required
                  value={newJoinDate}
                  onChange={(e) => setNewJoinDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-blue-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* Leave Calculation Mode (Auto vs Manual) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>연차 산정 방식 선택</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    근속 {estimatedTenure.years}년 {estimatedTenure.months}개월차 (법정 기본 {estimatedLegalDays}일)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCalculationMode('AUTO')}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      newCalculationMode === 'AUTO'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>근로기준법 자동 산정</span>
                      {newCalculationMode === 'AUTO' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      입사일 기준 연차(15일, 3년차 16일 등) 자동 계산
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCalculationMode('MANUAL')}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      newCalculationMode === 'MANUAL'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>관리자 수동 직접 지정</span>
                      {newCalculationMode === 'MANUAL' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      관리자가 부여 일수를 직접 수동 입력하여 지정
                    </p>
                  </button>
                </div>

                {newCalculationMode === 'MANUAL' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      수동 지정 기본 연차 일수 (일) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      required
                      value={newManualDays}
                      onChange={(e) => setNewManualDays(Number(e.target.value))}
                      className="w-full text-xs bg-white border border-purple-300 rounded-xl px-3 py-2 font-bold text-purple-800 focus:ring-2 focus:ring-purple-500 outline-hidden"
                    />
                    <p className="text-[11px] text-purple-600 mt-1">
                      * 법정 산정일과 관계없이 지정한 {newManualDays}일이 당해 연차로 고정 부여됩니다.
                    </p>
                  </div>
                )}
              </div>

              {/* Extra Days & Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">특별 가산 휴가 (포상 등)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={newExtraDays}
                    onChange={(e) => setNewExtraDays(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">비상 연락처</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  직원 등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <span>{editEmpModal.name} 직원 정보 및 연차 산정 수정</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  입사일 및 연차 산정 방식(법정 자동 vs 관리자 수동 지정)을 변경합니다.
                </p>
              </div>
              <button onClick={() => setEditEmpModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Account ID / Password */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">로그인 ID</label>
                  <input
                    type="text"
                    required
                    value={editEmpModal.loginId}
                    onChange={(e) => setEditEmpModal({ ...editEmpModal, loginId: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">비밀번호 변경</label>
                  <input
                    type="text"
                    value={editEmpModal.password || '1234'}
                    onChange={(e) => setEditEmpModal({ ...editEmpModal, password: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">이름</label>
                  <input
                    type="text"
                    value={editEmpModal.name}
                    onChange={(e) => setEditEmpModal({ ...editEmpModal, name: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">직급</label>
                  <input
                    type="text"
                    value={editEmpModal.position}
                    onChange={(e) => setEditEmpModal({ ...editEmpModal, position: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Join Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  입사일자 (기준일)
                </label>
                <input
                  type="date"
                  required
                  value={editEmpModal.joinDate}
                  onChange={(e) => setEditEmpModal({ ...editEmpModal, joinDate: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-blue-700"
                />
              </div>

              {/* Calculation Mode Toggle in Edit */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 block">
                  연차 산정 방식 수정
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEmpModal({ ...editEmpModal, calculationMode: 'AUTO' })}
                    className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      editEmpModal.calculationMode !== 'MANUAL'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    법정 자동산정
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEmpModal({ 
                      ...editEmpModal, 
                      calculationMode: 'MANUAL',
                      manualBaseGrantedDays: editEmpModal.manualBaseGrantedDays || 15 
                    })}
                    className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      editEmpModal.calculationMode === 'MANUAL'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    관리자 수동 직접 지정
                  </button>
                </div>

                {editEmpModal.calculationMode === 'MANUAL' && (
                  <div className="pt-1 animate-in fade-in">
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      수동 지정 기본 연차 일수 (일) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      required
                      value={editEmpModal.manualBaseGrantedDays || 15}
                      onChange={(e) => setEditEmpModal({ 
                        ...editEmpModal, 
                        manualBaseGrantedDays: Number(e.target.value) 
                      })}
                      className="w-full text-xs bg-white border border-purple-300 rounded-xl px-3 py-2 font-bold text-purple-800"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  특별 가산 휴가 일수 (포상/대체휴가 등)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={editEmpModal.extraGrantedDays || 0}
                  onChange={(e) => setEditEmpModal({ ...editEmpModal, extraGrantedDays: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-purple-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditEmpModal(null)}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  수정 사항 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

