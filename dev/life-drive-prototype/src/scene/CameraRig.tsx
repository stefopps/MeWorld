import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getCurve } from './Road';
import { useGameStore } from '../state/useGameStore';

export function CameraRig() {
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const { gl } = useThree();
  const canvas = gl.domElement;

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      const s = useGameStore.getState();
      panStart.current = { x: e.clientX, y: e.clientY, panX: s.camPanX, panY: s.camPanY };
      canvas.style.cursor = 'grabbing';
    }
  });
  window.addEventListener('pointermove', e => {
    if (!isPanning.current) return;
    const dx = (e.clientX - panStart.current.x) * 0.02;
    const dy = (e.clientY - panStart.current.y) * 0.02;
    useGameStore.getState().setCamPan(panStart.current.panX + dx, panStart.current.panY - dy);
  });
  window.addEventListener('pointerup', () => { isPanning.current = false; canvas.style.cursor = ''; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const s = useGameStore.getState();
    const z = s.camZoomTarget ? s.camZoomTarget : s.camZoom;
    // We store zoom separately for 3D vs engine
  }, { passive: false });

  useFrame(state => {
    const s = useGameStore.getState();
    const curve = getCurve();
    if (!curve) return;
    const { progress, speed, camPanX, camPanY } = s;
    const pt = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    const ahead = curve.getPointAt(Math.min(1, progress + 0.02));
    const bob = Math.sin(Date.now() * 0.0025) * (speed || 0.12) * 0.06;

    const pos = pt.clone()
      .add(tan.clone().multiplyScalar(-4.5))
      .add(new THREE.Vector3(0, 3.8, 0))
      .add(new THREE.Vector3(camPanX, 0, camPanY));
    pos.y += bob;

    state.camera.position.copy(pos);
    state.camera.lookAt(ahead.add(new THREE.Vector3(camPanX, 0.8, camPanY)));
  });

  return null;
}
