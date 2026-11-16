import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  HouseDesignConfig,
  HousePoint,
  Vec3,
} from '../types/project';
import { computeHousePoints, fmtNum } from '../utils/vectorMath';

export interface VectorOverlayData {
  line?: {
    pointA: Vec3;
    pointB: Vec3;
    label: string;
  } | null;
  plane?: {
    points: [Vec3, Vec3, Vec3];
    normal: Vec3;
    label: string;
  } | null;
  distanceSegment?: {
    from: Vec3;
    to: Vec3;
  } | null;
}

interface HouseVector3DSceneProps {
  config: HouseDesignConfig;
  selectedPointId?: string | null;
  highlightedPointIds?: string[];
  onSelectPoint?: (point: HousePoint) => void;
  overlay?: VectorOverlayData;
  compact?: boolean;
}

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Maps Korean High School Math / SketchUp coordinate (X width, Y depth, Z up)
 * to Three.js right-handed world space (X right, Y up, -Z depth).
 */
function mathToThree(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.z, -v.y);
}

function createCylinderBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.max(dir.length(), 0.01);
  const geo = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export const HouseVector3DScene: React.FC<HouseVector3DSceneProps> = ({
  config,
  selectedPointId = null,
  highlightedPointIds = [],
  onSelectPoint,
  overlay,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HousePoint | null>(null);

  const points = useMemo(() => computeHousePoints(config), [config]);
  const onSelectPointRef = useRef(onSelectPoint);
  onSelectPointRef.current = onSelectPoint;

  const sceneControllerRef = useRef<{
    rebuildScene: () => void;
    setCameraPreset: (preset: 'iso' | 'front' | 'side' | 'top') => void;
  } | null>(null);

  const latestPropsRef = useRef({
    config,
    points,
    selectedPointId,
    highlightedPointIds,
    overlay,
    showAxes,
    xrayMode,
  });
  latestPropsRef.current = {
    config,
    points,
    selectedPointId,
    highlightedPointIds,
    overlay,
    showAxes,
    xrayMode,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F1F5F9');
    scene.fog = new THREE.Fog('#F1F5F9', 36, 85);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 200);
    camera.position.set(14, 11, 16);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Three-point studio lighting
    const hemi = new THREE.HemisphereLight('#E0F2FE', '#CBD5E1', 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 1.85);
    keyLight.position.set(14, 22, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#DBEAFE', 0.7);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 5;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;

    // Ground subtle backdrop plane
    const groundGeo = new THREE.CircleGeometry(34, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      roughness: 0.95,
      metalness: 0.0,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -0.03;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const dynamicRoot = new THREE.Group();
    scene.add(dynamicRoot);

    const clickableNodes: THREE.Mesh[] = [];
    let camAnimTarget: THREE.Vector3 | null = null;
    let lookAnimTarget: THREE.Vector3 | null = null;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function disposeGroup(group: THREE.Object3D) {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine || (obj as THREE.Sprite).isSprite) {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) {
            mat.forEach((mt) => {
              if ((mt as THREE.SpriteMaterial).map) (mt as THREE.SpriteMaterial).map?.dispose();
              mt.dispose();
            });
          } else if (mat) {
            if ((mat as THREE.SpriteMaterial).map) (mat as THREE.SpriteMaterial).map?.dispose();
            mat.dispose();
          }
        }
      });
    }

    const makeAxisTag = (text: string, bg: string) => {
      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(4, 6, 184, 52, 10);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 96, 32);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(2.1, 0.7, 1);
      return sp;
    };

    const makePointTag = (label: string, active: boolean) => {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 48;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = active ? '#1D4ED8' : 'rgba(15, 23, 42, 0.82)';
        ctx.beginPath();
        ctx.roundRect(6, 6, 84, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 48, 25);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(0.95, 0.48, 1);
      return sp;
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        let animating = false;
        if (camAnimTarget && lookAnimTarget) {
          const dampFactor = 1 - Math.exp(-6.0 * delta);
          camera.position.lerp(camAnimTarget, dampFactor);
          controls.target.lerp(lookAnimTarget, dampFactor);
          if (
            camera.position.distanceTo(camAnimTarget) < 0.05 &&
            controls.target.distanceTo(lookAnimTarget) < 0.05
          ) {
            camAnimTarget = null;
            lookAnimTarget = null;
          } else {
            animating = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || animating) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function rebuildScene() {
      disposeGroup(dynamicRoot);
      dynamicRoot.clear();
      clickableNodes.length = 0;

      const {
        config: cfg,
        points: pts,
        selectedPointId: selId,
        highlightedPointIds: hlIds,
        overlay: ov,
        showAxes: axesOn,
        xrayMode: xray,
      } = latestPropsRef.current;

      const ptMap = new Map(pts.map((p) => [p.id, p]));
      const b1 = ptMap.get('B1')!;
      const b2 = ptMap.get('B2')!;
      const b3 = ptMap.get('B3')!;
      const b4 = ptMap.get('B4')!;
      const e1 = ptMap.get('E1')!;
      const e2 = ptMap.get('E2')!;
      const e3 = ptMap.get('E3')!;
      const e4 = ptMap.get('E4')!;
      const r1 = ptMap.get('R1')!;
      const r2 = ptMap.get('R2')!;
      const s1 = ptMap.get('S1')!;
      const s2 = ptMap.get('S2')!;
      const s3 = ptMap.get('S3')!;
      const s4 = ptMap.get('S4')!;

      const centerX = (b1.x + b3.x) / 2;
      const centerY = (b1.y + b3.y) / 2;
      const baseZ = b1.z;

      // Ground elevation grid sits at mathematical z = 0 (origin plane)
      const grid = new THREE.GridHelper(28, 28, '#94A3B8', '#CBD5E1');
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.45;
      grid.position.set(0, 0.01, 0);
      dynamicRoot.add(grid);

      // Coordinate Axes at mathematical Origin (0, 0, 0)
      if (axesOn) {
        const axesGroup = new THREE.Group();
        const originMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 16),
          new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.3 })
        );
        axesGroup.add(originMesh);

        const oTag = makeAxisTag('O(0,0,0)', '#0F172A');
        oTag.position.set(-0.6, -0.5, 0.6);
        axesGroup.add(oTag);

        // X Axis (Red, +X)
        axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 11, '#DC2626', 0.55, 0.25));
        const xTag = makeAxisTag('X (동서)', '#DC2626');
        xTag.position.set(11.8, 0.35, 0);
        axesGroup.add(xTag);

        // Y Axis (Green, +Y in math = -Z in Three.js)
        axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 10, '#059669', 0.55, 0.25));
        const yTag = makeAxisTag('Y (남북)', '#059669');
        yTag.position.set(0, 0.35, -10.8);
        axesGroup.add(yTag);

        // Z Axis (Blue, +Z in math = +Y in Three.js)
        axesGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 8.5, '#2563EB', 0.55, 0.25));
        const zTag = makeAxisTag('Z (높이)', '#2563EB');
        zTag.position.set(0, 9.2, 0);
        axesGroup.add(zTag);

        dynamicRoot.add(axesGroup);
      }

      // Composite Architectural House Group (10+ distinct PBR parts)
      const houseGroup = new THREE.Group();

      const wallMat = new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        roughness: 0.72,
        metalness: 0.04,
        transparent: xray,
        opacity: xray ? 0.32 : 1.0,
      });
      const plinthMat = new THREE.MeshStandardMaterial({
        color: '#94A3B8',
        roughness: 0.85,
        metalness: 0.05,
        transparent: xray,
        opacity: xray ? 0.35 : 1.0,
      });
      const woodMat = new THREE.MeshStandardMaterial({
        color: '#A16207',
        roughness: 0.58,
        metalness: 0.08,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: '#334155',
        roughness: 0.45,
        metalness: 0.25,
        side: THREE.DoubleSide,
        transparent: xray,
        opacity: xray ? 0.35 : 0.96,
      });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: '#BAE6FD',
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.6,
      });

      // 1. Stone foundation plinth & front porch deck
      const plinthH = 0.22;
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.width + 0.3, plinthH, cfg.depth + 0.3),
        plinthMat
      );
      plinth.position.copy(mathToThree({ x: centerX, y: centerY, z: baseZ + plinthH / 2 }));
      plinth.receiveShadow = true;
      plinth.castShadow = !isSoftwareGl;
      houseGroup.add(plinth);

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.width + 0.2, 0.14, 2.2),
        woodMat
      );
      deck.position.copy(mathToThree({ x: centerX, y: b1.y - 1.1, z: baseZ + 0.07 }));
      deck.receiveShadow = true;
      houseGroup.add(deck);

      // 2. Main Body Walls (built from exact vertex prism so gable/shed/aframe match 100%)
      const bodyHeight = cfg.archetype === 'aframe' ? 0.5 : cfg.wallHeight;
      if (cfg.archetype !== 'aframe') {
        const wallBox = new THREE.Mesh(
          new THREE.BoxGeometry(cfg.width, bodyHeight - plinthH, cfg.depth),
          wallMat
        );
        wallBox.position.copy(
          mathToThree({ x: centerX, y: centerY, z: baseZ + plinthH + (bodyHeight - plinthH) / 2 })
        );
        wallBox.castShadow = !isSoftwareGl;
        wallBox.receiveShadow = true;
        houseGroup.add(wallBox);
      }

      // Gable triangular end walls (front & back) or Shed side walls
      const buildQuadOrTri = (verts: Vec3[], mat: THREE.Material) => {
        const geom = new THREE.BufferGeometry();
        const coords: number[] = [];
        for (let i = 1; i < verts.length - 1; i++) {
          const p0 = mathToThree(verts[0]);
          const p1 = mathToThree(verts[i]);
          const p2 = mathToThree(verts[i + 1]);
          coords.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
        geom.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
        geom.computeVertexNormals();
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = !isSoftwareGl;
        mesh.receiveShadow = true;
        return mesh;
      };

      if (cfg.archetype === 'shed') {
        // Sloped side triangles & back taller wall
        houseGroup.add(buildQuadOrTri([e1, e4, r1], wallMat));
        houseGroup.add(buildQuadOrTri([e2, r2, e3], wallMat));
        houseGroup.add(buildQuadOrTri([e4, e3, r2, r1], wallMat));
        // Single sloped roof slab
        houseGroup.add(buildQuadOrTri([e1, e2, r2, r1], roofMat));
      } else {
        // Gable / A-frame / Custom end triangles
        houseGroup.add(buildQuadOrTri([e1, e2, r1], wallMat));
        houseGroup.add(buildQuadOrTri([e4, r2, e3], wallMat));
        if (cfg.archetype === 'aframe') {
          // Low vertical knee walls
          const knee = new THREE.Mesh(
            new THREE.BoxGeometry(cfg.width, 0.5, cfg.depth),
            wallMat
          );
          knee.position.copy(mathToThree({ x: centerX, y: centerY, z: baseZ + 0.25 }));
          houseGroup.add(knee);
        }
        // Left & Right pitched roof planes
        houseGroup.add(buildQuadOrTri([e1, r1, r2, e4], roofMat));
        houseGroup.add(buildQuadOrTri([e2, e3, r2, r1], roofMat));
      }

      // 3. Structural Roof Ridge Beam & Eave Beams
      houseGroup.add(createCylinderBetween(mathToThree(r1), mathToThree(r2), 0.1, woodMat));
      houseGroup.add(createCylinderBetween(mathToThree(e1), mathToThree(e4), 0.08, woodMat));
      houseGroup.add(createCylinderBetween(mathToThree(e2), mathToThree(e3), 0.08, woodMat));

      // 4. Front Porch Slanted Pillars (S1->S2, S3->S4) — hero structural lines!
      const pLeft = createCylinderBetween(mathToThree(s1), mathToThree(s2), 0.13, woodMat);
      pLeft.castShadow = !isSoftwareGl;
      const pRight = createCylinderBetween(mathToThree(s3), mathToThree(s4), 0.13, woodMat);
      pRight.castShadow = !isSoftwareGl;
      houseGroup.add(pLeft, pRight);

      // 5. Front door & windows (on front facade y = b1.y)
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.12), woodMat);
      door.position.copy(mathToThree({ x: centerX, y: b1.y - 0.03, z: baseZ + 1.05 }));
      houseGroup.add(door);

      const winW = Math.min(1.5, cfg.width * 0.2);
      const winZ = baseZ + Math.min(1.6, bodyHeight * 0.55);
      const winL = new THREE.Mesh(new THREE.BoxGeometry(winW, 1.0, 0.12), glassMat);
      winL.position.copy(mathToThree({ x: b1.x + cfg.width * 0.22, y: b1.y - 0.03, z: winZ }));
      const winR = new THREE.Mesh(new THREE.BoxGeometry(winW, 1.0, 0.12), glassMat);
      winR.position.copy(mathToThree({ x: b2.x - cfg.width * 0.22, y: b1.y - 0.03, z: winZ }));
      houseGroup.add(winL, winR);

      // Wireframe outline edges for architectural clarity
      const edgePairs: Array<[HousePoint, HousePoint]> = [
        [b1, b2], [b2, b3], [b3, b4], [b4, b1],
        [b1, e1], [b2, e2], [b3, e3], [b4, e4],
        [e1, e2], [e2, e3], [e3, e4], [e4, e1],
        [r1, r2],
      ];
      if (cfg.archetype === 'shed') {
        edgePairs.push([e1, r1], [e2, r2], [e4, r1], [e3, r2]);
      } else {
        edgePairs.push([e1, r1], [e2, r1], [e4, r2], [e3, r2]);
      }
      const lineVerts: number[] = [];
      edgePairs.forEach(([pa, pb]) => {
        const va = mathToThree(pa);
        const vb = mathToThree(pb);
        lineVerts.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      });
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
      const wireMat = new THREE.LineBasicMaterial({ color: '#1E293B', transparent: true, opacity: 0.55 });
      houseGroup.add(new THREE.LineSegments(wireGeo, wireMat));

      dynamicRoot.add(houseGroup);

      // Interactive Vertex Nodes (P points)
      pts.forEach((pt) => {
        const isSelected = pt.id === selId;
        const isHighlighted = hlIds.includes(pt.id);
        const nodeColor = isSelected
          ? '#DC2626'
          : isHighlighted
          ? '#D97706'
          : pt.category === 'ridge'
          ? '#7C3AED'
          : pt.category === 'pillar'
          ? '#059669'
          : '#2563EB';

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(isSelected || isHighlighted ? 0.24 : 0.17, 16, 16),
          new THREE.MeshStandardMaterial({
            color: nodeColor,
            roughness: 0.25,
            metalness: 0.15,
          })
        );
        const worldP = mathToThree(pt);
        sphere.position.copy(worldP);
        sphere.userData.point = pt;
        clickableNodes.push(sphere);
        dynamicRoot.add(sphere);

        const tag = makePointTag(pt.id, isSelected || isHighlighted);
        tag.position.set(worldP.x, worldP.y + 0.48, worldP.z);
        dynamicRoot.add(tag);
      });

      // Verified Vector / Line / Plane 3D Reflection Overlay!
      if (ov?.line) {
        const va = mathToThree(ov.line.pointA);
        const vb = mathToThree(ov.line.pointB);
        const dir = new THREE.Vector3().subVectors(vb, va);
        const len = dir.length();
        if (len > 0.01) {
          const u = dir.clone().normalize();
          // Infinite line extension
          const pStart = va.clone().addScaledVector(u, -5);
          const pEnd = vb.clone().addScaledVector(u, 5);
          const extGeo = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
          const extLine = new THREE.Line(
            extGeo,
            new THREE.LineDashedMaterial({ color: '#EA580C', dashSize: 0.35, gapSize: 0.2 })
          );
          extLine.computeLineDistances();
          dynamicRoot.add(extLine);

          // Direction vector arrow u
          const arrow = new THREE.ArrowHelper(u, va, len, '#EA580C', 0.55, 0.26);
          dynamicRoot.add(arrow);
        }
      }

      if (ov?.plane) {
        const [p0m, p1m, p2m] = ov.plane.points;
        const p0 = mathToThree(p0m);
        const p1 = mathToThree(p1m);
        const p2 = mathToThree(p2m);
        const nThree = mathToThree(ov.plane.normal).normalize();

        // Build extended parallelogram around the 3 points for visual clarity
        const e1v = new THREE.Vector3().subVectors(p1, p0);
        const e2v = new THREE.Vector3().subVectors(p2, p0);
        const cCenter = p0.clone().addScaledVector(e1v, 0.5).addScaledVector(e2v, 0.5);
        const planeGeo = new THREE.PlaneGeometry(
          Math.max(e1v.length() * 1.35, 6),
          Math.max(e2v.length() * 1.35, 6)
        );
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nThree);
        const planeMesh = new THREE.Mesh(
          planeGeo,
          new THREE.MeshStandardMaterial({
            color: '#0EA5E9',
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide,
            roughness: 0.3,
          })
        );
        planeMesh.position.copy(cCenter);
        planeMesh.quaternion.copy(q);
        dynamicRoot.add(planeMesh);

        // Normal vector arrow n perpendicular to roof plane
        const normalArrow = new THREE.ArrowHelper(nThree, cCenter, 3.2, '#0284C7', 0.5, 0.24);
        dynamicRoot.add(normalArrow);
      }

      if (ov?.distanceSegment) {
        const f = mathToThree(ov.distanceSegment.from);
        const t = mathToThree(ov.distanceSegment.to);
        const dGeo = new THREE.BufferGeometry().setFromPoints([f, t]);
        const dLine = new THREE.Line(
          dGeo,
          new THREE.LineBasicMaterial({ color: '#9333EA' })
        );
        dynamicRoot.add(dLine);
      }

      controls.target.copy(mathToThree({ x: centerX, y: centerY, z: baseZ + bodyHeight * 0.6 }));
      requestRender();
    }

    const setCameraPreset = (preset: 'iso' | 'front' | 'side' | 'top') => {
      const { points: pts, config: cfg } = latestPropsRef.current;
      const b1 = pts[0];
      const b3 = pts[2];
      const cx = (b1.x + b3.x) / 2;
      const cy = (b1.y + b3.y) / 2;
      const cz = b1.z + cfg.wallHeight * 0.6;
      const target = mathToThree({ x: cx, y: cy, z: cz });
      lookAnimTarget = target;

      if (preset === 'iso') {
        camAnimTarget = target.clone().add(new THREE.Vector3(11, 8, 12));
      } else if (preset === 'front') {
        camAnimTarget = target.clone().add(new THREE.Vector3(0, 1.5, 16));
      } else if (preset === 'side') {
        camAnimTarget = target.clone().add(new THREE.Vector3(16, 2, 0));
      } else {
        camAnimTarget = target.clone().add(new THREE.Vector3(0, 18, 0.2));
      }
      requestRender();
    };

    sceneControllerRef.current = { rebuildScene, setCameraPreset };
    rebuildScene();

    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', () => {
      camAnimTarget = null;
      lookAnimTarget = null;
    });

    // Raycasting for clicking / hovering vertex spheres
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastMoveCheck = 0;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableNodes, false);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.point as HousePoint | undefined;
        if (pt && onSelectPointRef.current) {
          onSelectPointRef.current(pt);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 50) return;
      lastMoveCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableNodes, false);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.point as HousePoint | undefined;
        setHoveredPoint(pt ?? null);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredPoint(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(entry.contentRect.width, 200);
      const h = Math.max(entry.contentRect.height, 200);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeGroup(dynamicRoot);
      groundGeo.dispose();
      groundMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    sceneControllerRef.current?.rebuildScene();
  }, [config, selectedPointId, highlightedPointIds, overlay, showAxes, xrayMode]);

  return (
    <div
      className={`relative w-full h-full ${
        compact ? 'min-h-[360px]' : 'min-h-[480px]'
      } rounded-xl overflow-hidden border border-slate-200 bg-slate-100`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-white text-sm">
          3D 그래픽 컨텍스트를 복구하는 중입니다...
        </div>
      )}

      {/* Minimal Top-Left Coordinate Legend */}
      <div className="absolute top-3 left-3 pointer-events-none bg-slate-900/85 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2.5">
        <span className="font-semibold">3D 좌표 공간</span>
        <span className="text-red-300 font-mono-tabular">X(가로)</span>
        <span className="text-emerald-300 font-mono-tabular">Y(깊이)</span>
        <span className="text-blue-300 font-mono-tabular">Z(높이)</span>
      </div>

      {/* Hovered Point Readout */}
      {hoveredPoint && (
        <div className="absolute top-3 right-3 pointer-events-none bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-mono-tabular">
          {hoveredPoint.id} · {hoveredPoint.name} ({fmtNum(hoveredPoint.x)}, {fmtNum(hoveredPoint.y)}, {fmtNum(hoveredPoint.z)})
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1 px-3 py-1 rounded-t-lg bg-slate-900/85 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          {dockCollapsed ? '뷰포트 제어 열기' : '뷰포트 제어 접기'}
        </button>
        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1 bg-slate-900/85 text-white px-2.5 py-1.5 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.setCameraPreset('iso')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              등각뷰
            </button>
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.setCameraPreset('front')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              정면(XZ)
            </button>
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.setCameraPreset('side')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              측면(YZ)
            </button>
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.setCameraPreset('top')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              평면(XY)
            </button>
            <span className="h-3.5 w-px bg-white/20 mx-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setShowAxes((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                showAxes ? 'bg-blue-600 text-white' : 'hover:bg-white/15 text-slate-300'
              }`}
            >
              좌표축
            </button>
            <button
              type="button"
              onClick={() => setXrayMode((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                xrayMode ? 'bg-amber-600 text-white' : 'hover:bg-white/15 text-slate-300'
              }`}
            >
              투명 구조
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
