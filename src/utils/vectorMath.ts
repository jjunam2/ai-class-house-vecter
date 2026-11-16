import type {
  ExactLineResult,
  ExactPlaneResult,
  ExactRelationResult,
  HouseDesignConfig,
  HousePoint,
  LineStudentInput,
  PlaneStudentInput,
  RelationStudentInput,
  Vec3,
} from '../types/project';

const EPS = 1e-4;

export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

export function fmtNum(n: number): string {
  const r = round2(n);
  if (Math.abs(r - Math.round(r)) < 1e-6) return String(Math.round(r));
  return String(r);
}

/**
 * Parses integer, decimal, or simple fraction string like "3/2", "-4/5"
 */
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length !== 2) return null;
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-9) {
      return null;
    }
    return num / den;
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function isNearInt(v: number): boolean {
  return Math.abs(v - Math.round(v)) < 1e-5;
}

export function simplifyVec3(v: Vec3): Vec3 {
  if (isNearInt(v.x) && isNearInt(v.y) && isNearInt(v.z)) {
    const ix = Math.round(v.x);
    const iy = Math.round(v.y);
    const iz = Math.round(v.z);
    const g = gcdInt(gcdInt(ix, iy), iz);
    if (g > 1) {
      return { x: ix / g, y: iy / g, z: iz / g };
    }
  }
  return { x: round2(v.x), y: round2(v.y), z: round2(v.z) };
}

export function simplifyPlaneCoeffs(a: number, b: number, c: number, d: number): [number, number, number, number] {
  if (isNearInt(a) && isNearInt(b) && isNearInt(c) && isNearInt(d)) {
    const ia = Math.round(a);
    const ib = Math.round(b);
    const ic = Math.round(c);
    const id = Math.round(d);
    const g = gcdInt(gcdInt(gcdInt(ia, ib), ic), id);
    let sa = ia / g;
    let sb = ib / g;
    let sc = ic / g;
    let sd = id / g;
    // Prefer first non-zero coefficient to be positive
    const firstNonZero = [sa, sb, sc].find((val) => val !== 0) ?? 1;
    if (firstNonZero < 0) {
      sa = -sa;
      sb = -sb;
      sc = -sc;
      sd = -sd;
    }
    return [sa, sb, sc, sd];
  }
  return [round2(a), round2(b), round2(c), round2(d)];
}

