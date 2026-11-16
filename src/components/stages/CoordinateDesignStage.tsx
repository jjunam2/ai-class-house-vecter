import React, { useMemo, useState } from 'react';
import { ArrowRight, Box, Crosshair, HelpCircle, RotateCcw } from 'lucide-react';
import type {
  HouseArchetype,
  HouseDesignConfig,
  HousePoint,
  OriginMode,
} from '../../types/project';
import { computeHousePoints, fmtNum } from '../../utils/vectorMath';
import { DEFAULT_HOUSE_CONFIG } from '../../data/seedExhibitions';
import { HouseVector3DScene } from '../HouseVector3DScene';

interface CoordinateDesignStageProps {
  config: HouseDesignConfig;
  inquiryQuestion: string;
  onChangeConfig: (next: HouseDesignConfig) => void;
  onChangeInquiry: (next: string) => void;
  onNextStage: () => void;
}

const ARCHETYPE_LABELS: Array<{ id: HouseArchetype; label: string; desc: string }> = [
  { id: 'gable', label: '박공지붕 주택', desc: '대칭 양면 경사 지붕' },
  { id: 'shed', label: '단면 경사 하우스', desc: '단일 경사 태양광 지붕' },
  { id: 'aframe', label: 'A프레임 다락집', desc: '삼각 급경사 구조' },
  { id: 'custom', label: '자유 비대칭 설계', desc: '용마루 편심 조절' },
];

const ORIGIN_MODES: Array<{ id: OriginMode; label: string }> = [
  { id: 'corner', label: '한쪽 끝 모서리 (B₁)' },
  { id: 'center', label: '집의 바닥 중앙' },
  { id: 'custom', label: '사용자 지정 이동' },
];

const SAMPLE_QUESTIONS = [
  '만약 기준 좌표축의 원점을 집의 모서리에서 바닥 중앙으로 옮긴다면, 각 지점의 좌표와 지붕 평면 방정식의 법선벡터·상수항은 어떻게 바뀔까?',
  '만약 현관 사선 기둥의 상단 X좌표 기울기를 1m에서 2m로 늘린다면, 기둥이 지면과 이루는 각도와 방향벡터는 어떤 과정을 거쳐 구할 수 있을까?',
  '만약 용마루 위치를 한쪽으로 치우치게 설계하면, 양쪽 지붕면이 만나는 각도(이면각)를 어떻게 벡터의 내적으로 계산할 수 있을까?',
];

