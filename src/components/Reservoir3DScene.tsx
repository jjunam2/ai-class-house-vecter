import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { SiteLotId, SiteLotInfo } from '../types/project';

interface Reservoir3DSceneProps {
  lots: SiteLotInfo[];
  selectedLotId: SiteLotId;
  sunTimeHour: number;
  onSelectLot: (lotId: SiteLotId) => void;
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

export const Reservoir3DScene: React.FC<Reservoir3DSceneProps> = ({
  lots,
  selectedLotId,
  sunTimeHour,
  onSelectLot,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const onSelectLotRef = useRef(onSelectLot);
  onSelectLotRef.current = onSelectLot;

  const sceneRefs = useRef<{
    requestRender: () => void;
    updateSun: (hour: number) => void;
    updateSelectedLot: (lotId: SiteLotId) => void;
    setCameraPreset: (preset: 'overview' | 'south' | 'top') => void;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EBF3FA');
    scene.fog = new THREE.FogExp2('#EBF3FA', 0.014);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(16, 15, 22);

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

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight('#DBEAFE', '#94A3B8', 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF7ED', 2.0);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -24;
    sunLight.shadow.camera.right = 24;
    sunLight.shadow.camera.top = 24;
    sunLight.shadow.camera.bottom = -24;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 46;
    controls.target.set(0, 1.0, 0);

    // Terrain height function representing Gukhwa-ri Reservoir basin & surrounding hills
    const terrainHeightAt = (x: number, z: number): number => {
      // Reservoir basin centered near (x: -1, z: 11)
      const distRes = Math.hypot((x + 1) * 0.9, (z - 12.5) * 1.15);
      const basin = -2.2 * Math.exp(-(distRes * distRes) / 62);
      // Gentle eastern ridge (Lot B) and northern hills
      const ridgeB = 2.6 * Math.exp(-((x - 8.5) ** 2 + (z + 2.5) ** 2) / 38);
      const northHill = 3.2 * Math.exp(-((x + 2) ** 2 + (z + 15) ** 2) / 70);
      const undulation = 0.25 * Math.sin(x * 0.28) * Math.cos(z * 0.25);
      return Math.max(-1.6, 0.7 + basin + ridgeB + northHill + undulation);
    };

    // Build terrain mesh with vertex elevation coloring
    const terrainGeo = new THREE.PlaneGeometry(52, 52, 72, 72);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const cShore = new THREE.Color('#D6C7A9');
    const cGrass = new THREE.Color('#7FA66E');
    const cRidge = new THREE.Color('#5B8252');
    const cTmp = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = terrainHeightAt(vx, vz);
      posAttr.setY(i, vy);
      if (vy < 0.25) {
        cTmp.copy(cShore);
      } else if (vy < 2.2) {
        cTmp.copy(cShore).lerp(cGrass, (vy - 0.25) / 1.95);
      } else {
        cTmp.copy(cGrass).lerp(cRidge, Math.min(1, (vy - 2.2) / 2.8));
      }
      colors[i * 3] = cTmp.r;
      colors[i * 3 + 1] = cTmp.g;
      colors[i * 3 + 2] = cTmp.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Reservoir Water Plane (at y = 0.05)
    const waterGeo = new THREE.PlaneGeometry(52, 52);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#1E6E9E',
      roughness: 0.14,
      metalness: 0.15,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.86,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = 0.08;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Subtle contour/coordinate grid lines on terrain
    const gridHelper = new THREE.GridHelper(36, 18, '#64748B', '#94A3B8');
    gridHelper.position.y = 0.12;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.18;
    scene.add(gridHelper);

    // Compass directions (N=-Z, S=+Z, E=+X, W=-X)
    const makeCompassLabel = (text: string, color: string) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        ctx.beginPath();
        ctx.arc(64, 64, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 46px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 66);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(2.2, 2.2, 1);
      return sp;
    };

    const compassSpecs = [
      { label: '북 N', pos: [0, 2.8, -17], color: '#3B82F6' },
      { label: '남 S', pos: [0, 1.8, 17], color: '#EF4444' },
      { label: '동 E', pos: [17, 2.2, 0], color: '#10B981' },
      { label: '서 W', pos: [-17, 2.2, 0], color: '#F59E0B' },
    ];
    compassSpecs.forEach((sp) => {
      const sprite = makeCompassLabel(sp.label, sp.color);
      sprite.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      scene.add(sprite);
    });

    // Instanced rural trees around hills (avoiding reservoir water and lot footprints)
    const treePositions: Array<{ x: number; y: number; z: number; s: number }> = [];
    for (let i = 0; i < 64; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 9 + (i % 13) * 1.15;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius - 3;
      const ty = terrainHeightAt(tx, tz);
      const nearLot = lots.some((l) => Math.hypot(tx - l.worldPos.x, tz - l.worldPos.z) < 3.4);
      if (ty > 0.45 && !nearLot && Math.abs(tx) < 22 && Math.abs(tz) < 22) {
        treePositions.push({ x: tx, y: ty, z: tz, s: 0.75 + ((i * 17) % 10) * 0.05 });
      }
    }

    if (treePositions.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.9, 6);
      trunkGeo.translate(0, 0.45, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#78553A', roughness: 0.9 });
      const crownGeo = new THREE.ConeGeometry(0.7, 1.9, 7);
      crownGeo.translate(0, 1.55, 0);
      const crownMat = new THREE.MeshStandardMaterial({ color: '#3D6B43', roughness: 0.8 });

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
      trunks.castShadow = !isSoftwareGl;
      crowns.castShadow = !isSoftwareGl;

      const dummy = new THREE.Object3D();
      const tint = new THREE.Color();
      treePositions.forEach((tp, idx) => {
        dummy.position.set(tp.x, tp.y, tp.z);
        dummy.scale.setScalar(tp.s);
        dummy.rotation.y = idx * 0.8;
        dummy.updateMatrix();
        trunks.setMatrixAt(idx, dummy.matrix);
        crowns.setMatrixAt(idx, dummy.matrix);
        tint.setHSL(0.32 + (idx % 5) * 0.015, 0.35, 0.32 + (idx % 4) * 0.04);
        crowns.setColorAt(idx, tint);
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      scene.add(trunks, crowns);
    }

    // Lot markers + ghost architectural footprint on each lot
    const lotGroups = new Map<SiteLotId, { group: THREE.Group; padMat: THREE.MeshStandardMaterial; ghost: THREE.Group }>();
    const clickableMeshes: THREE.Object3D[] = [];

    lots.forEach((lot) => {
      const g = new THREE.Group();
      const gy = terrainHeightAt(lot.worldPos.x, lot.worldPos.z);
      g.position.set(lot.worldPos.x, gy + 0.08, lot.worldPos.z);

      const padGeo = new THREE.BoxGeometry(3.4, 0.16, 2.8);
      const padMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.45,
        metalness: 0.05,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.receiveShadow = true;
      pad.castShadow = !isSoftwareGl;
      pad.userData.lotId = lot.id;
      clickableMeshes.push(pad);
      g.add(pad);

      // Ghost preview house on selected lot
      const ghost = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(2.4, 1.1, 1.8);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: '#2563EB',
        transparent: true,
        opacity: 0.45,
        roughness: 0.35,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.63;
      body.castShadow = !isSoftwareGl;
      ghost.add(body);

      const roofShape = new THREE.Shape();
      roofShape.moveTo(-1.35, 0);
      roofShape.lineTo(1.35, 0);
      roofShape.lineTo(0, 0.85);
      roofShape.closePath();
      const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 2.0, bevelEnabled: false });
      roofGeo.translate(0, 0, -1.0);
      const roofMat = new THREE.MeshStandardMaterial({
        color: '#1E40AF',
        transparent: true,
        opacity: 0.65,
        roughness: 0.4,
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 1.18;
      roof.castShadow = !isSoftwareGl;
      ghost.add(roof);
      g.add(ghost);

      // Floating label above lot
      const lc = document.createElement('canvas');
      lc.width = 256;
      lc.height = 72;
      const lctx = lc.getContext('2d');
      if (lctx) {
        lctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        lctx.beginPath();
        lctx.roundRect(8, 8, 240, 56, 12);
        lctx.fill();
        lctx.fillStyle = '#FFFFFF';
        lctx.font = 'bold 26px sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        lctx.fillText(lot.name.split('·')[0].trim(), 128, 36);
      }
      const ltex = new THREE.CanvasTexture(lc);
      ltex.colorSpace = THREE.SRGBColorSpace;
      const lsprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, depthTest: false }));
      lsprite.position.set(0, 2.8, 0);
      lsprite.scale.set(3.2, 0.9, 1);
      lsprite.userData.lotId = lot.id;
      clickableMeshes.push(lsprite);
      g.add(lsprite);

      scene.add(g);
      lotGroups.set(lot.id, { group: g, padMat, ghost });
    });

    // Camera transition state
    let camAnimTarget: THREE.Vector3 | null = null;
    let lookAnimTarget: THREE.Vector3 | null = null;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

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
          const dampFactor = 1 - Math.exp(-5.5 * delta);
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

    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', () => {
      camAnimTarget = null;
      lookAnimTarget = null;
    });

