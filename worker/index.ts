interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success: boolean; meta?: Record<string, unknown>; results?: T[] }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface Env {
  DB?: D1Database;
  ASSETS: Fetcher;
  TEACHER_PASSWORD?: string;
}

interface StudentResponseRow {
  id: string;
  student_alias: string;
  class_group: string;
  site_lot_id: string;
  house_title: string;
  house_concept: string;
  house_config_json: string;
  inquiry_question: string;
  line_summary_json: string;
  plane_summary_json: string;
  relation_summary_json: string;
  reflection_note: string;
  self_eval_json: string;
  is_public: number;
  created_at: string;
}

interface CommentRow {
  id: string;
  response_id: string;
  author_alias: string;
  feedback_type: string;
  content: string;
  created_at: string;
}

interface EthicsRow {
  id: string;
  author_alias: string;
  stance: string;
  argument: string;
  created_at: string;
}

const COOKIE_NAME = 'classroom_teacher_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const buf = new ArrayBuffer(bin.length);
    const out = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ba = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) {
    diff |= ba[i] ^ bb[i];
  }
  return diff === 0;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(`classroom-teacher-auth:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function createTeacherToken(secret: string): Promise<string> {
  const payload = JSON.stringify({ role: 'teacher', exp: Date.now() + SESSION_TTL_MS });
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadB64 = toBase64Url(payloadBytes);
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

async function verifyTeacherSession(request: Request, env: Env): Promise<boolean> {
  if (!env.TEACHER_PASSWORD) return false;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const sigBytes = fromBase64Url(sigB64);
  const payloadBytes = fromBase64Url(payloadB64);
  if (!sigBytes || !payloadBytes) return false;

  const key = await getSigningKey(env.TEACHER_PASSWORD);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
  if (!ok) return false;

  const decoded = safeJsonParse<{ role?: string; exp?: number }>(
    new TextDecoder().decode(payloadBytes),
    {}
  );
  return decoded.role === 'teacher' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
}

function buildSessionCookie(token: string, isHttps: boolean, maxAgeSeconds: number): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function mapRowToProject(row: StudentResponseRow, comments: CommentRow[]) {
  return {
    id: row.id,
    studentName: row.student_alias,
    classRoom: row.class_group,
    title: row.house_title,
    concept: row.house_concept,
    houseConfig: safeJsonParse(row.house_config_json, {}),
    observation: {
      selectedLotId: row.site_lot_id || 'lotA',
      sunTimeHour: 13,
      orientationNote: '',
      terrainNote: '',
      environmentNote: '',
      houseConcept: row.house_concept,
    },
    inquiryQuestion: row.inquiry_question,
    verifiedLineSummary: safeJsonParse(row.line_summary_json, null),
    verifiedPlaneSummary: safeJsonParse(row.plane_summary_json, null),
    verifiedRelationSummary: safeJsonParse(row.relation_summary_json, null),
    reflectionNote: row.reflection_note,
    selfEval: safeJsonParse(row.self_eval_json, null),
    aiCitationNote: '자체 수학 추론 점검 및 교사 정밀 검증 완료',
    isPublic: row.is_public === 1,
    comments: comments.map((c) => ({
      id: c.id,
      authorName: c.author_alias,
      feedbackType: c.feedback_type,
      content: c.content,
      createdAt: c.created_at,
    })),
    createdAt: row.created_at,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isHttps = url.protocol === 'https:';

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // Teacher Authentication Endpoints
    if (pathname === '/api/teacher/session' && request.method === 'GET') {
      const authenticated = await verifyTeacherSession(request, env);
      return jsonResponse({ authenticated, configured: Boolean(env.TEACHER_PASSWORD) });
    }

    if (pathname === '/api/teacher/login' && request.method === 'POST') {
      if (!env.TEACHER_PASSWORD) {
        return jsonResponse(
          { error: '서버에 교사 비밀번호(TEACHER_PASSWORD Secret)가 설정되지 않았습니다.' },
          503
        );
      }
      const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!password || password.length > 200) {
        return jsonResponse({ error: '비밀번호를 입력해 주세요.' }, 400);
      }

      const valid = await constantTimeEquals(password, env.TEACHER_PASSWORD);
      if (!valid) {
        return jsonResponse({ error: '교사 비밀번호가 올바르지 않습니다.' }, 401);
      }

      const token = await createTeacherToken(env.TEACHER_PASSWORD);
      return jsonResponse(
        { authenticated: true },
        200,
        { 'Set-Cookie': buildSessionCookie(token, isHttps, 28800) }
      );
    }

    if (pathname === '/api/teacher/logout' && request.method === 'POST') {
      return jsonResponse(
        { authenticated: false },
        200,
        { 'Set-Cookie': buildSessionCookie('', isHttps, 0) }
      );
    }

    // All data endpoints require D1 binding
    if (!env.DB) {
      return jsonResponse(
        { error: 'Cloudflare D1 데이터베이스(DB)가 아직 연결되지 않았습니다.' },
        503
      );
    }

    // Teacher Private + Public Responses Review Endpoint
    if (pathname === '/api/teacher/responses' && request.method === 'GET') {
      const authenticated = await verifyTeacherSession(request, env);
      if (!authenticated) {
        return jsonResponse({ error: '교사 인증이 필요합니다.' }, 401);
      }
      try {
        const res = await env.DB.prepare(
          'SELECT id, student_alias, class_group, site_lot_id, house_title, house_concept, house_config_json, inquiry_question, line_summary_json, plane_summary_json, relation_summary_json, reflection_note, self_eval_json, is_public, created_at FROM student_responses ORDER BY created_at DESC LIMIT 200'
        ).all<StudentResponseRow>();

        const items = (res.results ?? []).map((row) => mapRowToProject(row, []));
        return jsonResponse(items);
      } catch (err) {
        console.error('D1 teacher responses query failed:', err);
        return jsonResponse(
          { error: 'D1 데이터베이스에서 학생 응답을 조회하지 못했습니다. setup.sql 실행 여부를 확인하세요.' },
          500
        );
      }
    }

    // Student Response Submission (private by default unless isPublic is true)
    if (pathname === '/api/responses' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse({ error: '잘못된 요청 형식입니다.' }, 400);
      }

      const studentAlias = cleanStr(body.studentAlias, 30);
      const classGroup = cleanStr(body.classGroup, 30);
      const siteLotId = ['lotA', 'lotB', 'lotC'].includes(String(body.siteLotId))
        ? String(body.siteLotId)
        : 'lotA';
      const houseTitle = cleanStr(body.houseTitle, 80);
      const houseConcept = cleanStr(body.houseConcept, 500);
      const inquiryQuestion = cleanStr(body.inquiryQuestion, 600);
      const reflectionNote = cleanStr(body.reflectionNote, 2000);
      const isPublic = body.isPublic === true ? 1 : 0;

      if (studentAlias.length < 1 || studentAlias.length > 30) {
        return jsonResponse({ error: '가상 별칭은 1자 이상 30자 이하로 입력해 주세요.' }, 400);
      }
      if (houseTitle.length < 1 || houseTitle.length > 80) {
        return jsonResponse({ error: '작품 제목은 1자 이상 80자 이하로 입력해 주세요.' }, 400);
      }

      const houseConfigJson = JSON.stringify(body.houseConfig ?? {});
      const lineSummaryJson = body.verifiedLineSummary ? JSON.stringify(body.verifiedLineSummary) : '';
      const planeSummaryJson = body.verifiedPlaneSummary ? JSON.stringify(body.verifiedPlaneSummary) : '';
      const relationSummaryJson = body.verifiedRelationSummary ? JSON.stringify(body.verifiedRelationSummary) : '';
      const selfEvalJson = body.selfEval ? JSON.stringify(body.selfEval) : '';

      if (houseConfigJson.length > 4000 || lineSummaryJson.length > 4000 || planeSummaryJson.length > 4000) {
        return jsonResponse({ error: '제출 데이터 크기가 허용 범위를 초과했습니다.' }, 400);
      }

      const id = `resp-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();

      try {
        await env.DB.prepare(
          'INSERT INTO student_responses (id, student_alias, class_group, site_lot_id, house_title, house_concept, house_config_json, inquiry_question, line_summary_json, plane_summary_json, relation_summary_json, reflection_note, self_eval_json, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(
            id,
            studentAlias,
            classGroup,
            siteLotId,
            houseTitle,
            houseConcept,
            houseConfigJson,
            inquiryQuestion,
            lineSummaryJson,
            planeSummaryJson,
            relationSummaryJson,
            reflectionNote,
            selfEvalJson,
            isPublic,
            createdAt
          )
          .run();

        const createdProject = {
          id,
          studentName: studentAlias,
          classRoom: classGroup || '2학년',
          title: houseTitle,
          concept: houseConcept,
          houseConfig: body.houseConfig ?? {},
          observation: {
            selectedLotId: siteLotId,
            sunTimeHour: 13,
            orientationNote: '',
            terrainNote: '',
            environmentNote: '',
            houseConcept,
          },
          inquiryQuestion,
          verifiedLineSummary: body.verifiedLineSummary ?? null,
          verifiedPlaneSummary: body.verifiedPlaneSummary ?? null,
          verifiedRelationSummary: body.verifiedRelationSummary ?? null,
          reflectionNote,
          aiCitationNote: '자체 수학 추론 점검 및 교사 정밀 검증 완료',
          isPublic: isPublic === 1,
          comments: [],
          createdAt,
        };

        return jsonResponse({ ok: true, id, isPublic: isPublic === 1, project: createdProject }, 201);
      } catch (err) {
        console.error('D1 insert response error:', err);
        return jsonResponse(
          { error: '데이터베이스에 응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
          500
        );
      }
    }

    // Public Exhibition List (ONLY is_public = 1 rows — private responses never returned!)
    if (pathname === '/api/exhibitions' && request.method === 'GET') {
      try {
        const respRows = await env.DB.prepare(
          'SELECT id, student_alias, class_group, site_lot_id, house_title, house_concept, house_config_json, inquiry_question, line_summary_json, plane_summary_json, relation_summary_json, reflection_note, self_eval_json, is_public, created_at FROM student_responses WHERE is_public = 1 ORDER BY created_at DESC LIMIT 100'
        ).all<StudentResponseRow>();

        const commentRows = await env.DB.prepare(
          'SELECT c.id, c.response_id, c.author_alias, c.feedback_type, c.content, c.created_at FROM exhibition_comments c INNER JOIN student_responses r ON c.response_id = r.id WHERE r.is_public = 1 ORDER BY c.created_at ASC LIMIT 500'
        ).all<CommentRow>();

        const commentsByResponse = new Map<string, CommentRow[]>();
        for (const c of commentRows.results ?? []) {
          const list = commentsByResponse.get(c.response_id) ?? [];
          list.push(c);
          commentsByResponse.set(c.response_id, list);
        }

        const publicProjects = (respRows.results ?? []).map((row) =>
          mapRowToProject(row, commentsByResponse.get(row.id) ?? [])
        );

        return jsonResponse(publicProjects);
      } catch (err) {
        console.error('D1 public exhibitions query error:', err);
        return jsonResponse(
          { error: '공개 전시 목록을 데이터베이스에서 불러오지 못했습니다.' },
          500
        );
      }
    }

    // Add Peer Feedback Comment ONLY to public exhibition items
    const commentMatch = pathname.match(/^\/api\/exhibitions\/([^/]+)\/comments$/);
    if (commentMatch && request.method === 'POST') {
      const responseId = decodeURIComponent(commentMatch[1]);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) {
        return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
      }

      const authorAlias = cleanStr(body.authorName ?? body.authorAlias, 30);
      const feedbackType = ['explore', 'vector-relation', 'praise'].includes(
        String(body.feedbackType)
      )
        ? String(body.feedbackType)
        : 'vector-relation';
      const content = cleanStr(body.content, 500);

      if (authorAlias.length < 1) {
        return jsonResponse({ error: '가상 별칭을 입력해 주세요.' }, 400);
      }
      if (content.length < 2 || content.length > 500) {
        return jsonResponse({ error: '피드백 내용은 2자 이상 500자 이하로 입력해 주세요.' }, 400);
      }

      try {
        const target = await env.DB.prepare(
          'SELECT id, is_public FROM student_responses WHERE id = ?'
        )
          .bind(responseId)
          .first<{ id: string; is_public: number }>();

        if (!target || target.is_public !== 1) {
          return jsonResponse(
            { error: '공개 전시된 작품에만 피드백 댓글을 남길 수 있습니다.' },
            403
          );
        }

        const commentId = `c-${crypto.randomUUID()}`;
        const createdAt = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO exhibition_comments (id, response_id, author_alias, feedback_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
          .bind(commentId, responseId, authorAlias, feedbackType, content, createdAt)
          .run();

        return jsonResponse(
          {
            id: commentId,
            authorName: authorAlias,
            feedbackType,
            content,
            createdAt,
          },
          201
        );
      } catch (err) {
        console.error('D1 insert comment error:', err);
        return jsonResponse({ error: '피드백 댓글을 저장하지 못했습니다.' }, 500);
      }
    }

    // Public Ethics Discussion Board
    if (pathname === '/api/ethics-notes' && request.method === 'GET') {
      try {
        const res = await env.DB.prepare(
          'SELECT id, author_alias, stance, argument, created_at FROM ethics_notes ORDER BY created_at DESC LIMIT 100'
        ).all<EthicsRow>();
        const items = (res.results ?? []).map((r) => ({
          id: r.id,
          authorName: r.author_alias,
          stance: r.stance,
          argument: r.argument,
          createdAt: r.created_at,
        }));
        return jsonResponse(items);
      } catch (err) {
        console.error('D1 ethics query error:', err);
        return jsonResponse({ error: '윤리 토론 글을 불러오지 못했습니다.' }, 500);
      }
    }

    if (pathname === '/api/ethics-notes' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) {
        return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
      }
      const authorAlias = cleanStr(body.authorName ?? body.authorAlias, 30) || '익명 별칭';
      const stance = String(body.stance);
      const argument = cleanStr(body.argument, 600);

      if (!['human', 'ai', 'shared'].includes(stance)) {
        return jsonResponse({ error: '올바른 윤리 입장을 선택해 주세요.' }, 400);
      }
      if (argument.length < 2 || argument.length > 600) {
        return jsonResponse({ error: '의견은 2자 이상 600자 이하로 입력해 주세요.' }, 400);
      }

      const id = `eth-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();

      try {
        await env.DB.prepare(
          'INSERT INTO ethics_notes (id, author_alias, stance, argument, created_at) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(id, authorAlias, stance, argument, createdAt)
          .run();

        return jsonResponse(
          { id, authorName: authorAlias, stance, argument, createdAt },
          201
        );
      } catch (err) {
        console.error('D1 insert ethics error:', err);
        return jsonResponse({ error: '윤리 토론 의견을 저장하지 못했습니다.' }, 500);
      }
    }

    return jsonResponse({ error: '요청한 API 경로를 찾을 수 없습니다.' }, 404);
  },
};