export function subVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function dotVec(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lenVec(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Checks if two vectors are non-zero scalar multiples of each other
 */
export function areParallelNonZero(u: Vec3, v: Vec3): boolean {
  const lu = lenVec(u);
  const lv = lenVec(v);
  if (lu < EPS || lv < EPS) return false;
  const c = crossVec(u, v);
  return lenVec(c) / (lu * lv) < 0.015;
}

/**
 * Generates exact architectural points of the house in Korean Math / SketchUp coordinate convention:
 * X = width (East-West), Y = depth (South-North), Z = vertical height (ground z = 0)
 */
export function computeHousePoints(config: HouseDesignConfig): HousePoint[] {
  const W = config.width;
  const D = config.depth;
  const Hw = config.wallHeight;
  const Hr = config.roofHeight;
  const off = config.roofOffset;
  const tilt = config.pillarTilt;

  let shift: Vec3 = { x: 0, y: 0, z: 0 };
  if (config.originMode === 'center') {
    shift = { x: W / 2, y: D / 2, z: 0 };
  } else if (config.originMode === 'custom') {
    shift = { ...config.customOrigin };
  }

  const pt = (
    id: string,
    label: string,
    name: string,
    category: HousePoint['category'],
    x: number,
    y: number,
    z: number
  ): HousePoint => ({
    id,
    label,
    name,
    category,
    x: round2(x - shift.x),
    y: round2(y - shift.y),
    z: round2(z - shift.z),
  });

  const eaveH = config.archetype === 'aframe' ? 0.5 : Hw;
  const points: HousePoint[] = [
    pt('B1', 'B₁', '앞 왼쪽 바닥', 'base', 0, 0, 0),
    pt('B2', 'B₂', '앞 오른쪽 바닥', 'base', W, 0, 0),
    pt('B3', 'B₃', '뒤 오른쪽 바닥', 'base', W, D, 0),
    pt('B4', 'B₄', '뒤 왼쪽 바닥', 'base', 0, D, 0),
    pt('E1', 'E₁', '앞 왼쪽 처마', 'eave', 0, 0, eaveH),
    pt('E2', 'E₂', '앞 오른쪽 처마', 'eave', W, 0, eaveH),
    pt('E3', 'E₃', '뒤 오른쪽 처마', 'eave', W, D, eaveH),
    pt('E4', 'E₄', '뒤 왼쪽 처마', 'eave', 0, D, eaveH),
  ];

  if (config.archetype === 'shed') {
    // Single sloped roof rising toward the back (+Y)
    points.push(
      pt('R1', 'R₁', '뒤 왼쪽 상단 용마루', 'ridge', 0, D, Hw + Hr),
      pt('R2', 'R₂', '뒤 오른쪽 상단 용마루', 'ridge', W, D, Hw + Hr)
    );
  } else {
    // Gable, A-frame, or Custom pitched roof
    const ridgeX = W / 2 + off;
    points.push(
      pt('R1', 'R₁', '앞 용마루 꼭짓점', 'ridge', ridgeX, 0, Hw + Hr),
      pt('R2', 'R₂', '뒤 용마루 꼭짓점', 'ridge', ridgeX, D, Hw + Hr)
    );
  }

  // Front porch slanted structural pillars (S1->S2 on left, S3->S4 on right)
  points.push(
    pt('S1', 'S₁', '앞 사선기둥 하단(좌)', 'pillar', 0, -2, 0),
    pt('S2', 'S₂', '앞 사선기둥 상단(좌)', 'pillar', tilt, 0, eaveH),
    pt('S3', 'S₃', '앞 사선기둥 하단(우)', 'pillar', W, -2, 0),
    pt('S4', 'S₄', '앞 사선기둥 상단(우)', 'pillar', W - tilt, 0, eaveH)
  );

  return points;
}

function formatLinearTerm(varName: string, val: number): string {
  const r = round2(val);
  if (Math.abs(r) < 1e-6) return varName;
  if (r > 0) return `${varName} - ${fmtNum(r)}`;
  return `${varName} + ${fmtNum(Math.abs(r))}`;
}

export function buildLineEquationLatex(p: Vec3, dir: Vec3): string {
  const s = simplifyVec3(dir);
  const comps: Array<{ name: string; p: number; d: number }> = [
    { name: 'x', p: p.x, d: s.x },
    { name: 'y', p: p.y, d: s.y },
    { name: 'z', p: p.z, d: s.z },
  ];
  const nonZero = comps.filter((c) => Math.abs(c.d) >= EPS);
  const zero = comps.filter((c) => Math.abs(c.d) < EPS);

  const fracParts = nonZero.map((c) =>
    nonZero.length === 1
      ? `${c.name} \\in \\mathbb{R}`
      : `\\frac{${formatLinearTerm(c.name, c.p)}}{${fmtNum(c.d)}}`
  );
  const eqParts = zero.map((c) => `${c.name} = ${fmtNum(c.p)}`);

  if (nonZero.length === 3) {
    return fracParts.join(' = ');
  }
  if (nonZero.length === 2) {
    return `${fracParts.join(' = ')}, \\quad ${eqParts.join(', ')}`;
  }
  if (nonZero.length === 1) {
    return `${eqParts.join(', \\; ')} \\quad (${nonZero[0].name}\\text{은 임의의 실수})`;
  }
  return '\\text{두 점이 일치합니다}';
}

export function buildParametricLatex(p: Vec3, dir: Vec3): string {
  const s = simplifyVec3(dir);
  const term = (base: number, slope: number) => {
    const b = fmtNum(base);
    if (Math.abs(slope) < EPS) return b;
    const sl = Math.abs(slope) === 1 ? (slope > 0 ? '' : '-') : fmtNum(slope);
    if (Math.abs(base) < EPS) return `${sl}t`;
    return slope > 0 ? `${b} + ${sl}t` : `${b} - ${Math.abs(slope) === 1 ? '' : fmtNum(Math.abs(slope))}t`;
  };
  return `x = ${term(p.x, s.x)}, \\; y = ${term(p.y, s.y)}, \\; z = ${term(p.z, s.z)} \\; (t \\in \\mathbb{R})`;
}

export function buildPlaneEquationLatex(a: number, b: number, c: number, d: number): string {
  const [sa, sb, sc, sd] = simplifyPlaneCoeffs(a, b, c, d);
  const terms: string[] = [];
  const pushTerm = (coeff: number, varName: string) => {
    if (Math.abs(coeff) < EPS) return;
    const absVal = Math.abs(coeff);
    const coeffStr = varName && Math.abs(absVal - 1) < EPS ? '' : fmtNum(absVal);
    if (terms.length === 0) {
      terms.push(`${coeff < 0 ? '-' : ''}${coeffStr}${varName}`);
    } else {
      terms.push(`${coeff < 0 ? ' - ' : ' + '}${coeffStr}${varName}`);
    }
  };
  pushTerm(sa, 'x');
  pushTerm(sb, 'y');
  pushTerm(sc, 'z');
  pushTerm(sd, '');
  if (terms.length === 0) return '0 = 0';
  return `${terms.join('')} = 0`;
}

export function verifyLineEquation(
  points: HousePoint[],
  input: LineStudentInput
): ExactLineResult {
  const pointA = points.find((p) => p.id === input.pointAId) ?? points[0];
  const pointB = points.find((p) => p.id === input.pointBId) ?? points[1];

  const dir = subVec(pointB, pointA);
  const length = lenVec(dir);

  if (length < EPS) {
    return {
      valid: false,
      error: '서로 다른 두 지점을 선택해야 직선의 방정식을 구할 수 있습니다.',
      pointA,
      pointB,
      exactDir: dir,
      simplifiedDir: dir,
      exactLength: 0,
      exactAngleGroundDeg: 0,
      equationLatex: '',
      parametricLatex: '',
      derivationLatex: [],
      checks: {
        directionMatch: false,
        basePointOnLine: false,
        lengthMatch: false,
        angleMatch: false,
        allCorrect: false,
      },
    };
  }

  const sDir = simplifyVec3(dir);
  const sinGround = Math.min(1, Math.abs(dir.z) / length);
  const exactAngleGroundDeg = round2((Math.asin(sinGround) * 180) / Math.PI);
  const exactLength = round2(length);

  // Evaluate student input
  const uX = parseNumberInput(input.dirX);
  const uY = parseNumberInput(input.dirY);
  const uZ = parseNumberInput(input.dirZ);
  const bX = parseNumberInput(input.baseX);
  const bY = parseNumberInput(input.baseY);
  const bZ = parseNumberInput(input.baseZ);
  const lenIn = parseNumberInput(input.lengthInput);
  const angIn = parseNumberInput(input.angleGroundInput);

  let directionMatch = false;
  if (uX !== null && uY !== null && uZ !== null) {
    directionMatch = areParallelNonZero({ x: uX, y: uY, z: uZ }, dir);
  }

  // Base point is valid if it lies on the infinite line through A and B: (P - A) x dir == 0
  let basePointOnLine = false;
  if (bX !== null && bY !== null && bZ !== null) {
    const diff = subVec({ x: bX, y: bY, z: bZ }, pointA);
    const cross = crossVec(diff, dir);
    basePointOnLine = lenVec(cross) / length < 0.05;
  }

  const lengthMatch = lenIn !== null && Math.abs(lenIn - exactLength) <= 0.15;
  const angleMatch = angIn !== null && Math.abs(angIn - exactAngleGroundDeg) <= 1.0;

  const equationLatex = buildLineEquationLatex(pointA, sDir);
  const parametricLatex = buildParametricLatex(pointA, sDir);

  const derivationLatex = [
    `\\text{1) 두 점 } ${pointA.label}(${fmtNum(pointA.x)}, ${fmtNum(pointA.y)}, ${fmtNum(pointA.z)}), \\; ${pointB.label}(${fmtNum(pointB.x)}, ${fmtNum(pointB.y)}, ${fmtNum(pointB.z)})`,
    `\\text{2) 방향벡터 } \\vec{u} = \\overrightarrow{${pointA.label}${pointB.label}} = (${fmtNum(dir.x)}, ${fmtNum(dir.y)}, ${fmtNum(dir.z)}) ${
      sDir.x !== dir.x || sDir.y !== dir.y || sDir.z !== dir.z
        ? `\\parallel (${fmtNum(sDir.x)}, ${fmtNum(sDir.y)}, ${fmtNum(sDir.z)})`
        : ''
    }`,
    `\\text{3) 직선의 방정식: } ${equationLatex}`,
    `\\text{4) 선분 길이: } |\\vec{u}| = \\sqrt{(${fmtNum(dir.x)})^2 + (${fmtNum(dir.y)})^2 + (${fmtNum(dir.z)})^2} \\approx ${fmtNum(exactLength)}\\text{m}`,
    `\\text{5) 지면}(z=0\\text{, 법선 } \\vec{n}=(0,0,1))\\text{과 이루는 각: } \\sin\\theta = \\frac{|\\vec{u}\\cdot\\vec{n}|}{|\\vec{u}||\\vec{n}|} = \\frac{${fmtNum(Math.abs(dir.z))}}{${fmtNum(exactLength)}} \\implies \\theta \\approx ${fmtNum(exactAngleGroundDeg)}^\\circ`,
  ];

  return {
    valid: true,
    pointA,
    pointB,
    exactDir: dir,
    simplifiedDir: sDir,
    exactLength,
    exactAngleGroundDeg,
    equationLatex,
    parametricLatex,
    derivationLatex,
    checks: {
      directionMatch,
      basePointOnLine,
      lengthMatch,
      angleMatch,
      allCorrect: directionMatch && basePointOnLine && lengthMatch && angleMatch,
    },
  };
}

export function verifyPlaneEquation(
  points: HousePoint[],
  input: PlaneStudentInput
): ExactPlaneResult {
  const pointP = points.find((p) => p.id === input.pointPId) ?? points[4];
  const pointQ = points.find((p) => p.id === input.pointQId) ?? points[8];
  const pointR = points.find((p) => p.id === input.pointRId) ?? points[7];

  const pq = subVec(pointQ, pointP);
  const pr = subVec(pointR, pointP);
  const normal = crossVec(pq, pr);
  const normalLen = lenVec(normal);

  if (normalLen < EPS) {
    return {
      valid: false,
      error: '선택한 세 점이 한 직선 위에 있습니다. 일직선 위에 있지 않은 세 점을 선택하세요.',
      pointP,
      pointQ,
      pointR,
      exactPQ: pq,
      exactPR: pr,
      exactNormal: normal,
      simplifiedNormal: normal,
      exactD: 0,
      exactAngleGroundDeg: 0,
      equationLatex: '',
      derivationLatex: [],
      checks: {
        pqMatch: false,
        prMatch: false,
        normalMatch: false,
        equationMatch: false,
        angleMatch: false,
        allCorrect: false,
      },
    };
  }

  const rawD = -(normal.x * pointP.x + normal.y * pointP.y + normal.z * pointP.z);
  const [sa, sb, sc, sd] = simplifyPlaneCoeffs(normal.x, normal.y, normal.z, rawD);
  const sNormal = { x: sa, y: sb, z: sc };
  const cosGround = Math.min(1, Math.abs(normal.z) / normalLen);
  const exactAngleGroundDeg = round2((Math.acos(cosGround) * 180) / Math.PI);

  // Evaluate student input
  const pqX = parseNumberInput(input.pqX);
  const pqY = parseNumberInput(input.pqY);
  const pqZ = parseNumberInput(input.pqZ);
  const prX = parseNumberInput(input.prX);
  const prY = parseNumberInput(input.prY);
  const prZ = parseNumberInput(input.prZ);
  const nX = parseNumberInput(input.normalX);
  const nY = parseNumberInput(input.normalY);
  const nZ = parseNumberInput(input.normalZ);
  const eqA = parseNumberInput(input.eqA);
  const eqB = parseNumberInput(input.eqB);
  const eqC = parseNumberInput(input.eqC);
  const eqD = parseNumberInput(input.eqD);
  const angIn = parseNumberInput(input.angleGroundInput);

  const pqMatch =
    pqX !== null &&
    pqY !== null &&
    pqZ !== null &&
    Math.abs(pqX - pq.x) < 0.05 &&
    Math.abs(pqY - pq.y) < 0.05 &&
    Math.abs(pqZ - pq.z) < 0.05;

  const prMatch =
    prX !== null &&
    prY !== null &&
    prZ !== null &&
    Math.abs(prX - pr.x) < 0.05 &&
    Math.abs(prY - pr.y) < 0.05 &&
    Math.abs(prZ - pr.z) < 0.05;

  const normalMatch =
    nX !== null &&
    nY !== null &&
    nZ !== null &&
    areParallelNonZero({ x: nX, y: nY, z: nZ }, normal);

  // Plane equation ax + by + cz + d = 0 matches if (a,b,c) || (sa,sb,sc) AND P, Q, R satisfy ax+by+cz+d=0
  let equationMatch = false;
  if (eqA !== null && eqB !== null && eqC !== null && eqD !== null) {
    const studentN = { x: eqA, y: eqB, z: eqC };
    if (areParallelNonZero(studentN, sNormal)) {
      const nScale = lenVec(studentN);
      const errP = Math.abs(eqA * pointP.x + eqB * pointP.y + eqC * pointP.z + eqD) / nScale;
      const errQ = Math.abs(eqA * pointQ.x + eqB * pointQ.y + eqC * pointQ.z + eqD) / nScale;
      const errR = Math.abs(eqA * pointR.x + eqB * pointR.y + eqC * pointR.z + eqD) / nScale;
      equationMatch = errP < 0.05 && errQ < 0.05 && errR < 0.05;
    }
  }

  const angleMatch = angIn !== null && Math.abs(angIn - exactAngleGroundDeg) <= 1.0;

  const equationLatex = buildPlaneEquationLatex(sa, sb, sc, sd);

  const derivationLatex = [
    `\\text{1) 세 점 } ${pointP.label}(${fmtNum(pointP.x)}, ${fmtNum(pointP.y)}, ${fmtNum(pointP.z)}), \\; ${pointQ.label}(${fmtNum(pointQ.x)}, ${fmtNum(pointQ.y)}, ${fmtNum(pointQ.z)}), \\; ${pointR.label}(${fmtNum(pointR.x)}, ${fmtNum(pointR.y)}, ${fmtNum(pointR.z)})`,
    `\\text{2) 평면 위의 두 벡터: } \\overrightarrow{${pointP.label}${pointQ.label}} = (${fmtNum(pq.x)}, ${fmtNum(pq.y)}, ${fmtNum(pq.z)}), \\; \\overrightarrow{${pointP.label}${pointR.label}} = (${fmtNum(pr.x)}, ${fmtNum(pr.y)}, ${fmtNum(pr.z)})`,
    `\\text{3) 법선벡터(외적): } \\vec{n} = \\overrightarrow{${pointP.label}${pointQ.label}} \\times \\overrightarrow{${pointP.label}${pointR.label}} = (${fmtNum(normal.x)}, ${fmtNum(normal.y)}, ${fmtNum(normal.z)}) \\parallel (${fmtNum(sa)}, ${fmtNum(sb)}, ${fmtNum(sc)})`,
    `\\text{4) 평면의 방정식: } ${fmtNum(sa)}(x - ${fmtNum(pointP.x)}) + ${fmtNum(sb)}(y - ${fmtNum(pointP.y)}) + ${fmtNum(sc)}(z - ${fmtNum(pointP.z)}) = 0 \\implies ${equationLatex}`,
    `\\text{5) 바닥면}(z=0)\\text{과의 경사각: } \\cos\\theta = \\frac{|\\vec{n}\\cdot(0,0,1)|}{|\\vec{n}|} \\implies \\theta \\approx ${fmtNum(exactAngleGroundDeg)}^\\circ`,
  ];

  return {
    valid: true,
    pointP,
    pointQ,
    pointR,
    exactPQ: pq,
    exactPR: pr,
    exactNormal: normal,
    simplifiedNormal: sNormal,
    exactD: sd,
    exactAngleGroundDeg,
    equationLatex,
    derivationLatex,
    checks: {
      pqMatch,
      prMatch,
      normalMatch,
      equationMatch,
      angleMatch,
      allCorrect: pqMatch && prMatch && normalMatch && equationMatch && angleMatch,
    },
  };
}

export function verifyRelationTask(
  points: HousePoint[],
  lineRes: ExactLineResult | null,
  planeRes: ExactPlaneResult | null,
  input: RelationStudentInput,
  config: HouseDesignConfig
): ExactRelationResult {
  if (!planeRes || !planeRes.valid) {
    return {
      valid: false,
      error: '먼저 과제 2(지붕면의 평면의 방정식)를 유효한 세 점으로 설정해 주세요.',
      mode: input.mode,
      exactValue: 0,
      unit: '°',
      formulaLatex: '',
      derivationLatex: [],
      valueMatch: false,
    };
  }

  const n1 = planeRes.simplifiedNormal;
  const studentVal = parseNumberInput(input.answerValue);

  if (input.mode === 'line-plane-angle') {
    if (!lineRes || !lineRes.valid) {
      return {
        valid: false,
        error: '먼저 과제 1(기둥/모서리 직선의 방정식)을 설정해 주세요.',
        mode: input.mode,
        exactValue: 0,
        unit: '°',
        formulaLatex: '',
        derivationLatex: [],
        valueMatch: false,
      };
    }
    const u = lineRes.simplifiedDir;
    const denom = lenVec(u) * lenVec(n1);
    const sinVal = Math.min(1, Math.abs(dotVec(u, n1)) / denom);
    const deg = round2((Math.asin(sinVal) * 180) / Math.PI);
    return {
      valid: true,
      mode: input.mode,
      exactValue: deg,
      unit: '°',
      formulaLatex: `\\sin\\theta = \\frac{|\\vec{u}\\cdot\\vec{n}|}{|\\vec{u}||\\vec{n}|} \\implies \\theta \\approx ${fmtNum(deg)}^\\circ`,
      derivationLatex: [
        `\\vec{u} = (${fmtNum(u.x)}, ${fmtNum(u.y)}, ${fmtNum(u.z)}), \\quad \\vec{n} = (${fmtNum(n1.x)}, ${fmtNum(n1.y)}, ${fmtNum(n1.z)})`,
        `\\vec{u}\\cdot\\vec{n} = ${fmtNum(dotVec(u, n1))}, \\quad |\\vec{u}| = ${fmtNum(lenVec(u))}, \\quad |\\vec{n}| = ${fmtNum(lenVec(n1))}`,
        `\\sin\\theta = \\frac{${fmtNum(Math.abs(dotVec(u, n1)))}}{${fmtNum(denom)}} \\approx ${fmtNum(sinVal)} \\implies \\theta \\approx ${fmtNum(deg)}^\\circ`,
      ],
      valueMatch: studentVal !== null && Math.abs(studentVal - deg) <= 1.0,
    };
  }

  if (input.mode === 'two-planes-dihedral') {
    // Compare primary roof plane against opposite roof plane (E2, R1, E3)
    const e2 = points.find((p) => p.id === 'E2');
    const r1 = points.find((p) => p.id === 'R1');
    const e3 = points.find((p) => p.id === 'E3');
    let n2: Vec3 = { x: 0, y: 0, z: 1 };
    let oppName = '지면(z=0)';
    if (config.archetype !== 'shed' && e2 && r1 && e3) {
      n2 = simplifyVec3(crossVec(subVec(r1, e2), subVec(e3, e2)));
      oppName = '맞은편 지붕면(E₂R₁E₃)';
    }
    const denom = lenVec(n1) * lenVec(n2);
    const cosVal = Math.min(1, Math.abs(dotVec(n1, n2)) / denom);
    const deg = round2((Math.acos(cosVal) * 180) / Math.PI);
    return {
      valid: true,
      mode: input.mode,
      exactValue: deg,
      unit: '°',
      formulaLatex: `\\cos\\theta = \\frac{|\\vec{n_1}\\cdot\\vec{n_2}|}{|\\vec{n_1}||\\vec{n_2}|} \\implies \\theta \\approx ${fmtNum(deg)}^\\circ`,
      derivationLatex: [
        `\\text{평면 1 법선 } \\vec{n_1} = (${fmtNum(n1.x)}, ${fmtNum(n1.y)}, ${fmtNum(n1.z)})`,
        `\\text{${oppName} 법선 } \\vec{n_2} = (${fmtNum(n2.x)}, ${fmtNum(n2.y)}, ${fmtNum(n2.z)})`,
        `\\cos\\theta = \\frac{|${fmtNum(dotVec(n1, n2))}|}{${fmtNum(lenVec(n1))}\\cdot${fmtNum(lenVec(n2))}} \\approx ${fmtNum(cosVal)} \\implies \\theta \\approx ${fmtNum(deg)}^\\circ`,
      ],
      valueMatch: studentVal !== null && Math.abs(studentVal - deg) <= 1.0,
    };
  }

  // point-plane-distance
  const target = points.find((p) => p.id === input.targetPointId) ?? points[0];
  const [a, b, c, d] = [n1.x, n1.y, n1.z, planeRes.exactD];
  const numer = Math.abs(a * target.x + b * target.y + c * target.z + d);
  const denom = Math.sqrt(a * a + b * b + c * c);
  const dist = round2(numer / denom);
  return {
    valid: true,
    mode: input.mode,
    exactValue: dist,
    unit: 'm',
    formulaLatex: `d = \\frac{|ax_0+by_0+cz_0+d|}{\\sqrt{a^2+b^2+c^2}} \\approx ${fmtNum(dist)}\\text{m}`,
    derivationLatex: [
      `\\text{대상 점 } ${target.label}(${fmtNum(target.x)}, ${fmtNum(target.y)}, ${fmtNum(target.z)})`,
      `\\text{평면 } ${planeRes.equationLatex}`,
      `d = \\frac{|${fmtNum(a)}(${fmtNum(target.x)}) + ${fmtNum(b)}(${fmtNum(target.y)}) + ${fmtNum(c)}(${fmtNum(target.z)}) + (${fmtNum(d)})|}{\\sqrt{${fmtNum(a)}^2+${fmtNum(b)}^2+${fmtNum(c)}^2}} = \\frac{${fmtNum(numer)}}{${fmtNum(denom)}} \\approx ${fmtNum(dist)}\\text{m}`,
    ],
    valueMatch: studentVal !== null && Math.abs(studentVal - dist) <= 0.15,
  };
}

export function diagnoseVectorAttempt(
  taskType: 'line' | 'plane' | 'relation',
  points: HousePoint[],
  lineInput: LineStudentInput,
  planeInput: PlaneStudentInput,
  relationInput: RelationStudentInput,
  config: HouseDesignConfig
) {
  const now = new Date().toISOString();

  if (taskType === 'line') {
    const exact = verifyLineEquation(points, lineInput);
    if (!exact.valid) {
      return {
        summary: exact.error ?? '서로 다른 두 점을 선택해 주세요.',
        isConsistentWithStudent: false,
        aiCalculatedEquation: '미산출',
        aiCalculatedAngleOrValue: '미산출',
        stepByStepAdvice: ['서로 다른 시작점 A와 끝점 B를 먼저 지정하세요.'],
        mistakeSpots: ['선택한 두 점이 일치합니다.'],
        citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
        checkedAt: now,
      };
    }

    const mistakes: string[] = [];
    if (!exact.checks.directionMatch) {
      mistakes.push('방향벡터 u = B - A의 각 성분 차이를 다시 계산해 보세요. (상수배는 모두 정답으로 인정됩니다.)');
    }
    if (!exact.checks.basePointOnLine) {
      mistakes.push('방정식에 대입한 지나는 점 (x₁, y₁, z₁)이 두 점 A, B를 잇는 직선 위에 있지 않습니다.');
    }
    if (!exact.checks.lengthMatch) {
      mistakes.push('선분 길이 √(a² + b² + c²) 계산을 소수 둘째 자리까지 다시 확인해 보세요.');
    }
    if (!exact.checks.angleMatch) {
      mistakes.push('지면(z=0)과 직선이 이루는 각 θ는 sin θ = |u_z| / |u| 관계를 이용해 구합니다.');
    }

    return {
      summary: exact.checks.allCorrect
        ? '입력한 방향벡터, 지나는 점, 길이, 지면 각도가 모두 수학적으로 정확히 일치합니다.'
        : '일부 항목에서 계산 오차나 부호 확인이 필요합니다. 아래 점검 포인트를 참고해 수정한 뒤 교사 정밀 검증기로 확정하세요.',
      isConsistentWithStudent: exact.checks.allCorrect,
      aiCalculatedEquation: `${exact.pointA.label}(${fmtNum(exact.pointA.x)},${fmtNum(exact.pointA.y)},${fmtNum(exact.pointA.z)}), 방향벡터 (${fmtNum(exact.simplifiedDir.x)}, ${fmtNum(exact.simplifiedDir.y)}, ${fmtNum(exact.simplifiedDir.z)})`,
      aiCalculatedAngleOrValue: `길이 ${fmtNum(exact.exactLength)} m · 지면각 ${fmtNum(exact.exactAngleGroundDeg)}°`,
      stepByStepAdvice: [
        '1단계: 끝점 좌표에서 시작점 좌표를 빼서 방향벡터를 구합니다.',
        '2단계: 성분 중 0이 있으면 대칭형 분수식 대신 x = x₁ 형태로 따로 표기합니다.',
      ],
      mistakeSpots: mistakes,
      citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
      checkedAt: now,
    };
  }

  if (taskType === 'plane') {
    const exact = verifyPlaneEquation(points, planeInput);
    if (!exact.valid) {
      return {
        summary: exact.error ?? '일직선 위에 있지 않은 세 점을 선택해 주세요.',
        isConsistentWithStudent: false,
        aiCalculatedEquation: '미산출',
        aiCalculatedAngleOrValue: '미산출',
        stepByStepAdvice: ['삼각형을 이루는 세 점 P, Q, R을 선택하세요.'],
        mistakeSpots: ['세 점이 일직선 위에 있습니다.'],
        citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
        checkedAt: now,
      };
    }

    const mistakes: string[] = [];
    if (!exact.checks.pqMatch || !exact.checks.prMatch) {
      mistakes.push('두 벡터 PQ = Q - P, PR = R - P의 뺄셈 순서를 확인해 주세요.');
    }
    if (!exact.checks.normalMatch) {
      mistakes.push('법선벡터 n은 n·PQ = 0 이고 n·PR = 0 을 동시에 만족해야 합니다.');
    }
    if (!exact.checks.equationMatch) {
      mistakes.push('법선벡터 방향이 같더라도 점 P를 대입해 상수항 d = -(ax₀ + by₀ + cz₀)를 다시 계산해 보세요.');
    }
    if (!exact.checks.angleMatch) {
      mistakes.push('지붕 경사각 θ는 cos θ = |n_z| / |n| 공식으로 구할 수 있습니다.');
    }

    return {
      summary: exact.checks.allCorrect
        ? '두 평면 위 벡터와 법선벡터, 평면의 방정식 및 경사각이 모두 일치합니다.'
        : '법선벡터의 수직 조건이나 상수항 d의 부호를 점검해 보세요.',
      isConsistentWithStudent: exact.checks.allCorrect,
      aiCalculatedEquation: `법선벡터 (${fmtNum(exact.simplifiedNormal.x)}, ${fmtNum(exact.simplifiedNormal.y)}, ${fmtNum(exact.simplifiedNormal.z)}) · d = ${fmtNum(exact.exactD)}`,
      aiCalculatedAngleOrValue: `지붕 경사각 ${fmtNum(exact.exactAngleGroundDeg)}°`,
      stepByStepAdvice: [
        '1단계: 세 점으로 두 벡터 PQ, PR을 먼저 구합니다.',
        '2단계: 두 벡터에 수직인 법선벡터를 구한 뒤 한 점을 대입해 d를 결정합니다.',
      ],
      mistakeSpots: mistakes,
      citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
      checkedAt: now,
    };
  }

  const lRes = verifyLineEquation(points, lineInput);
  const pRes = verifyPlaneEquation(points, planeInput);
  const rel = verifyRelationTask(points, lRes, pRes, relationInput, config);
  if (!rel.valid) {
    return {
      summary: rel.error ?? '먼저 직선과 평면을 설정해 주세요.',
      isConsistentWithStudent: false,
      aiCalculatedEquation: '선행 과제 필요',
      aiCalculatedAngleOrValue: '미산출',
      stepByStepAdvice: ['과제 1과 과제 2의 점을 먼저 유효하게 지정하세요.'],
      mistakeSpots: [rel.error ?? '선행 설정이 필요합니다.'],
      citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
      checkedAt: now,
    };
  }

  return {
    summary: rel.valueMatch
      ? '심화 기하 관계(각도/거리) 계산 결과가 정확합니다.'
      : '내적 또는 점과 평면 사이 거리 공식의 분모(|u||n| 또는 √(a²+b²+c²))를 다시 확인해 보세요.',
    isConsistentWithStudent: rel.valueMatch,
    aiCalculatedEquation:
      rel.mode === 'line-plane-angle'
        ? 'sin θ = |u·n| / (|u||n|)'
        : rel.mode === 'two-planes-dihedral'
        ? 'cos θ = |n₁·n₂| / (|n₁||n₂|)'
        : 'd = |ax₀+by₀+cz₀+d| / √(a²+b²+c²)',
    aiCalculatedAngleOrValue: `${fmtNum(rel.exactValue)} ${rel.unit}`,
    stepByStepAdvice: [
      '직선-평면 각도는 sin θ, 두 평면의 이면각은 cos θ를 사용한다는 점에 유의하세요.',
    ],
    mistakeSpots: rel.valueMatch ? [] : ['계산값과 공식 적용 결과를 한 번 더 대조해 보세요.'],
    citationNote: '자체 대수 추론 도우미(외부 유료 API 미사용)',
    checkedAt: now,
  };
}
