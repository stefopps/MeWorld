import { useRef, useEffect } from 'react';
import { useGameStore } from '../state/useGameStore';

// ═══════════════════════════════════════════════════════════════
// Kessler's Canvas 2D engine — owns the sim loop, always running.
// Syncs state to Zustand every render frame.
// Canvas is visible in 2D mode, hidden in 3D mode (but still runs
// the sim so the 3D view gets live progress/steer/speed).
// ═══════════════════════════════════════════════════════════════

const COL = {
  road: '#46DC96', edge: 'rgba(0,0,0,0.25)', milestone: 'rgba(255,255,255,0.25)',
  body: '#3a3a3a', cabin: '#4a4a4a', windshield: 'rgba(110,160,230,0.85)',
  headlight: '#f4d35e', wheel: '#1b1b1b', hub: '#8a8a8a',
  barrier: '#c23b32', stripe: '#f2f2f2',
};
const ROAD_W = 90;
const BLOCK_T = 0.52;
const MAX_LATERAL = 30;
const SAMPLES = 1200;
const CAR_SCREEN_Y = 0.66;
const ISO_SQUASH = 0.72;
const ACTIVATION = 100;
const TIRE_SPAWN_MIN = 0.05, TIRE_SPAWN_MAX = 0.16;
const TIRE_GAIN_MIN = 3, TIRE_GAIN_MAX = 7;
const LOOP_AT = 0.98;
const BLOB_HOLD = 1.1, BLOB_FADE = 1.6;

const MILESTONES: [string, number][] = [
  ['Birth', 0.02], ['School', 0.15], ['University', 0.28], ['Career Peak', 0.41],
  ['Marriage', 0.66], ['Children', 0.80], ['Retirement', 0.96],
];

const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

interface Blob { x: number; y: number; r: number; hold: number; life: number; }

