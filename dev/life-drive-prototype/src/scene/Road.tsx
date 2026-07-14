import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../state/useGameStore';

export const C = {
  bg: '#262626', road: '#46DC96', pool: '#E05040',
  carBody: '#3A3A3A', carWindow: '#1A1A1A', wheel: '#DDDDDD', wheelTire: '#1A1A1A',
} as const;

const ROAD_HALF = 2.2;

export function getCurve(): THREE.CatmullRomCurve3 | null {
  const { splines, splineIndex } = useGameStore.getState();
  const wp = splines[splineIndex]?.waypoints;
  if (!wp || wp.length < 2) return null;
  return new THREE.CatmullRomCurve3(
    wp.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false, 'catmullrom', 0.5,
  );
}

export function Road() {
  const splines = useGameStore(s => s.splines);
  const splineIdx = useGameStore(s => s.splineIndex);
  const sp = splines[splineIdx];
  const wps = sp?.waypoints ?? [];
  const roadColor = sp?.color ?? C.road;

  const curve = useMemo(() => {
    if (wps.length < 2) return null;
    return new THREE.CatmullRomCurve3(
      wps.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false, 'catmullrom', 0.5,
    );
  }, [wps]);

  const ribbon = useMemo(() => {
    if (!curve) return null;
    const segs = 500;
    const verts: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const px = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      verts.push(pt.x - px.x * ROAD_HALF, pt.y, pt.z - px.z * ROAD_HALF);
      verts.push(pt.x + px.x * ROAD_HALF, pt.y, pt.z + px.z * ROAD_HALF);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices); g.computeVertexNormals();
    return g;
  }, [curve]);

  const edges = useMemo(() => {
    if (!curve) return null;
    const L: THREE.Vector3[] = [], R: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.004) {
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const px = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
      L.push(new THREE.Vector3(pt.x - px.x * ROAD_HALF, pt.y + 0.015, pt.z - px.z * ROAD_HALF));
      R.push(new THREE.Vector3(pt.x + px.x * ROAD_HALF, pt.y + 0.015, pt.z + px.z * ROAD_HALF));
    }
    return { left: new THREE.CatmullRomCurve3(L), right: new THREE.CatmullRomCurve3(R) };
  }, [curve]);

  if (!ribbon || !edges) return null;

  return (
    <group>
      <mesh geometry={ribbon} receiveShadow>
        <meshStandardMaterial color={roadColor} metalness={0} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh><tubeGeometry args={[edges.left, 200, 0.05, 4, false]} /><meshBasicMaterial color="#1A1A1A" opacity={0.25} transparent /></mesh>
      <mesh><tubeGeometry args={[edges.right, 200, 0.05, 4, false]} /><meshBasicMaterial color="#1A1A1A" opacity={0.25} transparent /></mesh>
    </group>
  );
}
