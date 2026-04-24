import { Canvas } from '@react-three/fiber';
import { Cloud, Clouds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Leva } from 'leva';
import { Lights } from './Lights';
import { GradientSky } from './GradientSky';
import { ProceduralTerrain } from './ProceduralTerrain';

export function Playground() {
  return (
    <div className="w-screen h-screen">
      <Leva collapsed={false} />
      <Canvas camera={{ position: [0, 5, 20], fov: 60, far: 3000 }}>
        <color attach="background" args={['#87CEEB']} />
        <Lights />
        <GradientSky />
        <Clouds material={THREE.MeshBasicMaterial} limit={1000}>
          {/* ── 큰 구름 (8개) — 넓고 두꺼움 ── */}
          <Cloud position={[-400, 120, -600]} segments={35} bounds={[60, 8, 25]} volume={20} opacity={0.5} speed={0.03} fade={800} color="white" />
          <Cloud position={[500, 140, 400]} segments={32} bounds={[50, 6, 20]} volume={18} opacity={0.45} speed={0.04} fade={800} color="white" />
          <Cloud position={[0, 130, -800]} segments={34} bounds={[55, 7, 22]} volume={19} opacity={0.5} speed={0.035} fade={800} color="white" />
          <Cloud position={[-700, 135, 300]} segments={30} bounds={[48, 6, 18]} volume={17} opacity={0.45} speed={0.04} fade={800} color="white" />
          <Cloud position={[800, 125, -400]} segments={32} bounds={[52, 7, 20]} volume={18} opacity={0.48} speed={0.035} fade={800} color="white" />
          <Cloud position={[300, 145, 700]} segments={30} bounds={[45, 6, 18]} volume={16} opacity={0.45} speed={0.04} fade={800} color="white" />
          <Cloud position={[-600, 130, -300]} segments={28} bounds={[42, 5, 16]} volume={15} opacity={0.42} speed={0.045} fade={800} color="white" />
          <Cloud position={[600, 120, -700]} segments={30} bounds={[48, 6, 19]} volume={17} opacity={0.46} speed={0.038} fade={800} color="white" />
          {/* ── 중간 구름 (16개) — 사방에 분포 ── */}
          <Cloud position={[300, 100, -300]} segments={22} bounds={[30, 4, 12]} volume={12} opacity={0.45} speed={0.06} fade={600} color="white" />
          <Cloud position={[-600, 110, 200]} segments={20} bounds={[25, 4, 10]} volume={10} opacity={0.4} speed={0.05} fade={600} color="white" />
          <Cloud position={[150, 95, 600]} segments={22} bounds={[28, 4, 11]} volume={11} opacity={0.4} speed={0.07} fade={600} color="white" />
          <Cloud position={[-250, 115, -500]} segments={18} bounds={[22, 3, 9]} volume={9} opacity={0.45} speed={0.06} fade={600} color="white" />
          <Cloud position={[700, 105, -100]} segments={20} bounds={[25, 4, 10]} volume={10} opacity={0.4} speed={0.055} fade={600} color="white" />
          <Cloud position={[-800, 100, -600]} segments={18} bounds={[24, 3, 10]} volume={10} opacity={0.42} speed={0.06} fade={600} color="white" />
          <Cloud position={[400, 108, 350]} segments={20} bounds={[26, 4, 10]} volume={11} opacity={0.38} speed={0.065} fade={600} color="white" />
          <Cloud position={[-100, 112, 800]} segments={22} bounds={[28, 4, 11]} volume={11} opacity={0.4} speed={0.055} fade={600} color="white" />
          <Cloud position={[850, 98, 500]} segments={18} bounds={[22, 3, 9]} volume={9} opacity={0.42} speed={0.07} fade={600} color="white" />
          <Cloud position={[-500, 105, 600]} segments={20} bounds={[25, 4, 10]} volume={10} opacity={0.38} speed={0.06} fade={600} color="white" />
          <Cloud position={[200, 110, -700]} segments={18} bounds={[24, 3, 10]} volume={10} opacity={0.4} speed={0.065} fade={600} color="white" />
          <Cloud position={[-850, 102, -100]} segments={20} bounds={[26, 4, 10]} volume={11} opacity={0.42} speed={0.055} fade={600} color="white" />
          <Cloud position={[550, 95, -550]} segments={18} bounds={[22, 3, 9]} volume={9} opacity={0.38} speed={0.07} fade={600} color="white" />
          <Cloud position={[-300, 108, -800]} segments={20} bounds={[25, 4, 10]} volume={10} opacity={0.4} speed={0.06} fade={600} color="white" />
          <Cloud position={[0, 100, 400]} segments={22} bounds={[28, 4, 11]} volume={11} opacity={0.42} speed={0.055} fade={600} color="white" />
          <Cloud position={[-700, 112, 700]} segments={18} bounds={[24, 3, 10]} volume={10} opacity={0.38} speed={0.065} fade={600} color="white" />
          {/* ── 작은 구름 (12개) — 얇고 가벼움 ── */}
          <Cloud position={[100, 80, -150]} segments={8} bounds={[12, 2, 6]} volume={5} opacity={0.3} speed={0.12} fade={400} color="white" />
          <Cloud position={[-200, 75, 350]} segments={7} bounds={[10, 2, 4]} volume={4} opacity={0.25} speed={0.15} fade={400} color="white" />
          <Cloud position={[450, 85, 250]} segments={9} bounds={[14, 2, 7]} volume={6} opacity={0.3} speed={0.1} fade={400} color="white" />
          <Cloud position={[-500, 90, -200]} segments={8} bounds={[12, 2, 5]} volume={5} opacity={0.28} speed={0.13} fade={400} color="white" />
          <Cloud position={[750, 78, 150]} segments={7} bounds={[10, 2, 4]} volume={4} opacity={0.25} speed={0.14} fade={400} color="white" />
          <Cloud position={[-150, 82, -650]} segments={9} bounds={[13, 2, 6]} volume={5} opacity={0.28} speed={0.11} fade={400} color="white" />
          <Cloud position={[350, 88, 550]} segments={8} bounds={[11, 2, 5]} volume={5} opacity={0.26} speed={0.13} fade={400} color="white" />
          <Cloud position={[-650, 76, 450]} segments={7} bounds={[10, 2, 4]} volume={4} opacity={0.24} speed={0.15} fade={400} color="white" />
          <Cloud position={[600, 84, -250]} segments={8} bounds={[12, 2, 5]} volume={5} opacity={0.28} speed={0.12} fade={400} color="white" />
          <Cloud position={[-400, 80, -400]} segments={9} bounds={[13, 2, 6]} volume={5} opacity={0.3} speed={0.11} fade={400} color="white" />
          <Cloud position={[200, 78, 800]} segments={7} bounds={[10, 2, 4]} volume={4} opacity={0.25} speed={0.14} fade={400} color="white" />
          <Cloud position={[-800, 86, 100]} segments={8} bounds={[11, 2, 5]} volume={5} opacity={0.27} speed={0.13} fade={400} color="white" />
          {/* ── 클러스터 3그룹 (9개) ── */}
          <Cloud position={[-350, 100, 500]} segments={12} bounds={[16, 3, 8]} volume={8} opacity={0.35} speed={0.08} fade={500} color="white" />
          <Cloud position={[-320, 90, 480]} segments={10} bounds={[12, 2, 6]} volume={6} opacity={0.3} speed={0.09} fade={500} color="white" />
          <Cloud position={[-380, 105, 520]} segments={8} bounds={[10, 2, 5]} volume={5} opacity={0.28} speed={0.1} fade={500} color="white" />
          <Cloud position={[650, 95, 300]} segments={12} bounds={[16, 3, 8]} volume={8} opacity={0.35} speed={0.08} fade={500} color="white" />
          <Cloud position={[680, 88, 280]} segments={10} bounds={[12, 2, 6]} volume={6} opacity={0.3} speed={0.09} fade={500} color="white" />
          <Cloud position={[630, 100, 330]} segments={8} bounds={[10, 2, 5]} volume={5} opacity={0.28} speed={0.1} fade={500} color="white" />
          <Cloud position={[-100, 92, -450]} segments={12} bounds={[16, 3, 8]} volume={8} opacity={0.35} speed={0.08} fade={500} color="white" />
          <Cloud position={[-70, 85, -470]} segments={10} bounds={[12, 2, 6]} volume={6} opacity={0.3} speed={0.09} fade={500} color="white" />
          <Cloud position={[-130, 98, -430]} segments={8} bounds={[10, 2, 5]} volume={5} opacity={0.28} speed={0.1} fade={500} color="white" />
        </Clouds>
        <ProceduralTerrain />
        <OrbitControls target={[0, 0, -20]} maxPolarAngle={Math.PI / 2.15} />
      </Canvas>
    </div>
  );
}