export const CoordinateDesignStage: React.FC<CoordinateDesignStageProps> = ({
  config,
  inquiryQuestion,
  onChangeConfig,
  onChangeInquiry,
  onNextStage,
}) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>('S2');
  const points = useMemo(() => computeHousePoints(config), [config]);
  const selectedPoint = points.find((p) => p.id === selectedPointId) ?? null;

  const handleArchetypeChange = (arch: HouseArchetype) => {
    if (arch === 'gable') {
      onChangeConfig({
        ...config,
        archetype: 'gable',
        roofOffset: 0,
        wallHeight: 3,
        roofHeight: 2,
      });
    } else if (arch === 'shed') {
      onChangeConfig({
        ...config,
        archetype: 'shed',
        roofOffset: 0,
        wallHeight: 3,
        roofHeight: 3,
      });
    } else if (arch === 'aframe') {
      onChangeConfig({
        ...config,
        archetype: 'aframe',
        wallHeight: 3,
        roofHeight: 3,
      });
    } else {
      onChangeConfig({
        ...config,
        archetype: 'custom',
        roofOffset: 1,
      });
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Stage Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            2단계 (2~3차시) · 읽걷쓰[걷기] · 문제 질문하기 & 공간 모델링
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            살고 싶은 집 3D 모델링 및 가상 좌표축 설정
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            집의 외형을 디자인하고 기준점(원점)을 이동해보며 주요 꼭짓점들이 3차원 좌표 (x, y, z)로 어떻게 변환되는지 탐색하세요.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              onChangeConfig({ ...DEFAULT_HOUSE_CONFIG, siteLotId: config.siteLotId })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본 치수로 초기화</span>
          </button>
          <button
            type="button"
            onClick={onNextStage}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <span>3단계 · 벡터 방정식 검증으로 이동</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        {/* Left: 3D House + Coordinate Table */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[490px]">
            <HouseVector3DScene
              config={config}
              selectedPointId={selectedPointId}
              onSelectPoint={(pt: HousePoint) => setSelectedPointId(pt.id)}
            />
          </div>

          {/* Selected Point Quick Inspector */}
          {selectedPoint && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-bold text-blue-700 mr-2">{selectedPoint.label}</span>
                <span className="font-semibold text-slate-900">{selectedPoint.name}</span>
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                ({fmtNum(selectedPoint.x)}, {fmtNum(selectedPoint.y)}, {fmtNum(selectedPoint.z)})
              </div>
            </div>
          )}

          {/* 3D Point Recording Sheet */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                3차원 공간 좌표 기록표 (학습지)
              </h2>
              <span className="text-xs text-slate-500">
                표의 점을 클릭하면 3D 모델에서 해당 위치가 강조됩니다
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {points.map((pt) => {
                const isSel = pt.id === selectedPointId;
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setSelectedPointId(pt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      isSel
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{pt.label}</span>
                      <span className="text-[11px] text-slate-500 truncate ml-1">
                        {pt.name}
                      </span>
                    </div>
                    <div className="font-mono-tabular text-xs font-semibold text-blue-800 mt-1">
                      ({fmtNum(pt.x)}, {fmtNum(pt.y)}, {fmtNum(pt.z)})
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Design Parameters + Origin Shift Experiment + Inquiry Card */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* 1. House Structure & Dimensions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Box className="w-4 h-4 text-blue-700" />
              <span>집 외형 및 구조 치수 설계</span>
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {ARCHETYPE_LABELS.map((item) => {
                const active = config.archetype === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleArchetypeChange(item.id)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.desc}</div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>가로 너비 (X축 방향)</span>
                  <span className="font-mono-tabular font-semibold">{config.width} m</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={14}
                  step={1}
                  value={config.width}
                  onChange={(e) =>
                    onChangeConfig({ ...config, width: Number(e.target.value) })
                  }
                  className="w-full accent-blue-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>세로 깊이 (Y축 방향)</span>
                  <span className="font-mono-tabular font-semibold">{config.depth} m</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={1}
                  value={config.depth}
                  onChange={(e) =>
                    onChangeConfig({ ...config, depth: Number(e.target.value) })
                  }
                  className="w-full accent-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>벽체 높이</span>
                    <span className="font-mono-tabular font-semibold">{config.wallHeight} m</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={5}
                    step={0.5}
                    value={config.wallHeight}
                    onChange={(e) =>
                      onChangeConfig({ ...config, wallHeight: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>지붕 높이차</span>
                    <span className="font-mono-tabular font-semibold">{config.roofHeight} m</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={config.roofHeight}
                    onChange={(e) =>
                      onChangeConfig({ ...config, roofHeight: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>현관 사선기둥 기울기</span>
                    <span className="font-mono-tabular font-semibold">{config.pillarTilt} m</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.5}
                    value={config.pillarTilt}
                    onChange={(e) =>
                      onChangeConfig({ ...config, pillarTilt: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>

                {config.archetype !== 'shed' && (
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>용마루 편심 이동</span>
                      <span className="font-mono-tabular font-semibold">{config.roofOffset} m</span>
                    </div>
                    <input
                      type="range"
                      min={-2}
                      max={2}
                      step={0.5}
                      value={config.roofOffset}
                      onChange={(e) =>
                        onChangeConfig({ ...config, roofOffset: Number(e.target.value) })
                      }
                      className="w-full accent-blue-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Origin Shift Experiment ("만약에 ~라면") */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <Crosshair className="w-4 h-4 text-blue-700" />
              <span>기준 좌표축 원점 변경 실험 ("만약에 ~라면")</span>
            </h2>
            <p className="text-xs text-slate-600 mb-3">
              원점 O(0, 0, 0)의 위치를 옮길 때 집의 모든 꼭짓점 좌표가 어떻게 달라지는지 실시간으로 비교하세요.
            </p>

            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg mb-3">
              {ORIGIN_MODES.map((m) => {
                const active = config.originMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, originMode: m.id })}
                    className={`flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {config.originMode === 'custom' && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <label key={axis} className="block">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase">
                      기준 이동 {axis} (m)
                    </span>
                    <input
                      type="number"
                      step={0.5}
                      value={config.customOrigin[axis]}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          customOrigin: {
                            ...config.customOrigin,
                            [axis]: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-sm font-mono-tabular rounded-lg border border-slate-300"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 3. Question Type Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-1">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              <span>질문 유형 카드 · 내 집의 탐구 질문 다듬기</span>
            </h2>
            <p className="text-xs text-slate-600 mb-3">
              "만약에 ~라면, 어떤 전략과 과정을 거칠까?" 형식으로 나만의 수학적 탐구 질문을 작성하세요.
            </p>

            <div className="space-y-1.5 mb-3">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChangeInquiry(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  예시 {idx + 1}: {q}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={inquiryQuestion}
              onChange={(e) => onChangeInquiry(e.target.value)}
              placeholder="직접 만든 탐구 질문을 입력하세요..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
