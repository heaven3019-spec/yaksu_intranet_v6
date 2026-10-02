import React, { useState, useRef } from 'react';
import { Employee, LeaveRequest } from '../types';
import { 
  parseExcelLeaveFile, 
  generateStandardLeaveTemplate,
  ParsedExcelResult,
  getDayOfWeekShort 
} from '../utils/excelParser';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Users, 
  CalendarDays, 
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  Table
} from 'lucide-react';
import { getLeaveTypeLabel } from '../utils/leaveCalculator';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  existingRequests: LeaveRequest[];
  onApplyImport: (newEmployees: Employee[], newRequests: LeaveRequest[], mode: 'MERGE' | 'OVERWRITE') => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingEmployees,
  existingRequests,
  onApplyImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedExcelResult | null>(null);
  const [importMode, setImportMode] = useState<'MERGE' | 'OVERWRITE'>('MERGE');
  const [activePreviewTab, setActivePreviewTab] = useState<'REQUESTS' | 'EMPLOYEES'>('REQUESTS');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = await parseExcelLeaveFile(buffer, existingEmployees);

      if (result.detectedEmployeeCount === 0 && result.detectedRequestCount === 0) {
        setErrorMsg('엑셀 파일에서 유효한 직원 명부나 연차 사용 기록을 찾을 수 없습니다. 표준 서식의 10개 열(성명, 직급, 입사일, 휴가구분, 시작일자, 종료일자, 사용일수, 신청사유, 결제상태, 비상연락처)을 확인해주세요.');
        setParseResult(null);
      } else {
        setParseResult(result);
        setActivePreviewTab('REQUESTS');
        setSelectedYear('ALL');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('엑셀 파일을 분석하는 도중 오류가 발생했습니다. 올바른 .xlsx, .xls, .csv 파일인지 확인해주세요.');
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmApply = () => {
    if (!parseResult) return;

    let finalEmployees: Employee[];
    let finalRequests: LeaveRequest[];

    if (importMode === 'OVERWRITE') {
      // Overwrite, but preserve admin
      const admin = existingEmployees.find((e) => e.role === 'ADMIN') || {
        id: 'admin-001',
        loginId: 'admin',
        password: '1234',
        name: '유정',
        position: '센터운영과장 (관리자)',
        email: 'yu.admin@yaksoo.kr',
        phone: '010-9999-8888',
        joinDate: '2020-01-02',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const,
      };

      const empsWithAdmin = parseResult.employees.some((e) => e.role === 'ADMIN')
        ? parseResult.employees
        : [admin, ...parseResult.employees];

      finalEmployees = empsWithAdmin;
      finalRequests = parseResult.requests;
    } else {
      // MERGE Mode: Match existing by clean name or ID
      const empMap = new Map<string, Employee>();
      existingEmployees.forEach((e) => empMap.set(e.name.trim(), { ...e }));

      parseResult.employees.forEach((newEmp) => {
        const key = newEmp.name.trim();
        if (empMap.has(key)) {
          const existing = empMap.get(key)!;
          empMap.set(key, {
            ...existing,
            position: newEmp.position || existing.position,
            joinDate: newEmp.joinDate || existing.joinDate,
            phone: newEmp.phone || existing.phone,
          });
        } else {
          empMap.set(key, newEmp);
        }
      });

      finalEmployees = Array.from(empMap.values());

      // Smart Request Deduplication: avoid duplicate entries on re-upload
      const requestMap = new Map<string, LeaveRequest>();
      existingRequests.forEach((req) => {
        const key = `${req.employeeName}_${req.startDate}_${req.endDate}_${req.type}`;
        requestMap.set(key, req);
      });
      parseResult.requests.forEach((req) => {
        const key = `${req.employeeName}_${req.startDate}_${req.endDate}_${req.type}`;
        requestMap.set(key, req);
      });

      finalRequests = Array.from(requestMap.values());
    }

    onApplyImport(finalEmployees, finalRequests, importMode);
    onClose();
  };

  // Dynamic years detected from the uploaded file
  const availableYears = parseResult ? Object.keys(parseResult.yearStats).sort() : [];

  // Filter requests by chosen year
  const filteredRequests = (parseResult?.requests || []).filter((req) => {
    if (selectedYear === 'ALL') return true;
    return req.startDate.startsWith(selectedYear);
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                직원 연차대장 엑셀 일괄 업로드
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                표준 서식에 입력된 직원별 연차 사용 기록을 원하는 연도별로 시스템에 일괄 등록합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {/* Template Download & Help Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start space-x-2.5 text-xs text-blue-950">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-blue-900">
                    직원 연차대장 표준 엑셀 서식을 다운로드하세요
                  </p>
                  <p className="text-blue-800 text-xs leading-relaxed">
                    서식을 내려받아 아래 <strong>10개 셀 항목</strong>에 맞춰 작성 후 업로드하시면 연도와 날짜가 시스템에 정확하게 등록됩니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => generateStandardLeaveTemplate(existingEmployees)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 shrink-0 cursor-pointer transition-all"
                title="10개 필수 항목이 포함된 표준 엑셀 서식 다운로드"
              >
                <Download className="w-4 h-4" />
                <span>표준 엑셀 서식 다운로드 (.xlsx)</span>
              </button>
            </div>

            {/* 10 Column Spec Pills */}
            <div className="pt-2 border-t border-blue-200/60">
              <p className="text-[11px] font-bold text-blue-900 mb-1.5 flex items-center space-x-1">
                <Table className="w-3.5 h-3.5 text-blue-600" />
                <span>표준 엑셀 10대 셀 구성 항목:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '1. 성명',
                  '2. 직급',
                  '3. 입사일',
                  '4. 휴가구분',
                  '5. 시작일자',
                  '6. 종료일자',
                  '7. 사용일수',
                  '8. 신청사유',
                  '9. 결제상태',
                  '10. 비상연락처'
                ].map((col) => (
                  <span
                    key={col}
                    className="text-[11px] bg-white text-blue-900 font-semibold px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center cursor-pointer transition-all ${
              file
                ? 'border-emerald-500 bg-emerald-50/30'
                : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className={`p-3 rounded-2xl ${file ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-600'}`}>
                {isLoading ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                ) : file ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {file ? file.name : '작성하신 엑셀 파일을 여기에 끌어다 놓거나 클릭하여 선택하세요'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  지원 형식: .xlsx, .xls, .csv (작성된 서식의 날짜에 따라 연도별로 자동 분류 등록됩니다)
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Preview */}
          {parseResult && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Year & Statistics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">인식된 임직원</span>
                  <div className="text-lg font-bold text-slate-900 flex items-center space-x-1.5 mt-0.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>{parseResult.detectedEmployeeCount}명</span>
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-blue-800 uppercase">총 연차 사용 건수</span>
                  <div className="text-lg font-bold text-blue-700 flex items-center space-x-1.5 mt-0.5">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span>{parseResult.detectedRequestCount}건</span>
                  </div>
                </div>

                {availableYears.map((yr) => (
                  <div key={yr} className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">{yr}년 연차 기록</span>
                    <div className="text-lg font-bold text-emerald-700 flex items-center space-x-1.5 mt-0.5">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>{parseResult.yearStats[yr]}건</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee breakdown pills */}
              {Object.keys(parseResult.employeeStats).length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>직원별 등록 현황:</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(parseResult.employeeStats).map(([empName, stats]) => {
                      const statObj = stats as { total: number; [year: string]: number };
                      return (
                        <span
                          key={empName}
                          className="inline-flex items-center text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 shadow-2xs font-medium"
                        >
                          <strong className="text-slate-900 mr-1.5">{empName}</strong>
                          <span className="text-blue-600 text-[11px]">총 {statObj.total}건</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview Tabs & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('REQUESTS')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activePreviewTab === 'REQUESTS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    연차 기록 미리보기 ({parseResult.detectedRequestCount}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('EMPLOYEES')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activePreviewTab === 'EMPLOYEES'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    직원 목록 ({parseResult.detectedEmployeeCount}명)
                  </button>
                </div>

                {/* Year filter selector for requests */}
                {activePreviewTab === 'REQUESTS' && availableYears.length > 1 && (
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-400 font-semibold mr-1">연도 필터:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedYear('ALL')}
                      className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                        selectedYear === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      전체
                    </button>
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedYear(yr)}
                        className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                          selectedYear === yr
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {yr}년
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {activePreviewTab === 'REQUESTS' ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">성명</th>
                        <th className="p-2.5">직급</th>
                        <th className="p-2.5">휴가구분</th>
                        <th className="p-2.5">시작일자</th>
                        <th className="p-2.5">종료일자</th>
                        <th className="p-2.5 text-right">사용일수</th>
                        <th className="p-2.5">신청사유</th>
                        <th className="p-2.5 text-center">결제상태</th>
                        <th className="p-2.5">비상연락처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-slate-400">
                            연차 사용 기록이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((req, idx) => {
                          const startDay = getDayOfWeekShort(req.startDate);
                          const endDay = getDayOfWeekShort(req.endDate);

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                                {req.employeeName}
                              </td>
                              <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                                {req.position}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 whitespace-nowrap">
                                {getLeaveTypeLabel(req.type, req.daysCount)}
                              </td>
                              <td className="p-2.5 font-medium text-slate-700 whitespace-nowrap">
                                {req.startDate} ({startDay})
                              </td>
                              <td className="p-2.5 font-medium text-slate-700 whitespace-nowrap">
                                {req.endDate} ({endDay})
                              </td>
                              <td className="p-2.5 text-right font-extrabold text-blue-600 whitespace-nowrap">
                                {req.daysCount}일
                              </td>
                              <td className="p-2.5 text-slate-600 truncate max-w-[160px]" title={req.reason}>
                                {req.reason}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {req.status === 'APPROVED' ? '승인' : '대기'}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                                {req.contactEmergency || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">성명</th>
                        <th className="p-2.5">직급</th>
                        <th className="p-2.5">입사일자</th>
                        <th className="p-2.5">연락처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parseResult.employees.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">
                            직원 정보가 기존 시스템의 직원과 자동 매칭되었습니다.
                          </td>
                        </tr>
                      ) : (
                        parseResult.employees.map((emp, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{emp.name}</td>
                            <td className="p-2.5 text-slate-600">{emp.position}</td>
                            <td className="p-2.5 font-semibold text-slate-800">{emp.joinDate}</td>
                            <td className="p-2.5 text-slate-500">{emp.phone || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Import Mode Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">반영 방식 선택:</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'MERGE'}
                      onChange={() => setImportMode('MERGE')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>기존 데이터에 추가 / 갱신 (권장)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'OVERWRITE'}
                      onChange={() => setImportMode('OVERWRITE')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>엑셀 내용으로 전체 덮어쓰기</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            취소
          </button>

          <button
            type="button"
            disabled={!parseResult}
            onClick={handleConfirmApply}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              parseResult
                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {parseResult ? `연차 데이터 (${parseResult.detectedRequestCount}건) 시스템에 일괄 반영하기` : '데이터 일괄 적용하기'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
