import { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function ThreeGlbViewer({
  modelUrl,
  title,
  height = 420,
}: {
  modelUrl: string;
  title?: string;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !modelUrl) return;

    let disposed = false;
    let animationFrame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fa);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    camera.position.set(4, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(6, 10, 7);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.4);
    fill.position.set(-6, 4, -5);
    scene.add(fill);

    const grid = new THREE.GridHelper(20, 20, 0xb7c0cc, 0xd9dfe7);
    grid.position.y = -0.001;
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

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        scene.add(root);

        root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const distance = maxDim * 1.8;
        camera.position.set(distance, distance * 0.75, distance);
        camera.near = Math.max(maxDim / 1000, 0.01);
        camera.far = Math.max(maxDim * 100, 1000);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        setLoading(false);
      },
      undefined,
      (reason) => {
        if (disposed) return;
        setLoading(false);
        setError(reason instanceof Error ? reason.message : 'GLB/GLTF 모델을 불러오지 못했습니다.');
      },
    );

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [height, modelUrl]);

  return <Box>
    {title && <Box sx={{ mb: 1, fontWeight: 700 }}>{title}</Box>}
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    <Box sx={{ position: 'relative', minHeight: height, border: '1px solid #dce2ea', borderRadius: 2, overflow: 'hidden', bgcolor: '#f5f7fa' }}>
      <Box ref={hostRef} sx={{ width: '100%', height }} />
      {loading && !error && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(245,247,250,0.72)' }}>
        <Box sx={{ textAlign: 'center' }}><CircularProgress size={30} /><div style={{ marginTop: 8 }}>GLB 모델 로딩 중…</div></Box>
      </Box>}
    </Box>
  </Box>;
}
