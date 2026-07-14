import { Road, getCurve, C } from './Road';
import { Car } from './Car';
import { CameraRig } from './CameraRig';
import { Roadblock } from './Roadblock';
import { useGameStore } from '../state/useGameStore';

export function Scene() {
  const progress = useGameStore(s => s.progress);
  const steer = useGameStore(s => s.steer);
  const curve = getCurve();
  if (!curve) return null;

  const carPt = curve.getPointAt(progress);
  const carTan = curve.getTangentAt(progress).normalize();
  const perpX = carTan.z;
  const perpZ = -carTan.x;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 15, 10]} intensity={1.2} castShadow shadow-mapSize={[512, 512]} />
      <hemisphereLight args={['#8899AA', '#223344', 0.4]} />
      <fog attach="fog" args={[C.bg, 20, 80]} />

      <Road />

      <group position={[carPt.x + perpX * steer, carPt.y, carPt.z + perpZ * steer]}>
        <Car steer={steer} />
      </group>

      <Roadblock />
      <CameraRig />
    </>
  );
}
