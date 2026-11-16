import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Eye,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import type { ExhibitionProject } from '../../types/project';
import { fmtNum } from '../../utils/vectorMath';
import { HouseVector3DScene, type VectorOverlayData } from '../HouseVector3DScene';
import { MathFormula } from '../MathFormula';

export const TeacherReviewStage: React.FC = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [responses, setResponses] = useState<ExhibitionProject[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchResponses = useCallback(async () => {
    setLoadingResponses(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/teacher/responses', {
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setAuthenticated(false);
        setResponses([]);
        return;
      }
      if (!res.ok) {
        throw new Error(
          data?.error || '학생 응답 목록을 불러오지 못했습니다.'
        );
      }
      if (Array.isArray(data)) {
        setResponses(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '응답 조회 중 오류가 발생했습니다.'
      );
    } finally {
      setLoadingResponses(false);
    }
  }, [selectedId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/teacher/session', {
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => null);
        if (!mounted) return;
        if (data) {
          setAuthenticated(Boolean(data.authenticated));
          setPasswordConfigured(data.configured !== false);
          if (data.authenticated) {
            fetchResponses();
          }
        }
      } catch {
        if (mounted) {
          setAuthError('교사 인증 서버 상태를 확인할 수 없습니다.');
        }
      } finally {
        if (mounted) setCheckingSession(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchResponses]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passwordInput.trim()) {
      setAuthError('교사 비밀번호를 입력해 주세요.');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || '로그인에 실패했습니다.');
      }
      setAuthenticated(true);
      setPasswordInput('');
      await fetchResponses();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/teacher/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      setAuthenticated(false);
      setResponses([]);
      setSelectedId(null);
    }
  };

  const selectedResponse = useMemo(
    () => responses.find((r) => r.id === selectedId) ?? responses[0] ?? null,
    [responses, selectedId]
  );

  const selectedOverlay: VectorOverlayData | undefined = useMemo(() => {
    if (!selectedResponse) return undefined;
    return {
      line: selectedResponse.verifiedLineSummary
        ? {
            pointA: selectedResponse.verifiedLineSummary.pointA,
            pointB: selectedResponse.verifiedLineSummary.pointB,
            label: selectedResponse.verifiedLineSummary.label,
          }
        : null,
      plane: selectedResponse.verifiedPlaneSummary
        ? {
            points: selectedResponse.verifiedPlaneSummary.points,
            normal: selectedResponse.verifiedPlaneSummary.normal,
            label: selectedResponse.verifiedPlaneSummary.label,
          }
        : null,
    };
  }, [selectedResponse]);

  const privateCount = responses.filter((r) => !r.isPublic).length;
  const publicCount = responses.filter((r) => r.isPublic).length;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            교사 전용 관리 화면 · Cloudflare D1 응답 확인
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            교사 응답 확인 및 평가 검토
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            학생들이 제출한 비공개·공개 프로젝트 응답과 벡터 방정식, 성찰 내용을 교사 인증 후 확인합니다.
          </p>
        </div>

        {authenticated && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchResponses}
              disabled={loadingResponses}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingResponses ? 'animate-spin' : ''}`} />
              <span>응답 새로고침</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>

      {/* Login Gate */}
      {!authenticated && (
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">교사 로그인</h2>
              <p className="text-xs text-slate-500">
                Cloudflare Secret(TEACHER_PASSWORD)으로 보호된 세션 쿠키 인증
              </p>
            </div>
          </div>

          {!passwordConfigured && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs">
              서버에 <code>TEACHER_PASSWORD</code> Secret이 아직 등록되지 않았습니다. Cloudflare Worker 설정에서 Secret을 추가해 주세요.
            </div>
          )}

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">교사 비밀번호</span>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="교사 비밀번호 입력"
                autoComplete="current-password"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <button
              type="submit"
              disabled={checkingSession || loginLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{loginLoading ? '인증 확인 중...' : '로그인'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Authenticated Teacher Dashboard */}
      {authenticated && (
        <>
          {loadError && (
            <div className="bg-red-50 border border-red-300 text-red-900 rounded-xl p-4 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">전체 제출 응답</div>
              <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                {responses.length}건
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">비공개 응답 (교사 전용)</div>
              <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                {privateCount}건
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">공개 전시 출품 응답</div>
              <div className="text-2xl font-bold font-mono-tabular text-blue-700 mt-1">
                {publicCount}건
              </div>
            </div>
          </div>

          {responses.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              아직 데이터베이스에 저장된 학생 응답이 없습니다. 학생 화면의 [4·5단계·전시·제출]에서 응답을 저장한 뒤 [응답 새로고침]을 눌러 확인하세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left List */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 text-xs font-semibold text-slate-700">
                  학생 제출 응답 목록 (클릭하여 상세 보기)
                </div>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-200">
                  {responses.map((item) => {
                    const active = selectedResponse?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left px-4 py-3.5 transition-colors ${
                          active ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">
                            {item.studentName} · {item.classRoom || '모둠 미표기'}
                          </span>
                          <span className="font-medium text-slate-600">
                            {item.isPublic ? '공개 전시' : '비공개'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
                          {new Date(item.createdAt).toLocaleString('ko-KR')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Detailed Inspector */}
              {selectedResponse && (
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          {selectedResponse.studentName} · {selectedResponse.classRoom} ·{' '}
                          {selectedResponse.isPublic ? '온라인 전시 공개됨' : '교사 전용 비공개 응답'}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                          {selectedResponse.title}
                        </h2>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                        <span>상세 검토 중</span>
                      </span>
                    </div>

                    <div className="h-[340px]">
                      <HouseVector3DScene
                        config={selectedResponse.houseConfig}
                        overlay={selectedOverlay}
                        compact
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedResponse.verifiedLineSummary && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                          <div className="text-xs font-semibold text-orange-700 mb-1">
                            {selectedResponse.verifiedLineSummary.label} (지면각{' '}
                            {fmtNum(selectedResponse.verifiedLineSummary.angleGroundDeg)}°)
                          </div>
                          <MathFormula
                            latex={selectedResponse.verifiedLineSummary.equationLatex}
                          />
                        </div>
                      )}

                      {selectedResponse.verifiedPlaneSummary && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                          <div className="text-xs font-semibold text-sky-700 mb-1">
                            {selectedResponse.verifiedPlaneSummary.label} (경사각{' '}
                            {fmtNum(selectedResponse.verifiedPlaneSummary.angleGroundDeg)}°)
                          </div>
                          <MathFormula
                            latex={selectedResponse.verifiedPlaneSummary.equationLatex}
                          />
                        </div>
                      )}
                    </div>

                    {selectedResponse.inquiryQuestion && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                        <div className="font-semibold text-slate-900">학생 탐구 질문</div>
                        <p className="text-slate-700">{selectedResponse.inquiryQuestion}</p>
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-semibold text-slate-900">성찰 답변</div>
                      <p className="text-slate-700 leading-relaxed">
                        {selectedResponse.reflectionNote || '작성된 성찰 답변이 없습니다.'}
                      </p>
                    </div>

                    {selectedResponse.selfEval && (
                      <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <span className="font-semibold text-slate-900">자기평가 결과: </span>
                        1번({selectedResponse.selfEval.selfEval1 || '미응답'}) · 2번(
                        {selectedResponse.selfEval.selfEval2 || '미응답'}) · 3번(
                        {selectedResponse.selfEval.selfEval3 || '미응답'})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
