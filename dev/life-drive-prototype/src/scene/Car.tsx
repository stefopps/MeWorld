import { useRef } from 'react';
import { C } from './Road';

const LANE_HALF = 1.0;
const BODY_W = 1.0, BODY_L = 2.2, BODY_H = 0.5;
const CABIN_W = 0.85, CABIN_L = 1.1, CABIN_H = 0.4;
const WHEEL_R = 0.3, WHEEL_T = 0.2;

export function Car({ steer }: { steer: number }) {
  const ref = useRef<THREE.Group>(null!);

  return (
    <group ref={ref} position={[steer * LANE_HALF, 0.35, 0]} rotation-z={steer * 0.18}>
      {/* Body */}
      <mesh position={[0, BODY_H / 2, 0]} castShadow>
        <boxGeometry args={[BODY_W, BODY_H, BODY_L]} />
        <meshStandardMaterial color={C.carBody} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, BODY_H + CABIN_H / 2, -0.15]} castShadow>
        <boxGeometry args={[CABIN_W, CABIN_H, CABIN_L]} />
        <meshStandardMaterial color={C.carWindow} roughness={0.2} metalness={0.6} />
      </mesh>

      {/* Windshield */}
      <mesh position={[0, BODY_H + 0.1, CABIN_L / 2 - 0.05]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[CABIN_W - 0.05, 0.35]} />
        <meshStandardMaterial color={C.carWindow} roughness={0.1} metalness={0.8} side={2} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.3, 0.25, BODY_L / 2]}>
        <circleGeometry args={[0.12, 8]} />
        <meshBasicMaterial color="#FFE" />
      </mesh>
      <mesh position={[0.3, 0.25, BODY_L / 2]}>
        <circleGeometry args={[0.12, 8]} />
        <meshBasicMaterial color="#FFE" />
      </mesh>

      {/* Wheels */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <group key={i} position={[sx * (BODY_W / 2 + 0.1), 0, sz * (BODY_L / 2 - 0.35)]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[WHEEL_T * 0.85, WHEEL_T * 0.85, WHEEL_R, 20]} />
            <meshStandardMaterial color={C.wheelTire} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[WHEEL_T * 0.6, WHEEL_T * 0.6, WHEEL_R + 0.05, 16]} />
            <meshStandardMaterial color="#FFF" roughness={0.4} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Bumpers */}
      <mesh position={[0, 0.15, BODY_L / 2 + 0.05]}>
        <boxGeometry args={[BODY_W, 0.1, 0.08]} />
        <meshStandardMaterial color="#555" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.15, -BODY_L / 2 - 0.05]}>
        <boxGeometry args={[BODY_W, 0.1, 0.08]} />
        <meshStandardMaterial color="#555" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}
