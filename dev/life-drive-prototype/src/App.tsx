import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './scene/Scene';
import { GameEngine } from './engine/GameEngine';
import { useGameStore } from './state/useGameStore';

function Controls() {
  const splines = useGameStore(s => s.splines);
  const splineIdx = useGameStore(s => s.splineIndex);
  const viewMode = useGameStore(s => s.viewMode);
  const setSpline = useGameStore(s => s.setSpline);
  const setViewMode = useGameStore(s => s.setViewMode);
  const blocked = useGameStore(s => s.blocked);
  const metabolites = useGameStore(s => s.metabolites);

  const btn: React.CSSProperties = {
    padding: '5px 14px', borderRadius: 999,
    fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif',
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
    transition: 'all .2s',
  };

  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 50,
      display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
    }}>
      <button onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')} style={{
        ...btn,
        padding: '6px 18px', fontSize: 12, fontWeight: 700,
        borderColor: viewMode === '2d' ? '#46DC96' : 'rgba(255,255,255,0.3)',
        background: viewMode === '2d' ? '#46DC96' : 'rgba(255,255,255,0.08)',
        color: viewMode === '2d' ? '#1A1A17' : '#FFF',
      }}>
        {viewMode === '2d' ? '2D Drive' : '3D View'}
      </button>

      <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 4px', alignSelf: 'stretch' }} />

      {splines.map((sp, i) => (
        <button key={i} onClick={() => setSpline(i)} style={{
          ...btn,
          borderColor: i === splineIdx ? sp.color : 'rgba(255,255,255,0.15)',
          background: i === splineIdx ? sp.color : 'rgba(255,255,255,0.06)',
          color: i === splineIdx ? '#1A1A17' : 'rgba(255,255,255,0.5)',
        }}>
          {sp.name}
        </button>
      ))}

      {blocked && (
        <span style={{
          ...btn,
          color: '#46DC96', fontWeight: 700,
          borderColor: 'rgba(70,220,150,0.3)',
          background: 'rgba(70,220,150,0.1)',
          cursor: 'default',
        }}>
          {Math.round(metabolites)}%
        </span>
      )}
    </div>
  );
}

export default function App() {
  const viewMode = useGameStore(s => s.viewMode);
  const setViewMode = useGameStore(s => s.setViewMode);

  // Tab toggles 2D/3D
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const vm = useGameStore.getState().viewMode;
        setViewMode(vm === '2d' ? '3d' : '2d');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setViewMode]);

  return (
    <>
      {/* Engine ALWAYS mounted — drives the sim loop, syncs to store */}
      <GameEngine />

      {viewMode === '3d' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2, background: '#262626' }}>
          <Canvas camera={{ position: [0, 8, 8], fov: 55 }} shadows gl={{ antialias: true }}>
            <Scene />
          </Canvas>
        </div>
      )}

      <Controls />

      <div id="keys" style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
        display: 'flex', gap: 8, alignItems: 'center', padding: '10px 18px',
        background: 'rgba(38,38,38,0.5)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, pointerEvents: 'none',
        fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2px',
      }}>
        <b>Tab</b> toggle view <span>·</span>
        <b>W</b>/<b>S</b> drive <span>·</span>
        <b>A</b>/<b>D</b> steer <span>·</span>
        hold <b>W</b> at block <span>·</span>
        <b>Q</b>/<b>E</b> cam <span>·</span>
        <b>scroll</b> zoom <span>·</span>
        <b>R</b> reset cam
      </div>
    </>
  );
}
