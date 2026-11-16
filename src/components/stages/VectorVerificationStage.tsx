import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  Eye,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  HouseDesignConfig,
  VerificationState,
} from '../../types/project';
import {
  computeHousePoints,
  crossVec,
  diagnoseVectorAttempt,
  fmtNum,
  lenVec,
  round2,
  simplifyPlaneCoeffs,
  simplifyVec3,
  subVec,
  verifyLineEquation,
  verifyPlaneEquation,
  verifyRelationTask,
} from '../../utils/vectorMath';
import { HouseVector3DScene, type VectorOverlayData } from '../HouseVector3DScene';
import { MathFormula } from '../MathFormula';

interface VectorVerificationStageProps {
  config: HouseDesignConfig;
  verification: VerificationState;
  onChange: (next: VerificationState) => void;
  onNextStage: () => void;
}

type TaskTab = 'line' | 'plane' | 'relation';

export const VectorVerificationStage: React.FC<VectorVerificationStageProps> = ({
  config,
  verification,
  onChange,
  onNextStage,
}) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('line');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const points = useMemo(() => computeHousePoints(config), [config]);

  const overlay: VectorOverlayData = useMemo(() => {
    const res: VectorOverlayData = {};
    if (verification.reflectLineTo3D && verification.lineExactResult?.valid) {
      res.line = {
        pointA: verification.lineExactResult.pointA,
        pointB: verification.lineExactResult.pointB,
        label: '검증된 직선',
      };
    }
    if (verification.reflectPlaneTo3D && verification.planeExactResult?.valid) {
      res.plane = {
        points: [
          verification.planeExactResult.pointP,
          verification.planeExactResult.pointQ,
          verification.planeExactResult.pointR,
        ],
        normal: verification.planeExactResult.simplifiedNormal,
        label: '검증된 평면',
      };
    }
    if (
      verification.reflectRelationTo3D &&
      verification.relationExactResult?.valid &&
      verification.relationExactResult.mode === 'point-plane-distance' &&
      verification.planeExactResult?.valid
    ) {
      const targetPt = points.find((p) => p.id === verification.relationInput.targetPointId);
      if (targetPt) {
        const n = verification.planeExactResult.simplifiedNormal;
        const d = verification.planeExactResult.exactD;
        const denom = n.x * n.x + n.y * n.y + n.z * n.z;
        if (denom > 1e-6) {
          const t = -(n.x * targetPt.x + n.y * targetPt.y + n.z * targetPt.z + d) / denom;
          res.distanceSegment = {
            from: targetPt,
            to: {
              x: targetPt.x + t * n.x,
              y: targetPt.y + t * n.y,
              z: targetPt.z + t * n.z,
            },
          };
        }
      }
    }
    return res;
  }, [
    points,
    verification.reflectLineTo3D,
    verification.lineExactResult,
    verification.reflectPlaneTo3D,
    verification.planeExactResult,
    verification.reflectRelationTo3D,
    verification.relationExactResult,
    verification.relationInput.targetPointId,
  ]);

  const highlightedPointIds = useMemo(() => {
    if (activeTab === 'line') {
      return [verification.lineInput.pointAId, verification.lineInput.pointBId];
    }
    if (activeTab === 'plane') {
      return [
        verification.planeInput.pointPId,
        verification.planeInput.pointQId,
        verification.planeInput.pointRId,
      ];
    }
    return [verification.relationInput.targetPointId];
  }, [activeTab, verification]);

  // Helper: fill demo calculation matching current house (useful for teacher demonstration)
  const fillSampleForTeacherDemo = () => {
    if (activeTab === 'line') {
      const pA = points.find((p) => p.id === verification.lineInput.pointAId) ?? points[0];
      const pB = points.find((p) => p.id === verification.lineInput.pointBId) ?? points[1];
      const d = subVec(pB, pA);
      const sd = simplifyVec3(d);
      const len = round2(lenVec(d));
      const ang = len > 0 ? round2((Math.asin(Math.min(1, Math.abs(d.z) / len)) * 180) / Math.PI) : 0;
      onChange({
        ...verification,
        lineInput: {
          ...verification.lineInput,
          dirX: fmtNum(sd.x),
          dirY: fmtNum(sd.y),
          dirZ: fmtNum(sd.z),
          baseX: fmtNum(pA.x),
          baseY: fmtNum(pA.y),
          baseZ: fmtNum(pA.z),
          lengthInput: fmtNum(len),
          angleGroundInput: fmtNum(ang),
          reasoning: `${pA.label}에서 ${pB.label}로 향하는 위치벡터의 차로 방향벡터를 구하고, |u|와 sin θ 공식을 이용함.`,
        },
      });
    } else if (activeTab === 'plane') {
      const pP = points.find((p) => p.id === verification.planeInput.pointPId) ?? points[4];
      const pQ = points.find((p) => p.id === verification.planeInput.pointQId) ?? points[8];
      const pR = points.find((p) => p.id === verification.planeInput.pointRId) ?? points[7];
      const pq = subVec(pQ, pP);
      const pr = subVec(pR, pP);
      const n = crossVec(pq, pr);
      const nLen = lenVec(n);
      const dRaw = -(n.x * pP.x + n.y * pP.y + n.z * pP.z);
      const [sa, sb, sc, sd] = simplifyPlaneCoeffs(n.x, n.y, n.z, dRaw);
      const ang = nLen > 0 ? round2((Math.acos(Math.min(1, Math.abs(n.z) / nLen)) * 180) / Math.PI) : 0;
      onChange({
        ...verification,
        planeInput: {
          ...verification.planeInput,
          pqX: fmtNum(pq.x),
          pqY: fmtNum(pq.y),
          pqZ: fmtNum(pq.z),
          prX: fmtNum(pr.x),
          prY: fmtNum(pr.y),
          prZ: fmtNum(pr.z),
          normalX: fmtNum(sa),
          normalY: fmtNum(sb),
          normalZ: fmtNum(sc),
          eqA: fmtNum(sa),
          eqB: fmtNum(sb),
          eqC: fmtNum(sc),
          eqD: fmtNum(sd),
          angleGroundInput: fmtNum(ang),
          reasoning: `세 점으로 두 벡터를 만들고 외적으로 법선벡터 n을 구한 뒤 평면의 방정식을 세움.`,
        },
      });
    } else {
      const lineExact = verifyLineEquation(points, verification.lineInput);
      const planeExact = verifyPlaneEquation(points, verification.planeInput);
      const rel = verifyRelationTask(
        points,
        lineExact,
        planeExact,
        verification.relationInput,
        config
      );
      if (rel.valid) {
        onChange({
          ...verification,
          relationInput: {
            ...verification.relationInput,
            answerValue: fmtNum(rel.exactValue),
            reasoning: '법선벡터와 방향벡터의 내적/거리 공식을 이용하여 산출함.',
          },
        });
      }
    }
  };

  // [A] 자체 추론 도우미 점검 (유료 API 없이 동작)
  const handleAskAiCheck = () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const feedback = diagnoseVectorAttempt(
        activeTab,
        points,
        verification.lineInput,
        verification.planeInput,
        verification.relationInput,
        config
      );
      if (activeTab === 'line') {
        onChange({ ...verification, lineAiFeedback: feedback });
      } else if (activeTab === 'plane') {
        onChange({ ...verification, planeAiFeedback: feedback });
      } else {
        onChange({ ...verification, relationAiFeedback: feedback });
      }
    } finally {
      setAiLoading(false);
    }
  };

  // [H] 교사 제작 웹앱 정밀 검증기
  const handleRunTeacherVerify = () => {
    if (activeTab === 'line') {
      const exact = verifyLineEquation(points, verification.lineInput);
      onChange({
        ...verification,
        lineExactResult: exact,
        reflectLineTo3D: exact.valid ? true : verification.reflectLineTo3D,
      });
    } else if (activeTab === 'plane') {
      const exact = verifyPlaneEquation(points, verification.planeInput);
      onChange({
        ...verification,
        planeExactResult: exact,
        reflectPlaneTo3D: exact.valid ? true : verification.reflectPlaneTo3D,
      });
    } else {
      const lineRes = verification.lineExactResult ?? verifyLineEquation(points, verification.lineInput);
      const planeRes = verification.planeExactResult ?? verifyPlaneEquation(points, verification.planeInput);
      const rel = verifyRelationTask(
        points,
        lineRes,
        planeRes,
        verification.relationInput,
        config
      );
      onChange({
        ...verification,
        relationExactResult: rel,
        reflectRelationTo3D: rel.valid ? true : verification.reflectRelationTo3D,
      });
    }
  };

  const currentAiFeedback =
    activeTab === 'line'
      ? verification.lineAiFeedback
      : activeTab === 'plane'
      ? verification.planeAiFeedback
      : verification.relationAiFeedback;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            3단계 (4~5차시) · H-A-H (인간 → AI → 인간) · 과업 탐구하기
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            직선과 평면의 벡터 방정식 유도 및 AI · 교사 웹앱 검증
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            먼저 내 손으로 직접 계산하고([H]), AI로 풀이를 점검한 뒤([A]), 교사 정밀 검증기로 정답을 확인해 3D 집에 반영하세요([H]).
          </p>
        </div>
        <button
          type="button"
          onClick={onNextStage}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <span>4·5단계 · 온라인 전시 출품으로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* H-A-H Process Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-xs font-bold text-slate-900">1. [H] 학생이 먼저 직접 계산</div>
          <div className="text-xs text-slate-600 mt-0.5">
            설정한 좌표를 보고 방향벡터·법선벡터·방정식·각도를 종이에 먼저 풀어 입력합니다.
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-xs font-bold text-blue-700">2. [A] 인공지능(AI) 점검 돕기</div>
          <div className="text-xs text-slate-600 mt-0.5">
            AI가 내 풀이 과정의 오류나 부호 실수를 짚어주고 계산 결과를 비교해 줍니다.
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-xs font-bold text-emerald-700">3. [H] 교사 정밀 검증 및 3D 반영</div>
          <div className="text-xs text-slate-600 mt-0.5">
            AI와 풀이가 다를 경우 교사 웹앱의 수학 엔진으로 정답을 확정하고 3D 집에 시각화합니다.
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        {/* Left: 3D House with Vector Overlay & Coordinate Reference */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="h-[460px]">
            <HouseVector3DScene
              config={config}
              highlightedPointIds={highlightedPointIds}
              overlay={overlay}
            />
          </div>

          {/* 3D Overlay Toggles */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-700" />
              <span>3D 집 벡터 시각화 레이어</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!verification.lineExactResult?.valid}
                onClick={() =>
                  onChange({
                    ...verification,
                    reflectLineTo3D: !verification.reflectLineTo3D,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                  verification.reflectLineTo3D && verification.lineExactResult?.valid
                    ? 'bg-orange-50 border-orange-500 text-orange-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500 disabled:opacity-45'
                }`}
              >
                직선·방향벡터 표시
              </button>
              <button
                type="button"
                disabled={!verification.planeExactResult?.valid}
                onClick={() =>
                  onChange({
                    ...verification,
                    reflectPlaneTo3D: !verification.reflectPlaneTo3D,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                  verification.reflectPlaneTo3D && verification.planeExactResult?.valid
                    ? 'bg-sky-50 border-sky-500 text-sky-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500 disabled:opacity-45'
                }`}
              >
                지붕 평면·법선벡터 표시
              </button>
            </div>
          </div>

          {/* Compact Reference Coordinates */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-800 mb-2">
              현재 내 집의 주요 지점 좌표 참고표
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {points.map((pt) => {
                const isHl = highlightedPointIds.includes(pt.id);
                return (
                  <div
                    key={pt.id}
                    className={`px-2.5 py-1.5 rounded border text-xs ${
                      isHl
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{pt.label} {pt.name}: </span>
                    <span className="font-mono-tabular">
                      ({fmtNum(pt.x)},{fmtNum(pt.y)},{fmtNum(pt.z)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: H-A-H Interactive Math Verification Deck */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Task Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('line')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'line'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                과제 1 · 직선의 방정식
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plane')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'plane'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                과제 2 · 평면의 방정식
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('relation')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'relation'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                과제 3 · 각도·거리 심화
              </button>
            </div>

            <button
              type="button"
              onClick={fillSampleForTeacherDemo}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 whitespace-nowrap"
            >
              시연용 예시 풀이 채우기
            </button>
          </div>

          {/* Task 1: Line Equation */}
          {activeTab === 'line' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  [12기하03-04] 기둥·모서리의 직선의 벡터 방정식 구하기
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  직선이 지나는 두 점을 선택하고, 직접 계산한 방향벡터와 방정식을 입력하세요. (분수 입력 가능: 예 3/2)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">시작점 A</span>
                  <select
                    value={verification.lineInput.pointAId}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        lineInput: { ...verification.lineInput, pointAId: e.target.value },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} {p.name} ({fmtNum(p.x)}, {fmtNum(p.y)}, {fmtNum(p.z)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">끝점 B</span>
                  <select
                    value={verification.lineInput.pointBId}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        lineInput: { ...verification.lineInput, pointBId: e.target.value },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} {p.name} ({fmtNum(p.x)}, {fmtNum(p.y)}, {fmtNum(p.z)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-semibold text-slate-800">
                  [H] 내가 직접 계산한 직선의 요소 입력
                </div>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    방향벡터 <MathFormula latex="\vec{u} = (a, b, c)" /> (상수배 모두 정답 인정)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="a (x성분)"
                      value={verification.lineInput.dirX}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, dirX: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="b (y성분)"
                      value={verification.lineInput.dirY}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, dirY: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="c (z성분)"
                      value={verification.lineInput.dirZ}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, dirZ: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    방정식에 대입한 지나는 한 점 <MathFormula latex="(x_1, y_1, z_1)" />
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="x₁"
                      value={verification.lineInput.baseX}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, baseX: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="y₁"
                      value={verification.lineInput.baseY}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, baseY: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="z₁"
                      value={verification.lineInput.baseZ}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, baseZ: e.target.value },
                        })
                      }
                      className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-slate-600">기둥/선분 실제 길이 (m)</span>
                    <input
                      type="text"
                      placeholder="예: 3.74"
                      value={verification.lineInput.lengthInput}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: { ...verification.lineInput, lengthInput: e.target.value },
                        })
                      }
                      className="mt-1 w-full px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-600">지면(xy평면)과 이루는 각 (°)</span>
                    <input
                      type="text"
                      placeholder="예: 53.3"
                      value={verification.lineInput.angleGroundInput}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          lineInput: {
                            ...verification.lineInput,
                            angleGroundInput: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                    />
                  </label>
                </div>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    내 풀이 과정 요약 (풀이 기록지)
                  </span>
                  <textarea
                    rows={2}
                    value={verification.lineInput.reasoning}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        lineInput: { ...verification.lineInput, reasoning: e.target.value },
                      })
                    }
                    placeholder="직선의 방정식과 각도를 유도한 풀이 과정을 간단히 적어보세요."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Task 2: Plane Equation */}
          {activeTab === 'plane' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  [12기하03-05] 지붕면·벽면의 평면의 벡터 방정식 구하기
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  한 평면을 결정하는 일직선 위에 있지 않은 세 점 P, Q, R을 선택하고 법선벡터와 방정식을 계산하세요.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'pointPId', label: '점 P' },
                    { key: 'pointQId', label: '점 Q' },
                    { key: 'pointRId', label: '점 R' },
                  ] as const
                ).map((sel) => (
                  <label key={sel.key} className="block">
                    <span className="text-xs font-semibold text-slate-700">{sel.label}</span>
                    <select
                      value={verification.planeInput[sel.key]}
                      onChange={(e) =>
                        onChange({
                          ...verification,
                          planeInput: {
                            ...verification.planeInput,
                            [sel.key]: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      {points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({fmtNum(p.x)},{fmtNum(p.y)},{fmtNum(p.z)})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-semibold text-slate-800">
                  [H] 내가 직접 계산한 평면의 요소 입력
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs text-slate-600 mb-1">
                      벡터 <MathFormula latex="\overrightarrow{PQ}" />
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['pqX', 'pqY', 'pqZ'] as const).map((k, i) => (
                        <input
                          key={k}
                          type="text"
                          placeholder={['x', 'y', 'z'][i]}
                          value={verification.planeInput[k]}
                          onChange={(e) =>
                            onChange({
                              ...verification,
                              planeInput: { ...verification.planeInput, [k]: e.target.value },
                            })
                          }
                          className="px-2 py-1.5 text-xs font-mono-tabular rounded border border-slate-300 bg-white"
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-600 mb-1">
                      벡터 <MathFormula latex="\overrightarrow{PR}" />
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['prX', 'prY', 'prZ'] as const).map((k, i) => (
                        <input
                          key={k}
                          type="text"
                          placeholder={['x', 'y', 'z'][i]}
                          value={verification.planeInput[k]}
                          onChange={(e) =>
                            onChange({
                              ...verification,
                              planeInput: { ...verification.planeInput, [k]: e.target.value },
                            })
                          }
                          className="px-2 py-1.5 text-xs font-mono-tabular rounded border border-slate-300 bg-white"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    법선벡터 <MathFormula latex="\vec{n} = (a, b, c)" /> (상수배 동치 모두 인정)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['normalX', 'normalY', 'normalZ'] as const).map((k, i) => (
                      <input
                        key={k}
                        type="text"
                        placeholder={['a', 'b', 'c'][i]}
                        value={verification.planeInput[k]}
                        onChange={(e) =>
                          onChange({
                            ...verification,
                            planeInput: { ...verification.planeInput, [k]: e.target.value },
                          })
                        }
                        className="px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    평면의 방정식 <MathFormula latex="ax + by + cz + d = 0" /> 계수
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {(['eqA', 'eqB', 'eqC', 'eqD'] as const).map((k, i) => (
                      <input
                        key={k}
                        type="text"
                        placeholder={['a', 'b', 'c', 'd'][i]}
                        value={verification.planeInput[k]}
                        onChange={(e) =>
                          onChange({
                            ...verification,
                            planeInput: { ...verification.planeInput, [k]: e.target.value },
                          })
                        }
                        className="px-2.5 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                      />
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-600">
                    바닥면(z=0)과 지붕면이 이루는 경사각 (°)
                  </span>
                  <input
                    type="text"
                    placeholder="예: 26.57"
                    value={verification.planeInput.angleGroundInput}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        planeInput: {
                          ...verification.planeInput,
                          angleGroundInput: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                  />
                </label>

                <div>
                  <span className="block text-xs text-slate-600 mb-1">
                    내 풀이 과정 요약 (풀이 기록지)
                  </span>
                  <textarea
                    rows={2}
                    value={verification.planeInput.reasoning}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        planeInput: { ...verification.planeInput, reasoning: e.target.value },
                      })
                    }
                    placeholder="법선벡터를 내적 조건(n·PQ=0, n·PR=0)이나 외적으로 구한 과정을 기록하세요."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Task 3: Angles & Distances */}
          {activeTab === 'relation' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  기하학적 관계 심화 분석 (교각 · 이면각 · 거리)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  과제 1의 직선과 과제 2의 평면을 결합해 건축물의 기하학적 성질을 분석합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'line-plane-angle', label: '직선과 평면의 각' },
                    { id: 'two-planes-dihedral', label: '두 지붕면의 이면각' },
                    { id: 'point-plane-distance', label: '점과 평면의 거리' },
                  ] as const
                ).map((m) => {
                  const active = verification.relationInput.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...verification,
                          relationInput: { ...verification.relationInput, mode: m.id },
                        })
                      }
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        active
                          ? 'bg-blue-50 border-blue-600 text-blue-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {verification.relationInput.mode === 'point-plane-distance' && (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    거리를 측정할 꼭짓점 선택
                  </span>
                  <select
                    value={verification.relationInput.targetPointId}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        relationInput: {
                          ...verification.relationInput,
                          targetPointId: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} {p.name} ({fmtNum(p.x)}, {fmtNum(p.y)}, {fmtNum(p.z)})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    [H] 내가 계산한 결괏값 (
                    {verification.relationInput.mode === 'point-plane-distance' ? 'm' : '°'})
                  </span>
                  <input
                    type="text"
                    placeholder={
                      verification.relationInput.mode === 'point-plane-distance'
                        ? '예: 2.68'
                        : '예: 53.3'
                    }
                    value={verification.relationInput.answerValue}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        relationInput: {
                          ...verification.relationInput,
                          answerValue: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-slate-300 bg-white"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-600">내 풀이 과정 메모</span>
                  <textarea
                    rows={2}
                    value={verification.relationInput.reasoning}
                    onChange={(e) =>
                      onChange({
                        ...verification,
                        relationInput: {
                          ...verification.relationInput,
                          reasoning: e.target.value,
                        },
                      })
                    }
                    placeholder="내적 또는 점과 평면 사이 거리 공식 적용 과정을 적으세요."
                    className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons: [A] AI Check + [H] Teacher Precision Verifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleAskAiCheck}
              disabled={aiLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-600 bg-blue-50 text-blue-900 text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              <Bot className="w-4 h-4" />
              <span>{aiLoading ? 'AI 점검 중...' : '[A] AI에게 내 풀이 점검받기'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunTeacherVerify}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              <span>[H] 교사 정밀 검증기 정답 확인 & 3D 반영</span>
            </button>
          </div>

          {aiError && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3.5 text-xs">
              {aiError}
            </div>
          )}

          {/* [A] AI Feedback Card */}
          {currentAiFeedback && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-700" />
                  <span>[A] 풀이 점검 도우미 분석 결과</span>
                </div>
                <span className="text-xs font-semibold text-blue-700">
                  {currentAiFeedback.isConsistentWithStudent ? '풀이 일치' : '재검토 필요'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {currentAiFeedback.summary}
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div>
                  <span className="font-semibold text-slate-800">산출 식 기준: </span>
                  <span className="font-mono-tabular text-slate-900">
                    {currentAiFeedback.aiCalculatedEquation}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">산출 수치/각도: </span>
                  <span className="font-mono-tabular text-slate-900">
                    {currentAiFeedback.aiCalculatedAngleOrValue}
                  </span>
                </div>
              </div>
              {currentAiFeedback.mistakeSpots.length > 0 && (
                <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                  {currentAiFeedback.mistakeSpots.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                출처 및 윤리 안내: {currentAiFeedback.citationNote} · AI 결과와 내 풀이가 다를 경우 아래 교사 정밀 검증기로 최종 확인하세요.
              </div>
            </div>
          )}

          {/* [H] Teacher Deterministic Verification Output */}
          {activeTab === 'line' && verification.lineExactResult && (
            <div className="bg-white border border-emerald-300 rounded-xl p-5 space-y-3">
              {!verification.lineExactResult.valid ? (
                <div className="text-sm text-red-700 font-medium">
                  {verification.lineExactResult.error}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      [H] 교사 정밀 검증기 · 직선 최종 정답
                    </h3>
                    <span
                      className={`text-xs font-bold ${
                        verification.lineExactResult.checks.allCorrect
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {verification.lineExactResult.checks.allCorrect
                        ? '전체 정답 일치'
                        : '일부 항목 수정 필요'}
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      {
                        label: '방향벡터',
                        ok: verification.lineExactResult.checks.directionMatch,
                      },
                      {
                        label: '지나는 점',
                        ok: verification.lineExactResult.checks.basePointOnLine,
                      },
                      {
                        label: '선분 길이',
                        ok: verification.lineExactResult.checks.lengthMatch,
                      },
                      {
                        label: '지면과의 각',
                        ok: verification.lineExactResult.checks.angleMatch,
                      },
                    ].map((chk) => (
                      <div
                        key={chk.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                          chk.ok
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        {chk.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="font-semibold">{chk.label}:</span>
                        <span>{chk.ok ? '정확함' : '다시 확인'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Exact Equation & Step Derivation */}
                  <div className="bg-blueprint-grid bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 overflow-x-auto">
                    <div className="text-xs font-semibold text-slate-600">정확한 직선의 방정식</div>
                    <div className="text-base text-slate-900">
                      <MathFormula
                        latex={verification.lineExactResult.equationLatex}
                        displayMode
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs text-slate-800">
                      {verification.lineExactResult.derivationLatex.map((line, idx) => (
                        <div key={idx}>
                          <MathFormula latex={line} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'plane' && verification.planeExactResult && (
            <div className="bg-white border border-emerald-300 rounded-xl p-5 space-y-3">
              {!verification.planeExactResult.valid ? (
                <div className="text-sm text-red-700 font-medium">
                  {verification.planeExactResult.error}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      [H] 교사 정밀 검증기 · 평면 최종 정답
                    </h3>
                    <span
                      className={`text-xs font-bold ${
                        verification.planeExactResult.checks.allCorrect
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {verification.planeExactResult.checks.allCorrect
                        ? '전체 정답 일치'
                        : '일부 항목 수정 필요'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: '벡터 PQ', ok: verification.planeExactResult.checks.pqMatch },
                      { label: '벡터 PR', ok: verification.planeExactResult.checks.prMatch },
                      { label: '법선벡터', ok: verification.planeExactResult.checks.normalMatch },
                      { label: '평면 방정식', ok: verification.planeExactResult.checks.equationMatch },
                      { label: '지붕 경사각', ok: verification.planeExactResult.checks.angleMatch },
                    ].map((chk) => (
                      <div
                        key={chk.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                          chk.ok
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        {chk.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="font-semibold">{chk.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blueprint-grid bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 overflow-x-auto">
                    <div className="text-xs font-semibold text-slate-600">정확한 평면의 방정식</div>
                    <div className="text-base text-slate-900">
                      <MathFormula
                        latex={verification.planeExactResult.equationLatex}
                        displayMode
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs text-slate-800">
                      {verification.planeExactResult.derivationLatex.map((line, idx) => (
                        <div key={idx}>
                          <MathFormula latex={line} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'relation' && verification.relationExactResult && (
            <div className="bg-white border border-emerald-300 rounded-xl p-5 space-y-3">
              {!verification.relationExactResult.valid ? (
                <div className="text-sm text-red-700 font-medium">
                  {verification.relationExactResult.error}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      [H] 교사 정밀 검증기 · 심화 관계 최종 정답
                    </h3>
                    <span
                      className={`text-xs font-bold ${
                        verification.relationExactResult.valueMatch
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {verification.relationExactResult.valueMatch
                        ? '정답 일치'
                        : '계산값 재확인'}
                    </span>
                  </div>

                  <div className="bg-blueprint-grid bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 overflow-x-auto">
                    <div className="text-base text-slate-900">
                      <MathFormula
                        latex={verification.relationExactResult.formulaLatex}
                        displayMode
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs text-slate-800">
                      {verification.relationExactResult.derivationLatex.map((line, idx) => (
                        <div key={idx}>
                          <MathFormula latex={line} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