    const updateSun = (hour: number) => {
      // 7am (East +X) -> 12pm (South +Z high) -> 18pm (West -X)
      const t = (hour - 6) / 12; // 0..1
      const az = (1 - t) * Math.PI; // PI -> 0
      const elev = Math.sin(Math.max(0.15, Math.min(0.85, t)) * Math.PI) * 18 + 4;
      sunLight.position.set(Math.cos(az) * 20, elev, Math.sin(az) * 14 + 4);
      const warmth = 1 - Math.abs(t - 0.5) * 1.4;
      sunLight.intensity = 1.4 + warmth * 0.8;
      requestRender();
    };

    const updateSelectedLot = (id: SiteLotId) => {
      lotGroups.forEach((entry, key) => {
        const isSel = key === id;
        entry.padMat.color.set(isSel ? '#2563EB' : '#E2E8F0');
        entry.ghost.visible = isSel;
      });
      requestRender();
    };

    const setCameraPreset = (preset: 'overview' | 'south' | 'top') => {
      if (preset === 'overview') {
        camAnimTarget = new THREE.Vector3(16, 15, 22);
        lookAnimTarget = new THREE.Vector3(0, 1.0, 0);
      } else if (preset === 'south') {
        camAnimTarget = new THREE.Vector3(0, 8, 24);
        lookAnimTarget = new THREE.Vector3(0, 1.5, 0);
      } else {
        camAnimTarget = new THREE.Vector3(0, 32, 0.1);
        lookAnimTarget = new THREE.Vector3(0, 0, 0);
      }
      requestRender();
    };

