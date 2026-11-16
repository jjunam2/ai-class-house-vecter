import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Lock,
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
  ReflectionAndEthics,
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
  reflection: ReflectionAndEthics;
  exhibitions: ExhibitionProject[];
  dbNotice: string | null;
  onChangeIdentity: (next: { studentName: string; classRoom: string; houseTitle: string }) => void;
  onSubmitResponse: (payload: {
    studentAlias: string;
    classGroup: string;
    siteLotId: string;
    houseTitle: string;
    houseConcept: string;
    houseConfig: HouseDesignConfig;
    inquiryQuestion: string;
    verifiedLineSummary: ExhibitionProject['verifiedLineSummary'];
    verifiedPlaneSummary: ExhibitionProject['verifiedPlaneSummary'];
    verifiedRelationSummary: ExhibitionProject['verifiedRelationSummary'];
    reflectionNote: string;
    selfEval: {
      selfEval1: ReflectionAndEthics['selfEval1'];
      selfEval2: ReflectionAndEthics['selfEval2'];
      selfEval3: ReflectionAndEthics['selfEval3'];
    };
    isPublic: boolean;
  }) => Promise<{ id: string; isPublic: boolean; project?: ExhibitionProject }>;
  onAddComment: (
    projectId: string,
    comment: Omit<PeerFeedback, 'id' | 'createdAt'>
  ) => Promise<void>;
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
  reflection,
  exhibitions,
  dbNotice,
  onChangeIdentity,
  onSubmitResponse,
  onAddComment,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'exemplar'>('all');
  const [selectedProject, setSelectedProject] = useState<ExhibitionProject | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState<string | null>(null);
  const [isPublicShare, setIsPublicShare] = useState(false);
  const [copiedNotion, setCopiedNotion] = useState(false);
  const [showPublishForm, setShowPublishForm] = useState(true);

  // Comment composer state
  const [commentAuthor, setCommentAuthor] = useState(studentName || '');
  const [commentType, setCommentType] = useState<PeerFeedback['feedbackType']>('vector-relation');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

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
      `- 가상 별칭: ${classRoom} ${studentName || '별칭 미입력'}`,
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
      `## 4. 검증 및 성찰`,
      `${reflection.reflectionAnswer || '성찰·윤리 탭에서 성찰 기록 작성 가능'}`,
    ].join('\n');
  };

  const handleCopyNotion = async () => {
    try {
      await navigator.clipboard.writeText(buildNotionMarkdown());
      setCopiedNotion(true);
      setTimeout(() => setCopiedNotion(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishSuccessMsg(null);
    setPublishErrorMsg(null);

    if (!studentName.trim() || !houseTitle.trim()) {
      setPublishErrorMsg('가상 별칭과 작품 제목을 모두 입력해 주세요.');
      return;
    }

    setPublishing(true);
    try {
      const result = await onSubmitResponse({
        studentAlias: studentName.trim(),
        classGroup: classRoom.trim() || '1모둠',
        siteLotId: observation.selectedLotId,
        houseTitle: houseTitle.trim(),
        houseConcept: observation.houseConcept || '국화리 저수지 일대 3D 공간 벡터 주택',
        houseConfig,
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
        reflectionNote:
          reflection.reflectionAnswer ||
          '3차원 좌표와 벡터 방정식으로 집의 구조를 검증하고 반영했습니다.',
        selfEval: {
          selfEval1: reflection.selfEval1,
          selfEval2: reflection.selfEval2,
          selfEval3: reflection.selfEval3,
        },
        isPublic: isPublicShare,
      });

      setPublishSuccessMsg(
        result.isPublic
          ? '응답이 저장되었고, 온라인 전시관에 공개 등록되었습니다.'
          : '비공개 학생 응답이 교사 확인용으로 안전하게 저장되었습니다. (다른 학생에게는 보이지 않습니다.)'
      );
      if (result.isPublic && result.project) {
        setSelectedProject(result.project);
      }
    } catch (err) {
      setPublishErrorMsg(
        err instanceof Error
          ? err.message
          : '서버에 응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setCommentError(null);
    if (!commentAuthor.trim() || !commentText.trim()) {
      setCommentError('가상 별칭과 피드백 내용을 모두 입력해 주세요.');
      return;
    }
    setCommentSubmitting(true);
    try {
      await onAddComment(selectedProject.id, {
        authorName: commentAuthor.trim(),
        feedbackType: commentType,
        content: commentText.trim(),
      });
      setCommentText('');
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : '댓글 저장에 실패했습니다.'
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

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
            4·5단계 (6~8차시) · 읽걷쓰[쓰기] · 응답 저장 및 온라인 3D 전시
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            학생 응답 저장 · 온라인 전시관 및 상호 피드백
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            가상 별칭으로 내 집 설계와 벡터 분석 응답을 교사에게 제출하고, 공개를 선택한 작품은 학급 전시관에서 함께 감상합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyNotion}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {copiedNotion ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>{copiedNotion ? '노션 마크다운 복사됨' : '노션 정리용 마크다운 복사'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPublishForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>{showPublishForm ? '제출 서식 접기' : '내 응답 제출하기'}</span>
          </button>
        </div>
      </div>

      {dbNotice && (
        <div className="mt-4 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{dbNotice}</span>
        </div>
      )}

      {publishSuccessMsg && (
        <div className="mt-4 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium">
          {publishSuccessMsg}
        </div>
      )}

      {publishErrorMsg && (
        <div className="mt-4 bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{publishErrorMsg}</span>
        </div>
      )}

      {/* Student Response Submission Form */}
      {showPublishForm && (
        <form
          onSubmit={handlePublish}
          className="mt-5 bg-white border border-blue-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                학생 프로젝트 응답 저장 (교사 확인용)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                실명·학번·연락처 등 개인정보 대신 수업용 가상 별칭을 입력해 주세요. 비공개 응답은 교사 화면에서만 조회됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPublishForm(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="제출 창 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">
                가상 별칭 (1~30자, 실명 입력 금지)
              </span>
              <input
                type="text"
                required
                maxLength={30}
                placeholder="예: 수변건축가07"
                value={studentName}
                onChange={(e) =>
                  onChangeIdentity({ studentName: e.target.value, classRoom, houseTitle })
                }
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">모둠 / 반 별칭</span>
              <input
                type="text"
                maxLength={30}
                placeholder="예: 2학년 A모둠"
                value={classRoom}
                onChange={(e) =>
                  onChangeIdentity({ studentName, classRoom: e.target.value, houseTitle })
                }
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">작품 제목 (1~80자)</span>
              <input
                type="text"
                required
                maxLength={80}
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
              <span className="font-semibold text-slate-900">자동 첨부 직선 분석: </span>
              {activeLine.valid ? <MathFormula latex={activeLine.equationLatex} /> : '미입력'}
            </div>
            <div>
              <span className="font-semibold text-slate-900">자동 첨부 평면 분석: </span>
              {activePlane.valid ? <MathFormula latex={activePlane.equationLatex} /> : '미입력'}
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublicShare}
              onChange={(e) => setIsPublicShare(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-700 rounded"
            />
            <span className="text-xs text-slate-800 leading-relaxed">
              <strong>온라인 전시관에 함께 공개하기</strong> (체크하지 않으면 교사 확인 화면에만 비공개로 저장되며, 다른 학생에게는 절대 보이지 않습니다.)
            </span>
          </label>

          <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>기본 저장 상태: {isPublicShare ? '공개 전시 + 교사 확인' : '비공개 (교사만 열람)'}</span>
            </span>
            <button
              type="submit"
              disabled={publishing}
              className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {publishing ? '데이터베이스 저장 중...' : '응답 저장하기'}
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
            공개 전시 작품 ({exhibitions.length})
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
          공개 설정된 작품과 수업 우수 사례만 전시됩니다. 비공개 학생 응답은 교사 확인 메뉴에서만 조회됩니다.
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
                {proj.isExemplar ? ' · 수업 예시 사례' : ' · 공개 출품작'}
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{proj.title}</h3>
              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                {proj.concept}
              </p>

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

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
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

                  {!currentModalProject.isExemplar ? (
                    <form
                      onSubmit={handleSubmitComment}
                      className="pt-3 border-t border-slate-200 space-y-2.5"
                    >
                      <div className="text-xs font-semibold text-slate-800">
                        피드백 댓글 양식 작성하기
                      </div>
                      {commentError && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                          {commentError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          maxLength={30}
                          placeholder="내 가상 별칭"
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
                        maxLength={500}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="친구의 벡터 분석을 보고 추가 탐구 아이디어나 현실 공간과 벡터의 관계에 대한 의견을 적어주세요."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                      />
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{commentSubmitting ? '저장 중...' : '피드백 댓글 남기기'}</span>
                      </button>
                    </form>
                  ) : (
                    <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                      이 작품은 전자칠판 시연용 기본 우수 사례입니다. 학생이 공개 출품한 작품에 댓글을 저장할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
