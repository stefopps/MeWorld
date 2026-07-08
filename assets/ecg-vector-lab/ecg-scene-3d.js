/**
 * ECG Vector Lab — 3D torso (ref 02 / ref 03 dual-plane).
 * Blue coronal frontal ring ⊥ red transverse precordial plane at HC.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BODY_H = 185;
const BODY_W_DEFAULT = 206.326;
const GLB_PATH = 'assets/ecg-vector-lab/character/boy.glb';
const LIMB_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
/** Ref 02/03 — blue = frontal limb plane, red = horizontal precordial plane */
const FRONTAL = 0x3b82f6;
const HORIZONTAL = 0xef4444;
const HORIZONTAL_RADIUS = 0.36;
const HORIZONTAL_ELLIPSE_Z = 0.2;

/** Default 3D lighting — low ambient, key from above-front (body reads dark gray). */
export const DEFAULT_SCENE3D_LIGHT = {
  ambient: 0.4,
  key: 1.15,
  keyAz: 12,
  keyEl: 48,
};

const KEY_LIGHT_DIST = 3.6;

function clampNum(v, lo, hi, fallback) {
  var n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export function normalizeScene3dLight(o) {
  o = o || {};
  var d = DEFAULT_SCENE3D_LIGHT;
  return {
    ambient: clampNum(o.ambient, 0, 1.2, d.ambient),
    key: clampNum(o.key, 0, 2.5, d.key),
    keyAz: clampNum(o.keyAz, -180, 180, d.keyAz),
    keyEl: clampNum(o.keyEl, 5, 89, d.keyEl),
  };
}

function keyLightPosition(azDeg, elDeg, dist) {
  var az = r(azDeg);
  var el = r(elDeg);
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * dist,
    Math.sin(el) * dist,
    Math.cos(az) * Math.cos(el) * dist
  );
}

/** @param {string} key electrode id */
function electrodeDepthZ(key, nx, ny) {
  if (key === 'RA') return 0.1;
  if (key === 'LA') return 0.14;
  if (key === 'RL') return -0.12;
  if (key === 'LL') return -0.06;
  if (key === 'HC' || key === 'heart') return 0.2;
  if (/^V\d$/.test(key)) {
    var vi = parseInt(key.slice(1), 10);
    var wrapFrac = (vi - 1) / 5;
    /* Anterior chest wall — all V leads in front of heart center (HC ~0.2). */
    return 0.3 + wrapFrac * 0.12 + (1 - ny) * 0.035;
  }
  return 0.08 * (0.5 - Math.abs(nx - 0.5));
}

/** 2D lab body coords → world (+Y up, +Z anterior toward viewer). */
export function bodyPtToWorld(bx, by, key, bodyW) {
  var bw = bodyW || BODY_W_DEFAULT;
  var nx = bx / bw;
  var ny = by / BODY_H;
  var x = (nx - 0.5) * 1.05;
  var y = (0.5 - ny) * 1.18;
  var z = electrodeDepthZ(key || '', nx, ny);
  return new THREE.Vector3(x, y, z);
}

/** Inverse of bodyPtToWorld (ignores z — maps world XY back to body plate). */
export function worldPtToBody(wx, wy, bodyW) {
  var bw = bodyW || BODY_W_DEFAULT;
  var nx = wx / 1.05 + 0.5;
  var ny = 0.5 - wy / 1.18;
  return { x: nx * bw, y: ny * BODY_H };
}

function r(d) {
  return (d * Math.PI) / 180;
}

function emissiveLineMat(color, opacity) {
  return new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
  });
}

function emissiveRingMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
  });
}

function clearGroup(group) {
  while (group.children.length) {
    var c = group.children[0];
    group.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) {
        c.material.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    }
  }
}

