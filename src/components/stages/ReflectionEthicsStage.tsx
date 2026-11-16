import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Printer,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import type {
  ReflectionAndEthics,
  SelfEvalLevel,
} from '../../types/project';

interface EthicsNoteItem {
  id: string;
  authorName: string;
  stance: 'human' | 'ai' | 'shared';
  argument: string;
  createdAt: string;
}

interface ReflectionEthicsStageProps {
  reflection: ReflectionAndEthics;
  studentName: string;
  ethicsBoard: EthicsNoteItem[];
  onChange: (next: ReflectionAndEthics) => void;
  onPostEthicsNote: (note: Omit<EthicsNoteItem, 'id' | 'createdAt'>) => Promise<void>;
}

const EVAL_LEVELS: SelfEvalLevel[] = ['잘함', '보통', '노력'];

const STANCE_LABELS: Record<'human' | 'ai' | 'shared', string> = {
  human: '도구를 활용한 사람에게 책임이 있다',
  ai: 'AI 시스템 개발·제공자에게 책임이 있다',
  shared: '사람과 AI 시스템의 공동 책임이다',
};

export const ReflectionEthicsStage: React.FC<ReflectionEthicsStageProps> = ({
  reflection,
  studentName,
  ethicsBoard,
  onChange,
  onPostEthicsNote,
}) => {
  const [postingEthics, setPostingEthics] = useState(false);
  const [postedNotice, setPostedNotice] = useState(false);
  const [ethicsError, setEthicsError] = useState<string | null>(null);

  const handleSubmitEthics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflection.ethicsStance || !reflection.ethicsArgument.trim()) return;
    setPostingEthics(true);
    setEthicsError(null);
    setPostedNotice(false);
    try {
      await onPostEthicsNote({
        authorName: studentName.trim() || '익명 별칭',
        stance: reflection.ethicsStance,
        argument: reflection.ethicsArgument.trim(),
      });
      setPostedNotice(true);
      setTimeout(() => setPostedNotice(false), 2500);
    } catch (err) {
      setEthicsError(
        err instanceof Error ? err.message : '윤리 토론 의견을 저장하지 못했습니다.'
      );
    } finally {
      setPostingEthics(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            성찰 · 평가 계획 · AI 디지털 윤리
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            프로젝트 성찰, 자기평가 및 AI · 디지털 윤리 약속
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            수업 전 과정을 되돌아보며 성취기준 도달 수준을 스스로 점검하고, AI 활용의 책임과 윤리에 대해 학급 친구들과 의견을 나눕니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>성찰·평가 포트폴리오 인쇄 / PDF 저장</span>
        </button>
      </div>

      {/* Top Row: Self Evaluation + Reflection Question */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Student Self Evaluation */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-700" />
            <span>학생 자기평가 (잘함 · 보통 · 노력)</span>
          </h2>

          {[
            {
              key: 'selfEval1' as const,
              q: '① 일상의 건축물과 주변 공간 구조물을 관찰하고 가상의 좌표축을 설정하여 3차원 공간 좌표로 표현할 수 있나요?',
            },
            {
              key: 'selfEval2' as const,
              q: '② 직접 디자인한 공간 구조물의 주요 요소를 벡터를 이용한 직선과 평면의 방정식으로 나타내어 수학적으로 분석할 수 있나요?',
            },
            {
              key: 'selfEval3' as const,
              q: '③ 공간을 벡터로 분석한 결과를 인공지능 도구로 점검·검증하여 정리하고, 온라인 전시를 통해 공유할 수 있나요?',
            },
          ].map((item) => (
            <div
              key={item.key}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5"
            >
              <p className="text-xs font-medium text-slate-800 leading-relaxed">{item.q}</p>
              <div className="flex items-center gap-2">
                {EVAL_LEVELS.map((lvl) => {
                  const active = reflection[item.key] === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onChange({ ...reflection, [item.key]: lvl })}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Reflection Prompt */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-700" />
            <span>성찰 질문 기록</span>
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-950 font-medium leading-relaxed">
            "설계한 공간을 벡터 식으로 변환하고 AI로 검증하는 과정에서 처음 의도와 달라진 점은 무엇이며, 이를 해결하기 위해 어떤 수학적 판단을 내렸나요?"
          </div>
          <textarea
            rows={8}
            value={reflection.reflectionAnswer}
            onChange={(e) => onChange({ ...reflection, reflectionAnswer: e.target.value })}
            placeholder="예: 처음에는 지붕 경사각을 30°로 생각했으나 좌표를 대입해 법선벡터를 계산해보니 실제 각도가 달랐습니다. 이를 해결하기 위해 용마루 높이를 조정하거나 교사 검증 웹앱을 통해 부호와 상수배 동치 관계를 다시 점검했습니다."
            className="flex-1 w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Middle Row: AI Ethics Discussion & Digital Safety Pledge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-700" />
            <span>AI 윤리 함께 고민하기</span>
          </h2>
          <p className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
            "건축 설계나 수학적 계산에서 AI가 도출한 결괏값에 오류가 있을 때, 그 책임은 도구를 활용한 사람에게 있을까 아니면 AI 시스템에 있을까?"
          </p>

          <form onSubmit={handleSubmitEthics} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['human', 'ai', 'shared'] as const).map((st) => {
                const active = reflection.ethicsStance === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onChange({ ...reflection, ethicsStance: st })}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {STANCE_LABELS[st]}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={2}
              value={reflection.ethicsArgument}
              onChange={(e) => onChange({ ...reflection, ethicsArgument: e.target.value })}
              placeholder="나의 입장과 그 이유를 작성해 학급 윤리 토론 보드에 공유하세요."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />

            {ethicsError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-2.5 text-xs">
                {ethicsError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-medium">
                {postedNotice ? '학급 윤리 토론 보드에 등록되었습니다.' : ''}
              </span>
              <button
                type="submit"
                disabled={postingEthics || !reflection.ethicsStance || !reflection.ethicsArgument.trim()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                {postingEthics ? '등록 중...' : '토론 보드에 내 생각 공유'}
              </button>
            </div>
          </form>

          {ethicsBoard.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2 max-h-48 overflow-y-auto">
              <div className="text-xs font-semibold text-slate-600">
                학급 친구들의 윤리 의견 ({ethicsBoard.length})
              </div>
              {ethicsBoard.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-900">{item.authorName}</span>
                    <span>{STANCE_LABELS[item.stance]}</span>
                  </div>
                  <p className="text-slate-700">{item.argument}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Digital Safety Pledge */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>디지털 안전 약속 체크리스트</span>
          </h2>
          <p className="text-xs text-slate-600">
            수업 중 AI 도구와 온라인 전시 사이트를 안전하고 윤리적으로 사용하기 위해 아래 항목을 확인하고 서약합니다.
          </p>

          <div className="space-y-2.5">
            {[
              {
                key: 'safetyAgeAgreed' as const,
                text: '생성형 AI 도구의 이용 연령 기준 및 보호자 동의를 확인하고 준수합니다.',
              },
              {
                key: 'safetyCitationAgreed' as const,
                text: 'AI를 활용해 도출한 계산 및 점검 결과의 출처를 산출물에 명확히 표시합니다.',
              },
              {
                key: 'safetyPrivacyAgreed' as const,
                text: '온라인 전시 사이트 및 공유 플랫폼에 타인이나 본인의 개인정보가 노출되지 않도록 유의합니다.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100"
              >
                <input
                  type="checkbox"
                  checked={reflection[item.key]}
                  onChange={(e) =>
                    onChange({ ...reflection, [item.key]: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 accent-blue-700 rounded"
                />
                <span className="text-xs text-slate-800 leading-relaxed">{item.text}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Official Assessment Rubric Table (from PDF Page 5) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-bold text-slate-900 mb-3">
          프로젝트 수업 평가 기준표 (루브릭)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-y border-slate-200">
                <th className="py-2.5 px-3 font-semibold w-36">평가 요소</th>
                <th className="py-2.5 px-3 font-semibold w-36">방법 · 시기</th>
                <th className="py-2.5 px-3 font-semibold">상</th>
                <th className="py-2.5 px-3 font-semibold">중</th>
                <th className="py-2.5 px-3 font-semibold">하</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">
                  ① 제작한 나의 집을 좌표 공간으로 적용하여 좌표로 표기
                </td>
                <td className="py-3 px-3">3차원 점 표시하기 (2~3차시)</td>
                <td className="py-3 px-3">
                  일상의 건축물이나 주변 공간 구조물에서 기준점을 정해 가상의 좌표축을 설정하고, 주요 지점의 위치 관계를 3차원 공간 좌표로 변환하여 나타냄.
                </td>
                <td className="py-3 px-3">
                  주어진 공간 구조물 모델에서 안내된 좌표축을 바탕으로 주요 위치를 3차원 공간 좌표로 나타냄.
                </td>
                <td className="py-3 px-3">
                  안내된 절차에 따라 예시로 제시된 3차원 공간 좌표축 상의 점의 좌표를 읽거나 표시함.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">
                  ② 직선·평면의 벡터 방정식 유도 풀이 기록
                </td>
                <td className="py-3 px-3">유도 풀이 기록 (4~5차시)</td>
                <td className="py-3 px-3">
                  직접 디자인한 공간 구조물의 기둥과 지붕면 등 주요 요소를 벡터를 이용한 직선과 평면의 방정식으로 유도하고 기하학적 성질을 수학적으로 분석함.
                </td>
                <td className="py-3 px-3">
                  디자인한 공간 구조물의 요소를 안내된 공식과 절차에 따라 직선과 평면의 벡터 방정식으로 나타냄.
                </td>
                <td className="py-3 px-3">
                  주어진 공식과 절차에 따라 직선 또는 평면의 벡터 방정식 일부를 구함.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">
                  ③ 친구들의 산출물을 보고 피드백 해주기
                </td>
                <td className="py-3 px-3">온라인 전시 상호 피드백 (6~8차시)</td>
                <td className="py-3 px-3">
                  공간을 벡터로 분석한 결과를 인공지능 도구로 점검·검증하여 오류를 수정한 뒤, 완성된 분석 과정과 결과물을 온라인 전시를 통해 공유함.
                </td>
                <td className="py-3 px-3">
                  인공지능 도구를 활용해 벡터 분석 결과를 점검하고 안내된 서식에 맞추어 온라인 전시에 등록함.
                </td>
                <td className="py-3 px-3">
                  안내에 따라 인공지능 도구로 계산 결과를 확인하고 결과물 일부를 온라인 전시에 게시함.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
