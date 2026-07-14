import { create } from 'zustand';

export interface SplineDef {
  name: string;
  color: string;
  waypoints: [number, number, number][];
}

export interface GameState {
  // ═══ CORE STATE (synced from 2D Canvas engine) ═══
  progress: number;
  speed: number;
  steer: number;
  steerTarget: number;
  blocked: boolean;
  resolved: boolean;
  metabolites: number;
  breakT: number;
  checkpoint: number;

  // ═══ CAMERA ═══
  camRot: number;
  camRotTarget: number;
  camZoom: number;
  camZoomTarget: number;
  carAngleVis: number;

  // ═══ SPLINES ═══
  splines: SplineDef[];
  splineIndex: number;

  // ═══ VIEW ═══
  viewMode: '2d' | '3d';

  // ═══ 3D CAMERA PAN ═══
  camPanX: number;
  camPanY: number;

  // ═══ ACTIONS (Zustand writes) ═══
  setViewMode: (m: '2d' | '3d') => void;
  setSpline: (i: number) => void;
  setCamPan: (x: number, y: number) => void;
  // bulk sync from Canvas engine (called every render)
  syncFromEngine: (s: Partial<EngineSnapshot>) => void;
}

export interface EngineSnapshot {
  progress: number;
  speed: number;
  steer: number;
  steerTarget: number;
  blocked: boolean;
  resolved: boolean;
  metabolites: number;
  breakT: number;
  checkpoint: number;
  camRot: number;
  camRotTarget: number;
  camZoom: number;
  camZoomTarget: number;
  carAngleVis: number;
}

const INITIAL_SPLINES: SplineDef[] = [
  {
    name: 'Life Journey',
    color: '#46DC96',
    waypoints: [
      [0,   0,  0], [4,  0, -3], [10, 0, -6], [18, 0, -2],
      [24, -1, 4], [20, 0, 10], [14, 0, 13], [7,  0, 11],
      [2,   0, 6], [-4, 0,  2], [-8, 0, -3],
    ],
  },
  {
    name: 'Neural Crest',
    color: '#22C55E',
    waypoints: [
      [0,   0,  0], [3,  0, -2], [8,  0, 1], [12, 0, 5],
      [10, -1, 8], [5,  0, 9],  [0,  0, 6], [-5, 0, 3],
    ],
  },
  {
    name: 'Folate Cycle',
    color: '#8B5CF6',
    waypoints: [
      [0,   0,  0], [2,  0, -1], [5,  0, -3], [8,  0, -1],
      [6,   0,  2], [4,  0,  4], [1,  0,  3], [-3, 0, 1],
    ],
  },
];

export const useGameStore = create<GameState>((set) => ({
  progress: 0, speed: 0, steer: 0, steerTarget: 0,
  blocked: false, resolved: false,
  metabolites: 0, breakT: 0, checkpoint: 0,

  camRot: 0, camRotTarget: 0, camZoom: 1, camZoomTarget: 1,
  carAngleVis: 0,

  splines: INITIAL_SPLINES,
  splineIndex: 0,

  viewMode: '3d',
  camPanX: 0, camPanY: 0,

  setViewMode: (m) => set({ viewMode: m }),
  setSpline: (i) => set({ splineIndex: i }),
  setCamPan: (x, y) => set({ camPanX: x, camPanY: y }),

  syncFromEngine: (snap) => set(snap as GameState),
}));
