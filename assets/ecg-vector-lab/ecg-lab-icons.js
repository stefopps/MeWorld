/**
 * Tabler Icons (outline 24×24 stroke 2) for ECG Vector Lab standalone UI.
 * https://tabler.io/icons — same convention as SceneToolbarIcons.jsx
 */
(function (w) {
  'use strict';

  /** @type {Record<string, string|string[]>} */
  var ICONS = {
    'chevron-down': 'M6 9l6 6 6-6',
    'chevron-left': 'M15 6l-6 6 6 6',
    'chevron-right': 'M9 6l6 6 -6 6',
    'player-play': 'M6 4v16l12 -8z',
    'player-pause': ['M6 5h4v14H6z', 'M14 5h4v14h-4z'],
    x: ['M18 6l-12 12', 'M6 6l12 12'],
    heart: 'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    lungs: [
      'M6 5a5 5 0 1 1 10 0v6a5 5 0 1 1 -10 0V5',
      'M18 5a5 5 0 1 0 -10 0v6a5 5 0 1 0 10 0V5',
    ],
    'topology-ring-2': [
      'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
      'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    ],
    'chart-radar': [
      'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
      'M12 3l0 2',
      'M12 19l0 2',
      'M3 12l2 0',
      'M19 12l2 0',
    ],
    'focus-2': [
      'M4 8V6a2 2 0 0 1 2 -2h2',
      'M4 16v2a2 2 0 0 0 2 2h2',
      'M16 4h2a2 2 0 0 1 2 2v2',
      'M16 20h2a2 2 0 0 0 2 -2v-2',
      'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    ],
    triangle: 'M12 3l8 8.578l-1.187 .183a5 5 0 0 1 -2.578 -.523l-4.235 -1.39l-4.235 1.39a5 5 0 0 1 -2.578 .523l-1.187 -.183l8 -8.578',
    'arrow-right': 'M5 12l14 0 M13 18l6 -6 M13 6l6 6',
    sparkles: [
      'M16 21l-4 -4-4 4 M4 5l.5 2.5 M19.5 4.5l-2.5 2.5 M12 2v3 M12 20v3',
    ],
    bolt: 'M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11',
    'map-pin': ['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M12 12v9'],
    'hand-click': [
      'M8 13V4.5a1.5 1.5 0 0 1 3 0V12',
      'M11 11.5v-2a1.5 1.5 0 0 1 3 0V12',
      'M14 10.5a1.5 1.5 0 0 1 3 0V16.5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-7.5a1.5 1.5 0 0 1 3 0V12',
    ],
    sun: [
      'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
      'M3 12h1',
      'M20 12h1',
      'M12 3v1',
      'M12 20v1',
      'M5.6 5.6l.7 .7',
      'M17.7 17.7l.7 .7',
      'M5.6 18.4l.7 -.7',
      'M17.7 6.3l.7 -.7',
    ],
    moon: 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008',
    'circle-check': ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 12l2 2l4 -4'],
    'circle-dotted': 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'arrow-up': 'M12 5l0 14 M18 11l-6 -6 M6 11l6 -6',
    'arrow-down': 'M12 19l0 -14 M18 13l-6 6 M6 13l6 6',
  };

  var LAYER_ICON = {
    heart: 'heart',
    ribs: 'lungs',
    limbRing: 'topology-ring-2',
    vFan: 'chart-radar',
    scope: 'focus-2',
    tri: 'triangle',
    vector: 'arrow-right',
    comet: 'sparkles',
    leadFlow: 'bolt',
  };

  function pathsHtml(name) {
    var p = ICONS[name];
    if (!p) return '';
    if (Array.isArray(p)) {
      return p.map(function (d) {
        return '<path d="' + d + '"/>';
      }).join('');
    }
    return '<path d="' + p + '"/>';
  }

  function svg(name, size) {
    size = size || 18;
    if (!ICONS[name]) return '';
    return (
      '<svg class="ti-svg" xmlns="http://www.w3.org/2000/svg" width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      pathsHtml(name) +
      '</svg>'
    );
  }

  function pill(iconName, label) {
    return svg(iconName, 14) + '<span class="pill-txt">' + label + '</span>';
  }

  function setIconOnly(el, name, size) {
    if (!el) return;
    el.innerHTML = svg(name, size || 18);
  }

  function setPill(el, iconName, label) {
    if (!el) return;
    el.innerHTML = pill(iconName, label);
  }

  function initChevrons() {
    document.querySelectorAll('.axis-chevron, .stage-bottom-toggle-chevron').forEach(function (el) {
      el.innerHTML = svg('chevron-down', 14);
    });
  }

  function initLayerPills() {
    document.querySelectorAll('.layer-pill[data-layer]').forEach(function (btn) {
      var layer = btn.dataset.layer;
      var icon = btn.dataset.icon || LAYER_ICON[layer];
      var txt = btn.querySelector('.pill-txt');
      var label = txt ? txt.textContent : btn.textContent.replace(/^[^\w]+/, '').trim();
      if (!icon) return;
      if (!txt) {
        btn.innerHTML = pill(icon, label);
      } else {
        btn.insertAdjacentHTML('afterbegin', svg(icon, 14));
      }
    });
  }

  function initDom() {
    initChevrons();
    initLayerPills();
    setIconOnly(document.getElementById('playB'), 'player-play', 18);
    setIconOnly(document.getElementById('pauseB'), 'player-pause', 18);
    setIconOnly(document.getElementById('axisPrev'), 'chevron-left', 16);
    setIconOnly(document.getElementById('axisNext'), 'chevron-right', 16);
    document.querySelectorAll('.dock-panel-close').forEach(function (btn) {
      setIconOnly(btn, 'x', 18);
    });
    setPill(document.getElementById('placeLeadsBtn'), 'map-pin', '12-lead');
    setPill(document.getElementById('placeScopeBtn'), 'focus-2', 'Scope');
    setPill(document.getElementById('placeHeartBtn'), 'heart', 'Heart');
    var iso = document.getElementById('clickIsolateToggle');
    if (iso) iso.innerHTML = pill('hand-click', 'Click iso');
    document.querySelectorAll('[data-roadmap-icon]').forEach(function (el) {
      el.innerHTML = svg(el.getAttribute('data-roadmap-icon'), 16);
    });
  }

  w.EcgIcons = {
    svg: svg,
    pill: pill,
    setIconOnly: setIconOnly,
    setPill: setPill,
    initDom: initDom,
    layerIcon: function (layer) {
      return LAYER_ICON[layer] || 'circle';
    },
  };
})(window);
