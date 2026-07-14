import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getCurve, C } from './Road';
import { useGameStore } from '../state/useGameStore';

const BLOCK_POINT = 0.6;
const ACTIVATION = 100;

export function Roadblock() {
  const blocked = useGameStore(s => s.blocked);
  const resolved = useGameStore(s => s.resolved);
  const metabolites = useGameStore(s => s.metabolites);
  const curve = getCurve();
  const fill = metabolites / ACTIVATION;

  const pos = useMemo(() => {
    if (!curve) return new THREE.Vector3();
    return curve.getPointAt(BLOCK_POINT).clone();
  }, [curve]);

  if (resolved && !blocked && metabolites === 0) {
    return null;
  }

  const barrierScale = 1 - fill * 0.7;
  const barrierWidth = 5.5 * (1 - fill * 0.55);

  return (
    <group position={[pos.x, pos.y + 0.3, pos.z]}>
      {(!resolved || blocked) && (
        <group scale={[barrierWidth / 5.5, barrierScale, 1]}>
          <mesh>
            <boxGeometry args={[5.5, 1.2, 0.3]} />
            <meshStandardMaterial
              color={C.pool}
              roughness={0.5}
              metalness={0.2}
              transparent
              opacity={barrierScale}
            />
          </mesh>
          {[-1.6, -0.4, 0.8, 2.0].map((sx, i) => (
            <mesh key={i} position={[sx, 0, 0.16]}>
              <boxGeometry args={[0.8, 0.7, 0.02]} />
              <meshBasicMaterial color="#FFF" opacity={0.3 * barrierScale} transparent />
            </mesh>
          ))}
        </group>
      )}

      {blocked && (
        <Html position={[0, 3, 0]} center transform style={{ pointerEvents: 'auto' }}>
          <div style={{
            background: 'rgba(38,38,38,0.55)', backdropFilter: 'blur(18px)',
            borderRadius: 18, padding: '20px 28px', textAlign: 'center',
            fontFamily: 'Inter,sans-serif', color: '#FFF',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            fontSize: 14,
          }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#46DC96', marginBottom: 6 }}>
              {Math.round(metabolites)} / {ACTIVATION}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Hold W to break through
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
