export function Lights() {
  return (
    <>
      {/* Ambient Light - 전체적으로 균일한 빛 (그림자 없음) */}
      <ambientLight intensity={0.3} />

      {/* Directional Light - 태양처럼 평행하게 내리쬐는 빛 */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        color="white"
      />

      {/* Point Light - 전구처럼 한 점에서 퍼지는 빛 */}
      <pointLight position={[-3, 3, -3]} intensity={0.5} color="yellow" />

      {/* Spot Light - 스포트라이트 (원뿔 모양) */}
      <spotLight
        position={[3, 5, 0]}
        angle={0.3}
        penumbra={0.5}
        intensity={0.8}
        color="cyan"
      />
    </>
  );
}