    sceneRefs.current = {
      requestRender,
      updateSun,
      updateSelectedLot,
      setCameraPreset,
    };

    updateSun(sunTimeHour);
    updateSelectedLot(selectedLotId);

    // Raycast click on lot pads
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const lotId = hits[0].object.userData.lotId as SiteLotId | undefined;
        if (lotId) {
          onSelectLotRef.current(lotId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

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
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      terrainGeo.dispose();
      terrainMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    sceneRefs.current?.updateSun(sunTimeHour);
  }, [sunTimeHour]);

  useEffect(() => {
    sceneRefs.current?.updateSelectedLot(selectedLotId);
  }, [selectedLotId]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-xl overflow-hidden border border-slate-200 bg-sky-50">
      <div ref={containerRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-white text-sm">
          3D 그래픽 컨텍스트를 복구하는 중입니다...
        </div>
      )}

      {/* Top-Left Minimal Viewport Label */}
      <div className="absolute top-3 left-3 pointer-events-none bg-slate-900/80 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
        국화리 저수지 일대 3D 지형 모델 · 클릭하여 대지 구역 선택
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1 px-3 py-1 rounded-t-lg bg-slate-900/85 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          {dockCollapsed ? '시점 제어 열기' : '시점 제어 접기'}
        </button>
        {!dockCollapsed && (
          <div className="flex items-center gap-1.5 bg-slate-900/85 text-white px-2.5 py-1.5 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => sceneRefs.current?.setCameraPreset('overview')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              입체 조망
            </button>
            <button
              type="button"
              onClick={() => sceneRefs.current?.setCameraPreset('south')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              남향 정면
            </button>
            <button
              type="button"
              onClick={() => sceneRefs.current?.setCameraPreset('top')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              항공 평면
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
