import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  MonitorPlay,
  Send,
  Upload,
  X,
} from 'lucide-react';
import type {
  ExhibitionProject,
  HouseDesignConfig,
  PeerFeedback,
  SiteObservationData,
  VerificationState,
} from '../../types/project';
import {
  computeHousePoints,
  fmtNum,
  verifyLineEquation,
  verifyPlaneEquation,
  verifyRelationTask,
} from '../../utils/vectorMath';
import { HouseVector3DScene, type VectorOverlayData } from '../HouseVector3DScene';
import { MathFormula } from '../MathFormula';

interface ExhibitionStageProps {
  studentName: string;
  classRoom: string;
  houseTitle: string;
  houseConfig: HouseDesignConfig;
  observation: SiteObservationData;
  inquiryQuestion: string;
  verification: VerificationState;
  reflectionNote: string;
  exhibitions: ExhibitionProject[];
  onChangeIdentity: (next: { studentName: string; classRoom: string; houseTitle: string }) => void;
  onPublishProject: (project: ExhibitionProject) => Promise<void>;
  onAddComment: (projectId: string, comment: Omit<PeerFeedback, 'id' | 'createdAt'>) => Promise<void>;
}

const FEEDBACK_TYPE_LABELS: Record<PeerFeedback['feedbackType'], string> = {
  explore: '추가 탐구 제안',
  'vector-relation': '벡터·현실공간 분석 제안',
  praise: '우수 사례 칭찬',
};

