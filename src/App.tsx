import React, { useEffect, useState } from 'react';
import type {
  ExhibitionProject,
  HouseDesignConfig,
  PeerFeedback,
  ReflectionAndEthics,
  SiteObservationData,
  StageId,
  VerificationState,
} from './types/project';
import {
  DEFAULT_HOUSE_CONFIG,
  DEFAULT_OBSERVATION,
  DEFAULT_REFLECTION,
  DEFAULT_VERIFICATION,
  SEED_EXHIBITIONS,
} from './data/seedExhibitions';
import { SiteObservationStage } from './components/stages/SiteObservationStage';
import { CoordinateDesignStage } from './components/stages/CoordinateDesignStage';
import { VectorVerificationStage } from './components/stages/VectorVerificationStage';
import { ExhibitionStage } from './components/stages/ExhibitionStage';
import { ReflectionEthicsStage } from './components/stages/ReflectionEthicsStage';

interface EthicsNoteItem {
  id: string;
  authorName: string;
  stance: 'human' | 'ai' | 'shared';
  argument: string;
  createdAt: string;
}

const STORAGE_KEY = 'vector_house_lesson_draft_v1';

const NAV_ITEMS: Array<{ id: StageId; label: string }> = [
  { id: 'observation', label: '1단계·입지관찰' },
  { id: 'design', label: '2단계·좌표설계' },
  { id: 'verification', label: '3단계·벡터검증' },
  { id: 'exhibition', label: '4·5단계·온라인전시' },
  { id: 'reflection', label: '성찰·윤리' },
];

function loadSavedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function App() {
  const saved = React.useMemo(() => loadSavedDraft(), []);

  const [activeStage, setActiveStage] = useState<StageId>('observation');
  const [studentName, setStudentName] = useState<string>(saved?.studentName ?? '');
  const [classRoom, setClassRoom] = useState<string>(saved?.classRoom ?? '2학년 1반');
  const [houseTitle, setHouseTitle] = useState<string>(saved?.houseTitle ?? '');

  const [observation, setObservation] = useState<SiteObservationData>(
    saved?.observation ?? DEFAULT_OBSERVATION
  );
  const [houseConfig, setHouseConfig] = useState<HouseDesignConfig>(
    saved?.houseConfig ?? DEFAULT_HOUSE_CONFIG
  );
  const [inquiryQuestion, setInquiryQuestion] = useState<string>(
    saved?.inquiryQuestion ??
      '만약 기준 좌표축의 원점을 집의 모서리에서 바닥 중앙으로 옮긴다면, 각 지점의 좌표와 지붕 평면 방정식의 법선벡터·상수항은 어떻게 바뀔까?'
  );
  const [verification, setVerification] = useState<VerificationState>(
    saved?.verification ?? DEFAULT_VERIFICATION
  );
  const [reflection, setReflection] = useState<ReflectionAndEthics>(
    saved?.reflection ?? DEFAULT_REFLECTION
  );

  const [exhibitions, setExhibitions] = useState<ExhibitionProject[]>(SEED_EXHIBITIONS);
  const [ethicsBoard, setEthicsBoard] = useState<EthicsNoteItem[]>([]);

  // Persist student work locally so refreshing during class preserves progress
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          studentName,
          classRoom,
          houseTitle,
          observation,
          houseConfig,
          inquiryQuestion,
          verification,
          reflection,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [
    studentName,
    classRoom,
    houseTitle,
    observation,
    houseConfig,
    inquiryQuestion,
    verification,
    reflection,
  ]);

  // Fetch shared class exhibition & ethics discussion board from Express server
  useEffect(() => {
    fetch('/api/exhibitions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setExhibitions(data);
        }
      })
      .catch(() => {
        // Seed data remains active if offline
      });

    fetch('/api/ethics-notes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setEthicsBoard(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleObservationChange = (nextObs: SiteObservationData) => {
    setObservation(nextObs);
    if (nextObs.selectedLotId !== houseConfig.siteLotId) {
      setHouseConfig((prev) => ({ ...prev, siteLotId: nextObs.selectedLotId }));
    }
  };

  const handlePublishProject = async (project: ExhibitionProject) => {
    try {
      const res = await fetch('/api/exhibitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (res.ok) {
        const updated = await res.json();
        if (Array.isArray(updated)) {
          setExhibitions(updated);
          return;
        }
      }
    } catch {
      // Fallback to client state
    }
    setExhibitions((prev) => [project, ...prev]);
  };

  const handleAddComment = async (
    projectId: string,
    comment: Omit<PeerFeedback, 'id' | 'createdAt'>
  ) => {
    try {
      const res = await fetch(`/api/exhibitions/${encodeURIComponent(projectId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      });
      if (res.ok) {
        const updated = await res.json();
        if (Array.isArray(updated)) {
          setExhibitions(updated);
          return;
        }
      }
    } catch {
      // Fallback to client state
    }
    const localComment: PeerFeedback = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setExhibitions((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, comments: [...p.comments, localComment] } : p
      )
    );
  };

  const handlePostEthicsNote = async (note: Omit<EthicsNoteItem, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/ethics-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      if (res.ok) {
        const updated = await res.json();
        if (Array.isArray(updated)) {
          setEthicsBoard(updated);
          return;
        }
      }
    } catch {
      // Fallback
    }
    setEthicsBoard((prev) => [
      { ...note, id: `eth-${Date.now()}`, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200 px-4 sm:px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveStage('observation')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            벡터로 짓는 나의 집
          </button>

          {/* Zone 2: 5 Single-Line Stage Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {NAV_ITEMS.map((item) => {
              const active = activeStage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStage(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-blue-700 border-blue-700 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveStage('exhibition')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              내 작품 출품
            </button>
          </div>
        </div>

        {/* Mobile Stage Strip */}
        <nav className="flex md:hidden items-center gap-3 overflow-x-auto pt-2.5 mt-2.5 border-t border-slate-100 text-xs font-medium">
          {NAV_ITEMS.map((item) => {
            const active = activeStage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveStage(item.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Stage Workspace */}
      <main className="flex-1">
        {activeStage === 'observation' && (
          <SiteObservationStage
            observation={observation}
            onChange={handleObservationChange}
            onNextStage={() => setActiveStage('design')}
          />
        )}

        {activeStage === 'design' && (
          <CoordinateDesignStage
            config={houseConfig}
            inquiryQuestion={inquiryQuestion}
            onChangeConfig={setHouseConfig}
            onChangeInquiry={setInquiryQuestion}
            onNextStage={() => setActiveStage('verification')}
          />
        )}

        {activeStage === 'verification' && (
          <VectorVerificationStage
            config={houseConfig}
            verification={verification}
            onChange={setVerification}
            onNextStage={() => setActiveStage('exhibition')}
          />
        )}

        {activeStage === 'exhibition' && (
          <ExhibitionStage
            studentName={studentName}
            classRoom={classRoom}
            houseTitle={houseTitle}
            houseConfig={houseConfig}
            observation={observation}
            inquiryQuestion={inquiryQuestion}
            verification={verification}
            reflectionNote={reflection.reflectionAnswer}
            exhibitions={exhibitions}
            onChangeIdentity={({ studentName: sn, classRoom: cr, houseTitle: ht }) => {
              setStudentName(sn);
              setClassRoom(cr);
              setHouseTitle(ht);
            }}
            onPublishProject={handlePublishProject}
            onAddComment={handleAddComment}
          />
        )}

        {activeStage === 'reflection' && (
          <ReflectionEthicsStage
            reflection={reflection}
            studentName={studentName}
            ethicsBoard={ethicsBoard}
            onChange={setReflection}
            onPostEthicsNote={handlePostEthicsNote}
          />
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="no-print border-t border-slate-200 bg-white px-6 py-4 mt-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            고등학교 2학년 기하 · 읽걷쓰AI 프로젝트 수업 · 성취기준 [12기하03-04], [12기하03-05]
          </span>
          <span>
            국화리 저수지 일대 공간 탐구 · H-A-H 벡터 방정식 검증 · 온라인 3D 전시
          </span>
        </div>
      </footer>
    </div>
  );
}
