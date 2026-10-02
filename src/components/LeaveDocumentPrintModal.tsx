import React from 'react';
import { Employee, LeaveCycleInfo, LeaveRequest } from '../types';
import { getLeaveTypeLabel } from '../utils/leaveCalculator';
import { X, Printer, CheckCircle } from 'lucide-react';

interface LeaveDocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  currentCycle: LeaveCycleInfo | null;
  selectedRequest?: LeaveRequest;
}

export const LeaveDocumentPrintModal: React.FC<LeaveDocumentPrintModalProps> = ({
  isOpen,
  onClose,
  employee,
  currentCycle,
  selectedRequest,
}) => {
  if (!isOpen) return null;

  const todayStr = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 flex items-center space-x-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>휴가신청서 / 연차사용계획서 인쇄 양식</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>지금 인쇄하기</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 sm:p-12 text-slate-900 font-sans space-y-6">
          {/* Header & Approval Box */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-widest text-slate-900">휴 가 신 청 서</h1>
              <p className="text-[11px] text-slate-500 mt-1">Leave Application & Report</p>
            </div>

            {/* Approval Stamp Table */}
            <table className="border-collapse border border-slate-900 text-center text-xs w-52">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 py-1 w-1/3 text-[11px]">담당</th>
                  <th className="border border-slate-900 py-1 w-1/3 text-[11px]">검토</th>
                  <th className="border border-slate-900 py-1 w-1/3 text-[11px]">승인</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-14">
                  <td className="border border-slate-900 relative">
                    <span className="text-[10px] text-slate-400">신청완료</span>
                  </td>
                  <td className="border border-slate-900 relative">
                    {selectedRequest?.status === 'APPROVED' && (
                      <span className="text-xs font-bold text-blue-700">확인</span>
                    )}
                  </td>
                  <td className="border border-slate-900 relative">
                    {selectedRequest?.status === 'APPROVED' && (
                      <div className="w-10 h-10 border-2 border-rose-600 rounded-full mx-auto flex items-center justify-center text-rose-600 font-bold text-[10px] transform -rotate-12">
                        승인
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Applicant Info Table */}
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 w-28 text-left font-bold text-slate-700">
                  성 명
                </th>
                <td className="border border-slate-300 py-2.5 px-3 font-bold">
                  {selectedRequest?.employeeName || employee.name}
                </td>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 w-28 text-left font-bold text-slate-700">
                  직 위
                </th>
                <td className="border border-slate-300 py-2.5 px-3">
                  {selectedRequest?.position || employee.position}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700">
                  입 사 일
                </th>
                <td className="border border-slate-300 py-2.5 px-3">
                  {employee.joinDate.replace(/-/g, '.')}
                </td>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700">
                  연차 잔여
                </th>
                <td className="border border-slate-300 py-2.5 px-3 font-semibold text-blue-700">
                  {currentCycle ? `${currentCycle.remainingDays}일 (총 ${currentCycle.totalGranted}일 중 ${currentCycle.usedDays}일 사용)` : '-'}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700">
                  연차 주기
                </th>
                <td colSpan={3} className="border border-slate-300 py-2.5 px-3">
                  {currentCycle ? currentCycle.label : '-'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Leave Specifics Table */}
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 w-28 text-left font-bold text-slate-700">
                  휴가 구분
                </th>
                <td className="border border-slate-300 py-2.5 px-3 font-bold">
                  {selectedRequest ? getLeaveTypeLabel(selectedRequest.type, selectedRequest.daysCount) : '전일 연차 (1일)'}
                </td>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 w-28 text-left font-bold text-slate-700">
                  사용 일수
                </th>
                <td className="border border-slate-300 py-2.5 px-3 font-bold text-blue-700">
                  {selectedRequest ? (selectedRequest.type === 'HOURLY' ? `${selectedRequest.daysCount} 일 (${Math.round(selectedRequest.daysCount * 8)}시간)` : `${selectedRequest.daysCount} 일`) : '1 일'}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700">
                  휴가 기간
                </th>
                <td colSpan={3} className="border border-slate-300 py-2.5 px-3">
                  {selectedRequest
                    ? `${selectedRequest.startDate} ~ ${selectedRequest.endDate}`
                    : '2026-08-15 ~ 2026-08-15'}
                </td>
              </tr>
              <tr className="h-28">
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700 align-top">
                  신청 사유
                </th>
                <td colSpan={3} className="border border-slate-300 py-2.5 px-3 align-top leading-relaxed">
                  {selectedRequest?.reason || '근로기준법 제60조에 따른 연차유급휴가 사용'}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-300 bg-slate-100 py-2.5 px-3 text-left font-bold text-slate-700">
                  비상 연락망
                </th>
                <td colSpan={3} className="border border-slate-300 py-2.5 px-3">
                  {selectedRequest?.contactEmergency || employee.phone || '-'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Statement & Signature */}
          <div className="text-center pt-6 space-y-6">
            <p className="text-xs text-slate-700 leading-relaxed">
              위와 같이 근로기준법 및 사내 취업규칙 규정에 의거하여<br />
              연차유급휴가를 신청하오니 재가하여 주시기 바랍니다.
            </p>

            <p className="text-xs font-semibold text-slate-800 tracking-wider">
              {todayStr}
            </p>

            <div className="flex justify-between items-center px-4 pt-2 text-xs font-bold">
              <span className="text-slate-500 font-semibold">동작구립 약수데이케어센터 귀중</span>
              <div className="flex items-center space-x-4">
                <span>신 청 자 : {selectedRequest?.employeeName || employee.name}</span>
                <span className="text-slate-400 font-normal">(서명 또는 인)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
