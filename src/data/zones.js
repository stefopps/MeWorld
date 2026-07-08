/** Demo patient scene — tuned for the built-in SVG */
export const DEMO_ZONES = {
  'zone-monitor': { cx: 0.78, cy: 0.22, w: 0.14, h: 0.12, label: 'Monitor & imaging' },
  'zone-iv-bag': { cx: 0.18, cy: 0.42, w: 0.12, h: 0.14, label: 'IV fluids' },
  'zone-blood': { cx: 0.38, cy: 0.48, w: 0.12, h: 0.1, label: 'Blood draw' },
  'zone-arm': { cx: 0.5, cy: 0.52, w: 0.14, h: 0.1, label: 'IV / medications' },
  'zone-icu': { cx: 0.5, cy: 0.82, w: 0.22, h: 0.1, label: 'Disposition' },
};

/** All zones including custom body-region zones — matches gameConfig.json */
export const ALL_ZONES = {
  'zone-monitor': { cx: 0.9267, cy: 0.099, w: 0.109, h: 0.1288, label: 'Monitor & vitals' },
  'zone-iv-bag': { cx: 0.0918, cy: 0.0998, w: 0.121, h: 0.1361, label: 'IV fluids' },
  'zone-blood': { cx: 0.6324, cy: 0.4246, w: 0.0897, h: 0.1097, label: 'Blood draw' },
  'zone-arm': { cx: 0.3695, cy: 0.4072, w: 0.0834, h: 0.1035, label: 'IV line / meds' },
  'zone-icu': { cx: 0.8779, cy: 0.9116, w: 0.1994, h: 0.0997, label: 'ICU · ward · obs · transfer' },
  'zone-custom-1': { cx: 0.4936, cy: 0.4215, w: 0.1693, h: 0.1693, label: 'Abdomen' },
  'zone-custom-2': { cx: 0.5017, cy: 0.1598, w: 0.05, h: 0.04, label: 'Nose' },
  'zone-custom-3': { cx: 0.5226, cy: 0.2815, w: 0.3835, h: 0.0985, label: 'Chest' },
  'zone-custom-4': { cx: 0.5007, cy: 0.6694, w: 0.1213, h: 0.1143, label: 'Left Knee' },
  'zone-custom-5': { cx: 0.3307, cy: 0.6294, w: 0.1123, h: 0.108, label: 'Right Knee' },
  'zone-custom-6': { cx: 0.212, cy: 0.9011, w: 0.2333, h: 0.0992, label: 'Right Foot' },
  'zone-custom-7': { cx: 0.4919, cy: 0.9387, w: 0.2402, h: 0.1016, label: 'Left Foot' },
};

export const ZONE_COLORS = {
  'zone-monitor': '#60a5fa',
  'zone-iv-bag': '#34d399',
  'zone-blood': '#f87171',
  'zone-arm': '#a78bfa',
  'zone-icu': '#fbbf24',
  'zone-custom-1': '#4ade80',
  'zone-custom-2': '#f472b6',
  'zone-custom-3': '#22c55e',
  'zone-custom-4': '#a3e635',
  'zone-custom-5': '#f97316',
  'zone-custom-6': '#06b6d4',
  'zone-custom-7': '#e879f9',
};
