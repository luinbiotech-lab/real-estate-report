import { useEffect, useMemo, useRef } from 'react';
import { Alert, Box } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SpatialPropertySpace } from '../../domain/propertyDataRoom/spatialMediaModel';

type NormalizedRect = { x: number; y: number; width: number; height: number };

type MappedSpace = { space: SpatialPropertySpace; rect: NormalizedRect; widthM?: number; depthM?: number; scaleVerified: boolean };

function rectFromSpace(space: SpatialPropertySpace): NormalizedRect | undefined {
  const geometry = space.geometry2d;
  if (!geometry || geometry.type !== 'normalized_rect' || geometry.coordinateSpace !== 'floor_plan_image') return undefined;
  const x = Number(geometry.x);
  const y = Number(geometry.y);
  const width = Number(geometry.width);
  const height = Number(geometry.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

export default function ThreeSchematicSpaceViewer({
  spaces,
  height = 420,
}: {
  spaces: SpatialPropertySpace[];
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapped = useMemo(() => spaces.map((space) => {
    const rect = rectFromSpace(space);
    if (!rect) return undefined;
    const estimated = space.estimatedGeometry3d;
    const widthM = Number(estimated?.widthM);
    const depthM = Number(estimated?.depthM);
    const scaleVerified = estimated?.scaleVerified === true && widthM > 0 && depthM > 0;
    return { space, rect, widthM: scaleVerified ? widthM : undefined, depthM: scaleVerified ? depthM : undefined, scaleVerified } as MappedSpace;
  }).filter((item): item is MappedSpace => Boolean(item)), [spaces]);
  const calibrated = mapped.length > 0 && mapped.every((item) => item.scaleVerified);
  const planSize = useMemo(() => {
    if (!calibrated) return undefined;
    const first = mapped[0];
    const widthM = first.widthM! / first.rect.width;
    const depthM = first.depthM! / first.rect.height;
    return Number.isFinite(widthM) && Number.isFinite(depthM) && widthM > 0 && depthM > 0 ? { widthM, depthM } : undefined;
  }, [calibrated, mapped]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mapped.length) return;

    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f7f9);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8794, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(2, 3, 2);
    key.castShadow = true;
    scene.add(key);

    const baseWidth = planSize?.widthM ?? 1;
    const baseDepth = planSize?.depthM ?? 1;
    const maxPlanDim = Math.max(baseWidth, baseDepth, 1);
    const visualHeight = calibrated ? Math.max(0.15, Math.min(0.6, maxPlanDim * 0.04)) : 0.12;

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(baseWidth * 1.04, calibrated ? 0.04 : 0.02, baseDepth * 1.04),
      new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.9 }),
    );
    floor.position.y = calibrated ? -0.02 : -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    const palette = [0xb8c5d6, 0xd5c7b8, 0xbfcfbd, 0xd5bfd0, 0xc9c3dd, 0xd5d1b7];
    mapped.forEach(({ space, rect, widthM, depthM }, index) => {
      const boxHeight = visualHeight + Math.min(index, 6) * visualHeight * 0.03;
      const boxWidth = calibrated ? widthM! : rect.width;
      const boxDepth = calibrated ? depthM! : rect.height;
      const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
      const material = new THREE.MeshStandardMaterial({
        color: palette[index % palette.length],
        roughness: 0.72,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const positionX = calibrated
        ? (rect.x + rect.width / 2) * baseWidth - baseWidth / 2
        : rect.x + rect.width / 2 - 0.5;
      const positionZ = calibrated
        ? (rect.y + rect.height / 2) * baseDepth - baseDepth / 2
        : rect.y + rect.height / 2 - 0.5;
      mesh.position.set(positionX, boxHeight / 2, positionZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { spaceId: space.id, spaceName: space.spaceName };
      scene.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x5f6b7a }),
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    });

    const gridSize = Math.max(baseWidth, baseDepth);
    const grid = new THREE.GridHelper(gridSize, 10, 0xa6afba, 0xd9dee5);
    grid.position.y = 0.001;
    scene.add(grid);

    const fitDistance = Math.max(gridSize * 1.35, calibrated ? 4 : 1.35);
    camera.position.set(fitDistance, fitDistance * 0.8, fitDistance);
    camera.near = Math.max(gridSize / 1000, 0.01);
    camera.far = Math.max(gridSize * 100, 1000);
    camera.updateProjectionMatrix();
    controls.target.set(0, visualHeight / 2, 0);
    controls.update();

    const resize = () => {
      const width = Math.max(host.clientWidth, 320);
      const actualHeight = Math.max(host.clientHeight, height);
      renderer.setSize(width, actualHeight, false);
      camera.aspect = width / actualHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
        if (object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [calibrated, height, mapped, planSize]);

  if (!mapped.length) return null;

  return <Box>
    <Alert severity={calibrated ? "info" : "warning"} sx={{ mb: 1.25 }}>
      {calibrated
        ? `평면 길이 축척은 검증되어 XY 치수는 meter scale로 표시합니다. 높이·벽두께는 아직 미확정이며, 공간 박스 자체는 수동 매핑 후보이므로 실측 BIM/법정면적으로 사용하지 않습니다.`
        : '이 3D는 raster 도면의 수동 공간 박스를 unitless로 extrusion한 검토용 모델입니다. 축척·층고·벽두께가 검증되기 전에는 실측 3D/BIM으로 사용하지 않습니다.'}
    </Alert>
    <Box ref={hostRef} sx={{ height, minHeight: height, border: '1px solid #dce2ea', borderRadius: 2, overflow: 'hidden', bgcolor: '#f6f7f9' }} />
  </Box>;
}
