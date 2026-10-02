import React, { useState } from 'react';
import { Employee, LeaveRequest } from '../types';
import { Lock, User, ShieldCheck, KeyRound, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authenticateWithServer } from '../utils/storage';
import { fetchAllFromFirestore } from '../lib/firebase';

interface LoginViewProps {
  employees: Employee[];
  onLoginSuccess: (employee: Employee, syncedEmployees?: Employee[], syncedRequests?: LeaveRequest[]) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ employees, onLoginSuccess }) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = loginId.trim();
    const cleanPw = password.trim();

    if (!cleanId) {
      setErrorMsg('아이디를 입력해주세요.');
      return;
    }

    if (!cleanPw) {
      setErrorMsg('비밀번호를 입력해주세요.');
      return;
    }

    setIsLoggingIn(true);

    try {
      // 1. First verify directly against Cloud Firestore (Primary Single Source of Truth across all devices)
      try {
        const cloudData = await fetchAllFromFirestore();
        if (cloudData && Array.isArray(cloudData.employees) && cloudData.employees.length > 0) {
          const cloudTarget = cloudData.employees.find(
            (emp) => emp.loginId.trim().toLowerCase() === cleanId.toLowerCase()
          );
          if (cloudTarget) {
            const correctPassword = (cloudTarget.password || '1234').trim();
            if (cleanPw === correctPassword) {
              onLoginSuccess(cloudTarget, cloudData.employees, cloudData.requests);
              return;
            } else {
              setErrorMsg('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
              setIsLoggingIn(false);
              return;
            }
          }
        }
      } catch (cloudErr) {
        console.warn('Cloud Firestore login query warning:', cloudErr);
      }

      // 2. Fallback: check in-memory employees state
      const memoryTarget = employees.find(
        (emp) => emp.loginId.trim().toLowerCase() === cleanId.toLowerCase()
      );

      if (memoryTarget) {
        const correctPassword = (memoryTarget.password || '1234').trim();
        if (cleanPw === correctPassword) {
          onLoginSuccess(memoryTarget);
          return;
        } else {
          setErrorMsg('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
          setIsLoggingIn(false);
          return;
        }
      }

      // 3. Fallback: verify against backend server DB
      const authResult = await authenticateWithServer(cleanId, cleanPw);
      if (authResult.success && authResult.employee) {
        onLoginSuccess(authResult.employee, authResult.allEmployees, authResult.requests);
        return;
      }

      // 4. If neither cloud, memory, nor server found the ID
      if (authResult.error && !authResult.error.includes('통신')) {
        setErrorMsg(authResult.error);
      } else {
        setErrorMsg(`'${cleanId}'는 등록되지 않은 아이디입니다. 아이디를 확인해주세요.`);
      }
    } catch (err) {
      console.error('Login submission error:', err);
      setErrorMsg('로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Organization Badge & Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/20 mb-3 border border-blue-400/30">
            약수
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            동작구립 약수데이케어센터
          </h2>
          <p className="mt-1 text-sm text-blue-200/80 font-medium">
            연차 관리 인트라넷 시스템
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-8 border border-white/20">
          <div className="mb-5 pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>직원 전용 인트라넷 로그인</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              등록된 본인의 고유 아이디와 비밀번호를 입력해주세요.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                아이디 (로그인 ID)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="login-id-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="아이디 입력"
                  disabled={isLoggingIn}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="login-pw-input"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  disabled={isLoggingIn}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>인증 및 최신 데이터 확인 중...</span>
                </>
              ) : (
                <>
                  <span>시스템 로그인</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security & Privacy Notice */}
        <div className="mt-6 text-center text-xs text-blue-200/60 leading-relaxed px-4">
          <p className="flex items-center justify-center space-x-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            <span>개인정보보호 및 권한 분리 안내</span>
          </p>
          <p className="mt-1 text-[11px]">
            일반 직원은 오직 본인의 연차 현황 및 신청 내역만 조회 가능하며, 타 직원의 정보 및 관리자 기능은 철저히 보호됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
