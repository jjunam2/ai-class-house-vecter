import React from 'react';
import { Compass, MapPin, Sun, ArrowRight } from 'lucide-react';
import type { SiteLotId, SiteObservationData } from '../../types/project';
import { SITE_LOTS } from '../../data/seedExhibitions';
import { Reservoir3DScene } from '../Reservoir3DScene';

interface SiteObservationStageProps {
  observation: SiteObservationData;
  onChange: (next: SiteObservationData) => void;
  onNextStage: () => void;
}

export const SiteObservationStage: React.FC<SiteObservationStageProps> = ({
  observation,
  onChange,
  onNextStage,
}) => {
  const selectedLot =
    SITE_LOTS.find((l) => l.id === observation.selectedLotId) ?? SITE_LOTS[0];

  const handleSelectLot = (lotId: SiteLotId) => {
    onChange({ ...observation, selectedLotId: lotId });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Stage Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            1단계 (1차시) · 읽걷쓰[읽기] · 현상 관찰하기
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            국화리 저수지 일대 입지 관찰 및 집 설계 위치 구상
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            답사한 국화리 저수지 지형의 방위, 고도, 일조 변화를 3D로 탐색하고 내가 살고 싶은 집의 대지를 선택하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onNextStage}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <span>2단계 · 3D 좌표 설계로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Split Sandbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Left: 3D Terrain Viewport + Sunlight Time Slider */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[500px] lg:h-[560px]">
            <Reservoir3DScene
              lots={SITE_LOTS}
              selectedLotId={observation.selectedLotId}
              sunTimeHour={observation.sunTimeHour}
              onSelectLot={handleSelectLot}
            />
          </div>

          {/* Sunlight Simulation Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  태양 고도 및 일조 방향 시뮬레이션
                </div>
                <div className="text-xs text-slate-500">
                  시간대에 따라 동쪽 → 정남쪽 → 서쪽으로 변하는 그림자와 채광을 확인하세요.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-[240px]">
              <input
                type="range"
                min={7}
                max={18}
                step={0.5}
                value={observation.sunTimeHour}
                onChange={(e) =>
                  onChange({ ...observation, sunTimeHour: Number(e.target.value) })
                }
                aria-label="태양 시각 조절"
                className="w-full accent-blue-700 cursor-pointer"
              />
              <span className="font-mono-tabular text-sm font-semibold text-slate-900 whitespace-nowrap w-14 text-right">
                {Math.floor(observation.sunTimeHour)}:
                {observation.sunTimeHour % 1 === 0 ? '00' : '30'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Lot Comparison + Observation Card */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Lot Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-700" />
                <span>대상 대지 후보 비교 선택</span>
              </h2>
              <span className="text-xs text-slate-500">3개 구역 중 택 1</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {SITE_LOTS.map((lot) => {
                const active = lot.id === observation.selectedLotId;
                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => handleSelectLot(lot.id)}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold whitespace-nowrap truncate">
                      {lot.name.split('·')[0].trim()}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums truncate">
                      표고 {lot.elevation}m · {lot.slopeDeg}°
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Lot Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-sm">
              <div className="font-semibold text-slate-900">{selectedLot.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">방위: </span>
                  <span className="font-medium text-slate-800">{selectedLot.orientation}</span>
                </div>
                <div>
                  <span className="text-slate-500">지형 고도/경사: </span>
                  <span className="font-mono-tabular font-medium text-slate-800">
                    {selectedLot.elevation}m / {selectedLot.slopeDeg}°
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">입지 장점: </span>
                {selectedLot.pros}
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">설계 고려사항: </span>
                {selectedLot.considerations}
              </div>
            </div>
          </div>

          {/* SketchUp & Field Observation Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex-1 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-700" />
                <span>국화리 저수지 답사 · 관찰 카드</span>
              </h2>
              <span className="text-xs text-slate-500">자동 저장됨</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. 방위 및 일조 조건 관찰
              </label>
              <input
                type="text"
                value={observation.orientationNote}
                onChange={(e) =>
                  onChange({ ...observation, orientationNote: e.target.value })
                }
                placeholder="예: 남향으로 창을 내어 겨울철 채광을 확보함"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. 지형 고도 및 기준점 구상
              </label>
              <input
                type="text"
                value={observation.terrainNote}
                onChange={(e) =>
                  onChange({ ...observation, terrainNote: e.target.value })
                }
                placeholder="예: 집의 한쪽 모서리를 기준점 (0,0,0)으로 설정"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                3. 주변 환경과 내가 살고 싶은 집 설계 컨셉
              </label>
              <textarea
                rows={3}
                value={observation.houseConcept}
                onChange={(e) =>
                  onChange({ ...observation, houseConcept: e.target.value })
                }
                placeholder="국화리 저수지 일대 환경과 어우러지는 집의 구조와 특징을 적으세요."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
