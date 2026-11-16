import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { SEED_EXHIBITIONS } from './src/data/seedExhibitions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const EXHIBITIONS_FILE = path.join(DATA_DIR, 'exhibitions.json');
const ETHICS_FILE = path.join(DATA_DIR, 'ethics.json');

const SEED_ETHICS = [
  {
    id: 'eth-seed-1',
    authorName: '김서연 (예시)',
    stance: 'human',
    argument:
      'AI는 계산을 돕는 도구일 뿐이므로, 최종 건축 설계와 수학적 검증 결과를 확인하고 책임지는 주체는 사람이어야 한다고 생각합니다.',
    createdAt: '2026-11-14T10:00:00Z',
  },
  {
    id: 'eth-seed-2',
    authorName: '이도현 (예시)',
    stance: 'shared',
    argument:
      '설계자가 교사 검증 웹앱 등으로 교차 검증해야 할 책임도 있지만, AI 개발사 역시 잘못된 수식 추론을 줄이고 출처와 한계를 알릴 책임이 함께 있습니다.',
    createdAt: '2026-11-14T11:20:00Z',
  },
];

async function ensureDataFile<T>(filePath: string, seedData: T): Promise<T> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    await fs.writeFile(filePath, JSON.stringify(seedData, null, 2), 'utf-8');
    return seedData;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Initialize Gemini SDK on server side only
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // 1. [A] AI Vector Verification Endpoint
  app.post('/api/ai/verify-vector', async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({
          error:
            'GEMINI_API_KEY가 설정되지 않아 AI 점검을 실행할 수 없습니다. 교사 정밀 검증기 버튼을 이용해 정답을 확인하세요.',
        });
      }

      const payload = req.body;
      const systemPrompt =
        '당신은 대한민국 고등학교 2학년 기하(성취기준 12기하03-04, 12기하03-05) 수업의 친절한 AI 수학 튜터입니다. ' +
        '학생이 직접 설계한 집의 3차원 좌표를 바탕으로 직선·평면의 벡터 방정식과 각도를 손으로 계산한 풀이를 점검하세요. ' +
        '한국어로 명확하고 친절하게 설명하되, 방향벡터와 법선벡터의 상수배 동치(예: k배한 벡터나 부호가 반대인 식도 같은 직선/평면)를 반드시 인정하세요. ' +
        '수식은 텍스트로 읽기 쉽게 작성하고, 마지막에는 AI 계산에도 오차가 있을 수 있으니 교사 검증 웹앱으로 최종 확인하라는 안내를 포함하세요.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `다음 학생의 3차원 공간 좌표 및 풀이 입력을 점검해 주세요:\n${JSON.stringify(payload, null, 2)}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: '학생 풀이에 대한 2~3문장 핵심 점검 요약',
              },
              isConsistentWithStudent: {
                type: Type.BOOLEAN,
                description: '학생의 계산이 수학적으로 올바르고 일관되는지 여부',
              },
              aiCalculatedEquation: {
                type: Type.STRING,
                description: 'AI가 산출한 직선 또는 평면의 방정식 요약 문자열',
              },
              aiCalculatedAngleOrValue: {
                type: Type.STRING,
                description: 'AI가 산출한 길이, 경사각 또는 거리 값',
              },
              stepByStepAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '단계별 풀이 조언',
              },
              mistakeSpots: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '실수가 있거나 주의가 필요한 부분 목록 (완벽하면 빈 배열)',
              },
            },
            required: [
              'summary',
              'isConsistentWithStudent',
              'aiCalculatedEquation',
              'aiCalculatedAngleOrValue',
              'stepByStepAdvice',
              'mistakeSpots',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        ...parsed,
        citationNote: 'Gemini 4 Hydrogen 기반 AI 수학 풀이 점검',
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Gemini verify-vector error:', error);
      return res.status(500).json({
        error:
          'AI 점검 호출 중 일시적인 오류가 발생했습니다. 아래 교사 제작 정밀 검증기로 정답을 확인해 주세요.',
      });
    }
  });

  // 2. Exhibition Projects API
  app.get('/api/exhibitions', async (_req, res) => {
    try {
      const data = await ensureDataFile(EXHIBITIONS_FILE, SEED_EXHIBITIONS);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '전시 데이터를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/exhibitions', async (req, res) => {
    try {
      const current = await ensureDataFile(EXHIBITIONS_FILE, SEED_EXHIBITIONS);
      const item = req.body;
      const next = [item, ...current];
      await fs.writeFile(EXHIBITIONS_FILE, JSON.stringify(next, null, 2), 'utf-8');
      res.json(next);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '전시 등록에 실패했습니다.' });
    }
  });

  app.post('/api/exhibitions/:id/comments', async (req, res) => {
    try {
      const current = await ensureDataFile(EXHIBITIONS_FILE, SEED_EXHIBITIONS);
      const targetId = req.params.id;
      const { authorName, feedbackType, content } = req.body;
      const comment = {
        id: `c-${Date.now()}`,
        authorName,
        feedbackType,
        content,
        createdAt: new Date().toISOString(),
      };
      const next = current.map((p) =>
        p.id === targetId ? { ...p, comments: [...(p.comments ?? []), comment] } : p
      );
      await fs.writeFile(EXHIBITIONS_FILE, JSON.stringify(next, null, 2), 'utf-8');
      res.json(next);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '댓글 저장에 실패했습니다.' });
    }
  });

  // 3. AI Ethics Class Discussion Board API
  app.get('/api/ethics-notes', async (_req, res) => {
    try {
      const data = await ensureDataFile(ETHICS_FILE, SEED_ETHICS);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '윤리 토론 데이터를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/ethics-notes', async (req, res) => {
    try {
      const current = await ensureDataFile(ETHICS_FILE, SEED_ETHICS);
      const { authorName, stance, argument } = req.body;
      const next = [
        {
          id: `eth-${Date.now()}`,
          authorName,
          stance,
          argument,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];
      await fs.writeFile(ETHICS_FILE, JSON.stringify(next, null, 2), 'utf-8');
      res.json(next);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '윤리 의견 저장에 실패했습니다.' });
    }
  });

  // Mount Vite middleware in dev, or static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