export function GameEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewMode = useGameStore(s => s.viewMode);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, DPR = 1;
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    window.addEventListener('resize', resize);
    resize();

    // ── RECONCILE STATE from store on mount (if loaded in 3D first) ──
    const initial = useGameStore.getState();

    // SPLINE BAKE
    const WAY: [number, number][] = [
      [0, 0], [140, -720], [-160, -1460], [210, -2220], [-110, -3020],
      [260, -3820], [-220, -4620], [110, -5420], [-260, -6220],
      [160, -7020], [0, -7820],
    ];
    const bakedX = new Float32Array(SAMPLES + 1);
    const bakedY = new Float32Array(SAMPLES + 1);
    const bakedA = new Float32Array(SAMPLES + 1);
    (function bake() {
      const n = WAY.length;
      const pts: [number, number][] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const u = (i / SAMPLES) * (n - 1);
        let seg = Math.floor(u), f = u - seg;
        if (seg >= n - 1) { seg = n - 2; f = 1; }
        const p0 = WAY[Math.max(seg - 1, 0)], p1 = WAY[seg],
          p2 = WAY[seg + 1], p3 = WAY[Math.min(seg + 2, n - 1)];
        pts.push([catmull(p0[0], p1[0], p2[0], p3[0], f), catmull(p0[1], p1[1], p2[1], p3[1], f)]);
        bakedX[i] = pts[i][0]; bakedY[i] = pts[i][1];
      }
      for (let i = 0; i <= SAMPLES; i++) {
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, SAMPLES)];
        bakedA[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);
      }
    })();

    function sample(t: number) {
      const u = clamp(t, 0, 1) * SAMPLES;
      const i = Math.floor(u), f = u - i, j = Math.min(i + 1, SAMPLES);
      return { x: lerp(bakedX[i], bakedX[j], f), y: lerp(bakedY[i], bakedY[j], f), a: bakedA[i] };
    }

    // STATE (restore from store if possible)
    const S = {
      progress: initial.progress,
      speed: initial.speed,
      steer: initial.steer,
      steerTarget: initial.steerTarget,
      blocked: initial.blocked,
      resolved: initial.resolved,
      metabolites: initial.metabolites,
      breakT: initial.breakT,
      checkpoint: initial.checkpoint,
      tireTimerL: 0.08, tireTimerR: 0.05,
      camRot: initial.camRot,
      camRotTarget: initial.camRotTarget,
      camZoom: initial.camZoom,
      camZoomTarget: initial.camZoomTarget,
      carAngleVis: initial.carAngleVis,
    };

    const trail: Blob[] = [];
    function spawnBlob(wx: number, wy: number, size: number) {
      trail.push({ x: wx, y: wy, r: size, hold: BLOB_HOLD, life: 1 });
      if (trail.length > 400) trail.shift();
    }
    function spawnBreakBurst() {
      const p = sample(BLOCK_T);
      const nx = Math.cos(p.a + Math.PI / 2), ny = Math.sin(p.a + Math.PI / 2);
      for (let i = 0; i < 34; i++) {
        const s = (Math.random() - 0.5) * ROAD_W;
        trail.push({ x: p.x + nx * s, y: p.y + ny * s, r: 4 + Math.random() * 7, hold: BLOB_HOLD, life: 1 });
      }
    }

    // INPUT
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key.toLowerCase() === 'r') { S.camRotTarget = 0; S.camZoomTarget = 1; }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let dragging = false, dragX = 0, dragSteer0 = 0;
    const onPDown = (e: PointerEvent) => { dragging = true; dragX = e.clientX; dragSteer0 = S.steerTarget; };
    const onPMove = (e: PointerEvent) => {
      if (!dragging) return;
      S.steerTarget = clamp(dragSteer0 + (e.clientX - dragX) / 140, -1, 1);
    };
    const onPUp = () => { dragging = false; };
    canvas.addEventListener('pointerdown', onPDown);
    window.addEventListener('pointermove', onPMove);
    window.addEventListener('pointerup', onPUp);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      S.camZoomTarget = clamp(S.camZoomTarget - e.deltaY * 0.0012, 0.55, 2.2);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // SIM
    function update(dt: number) {
      let throttle = 0;
      if (keys['w'] || keys['arrowup']) throttle += 1;
      if (keys['s'] || keys['arrowdown']) throttle -= 1;
      const targetSpeed = throttle * 0.10;
      S.speed = lerp(S.speed, targetSpeed, Math.min(dt * 4, 1));

      let next = S.progress + S.speed * dt;
      if (!S.resolved && next >= BLOCK_T) {
        next = BLOCK_T; S.blocked = true;
        if (throttle <= 0) S.speed = Math.min(S.speed, 0);
      } else if (S.blocked) { S.blocked = false; }
      S.progress = clamp(next, 0, 1);
      if (S.breakT > 0) S.breakT = Math.max(0, S.breakT - dt * 1.6);

      let steerIn = 0;
      if (keys['a'] || keys['arrowleft']) steerIn -= 1;
      if (keys['d'] || keys['arrowright']) steerIn += 1;
      if (steerIn !== 0) S.steerTarget = clamp(S.steerTarget + steerIn * dt * 3, -1, 1);
      else if (!dragging) S.steerTarget = lerp(S.steerTarget, 0, Math.min(dt * 3, 1));
      S.steer = lerp(S.steer, S.steerTarget, Math.min(dt * 8, 1));

      if (keys['q']) S.camRotTarget += dt * 0.9;
      if (keys['e']) S.camRotTarget -= dt * 0.9;
      S.camRot = lerp(S.camRot, S.camRotTarget, Math.min(dt * 5, 1));
      S.camZoom = lerp(S.camZoom, S.camZoomTarget, Math.min(dt * 6, 1));

      const p = sample(S.progress);
      const nx = Math.cos(p.a + Math.PI / 2), ny = Math.sin(p.a + Math.PI / 2);
      const fx = Math.cos(p.a), fy = Math.sin(p.a);
      const latX = p.x + nx * S.steer * MAX_LATERAL, latY = p.y + ny * S.steer * MAX_LATERAL;
      const rcx = latX - fx * 18, rcy = latY - fy * 18;
      const tireL = { x: rcx - nx * 13, y: rcy - ny * 13 };
      const tireR = { x: rcx + nx * 13, y: rcy + ny * 13 };

      if (S.blocked && throttle > 0) {
        S.tireTimerL -= dt;
        if (S.tireTimerL <= 0) {
          spawnBlob(tireL.x + (Math.random() - 0.5) * 10, tireL.y + (Math.random() - 0.5) * 10, 5 + Math.random() * 7);
          S.metabolites += TIRE_GAIN_MIN + Math.random() * (TIRE_GAIN_MAX - TIRE_GAIN_MIN);
          S.tireTimerL = TIRE_SPAWN_MIN + Math.random() * (TIRE_SPAWN_MAX - TIRE_SPAWN_MIN);
        }
        S.tireTimerR -= dt;
        if (S.tireTimerR <= 0) {
          spawnBlob(tireR.x + (Math.random() - 0.5) * 10, tireR.y + (Math.random() - 0.5) * 10, 5 + Math.random() * 7);
          S.metabolites += TIRE_GAIN_MIN + Math.random() * (TIRE_GAIN_MAX - TIRE_GAIN_MIN);
          S.tireTimerR = TIRE_SPAWN_MIN + Math.random() * (TIRE_SPAWN_MAX - TIRE_SPAWN_MIN);
        }
        if (S.metabolites >= ACTIVATION) {
          S.metabolites = ACTIVATION; S.resolved = true; S.blocked = false;
          S.breakT = 1; S.checkpoint = clamp(BLOCK_T - 0.06, 0, 1);
          spawnBreakBurst();
        }
      } else if (!S.blocked && Math.abs(S.speed) > 0.015) {
        spawnBlob(rcx, rcy, 3 + Math.abs(S.steer) * 11 + Math.random() * 1.5);
      }

      for (let i = trail.length - 1; i >= 0; i--) {
        const b = trail[i];
        if (b.hold > 0) { b.hold -= dt; }
        else { b.life -= dt / BLOB_FADE; b.r *= (1 - dt * 0.05); }
        if (b.life <= 0) trail.splice(i, 1);
      }

      if (S.progress >= LOOP_AT) {
        S.progress = S.checkpoint; S.metabolites = 0;
        S.blocked = false; S.resolved = false; S.breakT = 0;
        S.speed = 0; S.steer = 0; S.steerTarget = 0;
        trail.length = 0;
      }
    }

    // RENDER (only when in 2D mode)
    const hud = document.getElementById('hud');
    const sub = document.getElementById('sub');
    const fixedDt = 1 / 120;

    function render() {
      const vm = useGameStore.getState().viewMode;

      // Clear always (even in 3D — keeps canvas state clean)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = 'rgba(38,38,38,0.35)';

      if (vm === '2d') {
        // Full render
        ctx.fillRect(0, 0, W, H);
        const car = sample(S.progress);
        const nx = Math.cos(car.a + Math.PI / 2), ny = Math.sin(car.a + Math.PI / 2);
        const carX = car.x + nx * S.steer * MAX_LATERAL, carY = car.y + ny * S.steer * MAX_LATERAL;

        const anchorX = W / 2, anchorY = H * CAR_SCREEN_Y;
        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.scale(S.camZoom, S.camZoom);
        ctx.rotate(-car.a - Math.PI / 2 + S.camRot);
        ctx.scale(1, ISO_SQUASH);
        ctx.translate(-carX, -carY);

        const winBack = 90, winFwd = 260;
        const ci = Math.round(clamp(S.progress, 0, 1) * SAMPLES);
        const i0 = Math.max(0, ci - winBack), i1 = Math.min(SAMPLES, ci + winFwd);

        // Road ribbon
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const a = bakedA[i];
          ctx[i === i0 ? 'moveTo' : 'lineTo'](bakedX[i] + Math.cos(a + Math.PI / 2) * ROAD_W / 2, bakedY[i] + Math.sin(a + Math.PI / 2) * ROAD_W / 2);
        }
        for (let i = i1; i >= i0; i--) {
          const a = bakedA[i];
          ctx.lineTo(bakedX[i] - Math.cos(a + Math.PI / 2) * ROAD_W / 2, bakedY[i] - Math.sin(a + Math.PI / 2) * ROAD_W / 2);
        }
        ctx.closePath(); ctx.fillStyle = COL.road; ctx.fill();

        // Edge lines
        ctx.lineWidth = 2; ctx.strokeStyle = COL.edge;
        for (const side of [1, -1]) {
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const a = bakedA[i];
            ctx[i === i0 ? 'moveTo' : 'lineTo'](
              bakedX[i] + Math.cos(a + Math.PI / 2) * side * ROAD_W / 2,
              bakedY[i] + Math.sin(a + Math.PI / 2) * side * ROAD_W / 2,
            );
          }
          ctx.stroke();
        }

        // Milestones
        ctx.fillStyle = COL.milestone; ctx.font = '600 22px Inter';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const [name, t] of MILESTONES) {
          const mi = Math.round(t * SAMPLES);
          if (mi < i0 || mi > i1) continue;
          const mp = sample(t);
          ctx.save(); ctx.translate(mp.x, mp.y); ctx.rotate(mp.a + Math.PI / 2);
          ctx.fillText(name, 0, 0); ctx.restore();
        }

        // Barrier
        if (!S.resolved && BLOCK_T * SAMPLES >= i0 && BLOCK_T * SAMPLES <= i1) {
          const bp = sample(BLOCK_T);
          const dist = BLOCK_T - S.progress, fill = S.metabolites / ACTIVATION;
          let op = 1 - fill * 0.7;
          if (S.blocked || (dist > 0 && dist <= 0.04)) op *= (0.65 + 0.35 * Math.abs(Math.sin(performance.now() / 120)));
          ctx.save(); ctx.globalAlpha = op;
          ctx.translate(bp.x, bp.y); ctx.rotate(bp.a + Math.PI / 2);
          const half = (ROAD_W / 2) * (1 - fill * 0.55);
          ctx.fillStyle = COL.barrier; ctx.fillRect(-half, -10, half * 2, 20);
          ctx.beginPath(); ctx.rect(-half, -10, half * 2, 20); ctx.clip();
          ctx.fillStyle = COL.stripe;
          for (let sx = -ROAD_W / 2 - 20; sx < ROAD_W / 2 + 20; sx += 22) {
            ctx.save(); ctx.translate(sx, 0); ctx.rotate(0.7);
            ctx.fillRect(-4, -30, 8, 60); ctx.restore();
          }
          ctx.restore();
        }

        // Blobs
        for (const b of trail) {
          ctx.fillStyle = 'rgba(15,15,15,' + (0.85 * clamp(b.life, 0, 1)) + ')';
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        }

        // Checkpoint
        if (S.checkpoint > 0) {
          const cpi = Math.round(S.checkpoint * SAMPLES);
          if (cpi >= i0 && cpi <= i1) {
            const cp = sample(S.checkpoint);
            ctx.save(); ctx.translate(cp.x, cp.y);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }

        // Car
        ctx.save(); ctx.translate(carX, carY);
        S.carAngleVis = lerp(S.carAngleVis, car.a + Math.PI / 2 + S.steer * 0.10, 0.4);
        ctx.rotate(S.carAngleVis);
        drawCar(ctx);
        ctx.restore();
        ctx.restore();

        // HUD
        if (S.blocked) {
          hud?.classList.add('blocked');
          if (hud) hud.textContent = Math.round(S.metabolites) + ' / ' + ACTIVATION;
          if (sub) sub.textContent = 'accumulating — hold W to break through';
        } else {
          hud?.classList.remove('blocked');
          if (hud) hud.textContent = Math.round(S.progress * 1000) + ' m';
          if (sub) sub.textContent = S.resolved ? 'barrier cleared' : 'the road is your timeline';
        }
      } else {
        if (S.blocked) {
          hud?.classList.add('blocked');
          if (hud) hud.textContent = Math.round(S.metabolites) + ' / ' + ACTIVATION;
          if (sub) sub.textContent = 'accumulating — hold W to break through';
        } else {
          hud?.classList.remove('blocked');
          if (hud) hud.textContent = Math.round(S.progress * 1000) + ' m';
          if (sub) sub.textContent = S.resolved ? 'barrier cleared' : 'the road is your timeline';
        }
      }

      // Sync to Zustand every render frame
      useGameStore.getState().syncFromEngine({
        progress: S.progress, speed: S.speed,
        steer: S.steer, steerTarget: S.steerTarget,
        blocked: S.blocked, resolved: S.resolved,
        metabolites: S.metabolites, breakT: S.breakT, checkpoint: S.checkpoint,
        camRot: S.camRot, camRotTarget: S.camRotTarget,
        camZoom: S.camZoom, camZoomTarget: S.camZoomTarget,
        carAngleVis: S.carAngleVis,
      });
    }

    function drawCar(g: CanvasRenderingContext2D) {
      g.fillStyle = COL.wheel;
      for (const [wx, wy] of [[-17, -15], [17, -15], [-17, 15], [17, 15]]) {
        g.beginPath(); g.arc(wx, wy, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = COL.hub; g.beginPath(); g.arc(wx, wy, 2.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = COL.wheel;
      }
      g.fillStyle = COL.body; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
      g.beginPath();
      ([[-17, 27], [17, 27], [20, 4], [16, -22], [9, -27], [-9, -27], [-16, -22], [-20, 4]] as [number, number][])
        .forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = COL.cabin;
      g.beginPath();
      ([[-11, 10], [11, 10], [9, -12], [-9, -12]] as [number, number][]).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fill();
      g.fillStyle = COL.windshield;
      g.beginPath();
      ([[-8, -6], [8, -6], [6, -18], [-6, -18]] as [number, number][]).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fill();
      g.fillStyle = COL.headlight;
      g.beginPath(); g.arc(-8, -25, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(8, -25, 3, 0, Math.PI * 2); g.fill();
    }

    // LOOP (fixed-timestep)
    let last = performance.now(), acc = 0, raf = 0;
    function frame(now: number) {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      while (acc >= fixedDt) { update(fixedDt); acc -= fixedDt; }
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPDown);
      window.removeEventListener('pointermove', onPMove);
      window.removeEventListener('pointerup', onPUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        background: '#262626',
        cursor: 'grab',
        display: viewMode === '2d' ? 'block' : 'none',
        touchAction: 'none',
        zIndex: 1,
      }}
    />
  );
}
