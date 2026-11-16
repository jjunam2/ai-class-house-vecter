export type StageId = 'observation' | 'design' | 'verification' | 'exhibition' | 'reflection';

export type HouseArchetype = 'gable' | 'shed' | 'aframe' | 'custom';
export type OriginMode = 'corner' | 'center' | 'custom';
export type SiteLotId = 'lotA' | 'lotB' | 'lotC';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HousePoint {
  id: string;
  label: string;
  name: string;
  category: 'base' | 'eave' | 'ridge' | 'pillar';
  x: number;
  y: number;
  z: number;
}

export interface HouseDesignConfig {
  archetype: HouseArchetype;
  width: number;       // X (m)
  depth: number;       // Y (m)
  wallHeight: number;  // Z wall height (m)
  roofHeight: number;  // Z additional ridge height (m)
  roofOffset: number;  // X shift of ridge (m)
  pillarTilt: number;  // X slant of porch pillar (m)
  originMode: OriginMode;
  customOrigin: Vec3;
  siteLotId: SiteLotId;
}

export interface SiteLotInfo {
  id: SiteLotId;
  name: string;
  subtitle: string;
  elevation: number;
  slopeDeg: number;
  orientation: string;
  sunlightScore: string;
  reservoirView: string;
  pros: string;
  considerations: string;
  worldPos: { x: number; z: number; y: number };
}

export interface SiteObservationData {
  selectedLotId: SiteLotId;
  sunTimeHour: number;
  orientationNote: string;
  terrainNote: string;
  environmentNote: string;
  houseConcept: string;
}

export interface LineStudentInput {
  pointAId: string;
  pointBId: string;
  dirX: string;
  dirY: string;
  dirZ: string;
  baseX: string;
  baseY: string;
  baseZ: string;
  lengthInput: string;
  angleGroundInput: string;
  reasoning: string;
}

export interface PlaneStudentInput {
  pointPId: string;
  pointQId: string;
  pointRId: string;
  pqX: string;
  pqY: string;
  pqZ: string;
  prX: string;
  prY: string;
  prZ: string;
  normalX: string;
  normalY: string;
  normalZ: string;
  eqA: string;
  eqB: string;
  eqC: string;
  eqD: string;
  angleGroundInput: string;
  reasoning: string;
}

export interface RelationStudentInput {
  mode: 'line-plane-angle' | 'two-planes-dihedral' | 'point-plane-distance';
  targetPointId: string;
  answerValue: string;
  reasoning: string;
}

export interface ExactLineResult {
  valid: boolean;
  error?: string;
  pointA: HousePoint;
  pointB: HousePoint;
  exactDir: Vec3;
  simplifiedDir: Vec3;
  exactLength: number;
  exactAngleGroundDeg: number;
  equationLatex: string;
  parametricLatex: string;
  derivationLatex: string[];
  checks: {
    directionMatch: boolean;
    basePointOnLine: boolean;
    lengthMatch: boolean;
    angleMatch: boolean;
    allCorrect: boolean;
  };
}

export interface ExactPlaneResult {
  valid: boolean;
  error?: string;
  pointP: HousePoint;
  pointQ: HousePoint;
  pointR: HousePoint;
  exactPQ: Vec3;
  exactPR: Vec3;
  exactNormal: Vec3;
  simplifiedNormal: Vec3;
  exactD: number;
  exactAngleGroundDeg: number;
  equationLatex: string;
  derivationLatex: string[];
  checks: {
    pqMatch: boolean;
    prMatch: boolean;
    normalMatch: boolean;
    equationMatch: boolean;
    angleMatch: boolean;
    allCorrect: boolean;
  };
}

export interface ExactRelationResult {
  valid: boolean;
  error?: string;
  mode: RelationStudentInput['mode'];
  exactValue: number;
  unit: string;
  formulaLatex: string;
  derivationLatex: string[];
  valueMatch: boolean;
}

export interface AICheckFeedback {
  summary: string;
  isConsistentWithStudent: boolean;
  aiCalculatedEquation: string;
  aiCalculatedAngleOrValue: string;
  stepByStepAdvice: string[];
  mistakeSpots: string[];
  citationNote: string;
  checkedAt: string;
}

export interface VerificationState {
  lineInput: LineStudentInput;
  lineAiFeedback: AICheckFeedback | null;
  lineExactResult: ExactLineResult | null;
  reflectLineTo3D: boolean;

  planeInput: PlaneStudentInput;
  planeAiFeedback: AICheckFeedback | null;
  planeExactResult: ExactPlaneResult | null;
  reflectPlaneTo3D: boolean;

  relationInput: RelationStudentInput;
  relationAiFeedback: AICheckFeedback | null;
  relationExactResult: ExactRelationResult | null;
  reflectRelationTo3D: boolean;
}

export interface PeerFeedback {
  id: string;
  authorName: string;
  feedbackType: 'explore' | 'vector-relation' | 'praise';
  content: string;
  createdAt: string;
}

export type SelfEvalLevel = '잘함' | '보통' | '노력' | '';

export interface ReflectionAndEthics {
  selfEval1: SelfEvalLevel;
  selfEval2: SelfEvalLevel;
  selfEval3: SelfEvalLevel;
  reflectionAnswer: string;
  ethicsStance: 'human' | 'ai' | 'shared' | '';
  ethicsArgument: string;
  safetyAgeAgreed: boolean;
  safetyCitationAgreed: boolean;
  safetyPrivacyAgreed: boolean;
}

export interface ExhibitionProject {
  id: string;
  studentName: string;
  classRoom: string;
  title: string;
  concept: string;
  houseConfig: HouseDesignConfig;
  observation: SiteObservationData;
  inquiryQuestion: string;
  verifiedLineSummary: {
    label: string;
    equationLatex: string;
    angleGroundDeg: number;
    pointA: Vec3;
    pointB: Vec3;
  } | null;
  verifiedPlaneSummary: {
    label: string;
    equationLatex: string;
    normal: Vec3;
    angleGroundDeg: number;
    points: [Vec3, Vec3, Vec3];
  } | null;
  verifiedRelationSummary: {
    label: string;
    resultText: string;
  } | null;
  reflectionNote: string;
  aiCitationNote: string;
  isExemplar?: boolean;
  comments: PeerFeedback[];
  createdAt: string;
}