export const ExhibitionStage: React.FC<ExhibitionStageProps> = ({
  studentName,
  classRoom,
  houseTitle,
  houseConfig,
  observation,
  inquiryQuestion,
  verification,
  reflectionNote,
  exhibitions,
  onChangeIdentity,
  onPublishProject,
  onAddComment,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'exemplar'>('all');
  const [selectedProject, setSelectedProject] = useState<ExhibitionProject | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [copiedNotion, setCopiedNotion] = useState(false);
  const [showPublishForm, setShowPublishForm] = useState(false);

  // Comment composer state
  const [commentAuthor, setCommentAuthor] = useState(studentName || '');
  const [commentType, setCommentType] = useState<PeerFeedback['feedbackType']>('vector-relation');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const points = useMemo(() => computeHousePoints(houseConfig), [houseConfig]);

  const activeLine = useMemo(
    () => verification.lineExactResult ?? verifyLineEquation(points, verification.lineInput),
    [points, verification]
  );
  const activePlane = useMemo(
    () => verification.planeExactResult ?? verifyPlaneEquation(points, verification.planeInput),
    [points, verification]
  );
  const activeRelation = useMemo(
    () =>
      verification.relationExactResult ??
      verifyRelationTask(points, activeLine, activePlane, verification.relationInput, houseConfig),
    [points, activeLine, activePlane, verification.relationInput, verification.relationExactResult, houseConfig]
  );

  const displayedList = useMemo(() => {
    if (filterMode === 'exemplar') {
      return exhibitions.filter((e) => e.isExemplar);
    }
    return exhibitions;
  }, [exhibitions, filterMode]);

  const buildNotionMarkdown = () => {
    const coordLines = points
      .map((p) => `- ${p.label} ${p.name}: (${fmtNum(p.x)}, ${fmtNum(p.y)}, ${fmtNum(p.z)})`)
      .join('\n');

    return [
      `# [벡터로 짓는 나의 집] ${houseTitle || '나의 공간 설계 보고서'}`,
      `- 작성자: ${classRoom} ${studentName || '이름 미입력'}`,
      `- 선택 대지: ${observation.selectedLotId} · 컨셉: ${observation.houseConcept}`,
      ``,
      `## 1. 핵심 탐구 질문`,
      `> ${inquiryQuestion || '작성 전'}`,
      ``,
      `## 2. 3차원 공간 좌표 기록`,
      coordLines,
      ``,
      `## 3. 직선과 평면의 벡터 방정식 분석`,
      activeLine.valid
        ? `- 직선(${activeLine.pointA.label}→${activeLine.pointB.label}): $${activeLine.equationLatex}$ (지면각 약 ${fmtNum(activeLine.exactAngleGroundDeg)}°)`
        : '- 직선 분석 미완료',
      activePlane.valid
        ? `- 평면(${activePlane.pointP.label},${activePlane.pointQ.label},${activePlane.pointR.label}): $${activePlane.equationLatex}$ (경사각 약 ${fmtNum(activePlane.exactAngleGroundDeg)}°)`
        : '- 평면 분석 미완료',
      activeRelation.valid
        ? `- 심화 관계 분석: ${fmtNum(activeRelation.exactValue)}${activeRelation.unit}`
        : '',
      ``,
      `## 4. H-A-H 검증 및 성찰`,
      `${reflectionNote || '성찰·윤리 탭에서 성찰 기록 작성 가능'}`,
      `- 출처 및 윤리: Gemini AI 점검 및 교사 제작 정밀 웹앱 검증 완료 (개인정보 비노출 준수)`,
    ].join('\n');
  };

  const handleCopyNotion = async () => {
    try {
      await navigator.clipboard.writeText(buildNotionMarkdown());
      setCopiedNotion(true);
      setTimeout(() => setCopiedNotion(false), 2200);
    } catch {
      // Fallback ignored in restricted environments
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !houseTitle.trim()) return;
    setPublishing(true);
    try {
      const newProj: ExhibitionProject = {
        id: `student-${Date.now()}`,
        studentName: studentName.trim(),
        classRoom: classRoom.trim() || '2학년',
        title: houseTitle.trim(),
        concept: observation.houseConcept || '국화리 저수지 일대 3D 공간 벡터 주택',
        houseConfig,
        observation,
        inquiryQuestion,
        verifiedLineSummary: activeLine.valid
          ? {
              label: `${activeLine.pointA.label} → ${activeLine.pointB.label} 직선`,
              equationLatex: activeLine.equationLatex,
              angleGroundDeg: activeLine.exactAngleGroundDeg,
              pointA: activeLine.pointA,
              pointB: activeLine.pointB,
            }
          : null,
        verifiedPlaneSummary: activePlane.valid
          ? {
              label: `${activePlane.pointP.label}, ${activePlane.pointQ.label}, ${activePlane.pointR.label} 평면`,
              equationLatex: activePlane.equationLatex,
              normal: activePlane.simplifiedNormal,
              angleGroundDeg: activePlane.exactAngleGroundDeg,
              points: [activePlane.pointP, activePlane.pointQ, activePlane.pointR],
            }
          : null,
        verifiedRelationSummary: activeRelation.valid
          ? {
              label:
                activeRelation.mode === 'line-plane-angle'
                  ? '직선과 평면이 이루는 각'
                  : activeRelation.mode === 'two-planes-dihedral'
                  ? '두 지붕면의 이면각'
                  : '꼭짓점과 평면 사이의 거리',
              resultText: `${fmtNum(activeRelation.exactValue)}${activeRelation.unit}`,
            }
          : null,
        reflectionNote: reflectionNote || '3차원 좌표와 벡터 방정식으로 집의 구조를 검증하고 반영했습니다.',
        aiCitationNote:
          verification.lineAiFeedback || verification.planeAiFeedback
            ? 'Gemini AI 계산 점검 및 교사 웹앱 정밀 검증 완료'
            : '교사 제작 웹앱 정밀 검증 완료',
        comments: [],
        createdAt: new Date().toISOString(),
      };

      await onPublishProject(newProj);
      setPublishSuccess(true);
      setShowPublishForm(false);
      setSelectedProject(newProj);
      setTimeout(() => setPublishSuccess(false), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !commentAuthor.trim() || !commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await onAddComment(selectedProject.id, {
        authorName: commentAuthor.trim(),
        feedbackType: commentType,
        content: commentText.trim(),
      });
      setCommentText('');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Keep modal synced with latest exhibition state (for new comments)
  const currentModalProject = useMemo(() => {
    if (!selectedProject) return null;
    return exhibitions.find((p) => p.id === selectedProject.id) ?? selectedProject;
  }, [exhibitions, selectedProject]);

  const modalOverlay: VectorOverlayData | undefined = useMemo(() => {
    if (!currentModalProject) return undefined;
    return {
      line: currentModalProject.verifiedLineSummary
        ? {
            pointA: currentModalProject.verifiedLineSummary.pointA,
            pointB: currentModalProject.verifiedLineSummary.pointB,
            label: currentModalProject.verifiedLineSummary.label,
          }
        : null,
      plane: currentModalProject.verifiedPlaneSummary
        ? {
            points: currentModalProject.verifiedPlaneSummary.points,
            normal: currentModalProject.verifiedPlaneSummary.normal,
            label: currentModalProject.verifiedPlaneSummary.label,
          }
        : null,
    };
  }, [currentModalProject]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Stage Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            4·5단계 (6~8차시) · 읽걷쓰[쓰기] · 실천 행동하기
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            공간 벡터 온라인 전시관 및 상호 피드백
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            내 집 모델링과 벡터 분석 산출물을 노션에 정리하거나 온라인 전시에 출품하고, 친구들의 3D 작품에 수학적 피드백 댓글을 남겨보세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyNotion}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {copiedNotion ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedNotion ? '노션 마크다운 복사됨' : '노션 정리용 마크다운 복사'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPublishForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>내 작품 전시 등록하기</span>
          </button>
        </div>
      </div>

      {publishSuccess && (
        <div className="mt-4 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium">
          내 작품과 벡터 분석 산출물이 학급 온라인 전시관에 등록되었습니다!
        </div>
      )}

      {/* Publish Submission Drawer */}
      {showPublishForm && (
        <form
          onSubmit={handlePublish}
          className="mt-5 bg-white border border-blue-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              온라인 전시 출품 서식 작성 (개인정보 보호 유의)
            </h2>
            <button
              type="button"
              onClick={() => setShowPublishForm(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="출품 창 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">학년 · 반</span>
              <input
                type="text"
                required
                placeholder="예: 2학년 1반"
                value={classRoom}
                onChange={(e) =>
                  onChangeIdentity({ studentName, classRoom: e.target.value, houseTitle })
                }
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">이름 (또는 닉네임)</span>
              <input
                type="text"
                required
                placeholder="예: 김하늘"
                value={studentName}
                onChange={(e) =>
                  onChangeIdentity({ studentName: e.target.value, classRoom, houseTitle })
                }
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">작품 제목</span>
              <input
                type="text"
                required
                placeholder="예: 햇빛 드는 수변 사선기둥 주택"
                value={houseTitle}
                onChange={(e) =>
                  onChangeIdentity({ studentName, classRoom, houseTitle: e.target.value })
                }
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </label>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-semibold text-slate-900">자동 첨부되는 직선 분석: </span>
              {activeLine.valid ? (
                <MathFormula latex={activeLine.equationLatex} />
              ) : (
                '미입력'
              )}
            </div>
            <div>
              <span className="font-semibold text-slate-900">자동 첨부되는 평면 분석: </span>
              {activePlane.valid ? (
                <MathFormula latex={activePlane.equationLatex} />
              ) : (
                '미입력'
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">
              디지털 안전 약속: 전화번호, 집 주소 등 타인 및 본인의 민감한 개인정보가 포함되지 않도록 확인하세요.
            </span>
            <button
              type="submit"
              disabled={publishing}
              className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {publishing ? '전시 등록 중...' : '전시관에 최종 게시하기'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mt-6">
        <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            전체 전시 작품 ({exhibitions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('exemplar')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              filterMode === 'exemplar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MonitorPlay className="w-3.5 h-3.5 text-blue-700" />
            <span>전자칠판 우수 사례</span>
          </button>
        </div>

        <div className="text-xs text-slate-500">
          카드를 클릭하면 3D 집 모델과 벡터 방정식 풀이를 회전하며 살펴보고 피드백 댓글을 남길 수 있습니다.
        </div>
      </div>

      {/* Exhibition Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
        {displayedList.map((proj) => (
          <article
            key={proj.id}
            onClick={() => setSelectedProject(proj)}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between cursor-pointer hover:border-blue-500 transition-colors"
          >
            <div>
              <div className="text-xs text-slate-500 mb-1.5">
                {proj.classRoom} · {proj.studentName}
                {proj.isExemplar ? ' · 단계별 우수 사례' : ''}
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {proj.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                {proj.concept}
              </p>

              {/* Vector Analysis Summary Box */}
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>집 구조 / 기준점</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    {proj.houseConfig.width}×{proj.houseConfig.depth}×
                    {proj.houseConfig.wallHeight + proj.houseConfig.roofHeight}m ·{' '}
                    {proj.houseConfig.originMode === 'center' ? '중앙 원점' : '모서리 원점'}
                  </span>
                </div>
                {proj.verifiedLineSummary && (
                  <div className="pt-1.5 border-t border-slate-200 overflow-x-auto">
                    <div className="text-[11px] text-slate-500 mb-0.5">
                      {proj.verifiedLineSummary.label}
                    </div>
                    <MathFormula latex={proj.verifiedLineSummary.equationLatex} />
                  </div>
                )}
                {proj.verifiedPlaneSummary && (
                  <div className="pt-1.5 border-t border-slate-200 overflow-x-auto">
                    <div className="text-[11px] text-slate-500 mb-0.5">
                      {proj.verifiedPlaneSummary.label}
                    </div>
                    <MathFormula latex={proj.verifiedPlaneSummary.equationLatex} />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>피드백 {proj.comments.length}개</span>
              </span>
              <span className="font-semibold text-blue-700">3D 작품 · 분석 보기 →</span>
            </div>
          </article>
        ))}
      </div>

      {/* Interactive 3D Exhibition & Peer Feedback Modal */}
      {currentModalProject && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">
                  {currentModalProject.classRoom} · {currentModalProject.studentName} ·{' '}
                  {currentModalProject.aiCitationNote}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {currentModalProject.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="상세 보기 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 3D Model with Vector Overlays */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="h-[420px]">
                  <HouseVector3DScene
                    config={currentModalProject.houseConfig}
                    overlay={modalOverlay}
                    compact
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-900">설계 컨셉 및 입지 설명</div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {currentModalProject.concept}
                  </p>
                  {currentModalProject.inquiryQuestion && (
                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
                      <span className="font-semibold text-blue-800">핵심 탐구 질문: </span>
                      {currentModalProject.inquiryQuestion}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">수학적 성찰: </span>
                    {currentModalProject.reflectionNote}
                  </div>
                </div>
              </div>

              {/* Right Vector Formulas + Peer Feedback Section */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-blueprint-grid bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-900">
                    검증된 공간 벡터 방정식 산출물
                  </div>

                  {currentModalProject.verifiedLineSummary && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto">
                      <div className="text-xs font-semibold text-orange-700 mb-1">
                        {currentModalProject.verifiedLineSummary.label} (지면각{' '}
                        {fmtNum(currentModalProject.verifiedLineSummary.angleGroundDeg)}°)
                      </div>
                      <MathFormula
                        latex={currentModalProject.verifiedLineSummary.equationLatex}
                      />
                    </div>
                  )}

                  {currentModalProject.verifiedPlaneSummary && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto">
                      <div className="text-xs font-semibold text-sky-700 mb-1">
                        {currentModalProject.verifiedPlaneSummary.label} (경사각{' '}
                        {fmtNum(currentModalProject.verifiedPlaneSummary.angleGroundDeg)}°)
                      </div>
                      <MathFormula
                        latex={currentModalProject.verifiedPlaneSummary.equationLatex}
                      />
                    </div>
                  )}

                  {currentModalProject.verifiedRelationSummary && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-slate-700">
                        {currentModalProject.verifiedRelationSummary.label}
                      </div>
                      <div className="text-sm font-mono-tabular font-bold text-slate-900 mt-0.5">
                        {currentModalProject.verifiedRelationSummary.resultText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Peer Feedback Comments */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1 flex flex-col gap-3">
                  <div className="text-sm font-bold text-slate-900">
                    학급 친구 상호 피드백 ({currentModalProject.comments.length})
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {currentModalProject.comments.length === 0 ? (
                      <div className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-lg">
                        첫 번째 수학적 피드백 댓글을 남겨보세요!
                      </div>
                    ) : (
                      currentModalProject.comments.map((c) => (
                        <div
                          key={c.id}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="font-semibold text-slate-900">{c.authorName}</span>
                            <span>{FEEDBACK_TYPE_LABELS[c.feedbackType]}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Feedback Form */}
                  <form onSubmit={handleSubmitComment} className="pt-3 border-t border-slate-200 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-800">
                      피드백 댓글 양식 작성하기
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="내 이름 (예: 박서준)"
                        value={commentAuthor}
                        onChange={(e) => setCommentAuthor(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                      <select
                        value={commentType}
                        onChange={(e) =>
                          setCommentType(e.target.value as PeerFeedback['feedbackType'])
                        }
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="vector-relation">벡터·현실공간 분석 제안</option>
                        <option value="explore">추가 탐구 활동 제안</option>
                        <option value="praise">칭찬 및 정확성 의견</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="친구의 벡터 분석을 보고 추가 탐구 아이디어나 현실 공간과 벡터의 관계에 대한 의견을 적어주세요."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                    <button
                      type="submit"
                      disabled={commentSubmitting}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{commentSubmitting ? '등록 중...' : '피드백 댓글 남기기'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
