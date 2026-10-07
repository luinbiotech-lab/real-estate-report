import { useEffect, useMemo, useRef } from 'react';
import { Alert, Box } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SpatialPropertySpace } from '../../domain/propertyDataRoom/spatialMediaModel';

type NormalizedRect = { x: number; y: number; width: number; height: number };

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
  const mapped = useMemo(() => spaces.map((space) => ({ space, rect: rectFromSpace(space) })).filter((item): item is { space: SpatialPropertySpace; rect: NormalizedRect } => Boolean(item.rect)), [spaces]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mapped.length) return;

    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f7f9);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
    camera.position.set(1.35, 1.15, 1.45);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.08, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8794, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(2, 3, 2);
    key.castShadow = true;
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(1.04, 0.02, 1.04),
      new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.9 }),
    );
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const palette = [0xb8c5d6, 0xd5c7b8, 0xbfcfbd, 0xd5bfd0, 0xc9c3dd, 0xd5d1b7];
    mapped.forEach(({ space, rect }, index) => {
      const boxHeight = 0.12 + Math.min(index, 6) * 0.006;
      const geometry = new THREE.BoxGeometry(rect.width, boxHeight, rect.height);
      const material = new THREE.MeshStandardMaterial({
        color: palette[index % palette.length],
        roughness: 0.72,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(rect.x + rect.width / 2 - 0.5, boxHeight / 2, rect.y + rect.height / 2 - 0.5);
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

    const grid = new THREE.GridHelper(1, 10, 0xa6afba, 0xd9dee5);
    grid.position.y = 0.001;
    scene.add(grid);

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
  }, [height, mapped]);

  if (!mapped.length) return null;

  return <Box>
    <Alert severity="warning" sx={{ mb: 1.25 }}>
      이 3D는 raster 도면의 수동 공간 박스를 unitless로 extrusion한 검토용 모델입니다. 축척·층고·벽두께가 검증되기 전에는 실측 3D/BIM으로 사용하지 않습니다.
    </Alert>
    <Box ref={hostRef} sx={{ height, minHeight: height, border: '1px solid #dce2ea', borderRadius: 2, overflow: 'hidden', bgcolor: '#f6f7f9' }} />
  </Box>;
}
