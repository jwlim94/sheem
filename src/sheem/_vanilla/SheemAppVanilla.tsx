import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * SheemApp.tsx (R3F) 의 vanilla Three.js 버전.
 * 학습용 참조 — R3F가 내부에서 무엇을 자동화해주는지 확인용.
 */
export function SheemAppVanilla() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene — R3F의 <Canvas> 자식 트리
    const scene = new THREE.Scene();

    // Camera — R3F의 <Canvas camera={{ position, fov }}>
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Renderer — R3F의 <Canvas> 자체
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights — <ambientLight />, <directionalLight />
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(10, 10, 5);
    scene.add(directional);

    // Plane mesh — <mesh><planeGeometry /><meshStandardMaterial /></mesh>
    const geometry = new THREE.PlaneGeometry(50, 50);
    const material = new THREE.MeshStandardMaterial({ color: 0x2a2a3e });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Grid — <gridHelper args={[50, 50, '#444', '#333']} />
    const grid = new THREE.GridHelper(50, 50, 0x444444, 0x333333);
    scene.add(grid);

    // Render loop — R3F는 useFrame / 자동 raf로 처리
    let frameId: number;
    const tick = () => {
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    tick();

    // Resize — R3F 자동 처리
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup — R3F unmount 시 자동 dispose
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="w-screen h-screen" />;
}
