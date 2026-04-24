import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

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

    // PointerLockControls — R3F의 <PointerLockControls />
    // Drei 버전도 내부적으로 이걸 감싼 것
    const controls = new PointerLockControls(camera, renderer.domElement);
    // 클릭 시 포인터 락 — Drei는 Canvas 클릭 시 자동
    const handleCanvasClick = () => controls.lock();
    renderer.domElement.addEventListener('click', handleCanvasClick);

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

    // Reference boxes — R3F의 <ReferenceBoxes />
    const boxPositions: [number, number, number][] = [
      [10, 1, 0],
      [-10, 1, 0],
      [0, 1, 10],
      [0, 1, -10],
      [7, 1, 7],
      [-7, 1, -7],
    ];
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7fff });
    const boxes: THREE.Mesh[] = [];
    boxPositions.forEach(([x, y, z]) => {
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(x, y, z);
      scene.add(box);
      boxes.push(box);
    });

    // Keyboard state — R3F는 <KeyboardControls> + useKeyboardControls() 훅이 대신 처리
    const keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Delta time 계산용 Clock — R3F의 useFrame 콜백 인자인 delta와 동일
    const clock = new THREE.Clock();
    const MOVE_SPEED = 10;

    // 매 프레임 재사용할 벡터 — R3F에선 useRef로 보관
    const forwardVec = new THREE.Vector3();
    const rightVec = new THREE.Vector3();

    // Render loop — R3F는 useFrame / 자동 raf로 처리
    let frameId: number;
    const tick = () => {
      const delta = clock.getDelta();

      // 카메라 방향 기반 이동 — R3F의 CameraRig와 동일 로직
      camera.getWorldDirection(forwardVec);
      forwardVec.y = 0;
      forwardVec.normalize();
      rightVec.crossVectors(forwardVec, camera.up).normalize();

      const step = MOVE_SPEED * delta;
      if (keys.forward) camera.position.addScaledVector(forwardVec, step);
      if (keys.backward) camera.position.addScaledVector(forwardVec, -step);
      if (keys.right) camera.position.addScaledVector(rightVec, step);
      if (keys.left) camera.position.addScaledVector(rightVec, -step);

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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      boxGeometry.dispose();
      boxMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="w-screen h-screen" />;
}
