/** Heart pack registry — Heart 1 / Heart 2 toggle in ecg-vector-lab.html */
(function () {
  'use strict';

  window.HEART_PACKS = {
    'heart-1': {
      id: 'heart-1',
      label: 'Heart 1',
      note: 'Default traced reference (red + gray underlay)',
      red: function () {
        return window.HEART_1_RED;
      },
      gray: function () {
        return window.HEART_1_GRAY;
      },
    },
    'heart-2': {
      id: 'heart-2',
      label: 'Heart 2',
      note: 'Alternate gray trace (#D4D4D4) — replace assets/hearts/heart-2/ for your own SVG',
      red: function () {
        return window.HEART_2_RED;
      },
      gray: function () {
        return window.HEART_2_GRAY;
      },
    },
  };

  window.HEART_PACK_IDS = ['heart-1', 'heart-2'];

  /** Legacy aliases used by older snippets / tools */
  window.syncHeartLegacyAliases = function (packId) {
    var pack = window.HEART_PACKS[packId] || window.HEART_PACKS['heart-1'];
    window.HEART_SVG = pack.red();
    window.HEART_GRAY = pack.gray();
  };

  window.syncHeartLegacyAliases('heart-1');
})();
