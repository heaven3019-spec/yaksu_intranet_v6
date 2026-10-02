import React, { useState, useMemo } from 'react';
import { Employee, LeaveRequest } from '../types';
import { 
  calculateTenure, 
  getLeaveTypeBadgeColor, 
  getLeaveTypeLabel, 
  getStatusBadge 
} from '../utils/leaveCalculator';
import { 
  Check, 
  X, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  AlertCircle, 
  UserCheck, 
  Phone, 
  MessageSquare,
  Search,
  Users,
  ArrowUpDown,
  Filter,
  Trash2,
  Ban
} from 'lucide-react';

interface AdminApprovalViewProps {
  requests: LeaveRequest[];
  employees: Employee[];
  currentAdmin: Employee;
  onApprove: (requestId: string, adminName: string) => void;
  onReject: (requestId: string, adminName: string, reason: string) => void;
  onCancelApproved: (requestId: string, adminName: string, reason?: string) => void;
  onBulkCancelApproved?: (requestIds: string[], adminName: string, reason?: string) => void;
  onDeleteRequest?: (requestId: string) => void;
  onBulkDeleteRequests?: (requestIds: string[]) => void;
}

export const AdminApprovalView: React.FC<AdminApprovalViewProps> = ({
  requests,
  employees,
  currentAdmin,
  onApprove,
  onReject,
  onCancelApproved,
  onBulkCancelApproved,
  onDeleteRequest,
  onBulkDeleteRequests,
}) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'CANCELLED'>('PENDING');
  const [rejectModalReq, setRejectModalReq] = useState<LeaveRequest | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [cancelModalReq, setCancelModalReq] = useState<LeaveRequest | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Cancel Selection State
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<string[]>([]);
  const [isBulkCancelModalOpen, setIsBulkCancelModalOpen] = useState<boolean>(false);
  const [bulkCancelReasonInput, setBulkCancelReasonInput] = useState<string>('');

  // Delete Selection State (Cancelled Tab)
  const [selectedCancelledIds, setSelectedCancelledIds] = useState<string[]>([]);
  const [deleteConfirmModalReq, setDeleteConfirmModalReq] = useState<LeaveRequest | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);

  // History Tab Specific Filters
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState<string>('ALL');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('ALL');
  const [historySortOrder, setHistorySortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>('ALL');

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'PENDING'), [requests]);
  const historyRequests = useMemo(() => requests.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED'), [requests]);
  const cancelledRequests = useMemo(() => requests.filter((r) => r.status === 'CANCELLED'), [requests]);

  // Distinct available months in history requests (YYYY-MM)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    historyRequests.forEach((r) => {
      if (r.startDate && r.startDate.length >= 7) {
        months.add(r.startDate.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [historyRequests]);

  // Staff breakdown with history statistics
  const staffWithHistory = useMemo(() => {
    const map = new Map<string, { total: number; approvedDays: number; emp?: Employee }>();
    historyRequests.forEach((r) => {
      const key = r.employeeName;
      if (!map.has(key)) {
        const found = employees.find((e) => e.name === key || e.id === r.employeeId);
        map.set(key, { total: 0, approvedDays: 0, emp: found });
      }
      const item = map.get(key)!;
      item.total += 1;
      if (r.status === 'APPROVED') {
        item.approvedDays += r.daysCount;
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
  }, [historyRequests, employees]);

  // Selected employee information for detailed summary banner
  const selectedEmployeeInfo = useMemo(() => {
    if (historyEmployeeFilter === 'ALL') return null;
    const foundEmp = employees.find((e) => e.name === historyEmployeeFilter || e.id === historyEmployeeFilter);
    const historyList = historyRequests.filter((r) => r.employeeName === historyEmployeeFilter || r.employeeId === historyEmployeeFilter);
    const approvedDays = historyList.filter((r) => r.status === 'APPROVED').reduce((sum, r) => sum + r.daysCount, 0);

    return {
      name: foundEmp?.name || historyEmployeeFilter,
      position: foundEmp?.position || historyList[0]?.position || '직원',
      joinDate: foundEmp?.joinDate,
      totalCount: historyList.length,
      approvedDays: Number(approvedDays.toFixed(2)),
    };
  }, [historyEmployeeFilter, employees, historyRequests]);

  // Filtered and sorted displayed list
  const displayedList = useMemo(() => {
    if (activeTab === 'PENDING') {
      return pendingRequests.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.employeeName.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
        );
      });
    }

    if (activeTab === 'CANCELLED') {
      let list = cancelledRequests;

      // 1. Employee Filter
      if (historyEmployeeFilter !== 'ALL') {
        list = list.filter((r) => r.employeeName === historyEmployeeFilter || r.employeeId === historyEmployeeFilter);
      }

      // 2. Month Filter
      if (historyMonthFilter !== 'ALL') {
        list = list.filter((r) => (r.startDate && r.startDate.startsWith(historyMonthFilter)) || (r.cancelledAt && r.cancelledAt.startsWith(historyMonthFilter)));
      }

      // 3. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (r) =>
            r.employeeName.toLowerCase().includes(q) ||
            r.position.toLowerCase().includes(q) ||
            r.reason.toLowerCase().includes(q) ||
            (r.cancelReason && r.cancelReason.toLowerCase().includes(q))
        );
      }

      // 4. Date Sort (최신 날짜순 vs 과거 날짜순)
      return [...list].sort((a, b) => {
        const dateA = a.cancelledAt || a.startDate;
        const dateB = b.cancelledAt || b.startDate;
        if (historySortOrder === 'DESC') {
          return dateB.localeCompare(dateA);
        } else {
          return dateA.localeCompare(dateB);
        }
      });
    }

    // HISTORY TAB
    let list = historyRequests;

    // 1. Employee Filter
    if (historyEmployeeFilter !== 'ALL') {
      list = list.filter((r) => r.employeeName === historyEmployeeFilter || r.employeeId === historyEmployeeFilter);
    }

    // 2. Month Filter
    if (historyMonthFilter !== 'ALL') {
      list = list.filter((r) => r.startDate.startsWith(historyMonthFilter));
    }

    // 3. Status Filter
    if (historyStatusFilter !== 'ALL') {
      list = list.filter((r) => r.status === historyStatusFilter);
    }

    // 4. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }

    // 5. Date Sort (최신 날짜순 vs 과거 날짜순)
    return [...list].sort((a, b) => {
      const dateA = a.startDate;
      const dateB = b.startDate;
      if (historySortOrder === 'DESC') {
        return dateB.localeCompare(dateA);
      } else {
        return dateA.localeCompare(dateB);
      }
    });
  }, [
    activeTab,
    pendingRequests,
    historyRequests,
    historyEmployeeFilter,
    historyMonthFilter,
    historyStatusFilter,
    historySortOrder,
    searchQuery,
  ]);

  const handleOpenReject = (req: LeaveRequest) => {
    setRejectModalReq(req);
    setRejectReasonInput('');
  };

  const handleConfirmReject = () => {
    if (!rejectModalReq) return;
    if (!rejectReasonInput.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }
    onReject(rejectModalReq.id, currentAdmin.name, rejectReasonInput.trim());
    setRejectModalReq(null);
  };

  const handleOpenCancelApproved = (req: LeaveRequest) => {
    setCancelModalReq(req);
    setCancelReasonInput('');
  };

  const handleConfirmCancelApproved = () => {
    if (!cancelModalReq) return;
    if (typeof onCancelApproved === 'function') {
      onCancelApproved(cancelModalReq.id, currentAdmin.name, cancelReasonInput.trim() || '관리자 연차 승인 취소');
    }
    setCancelModalReq(null);
  };

  // Approved items in current filtered view
  const approvedHistoryInFilter = useMemo(() => {
    return displayedList.filter((r) => r.status === 'APPROVED');
  }, [displayedList]);

  const allApprovedSelected =
    approvedHistoryInFilter.length > 0 &&
    approvedHistoryInFilter.every((r) => selectedApprovedIds.includes(r.id));

  const handleToggleSelect = (id: string) => {
    setSelectedApprovedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (allApprovedSelected) {
      setSelectedApprovedIds([]);
    } else {
      setSelectedApprovedIds(approvedHistoryInFilter.map((r) => r.id));
    }
  };

  const handleOpenBulkCancel = () => {
    if (selectedApprovedIds.length === 0) {
      alert('승인 취소할 항목을 1개 이상 선택해주세요.');
      return;
    }
    setBulkCancelReasonInput('');
    setIsBulkCancelModalOpen(true);
  };

  const handleConfirmBulkCancel = () => {
    if (selectedApprovedIds.length === 0) return;
    const reason = bulkCancelReasonInput.trim() || '관리자 일괄 승인 취소';
    if (onBulkCancelApproved) {
      onBulkCancelApproved(selectedApprovedIds, currentAdmin.name, reason);
    } else if (typeof onCancelApproved === 'function') {
      selectedApprovedIds.forEach((id) => {
        onCancelApproved(id, currentAdmin.name, reason);
      });
    }
    setSelectedApprovedIds([]);
    setIsBulkCancelModalOpen(false);
  };

  // Deletion handlers for Cancelled Tab
  const handleOpenDelete = (req: LeaveRequest) => {
    setDeleteConfirmModalReq(req);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmModalReq) return;
    if (onDeleteRequest) {
      onDeleteRequest(deleteConfirmModalReq.id);
    }
    setSelectedCancelledIds((prev) => prev.filter((id) => id !== deleteConfirmModalReq.id));
    setDeleteConfirmModalReq(null);
  };

  const handleToggleSelectCancelled = (id: string) => {
    setSelectedCancelledIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allCancelledSelected =
    displayedList.length > 0 &&
    displayedList.every((r) => selectedCancelledIds.includes(r.id));

  const handleToggleSelectAllCancelled = () => {
    if (allCancelledSelected) {
      setSelectedCancelledIds([]);
    } else {
      setSelectedCancelledIds(displayedList.map((r) => r.id));
    }
  };

  const handleOpenBulkDelete = () => {
    if (selectedCancelledIds.length === 0) {
      alert('삭제할 취소 내역을 1개 이상 선택해주세요.');
      return;
    }
    setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedCancelledIds.length === 0) return;
    if (onBulkDeleteRequests) {
      onBulkDeleteRequests(selectedCancelledIds);
    } else if (onDeleteRequest) {
      selectedCancelledIds.forEach((id) => onDeleteRequest(id));
    }
    setSelectedCancelledIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleApproveAll = () => {
    if (pendingRequests.length === 0) return;
    if (confirm(`대기 중인 ${pendingRequests.length}건의 연차 신청을 모두 일괄 승인하시겠습니까?`)) {
      pendingRequests.forEach((req) => {
        onApprove(req.id, currentAdmin.name);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">관리자 연차 결재 및 승인 센터</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            결재권자: <strong className="text-slate-800 font-semibold">{currentAdmin.name} ({currentAdmin.position})</strong> · 직원들의 연차 신청서를 검토하여 승인/반려하거나, 기존 승인된 연차를 취소 처리할 수 있습니다.
          </p>
        </div>

        {/* Action / Count */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {pendingRequests.length > 0 && (
            <button
              id="approve-all-btn"
              onClick={handleApproveAll}
              className="w-full md:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>대기 전체 일괄 승인 ({pendingRequests.length}건)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            id="tab-pending-approvals"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap min-h-[40px] ${
              activeTab === 'PENDING'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>결재 대기 목록</span>
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            id="tab-history-approvals"
            onClick={() => {
              setActiveTab('HISTORY');
              setSelectedApprovedIds([]);
              setSelectedCancelledIds([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap min-h-[40px] ${
              activeTab === 'HISTORY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>처리 완료 내역 ({historyRequests.length})</span>
          </button>

          <button
            id="tab-cancelled-approvals"
            onClick={() => {
              setActiveTab('CANCELLED');
              setSelectedApprovedIds([]);
              setSelectedCancelledIds([]);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap min-h-[40px] ${
              activeTab === 'CANCELLED'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>취소 내역</span>
            {cancelledRequests.length > 0 && (
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                activeTab === 'CANCELLED' ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {cancelledRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="신청자명, 직급, 사유 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden min-h-[40px]"
          />
        </div>
      </div>

      {/* History Tab Advanced Filter Toolbar */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          {/* Selected Employee Summary Card (shown when an employee is picked) */}
          {selectedEmployeeInfo && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                  {selectedEmployeeInfo.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {selectedEmployeeInfo.name}
                    </h3>
                    <span className="text-xs text-blue-700 bg-blue-100/80 font-bold px-2 py-0.5 rounded-md">
                      {selectedEmployeeInfo.position}
                    </span>
                    {selectedEmployeeInfo.joinDate && (
                      <span className="text-[11px] text-slate-500">
                        (입사: {selectedEmployeeInfo.joinDate})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <strong>{selectedEmployeeInfo.name}</strong> 님의 연차 처리 완료 내역이 날짜순으로 표시되고 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <div className="bg-white px-3.5 py-1.5 rounded-xl border border-blue-200 text-xs shadow-2xs">
                  <span className="text-slate-500">처리 건수:</span>{' '}
                  <strong className="text-slate-900 font-bold">{selectedEmployeeInfo.totalCount}건</strong>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">승인 연차:</span>{' '}
                  <strong className="text-blue-600 font-extrabold">{selectedEmployeeInfo.approvedDays}일</strong>
                </div>

                <button
                  onClick={() => setHistoryEmployeeFilter('ALL')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
                  title="전체 직원 목록으로 돌아가기"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>전체 직원 보기</span>
                </button>
              </div>
            </div>
          )}

          {/* Filter Controls Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 1. Employee Filter Dropdown */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">직원별 필터:</label>
                <select
                  value={historyEmployeeFilter}
                  onChange={(e) => setHistoryEmployeeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                >
                  <option value="ALL">전체 직원 보기 ({historyRequests.length}건)</option>
                  {staffWithHistory.map(([name, data]) => (
                    <option key={name} value={name}>
                      {name} {data.emp?.position ? `(${data.emp.position})` : ''} - {data.total}건 ({data.approvedDays}일 승인)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Month Filter Dropdown */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">월별 필터:</label>
                <select
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                >
                  <option value="ALL">전체 기간</option>
                  {availableMonths.map((m) => {
                    const [year, month] = m.split('-');
                    return (
                      <option key={m} value={m}>
                        {year}년 {parseInt(month, 10)}월
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Date Sort Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">정렬:</span>
                <button
                  type="button"
                  onClick={() => setHistorySortOrder(historySortOrder === 'DESC' ? 'ASC' : 'DESC')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="클릭 시 최신순/과거순 전환"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>{historySortOrder === 'DESC' ? '최신 날짜순 ↓' : '과거 날짜순 ↑'}</span>
                </button>
              </div>

              {/* 4. Status Filter Pills */}
              <div className="flex items-center space-x-1 text-xs">
                {(['ALL', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => {
                  const labels: Record<string, string> = {
                    ALL: '전체',
                    APPROVED: '승인',
                    REJECTED: '반려',
                    CANCELLED: '취소',
                  };
                  const isActive = historyStatusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHistoryStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {labels[st]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Employee Chips for Instant 1-Click Filtering */}
            {staffWithHistory.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">직원 퀵선택:</span>
                <button
                  type="button"
                  onClick={() => setHistoryEmployeeFilter('ALL')}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    historyEmployeeFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  전체
                </button>
                {staffWithHistory.map(([name, data]) => {
                  const isSelected = historyEmployeeFilter === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setHistoryEmployeeFilter(name)}
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{name}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        ({data.total})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulk Selection and Batch Action Bar for Approved Leaves */}
          {approvedHistoryInFilter.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center space-x-2 text-xs font-bold text-slate-800 bg-white border border-amber-300 hover:bg-amber-100/60 active:bg-amber-200/60 px-3.5 py-2 rounded-xl cursor-pointer shadow-2xs transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={allApprovedSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>
                    {allApprovedSelected
                      ? '승인건 전체 선택 해제'
                      : `현재 화면 승인건 전체 선택 (${approvedHistoryInFilter.length}건)`}
                  </span>
                </button>

                <div className="text-xs text-amber-950 flex items-center space-x-1.5">
                  <span>선택된 승인 항목:</span>
                  <strong className="font-extrabold text-amber-800 text-sm bg-white px-2 py-0.5 rounded-lg border border-amber-300">
                    {selectedApprovedIds.length}건
                  </strong>
                  <span className="text-slate-500">(승인완료 총 {approvedHistoryInFilter.length}건 중)</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {selectedApprovedIds.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedApprovedIds([])}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      선택 해제
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenBulkCancel}
                      className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>선택한 {selectedApprovedIds.length}건 승인 취소</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApprovedIds(approvedHistoryInFilter.map((r) => r.id));
                      setBulkCancelReasonInput('');
                      setIsBulkCancelModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-900 rounded-xl cursor-pointer shadow-2xs transition-colors flex items-center space-x-1.5"
                    title="현재 조회된 모든 승인건을 일괄 취소합니다"
                  >
                    <XCircle className="w-4 h-4 text-amber-700" />
                    <span>전체 승인건 일괄 취소 ({approvedHistoryInFilter.length}건)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancelled Tab Advanced Toolbar */}
      {activeTab === 'CANCELLED' && (
        <div className="space-y-3">
          {/* Filter Controls Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 1. Employee Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">직원별 필터:</label>
                <select
                  value={historyEmployeeFilter}
                  onChange={(e) => setHistoryEmployeeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                >
                  <option value="ALL">전체 직원 보기 ({cancelledRequests.length}건)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Month Filter */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">월별 필터:</label>
                <select
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                >
                  <option value="ALL">전체 기간</option>
                  {availableMonths.map((m) => {
                    const [year, month] = m.split('-');
                    return (
                      <option key={m} value={m}>
                        {year}년 {parseInt(month, 10)}월
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Date Sort Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">정렬:</span>
                <button
                  type="button"
                  onClick={() => setHistorySortOrder(historySortOrder === 'DESC' ? 'ASC' : 'DESC')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="클릭 시 최신순/과거순 전환"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>{historySortOrder === 'DESC' ? '최신 취소순 ↓' : '과거 취소순 ↑'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Selection and Batch Action Bar for Cancelled Leaves */}
          {displayedList.length > 0 && (
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAllCancelled}
                  className="flex items-center space-x-2 text-xs font-bold text-slate-800 bg-white border border-rose-300 hover:bg-rose-100/60 active:bg-rose-200/60 px-3.5 py-2 rounded-xl cursor-pointer shadow-2xs transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={allCancelledSelected}
                    onChange={handleToggleSelectAllCancelled}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>
                    {allCancelledSelected
                      ? '취소건 전체 선택 해제'
                      : `현재 화면 취소건 전체 선택 (${displayedList.length}건)`}
                  </span>
                </button>

                <div className="text-xs text-rose-950 flex items-center space-x-1.5">
                  <span>선택된 삭제 항목:</span>
                  <strong className="font-extrabold text-rose-800 text-sm bg-white px-2 py-0.5 rounded-lg border border-rose-300">
                    {selectedCancelledIds.length}건
                  </strong>
                  <span className="text-slate-500">(현재 취소건 총 {displayedList.length}건 중)</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {selectedCancelledIds.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedCancelledIds([])}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      선택 해제
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenBulkDelete}
                      className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>선택한 {selectedCancelledIds.length}건 내역 영구 삭제</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCancelledIds(displayedList.map((r) => r.id));
                      setIsBulkDeleteModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-rose-100/70 border border-rose-300 text-rose-800 rounded-xl cursor-pointer shadow-2xs transition-colors flex items-center space-x-1.5"
                    title="현재 조회된 모든 취소 내역을 일괄 삭제합니다"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>전체 취소내역 일괄 삭제 ({displayedList.length}건)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Requests List */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 sm:p-12 text-center border border-slate-200 shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">
            {activeTab === 'PENDING' ? '대기 중인 연차 결재 건이 없습니다' : '처리된 결재 내역이 없습니다'}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'PENDING' ? '직원이 연차를 신청하면 실시간으로 이곳에 표시됩니다.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {displayedList.map((req) => {
            const emp = employees.find((e) => e.id === req.employeeId);
            const tenure = emp ? calculateTenure(emp.joinDate) : null;
            const isApproved = req.status === 'APPROVED';
            const isPending = req.status === 'PENDING';
            const isCancelled = req.status === 'CANCELLED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all ${
                  (activeTab === 'HISTORY' && selectedApprovedIds.includes(req.id))
                    ? 'border-amber-400 bg-amber-50/20 shadow-md ring-1 ring-amber-300'
                    : (activeTab === 'CANCELLED' && selectedCancelledIds.includes(req.id))
                    ? 'border-rose-400 bg-rose-50/20 shadow-md ring-1 ring-rose-300'
                    : 'border-slate-200 shadow-sm hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Optional Selection Checkbox + Applicant & Leave Information */}
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    {activeTab === 'HISTORY' && isApproved && (
                      <div className="pt-1 shrink-0">
                        <label className="flex items-center justify-center p-1 rounded-lg hover:bg-amber-100 cursor-pointer transition-colors" title="선택하여 승인 취소">
                          <input
                            type="checkbox"
                            checked={selectedApprovedIds.includes(req.id)}
                            onChange={() => handleToggleSelect(req.id)}
                            className="w-5 h-5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}
                    {activeTab === 'CANCELLED' && (
                      <div className="pt-1 shrink-0">
                        <label className="flex items-center justify-center p-1 rounded-lg hover:bg-rose-100 cursor-pointer transition-colors" title="선택하여 내역 삭제">
                          <input
                            type="checkbox"
                            checked={selectedCancelledIds.includes(req.id)}
                            onChange={() => handleToggleSelectCancelled(req.id)}
                            className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-base sm:text-lg font-bold text-slate-900">{req.employeeName}</span>
                      <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                        {req.position}
                      </span>
                      {emp && (
                        <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          입사 {emp.joinDate.replace(/-/g, '.')} ({tenure?.years}년 {tenure?.months}개월차)
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {getLeaveTypeLabel(req.type, req.daysCount)}
                      </span>
                    </div>

                    {/* Dates & Duration */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex items-center space-x-1.5 bg-blue-50/60 text-blue-900 px-2.5 py-1 rounded-lg">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold">
                          {req.startDate.replace(/-/g, '.')}
                          {req.startDate !== req.endDate && ` ~ ${req.endDate.replace(/-/g, '.')}`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-600">
                          소진 연차: <strong className="text-blue-600 font-bold text-sm">
                            {req.type === 'HOURLY' ? `${req.daysCount}일 (${Math.round(req.daysCount * 8)}시간)` : `${req.daysCount}일`}
                          </strong>
                        </span>
                      </div>
                      {req.contactEmergency && (
                        <div className="flex items-center space-x-1 text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>비상: {req.contactEmergency}</span>
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-800 flex items-start space-x-2">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">사유:</span>
                      <span className="text-slate-700 leading-relaxed">{req.reason}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1 pt-1">
                      <span>신청: {new Date(req.requestedAt).toLocaleString('ko-KR')}</span>
                      {req.reviewedAt && (
                        <span className="text-slate-600 font-medium">
                          결재: {new Date(req.reviewedAt).toLocaleString('ko-KR')} ({req.reviewedBy})
                        </span>
                      )}
                      {req.rejectReason && (
                        <span className="text-rose-600 font-semibold">
                          반려사유: {req.rejectReason}
                        </span>
                      )}
                      {req.cancelReason && (
                        <span className="text-amber-700 font-semibold">
                          취소사유: {req.cancelReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Right: Actions / Status */}
                  <div className="flex items-center space-x-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 justify-end">
                    {isPending ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleOpenReject(req)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center space-x-1 transition-colors cursor-pointer min-h-[44px]"
                        >
                          <X className="w-4 h-4 text-slate-500" />
                          <span>반려</span>
                        </button>
                        <button
                          onClick={() => onApprove(req.id, currentAdmin.name)}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer min-h-[44px]"
                        >
                          <Check className="w-4 h-4" />
                          <span>승인하기</span>
                        </button>
                      </div>
                    ) : isApproved ? (
                      <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                        <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl font-bold text-xs border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>승인 완료</span>
                        </span>
                        {/* Admin Cancellation of Approved Leave */}
                        <button
                          onClick={() => handleOpenCancelApproved(req)}
                          className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 transition-colors flex items-center space-x-1 cursor-pointer min-h-[38px]"
                          title="승인된 연차 취소 처리"
                        >
                          <XCircle className="w-3.5 h-3.5 text-amber-700" />
                          <span>승인 취소</span>
                        </button>
                      </div>
                    ) : isCancelled ? (
                      <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                        <span className="text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center space-x-1">
                          <Ban className="w-3.5 h-3.5 text-slate-500" />
                          <span>취소됨</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(req)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors flex items-center space-x-1 cursor-pointer min-h-[38px]"
                          title="이 취소 내역 영구 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>내역 삭제</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl font-bold text-xs border border-rose-200">
                        반려됨
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Cancel Approved Leave Modal */}
      {cancelModalReq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">승인된 연차 취소</h3>
              </div>
              <button
                onClick={() => setCancelModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5 text-amber-950">
                <p className="font-bold">이전에 승인된 연차를 취소하시겠습니까?</p>
                <p>취소 시 해당 직원의 잔여 연차 일수({cancelModalReq.daysCount}일)가 즉시 복구 환원됩니다.</p>
                <div className="mt-2 pt-2 border-t border-amber-200/80 text-[11px] text-amber-800">
                  <p>• 대상자: <strong>{cancelModalReq.employeeName}</strong> ({cancelModalReq.position})</p>
                  <p>• 기간: {cancelModalReq.startDate} ~ {cancelModalReq.endDate} ({cancelModalReq.daysCount}일)</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  취소 사유 (선택 입력)
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="예: 직원 요청에 따른 연차 일정 취소 및 연차 환원"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalReq(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelApproved}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm cursor-pointer"
                >
                  승인 취소 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Bulk Cancel Approved Leaves Modal */}
      {isBulkCancelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">선택한 연차 일괄 승인 취소</h3>
              </div>
              <button
                onClick={() => setIsBulkCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5 text-amber-950">
                <p className="font-bold">선택된 {selectedApprovedIds.length}건의 승인 완료 연차를 일괄 취소하시겠습니까?</p>
                <p>일괄 취소 시 대상 직원들의 잔여 연차 일수가 각각 즉시 복구 환원되며, 연차 신청 상태는 '신청 취소'로 변경됩니다.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  일괄 취소 사유 (선택 입력)
                </label>
                <input
                  type="text"
                  value={bulkCancelReasonInput}
                  onChange={(e) => setBulkCancelReasonInput(e.target.value)}
                  placeholder="예: 센터 일정 변경 또는 관리자 일괄 취소"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkCancelModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkCancel}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm cursor-pointer flex items-center space-x-1"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{selectedApprovedIds.length}건 일괄 승인 취소 확정</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-base">연차 신청 반려 처리</h3>
              </div>
              <button
                onClick={() => setRejectModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                <p><strong className="text-slate-700">신청자:</strong> {rejectModalReq.employeeName} ({rejectModalReq.position})</p>
                <p><strong className="text-slate-700">신청 기간:</strong> {rejectModalReq.startDate} ~ {rejectModalReq.endDate} ({rejectModalReq.daysCount}일)</p>
                <p><strong className="text-slate-700">신청 사유:</strong> {rejectModalReq.reason}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  반려 사유 작성 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="예: 해당 기간 센터 내 중요 일정으로 인해 일정 조정이 필요합니다."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  반려 처리 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Delete Single Cancelled Leave Record Modal */}
      {deleteConfirmModalReq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">취소 내역 영구 삭제</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-xs space-y-1.5 text-rose-950">
                <p className="font-bold">선택하신 취소 내역을 시스템 및 데이터베이스에서 영구 삭제하시겠습니까?</p>
                <p>삭제 시 취소 목록에서 완전히 제거되며 복구할 수 없습니다.</p>
                <div className="mt-2 pt-2 border-t border-rose-200/80 text-[11px] text-rose-800">
                  <p>• 대상자: <strong>{deleteConfirmModalReq.employeeName}</strong> ({deleteConfirmModalReq.position})</p>
                  <p>• 기간: {deleteConfirmModalReq.startDate} ~ {deleteConfirmModalReq.endDate} ({deleteConfirmModalReq.daysCount}일)</p>
                  {deleteConfirmModalReq.cancelReason && (
                    <p>• 취소사유: {deleteConfirmModalReq.cancelReason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModalReq(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>내역 영구 삭제 확정</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Bulk Delete Cancelled Leave Records Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">선택한 취소 내역 일괄 영구 삭제</h3>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-xs space-y-1.5 text-rose-950">
                <p className="font-bold">선택된 {selectedCancelledIds.length}건의 취소 내역을 일괄 영구 삭제하시겠습니까?</p>
                <p>일괄 삭제 시 시스템 및 데이터베이스에서 해당 취소 내역 데이터가 완전히 제거되며 복구할 수 없습니다.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{selectedCancelledIds.length}건 일괄 영구 삭제 확정</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