/** Small canvas sprite for V1–V6 edge labels on the horizontal plane. */
function makeTextSprite(text, color) {
  var hex = '#' + color.toString(16).padStart(6, '0');
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 36px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, 64, 32);
  ctx.fillStyle = hex;
  ctx.fillText(text, 64, 32);
  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  var mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  var sp = new THREE.Sprite(mat);
  sp.scale.set(0.11, 0.055, 1);
  sp.renderOrder = 15;
  return sp;
}

/** Points on horizontal (XZ) ellipse at HC — ref 02 red ellipse. */
function horizontalEllipsePoints(hc, rx, rz, segments) {
  var pts = [];
  for (var i = 0; i <= segments; i++) {
    var t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(hc.x + Math.cos(t) * rx, hc.y, hc.z + Math.sin(t) * rz));
  }
  return pts;
}

/** Unit direction in transverse plane from HC toward body-plate target. */
function horizontalDirFromBody(hc, bx, by, bodyW) {
  var w = bodyPtToWorld(bx, by, 'V', bodyW);
  var dx = w.x - hc.x;
  var dz = w.z - hc.z;
  var len = Math.sqrt(dx * dx + dz * dz) || 1;
  return new THREE.Vector3(dx / len, 0, dz / len);
}

export class EcgScene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c1c24);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
    this.camera.position.set(0, 0.08, 2.35);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.05, 0.08);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 4.5;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.enableZoom = false;
    this.controls.update();
    this._defaultCameraPosition = this.camera.position.clone();
    this._defaultTarget = this.controls.target.clone();
    this._defaultFitOffset = this._defaultCameraPosition.clone().sub(this._defaultTarget).normalize();

    /* Ambient + key (tunable) · fill/rim/hemi fixed — emissive guides ignore lights */
    this.ambientLight = new THREE.AmbientLight(0xd8dce8, DEFAULT_SCENE3D_LIGHT.ambient);
    this.scene.add(this.ambientLight);
    this.scene.add(new THREE.HemisphereLight(0xf0f4ff, 0x3a3a48, 0.42));
    this.keyLight = new THREE.DirectionalLight(0xfff6ea, DEFAULT_SCENE3D_LIGHT.key);
    this.scene.add(this.keyLight);
    var fill = new THREE.DirectionalLight(0xaabbdd, 0.48);
    fill.position.set(-1.8, 0.6, 1.2);
    this.scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffffff, 0.28);
    rim.position.set(0, 0.2, -2.2);
    this.scene.add(rim);
    this._lightCfg = normalizeScene3dLight(DEFAULT_SCENE3D_LIGHT);
    this.applyLighting(this._lightCfg);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.manikinGroup = new THREE.Group();
    this.guidesGroup = new THREE.Group();
    this.electrodeGroup = new THREE.Group();
    this.scopeGroup = new THREE.Group();
    this.heartGroup = new THREE.Group();
    this.root.add(this.manikinGroup, this.guidesGroup, this.electrodeGroup, this.scopeGroup, this.heartGroup);

    this.electrodeMeshes = {};
    this.triLines = null;
    this.limbRing = null;
    this.horizontalRing = null;
    this.vFanGroup = null;
    this.hcMarker = null;
    this.scopeRing = null;
    this.vectorArrow = null;
    this._lastLab = null;
    this._dragKey = null;
    this._dragPlane = new THREE.Plane();
    this._dragIntersect = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._onElectrodeMove = null;
    this._placingLeads = false;

    this._buildProceduralManikin();
    this._buildGuideMeshes();
    this._tryLoadGlb();
    this._bindPointer();
  }

  _bw(lab) {
    lab = lab || this._lastLab || {};
    return lab.bodyNW || BODY_W_DEFAULT;
  }

  /** Tune ambient + key only — rings/lines/sprites use MeshBasicMaterial (unaffected). */
  applyLighting(cfg) {
    cfg = normalizeScene3dLight(cfg || this._lightCfg);
    this._lightCfg = cfg;
    if (this.ambientLight) this.ambientLight.intensity = cfg.ambient;
    if (this.keyLight) {
      this.keyLight.intensity = cfg.key;
      this.keyLight.position.copy(keyLightPosition(cfg.keyAz, cfg.keyEl, KEY_LIGHT_DIST));
    }
  }

  _manikinMat() {
    return new THREE.MeshStandardMaterial({
      color: 0x555560,
      roughness: 0.82,
      metalness: 0.06,
      emissive: 0x151518,
      emissiveIntensity: 0.35,
    });
  }

  _buildProceduralManikin() {
    while (this.manikinGroup.children.length) this.manikinGroup.remove(this.manikinGroup.children[0]);
    var mat = this._manikinMat();
    var g = new THREE.Group();

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.21, 0.52, 28), mat);
    torso.position.y = 0.02;
    g.add(torso);

    var chest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 18), mat);
    chest.position.set(0, 0.12, 0.06);
    chest.scale.set(1.05, 0.88, 0.62);
    g.add(chest);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 16), mat);
    head.position.y = 0.46;
    g.add(head);

    function limb(rTop, rBot, len, x, y, z, rotZ) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 12), mat);
      m.position.set(x, y, z);
      if (rotZ) m.rotation.z = rotZ;
      g.add(m);
    }
    limb(0.06, 0.05, 0.38, -0.38, 0.18, 0.02, 0.35);
    limb(0.06, 0.05, 0.38, 0.38, 0.18, 0.02, -0.35);
    limb(0.07, 0.06, 0.48, -0.14, -0.42, -0.04, 0.06);
    limb(0.07, 0.06, 0.48, 0.14, -0.42, -0.04, -0.06);

    this.manikinGroup.add(g);
  }

  _tryLoadGlb() {
    var loader = new GLTFLoader();
    var self = this;
    loader.load(
      GLB_PATH,
      function (gltf) {
        while (self.manikinGroup.children.length) self.manikinGroup.remove(self.manikinGroup.children[0]);
        var model = gltf.scene;
        var mat = self._manikinMat();
        model.traverse(function (o) {
          if (o.isMesh) {
            o.material = mat;
            o.castShadow = false;
          }
        });
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var s = 1.15 / maxDim;
        model.scale.setScalar(s);
        box.setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += 0.05;
        self.manikinGroup.add(model);
      },
      undefined,
      function () {
        /* keep procedural manikin */
      }
    );
  }

  /**
   * Ref guide rings — perpendicular at HC (ref 02/03 colors):
   * · Blue = coronal frontal limb plane (XY, vertical hoop facing +Z)
   * · Red = transverse precordial plane (XZ, horizontal disc at heart level)
   * Plane labels are 2D HUD in ecg-vector-lab.html.
   */
  _buildGuideMeshes() {
    /* Coronal / frontal limb plane — default torus lies in XY (normal +Z). */
    this.limbRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.008, 12, 80),
      emissiveRingMat(FRONTAL, 0.72)
    );
    this.limbRing.renderOrder = 10;
    this.guidesGroup.add(this.limbRing);

    /* Transverse / precordial plane — rotate π/2 around X → XZ (horizontal disc). */
    this.horizontalRing = new THREE.Mesh(
      new THREE.TorusGeometry(HORIZONTAL_RADIUS, 0.007, 12, 80),
      emissiveRingMat(HORIZONTAL, 0.58)
    );
    this.horizontalRing.rotation.x = Math.PI / 2;
    this.horizontalRing.renderOrder = 9;
    this.guidesGroup.add(this.horizontalRing);

    /* V1–V6 vectors + edge markers — rebuilt each sync from HC in horizontal plane. */
    this.vFanGroup = new THREE.Group();
    this.vFanGroup.renderOrder = 11;
    this.guidesGroup.add(this.vFanGroup);

    /* Shared convergence point — both planes meet at HC (ref 03). */
    this.hcMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.95, depthWrite: false })
    );
    this.hcMarker.renderOrder = 16;
    this.guidesGroup.add(this.hcMarker);
  }

  _syncGuidePlanes(lab) {
    if (!lab || !lab.HC_BODY) return;
    var bw = this._bw(lab);
    var hc = bodyPtToWorld(lab.HC_BODY.x, lab.HC_BODY.y, 'HC', bw);
    if (this.limbRing) {
      this.limbRing.position.copy(hc);
      this.limbRing.rotation.set(0, 0, 0);
    }
    if (this.horizontalRing) {
      this.horizontalRing.position.copy(hc);
      this.horizontalRing.rotation.x = Math.PI / 2;
      this.horizontalRing.rotation.y = 0;
      this.horizontalRing.rotation.z = 0;
    }
    if (this.hcMarker) {
      this.hcMarker.position.copy(hc);
      this.hcMarker.visible = (lab.showLimbRing !== false) || (lab.showVFan !== false);
    }
  }

  _ensureElectrode(name, color) {
    if (this.electrodeMeshes[name]) return this.electrodeMeshes[name];
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 16, 12),
      new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.35,
        metalness: 0.05,
      })
    );
    mesh.userData.electrodeKey = name;
    this.electrodeGroup.add(mesh);
    this.electrodeMeshes[name] = mesh;
    return mesh;
  }

  _ndcFromEvent(e) {
    var rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickElectrode(e) {
    this._ndcFromEvent(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    var hits = this._raycaster.intersectObjects(this.electrodeGroup.children, false);
    for (var i = 0; i < hits.length; i++) {
      var key = hits[i].object.userData.electrodeKey;
      if (key && hits[i].object.visible) return key;
    }
    return null;
  }

  _dragElectrodeTo(e) {
    if (!this._dragKey) return;
    this._ndcFromEvent(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    if (!this._raycaster.ray.intersectPlane(this._dragPlane, this._dragIntersect)) return;
    var body = worldPtToBody(this._dragIntersect.x, this._dragIntersect.y, this._bw(this._lastLab));
    if (this._onElectrodeMove) this._onElectrodeMove(this._dragKey, body.x, body.y);
  }

  _updateControlsEnabled(lab) {
    lab = lab || this._lastLab || {};
    this.controls.enabled = !lab.placingScope && !lab.placingHeart && !this._dragKey;
  }

  _bindPointer() {
    var self = this;
    this.canvas.addEventListener('pointerdown', function (e) {
      if (!self._placingLeads || e.button !== 0) return;
      var key = self._pickElectrode(e);
      if (!key) return;
      self._dragKey = key;
      self.controls.enabled = false;
      var mesh = self.electrodeMeshes[key];
      if (mesh) {
        var n = new THREE.Vector3(0, 0, 1);
        self._dragPlane.setFromNormalAndCoplanarPoint(n, mesh.position.clone());
      }
      self.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!self._dragKey) return;
      self._dragElectrodeTo(e);
      e.preventDefault();
    });
    function endDrag(e) {
      if (!self._dragKey) return;
      self._dragKey = null;
      self._updateControlsEnabled();
      try {
        self.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  setElectrodeDrag(opts) {
    opts = opts || {};
    this._placingLeads = !!opts.placingLeads;
    this._onElectrodeMove = typeof opts.onMove === 'function' ? opts.onMove : null;
  }

  _syncElectrodes(lab) {
    var limbColors = { RA: 0xf8fafc, LA: 0x111827, RL: 0x5c6370, LL: 0x0284c7 };
    var placing = !!lab.placingLeads;
    var self = this;
    var bw = this._bw(lab);
    Object.keys(lab.EL_BODY || {}).forEach(function (n) {
      var p = lab.EL_BODY[n];
      var mesh = self._ensureElectrode(n, limbColors[n] || 0x0284c7);
      var w = bodyPtToWorld(p.x, p.y, n, bw);
      mesh.position.copy(w);
      mesh.visible = lab.showTri !== false || placing;
      mesh.scale.setScalar(placing ? 1.35 : 1);
    });
    REF_KEYS.forEach(function (n) {
      var p = lab.PRE_BODY[n];
      if (!p) return;
      var mesh = self._ensureElectrode(n, 0xef4444);
      mesh.position.copy(bodyPtToWorld(p.x, p.y, n, bw));
      mesh.visible = placing;
      mesh.scale.setScalar(placing ? 1.45 : 1);
    });
  }

  _syncEinthoven(lab) {
    if (this.triLines) {
      this.guidesGroup.remove(this.triLines);
      this.triLines.geometry.dispose();
      this.triLines.material.dispose();
      this.triLines = null;
    }
    if (!lab.showTri) return;
    var bw = this._bw(lab);
    var ra = bodyPtToWorld(lab.EL_BODY.RA.x, lab.EL_BODY.RA.y, 'RA', bw);
    var la = bodyPtToWorld(lab.EL_BODY.LA.x, lab.EL_BODY.LA.y, 'LA', bw);
    var ll = bodyPtToWorld(lab.EL_BODY.LL.x, lab.EL_BODY.LL.y, 'LL', bw);
    var pts = [ra.clone(), la.clone(), ra.clone(), ll.clone(), la.clone(), ll.clone()];
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.triLines = new THREE.LineSegments(geo, emissiveLineMat(0xffffff, 0.78));
    this.triLines.renderOrder = 8;
    this.guidesGroup.add(this.triLines);
  }

  /** 2D scope degrees → unit direction in coronal (XY) plane. */
  _scopeWorldBase(lab) {
    lab = lab || this._lastLab || {};
    var bw = this._bw(lab);
    var hc = lab.HC_BODY;
    var el = lab.EL_BODY;
    if (!hc || !el || !el.RA) return 0.36 * (lab.scopeScale || 1);
    var hcW = bodyPtToWorld(hc.x, hc.y, 'HC', bw);
    var sum = 0;
    ['RA', 'LA', 'LL'].forEach(function (k) {
      var p = el[k];
      var w = bodyPtToWorld(p.x, p.y, k, bw);
      sum += Math.hypot(w.x - hcW.x, w.y - hcW.y);
    });
    var mean = sum / 3;
    /* Legacy torus sr=0.36 at default CARDIOCARD triangle spacing. */
    var REF = 0.34;
    return Math.max(0.14, mean * (0.36 / REF) * (lab.scopeScale || 1));
  }

  _leadScopeRadius(lab, sr, name) {
    if (lab.scopeRingMode !== 'measured') return sr;
    var f = lab.measuredRingRad && lab.measuredRingRad[name];
    return sr * (f != null && isFinite(f) ? f : 1);
  }

  _dirFromLeadDeg(deg) {
    var a = r(deg);
    return new THREE.Vector3(Math.cos(a), -Math.sin(a), 0);
  }

  _syncMeasuredScopeAxes(lab, hc, sr) {
    if (!lab.showScope || !lab.leadDeg) return;
    var pts = [];
    var self = this;
    LIMB_LEADS.forEach(function (name) {
      var deg = lab.leadDeg[name];
      if (deg == null || !isFinite(deg)) return;
      var lr = self._leadScopeRadius(lab, sr, name);
      var dir = self._dirFromLeadDeg(deg);
      pts.push(hc.clone().add(dir.clone().multiplyScalar(-lr * 0.92)));
      pts.push(hc.clone().add(dir.clone().multiplyScalar(lr * 0.92)));
    });
    if (!pts.length) return;
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var axes = new THREE.LineSegments(geo, emissiveLineMat(FRONTAL, 0.62));
    axes.renderOrder = 12;
    this.scopeGroup.add(axes);
  }

  _syncHeart(lab) {
    while (this.heartGroup.children.length) this.heartGroup.remove(this.heartGroup.children[0]);
    if (!lab.showHeart || !lab.HEART_BODY) return;
    var bw = this._bw(lab);
    var pos = bodyPtToWorld(lab.HEART_BODY.x, lab.HEART_BODY.y, 'heart', bw);
    var scale = 0.11 * (lab.heartScale || 1);
    var rot = r(lab.heartRotation || 0);
    var heart = new THREE.Mesh(
      new THREE.SphereGeometry(scale, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd8d8dc,
        emissive: 0x888890,
        emissiveIntensity: 0.25,
        roughness: 0.88,
        metalness: 0.02,
        transparent: true,
        opacity: 0.92,
      })
    );
    heart.scale.set(1.05, 1, 0.32);
    heart.position.copy(pos);
    heart.rotation.set(-0.15, 0, rot);
    this.heartGroup.add(heart);
  }

  _syncScope(lab) {
    while (this.scopeGroup.children.length) this.scopeGroup.remove(this.scopeGroup.children[0]);
    if (!lab.showScope && !lab.showVector) return;

    var bw = this._bw(lab);
    var hc = bodyPtToWorld(lab.HC_BODY.x, lab.HC_BODY.y, 'HC', bw);
    var sr = this._scopeWorldBase(lab);

    if (lab.showScope) {
      if (lab.scopeRingMode === 'measured' && lab.measuredRingRad) {
        var ringPts = [];
        var self = this;
        LIMB_LEADS.forEach(function (name) {
          var deg = lab.leadDeg && lab.leadDeg[name];
          if (deg == null || !isFinite(deg)) return;
          var lr = self._leadScopeRadius(lab, sr, name);
          var dir = self._dirFromLeadDeg(deg);
          ringPts.push(hc.clone().add(dir.clone().multiplyScalar(lr)));
        });
        if (ringPts.length >= 3) {
          ringPts.push(ringPts[0].clone());
          var ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
          var ringLine = new THREE.LineLoop(ringGeo, emissiveLineMat(FRONTAL, 0.82));
          ringLine.renderOrder = 13;
          this.scopeGroup.add(ringLine);
        }
      } else {
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(sr, 0.005, 8, 64),
          emissiveRingMat(FRONTAL, 0.82)
        );
        ring.position.copy(hc);
        ring.rotation.set(0, 0, 0);
        ring.renderOrder = 13;
        this.scopeGroup.add(ring);
      }
      this._syncMeasuredScopeAxes(lab, hc, sr);
    }

    if (lab.showVector) {
      var va = lab.vec || { vx: 0, vy: 0, on: false };
      if (va.on) {
        var len = 0.28;
        var dir = new THREE.Vector3(va.vx, -va.vy, 0).normalize().multiplyScalar(len);
        var arrow = new THREE.ArrowHelper(dir, hc.clone(), len, 0x0284c7, 0.06, 0.04);
        arrow.renderOrder = 14;
        this.scopeGroup.add(arrow);
      }
    }
  }

  /**
   * Ref 02/03 horizontal plane geometry: red ellipse + V1–V6 vectors from HC
   * fanning patient-right (V1) → patient-left (V6) within the transverse plane.
   */
  _syncHorizontalGuide(lab) {
    if (!this.vFanGroup) return;
    clearGroup(this.vFanGroup);
    if (!lab || !lab.HC_BODY || !lab.PRE_BODY || lab.showVFan === false) return;

    var bw = this._bw(lab);
    var hc = bodyPtToWorld(lab.HC_BODY.x, lab.HC_BODY.y, 'HC', bw);
    var surfacePts = [];

    var self = this;
    REF_KEYS.forEach(function (k) {
      var p = lab.PRE_BODY[k];
      if (!p) return;
      var surf = bodyPtToWorld(p.x, p.y, k, bw);
      surfacePts.push(surf);

      /* HC → chest-surface V lead (curves with torso, not a flat disc). */
      var segPts = [hc.clone(), surf];
      var segGeo = new THREE.BufferGeometry().setFromPoints(segPts);
      var seg = new THREE.Line(segGeo, emissiveLineMat(HORIZONTAL, 0.88));
      seg.renderOrder = 12;
      self.vFanGroup.add(seg);

      var marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 12, 10),
        new THREE.MeshBasicMaterial({ color: HORIZONTAL, transparent: true, opacity: 0.95, depthWrite: false })
      );
      marker.position.copy(surf);
      marker.renderOrder = 13;
      self.vFanGroup.add(marker);

      var lblDir = surf.clone().sub(hc).normalize();
      var lbl = makeTextSprite(k, HORIZONTAL);
      lbl.position.copy(surf.clone().add(lblDir.multiplyScalar(0.07)));
      lbl.position.y += 0.03;
      self.vFanGroup.add(lbl);
    });

    /* Approximate red ring at precordial level — guide only, not a rigid plane. */
    if (surfacePts.length >= 2) {
      var avgY = 0;
      var maxRx = 0;
      var maxRz = HORIZONTAL_ELLIPSE_Z;
      surfacePts.forEach(function (sp) {
        avgY += sp.y;
        var dx = sp.x - hc.x;
        var dz = sp.z - hc.z;
        maxRx = Math.max(maxRx, Math.sqrt(dx * dx + dz * dz));
        maxRz = Math.max(maxRz, Math.abs(dz) * 0.85);
      });
      avgY /= surfacePts.length;
      var ringCenter = new THREE.Vector3(hc.x, avgY, hc.z);
      var ellPts = [];
      for (var i = 0; i <= 72; i++) {
        var t = (i / 72) * Math.PI * 2;
        ellPts.push(
          new THREE.Vector3(
            ringCenter.x + Math.cos(t) * maxRx * 0.92,
            ringCenter.y,
            ringCenter.z + Math.sin(t) * maxRz
          )
        );
      }
      var ellGeo = new THREE.BufferGeometry().setFromPoints(ellPts);
      var ell = new THREE.LineLoop(ellGeo, emissiveLineMat(HORIZONTAL, 0.48));
      ell.renderOrder = 10;
      this.vFanGroup.add(ell);
    }
  }

  sync(lab) {
    this._lastLab = lab;
    if (lab && lab.scene3dLight) this.applyLighting(lab.scene3dLight);
    this._syncGuidePlanes(lab);
    if (this.limbRing) this.limbRing.visible = lab.showLimbRing !== false;
    if (this.horizontalRing) this.horizontalRing.visible = lab.showVFan !== false;
    if (this.vFanGroup) this.vFanGroup.visible = lab.showVFan !== false;
    this._syncHorizontalGuide(lab);
    this._syncElectrodes(lab);
    this._syncEinthoven(lab);
    this._syncScope(lab);
    this._syncHeart(lab);
    this._placingLeads = !!lab.placingLeads;
    this._updateControlsEnabled(lab);
  }

  resetView() {
    this.camera.position.copy(this._defaultCameraPosition);
    this.controls.target.copy(this._defaultTarget);
    this.controls.update();
  }

  /** Frame manikin + guides in the canvas (OrbitControls target + distance). */
  fitToView() {
    var box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) {
      this.resetView();
      return;
    }
    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var maxSize = Math.max(size.x, size.y, size.z, 0.01);
    var fov = (this.camera.fov * Math.PI) / 180;
    var dist = (maxSize * 0.5) / Math.tan(fov * 0.5);
    dist *= 1.28;
    dist = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, dist));
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(this._defaultFitOffset.clone().multiplyScalar(dist));
    this.controls.update();
  }

  resize(w, h) {
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
  }
}

var REF_KEYS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

export function createEcgScene3d(canvas) {
  return new EcgScene3D(canvas);
}
