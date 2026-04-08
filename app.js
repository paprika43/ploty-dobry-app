/* =======================================
   Ploty Dobrý – Kalkulátor oplocení
   Main Application JavaScript
   ======================================= */

// ============================================================
// STATE
// ============================================================
const state = {
  fenceType: 'ctyrhranne_bez_nd',
  config: {
    height: 150,
    podhraboveDesky: false,
    podhrabovaVyska: 20,
    povrch: 'zemina',
    stiniciTkanina: false,
    // Čtyřhranné
    prumerDratu: 2.5,
    typSloupku: 'kulate_48',
    roleDelka: 25,
    barvaPletiva: 'zelena',
    // Svařované
    svarSloupky: 'klasicke_48',
    svarRoleDelka: 25,
    svarOkoVyska: 5, // výška oka v cm (pro BEKACLIP výpočet)
    // 2D
    sila2D: '6/5/6',
    barva2D: 'zelena',
    // 3D
    sila3D: 5,
    barva3D: 'zelena',
    // Max šířka pole
    maxFieldM: 2.5,
    // Betonový
    betonVzor: 'jednostranny',
    betonBarva: 'seda',
    betonDesky: 3,
    betonSokl: false,
    betonSoklVyska: 20,
    // Doprava – společné
    adresaStavby: '',
    betonarka: '',
    // Doprava montážníka
    doprMontKm: 0,
    doprMontSazba: 15,
    doprMontCest: 1,
    doprMontZpat: true,
    doprMontMytne: false,
    doprMontMytneKc: 0,
    // Doprava betonových produktů (individuální)
    dopravaBetProduktu: false,
    doprBetKm: 0,
    doprBetSazba: 15,
    doprBetCest: 1,
    doprBetZpat: true,
    doprBetMytne: false,
    doprBetMytneKc: 0,
    doprBetVozidlo: 'dodavka', // dodavka | vlek | hydraulicka
    doprBetPaletCustom: 0, // 0 = auto
    // Doprava betonu z betonárky
    doprBetonKm: 0,
    doprBetonSazba: 15,
    doprBetonCest: 1,
    doprBetonZpat: true,
    doprBetonMytne: false,
    doprBetonMytneKc: 0,
    // Vykládka palet
    vkladkaPaleta: 120,
  },
  // Fence path
  vertices: [],
  gates: [],
  manualStruts: [],
  // Canvas state
  zoom: 1,
  panX: 0,
  panY: 0,
  // Interaction
  tool: 'draw',
  selectedVertex: -1,
  hoveredVertex: -1,
  hoveredSegment: -1,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  panning: false,
  panStartX: 0,
  panStartY: 0,
  // Per-segment overrides: { fromVertexIdx: { fenceType, barva } }
  segmentStyles: {},
  // Per-post color: { vertexIndex → 'zelena'|'antracit'|'stribrna' }
  postColors: {},
  strutColors: {},   // key: `${wx.toFixed(2)},${wy.toFixed(2)}` → barva
  // Per-field color: key "segIdx:fieldIdx" → barva
  fieldColors: {},
  // Per-intermediate-post color: key "segIdx:intPostIdx" → barva
  intermediatePostColors: {},
  // Per-element height overrides (absolute cm, null = use segment default)
  postHeights: {},         // vertexIndex → cm
  intPostHeights: {},      // "segIdx:intPostIdx" → cm
  fieldHeights: {},        // "segIdx:fieldIdx" → cm (fence height for that field)
  // Binding wire colors: key "segIdx:fieldIdx" → barva, or "seg:segIdx" for whole seg
  wireColors: {},
  // Clip colors: key "v:vertexIdx" or "i:segIdx:intPostIdx" → barva
  clipColors: {},
  // Path breaks: set of vertex indices where path is broken (no segment between i and i+1)
  pathBreaks: new Set(),
  // Ghost/preview line: current cursor position in world coords while drawing
  ghostCursor: null, // { x, y } world coords (snapped)
  // Wall tool
  walls: [], // array of { vertices: [{x,y},...], thickness: cm, height: cm, barva: 'stribrna' }
  wallDrawing: null, // { vertices: [{x,y},...] } - currently being drawn wall
  wallConfig: { thickness: 20, height: 200, barva: 'stribrna' },
  selectedStruts: new Set(),
  // Shade cloth per segment: segFromIdx → { barva: 'zelena' }
  shadeCloth: {},
  shadeClothColors: {},  // segFromIdx → barva override
  selectedShadeCloth: new Set(), // segFromIdx keys
  // Multi-selection sets
  selectedPosts: new Set(),
  selectedSegments: new Set(),
  selectedFields: new Set(),      // keys like "segIdx:fieldIdx"
  selectedIntPosts: new Set(),    // keys like "segIdx:intPostIdx"
  selectedWires: new Set(),       // keys like "segIdx:fieldIdx" or "seg:segIdx"
  selectedGates: new Set(),       // keys like "gate:segIdx"
  // History
  history: [],
  historyIndex: -1,
  // Gate dialog
  gateSegmentIndex: -1,
  // Gate dragging in 2D
  draggingGate: null, // { gate, segFrom } when dragging a gate
  // Show detailed dimensions
  showDimensions: false,
  // Terrain: sparse map "x,y" → { surface: 'trava'|'beton'|'hlina'|'pisek'|'dlazba', elevation: meters }
  terrain: {},
  terrainTool: 'paint', // 'paint' only now
  terrainSurface: 'trava', // current brush surface
  terrainBrush: 1,         // brush size (1=single cell, 2=3x3, 3=5x5)
  terrainBlockHeight: 0,   // elevation for painted blocks (meters)
  // House tool
  houses: [],              // array of { vertices: [{x,y},...], height, barva, roofType, roofBarva }
  houseDrawing: null,      // { vertices: [{x,y},...] } - polygon being drawn
  _houseDragging: false,
  houseConfig: { height: 300, barva: 'bila', roofType: 'plochá', roofBarva: 'hneda' },
};

// Terrain surface definitions
const TERRAIN_SURFACES = {
  trava:  { label: 'Tráva',    color2D: '#4a8a3a', color3D: 0x4a8a3a },
  hlina:  { label: 'Hlína',    color2D: '#7a5c3a', color3D: 0x7a5c3a },
  beton:  { label: 'Beton',    color2D: '#8a8e92', color3D: 0x8a8e92 },
  pisek:  { label: 'Písek',    color2D: '#c4a96a', color3D: 0xc4a96a },
  dlazba: { label: 'Dlažba',   color2D: '#6e6e6e', color3D: 0x6e6e6e },
};

function getTerrainAt(gx, gy) {
  const key = `${Math.round(gx)},${Math.round(gy)}`;
  return state.terrain[key] || null;
}

function setTerrainCell(gx, gy, props) {
  const key = `${Math.round(gx)},${Math.round(gy)}`;
  if (!state.terrain[key]) state.terrain[key] = { surface: 'trava', elevation: 0 };
  Object.assign(state.terrain[key], props);
}

function getTerrainElevation(gx, gy) {
  // Block-based: flat elevation per cell, no interpolation
  const key = `${Math.round(gx)},${Math.round(gy)}`;
  return (state.terrain[key] || {}).elevation || 0;
}

function applyTerrainBrush(worldX, worldY) {
  const gx = Math.round(worldX);
  const gy = Math.round(worldY);
  const r = state.terrainBrush - 1; // 0 for 1x1, 1 for 3x3, 2 for 5x5
  const blockH = state.terrainBlockHeight || 0;
  let changed = false;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const cx = gx + dx, cy = gy + dy;
      const key = `${cx},${cy}`;
      const existing = state.terrain[key];
      const needsSurface = !existing || existing.surface !== state.terrainSurface;
      const needsElev = !existing || (existing.elevation || 0) !== blockH;
      if (needsSurface || needsElev) {
        setTerrainCell(cx, cy, { surface: state.terrainSurface, elevation: blockH });
        changed = true;
      }
    }
  }
  if (changed) {
    recalcAndRender();
  }
}

const CELL_SIZE = 24; // px per grid cell at zoom 1 (1 cell = 1m)
const GRID_M = 1.0;   // meters per grid cell

// ============================================================
// AUTO-SAVE / RESTORE STATE
// ============================================================
const APP_SAVE_KEY = 'plotyApp_state';
let _appSaveTimer = null;
function appAutoSave() {
  clearTimeout(_appSaveTimer);
  _appSaveTimer = setTimeout(() => {
    try {
      const toSave = {
        fenceType: state.fenceType,
        config: state.config,
        vertices: state.vertices,
        gates: state.gates,
        manualStruts: state.manualStruts,
        pathBreaks: [...state.pathBreaks],
        segmentStyles: state.segmentStyles,
        postColors: state.postColors,
        strutColors: state.strutColors,
        fieldColors: state.fieldColors,
        intermediatePostColors: state.intermediatePostColors,
        postHeights: state.postHeights,
        intPostHeights: state.intPostHeights,
        fieldHeights: state.fieldHeights,
        wireColors: state.wireColors,
        clipColors: state.clipColors,
        walls: state.walls,
        wallConfig: state.wallConfig,
        shadeCloth: state.shadeCloth,
        shadeClothColors: state.shadeClothColors,
        terrain: state.terrain,
        houses: state.houses,
        houseConfig: state.houseConfig,
        showDimensions: state.showDimensions,
        zoom: state.zoom, panX: state.panX, panY: state.panY
      };
      localStorage.setItem(APP_SAVE_KEY, JSON.stringify(toSave));
    } catch(e) {}
  }, 500);
}
function appAutoRestore() {
  try {
    const raw = localStorage.getItem(APP_SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    state.fenceType = d.fenceType || state.fenceType;
    Object.assign(state.config, d.config || {});
    state.vertices = d.vertices || [];
    state.gates = d.gates || [];
    state.manualStruts = d.manualStruts || [];
    state.pathBreaks = new Set(d.pathBreaks || []);
    state.segmentStyles = d.segmentStyles || {};
    state.postColors = d.postColors || {};
    state.strutColors = d.strutColors || {};
    state.fieldColors = d.fieldColors || {};
    state.intermediatePostColors = d.intermediatePostColors || {};
    state.postHeights = d.postHeights || {};
    state.intPostHeights = d.intPostHeights || {};
    state.fieldHeights = d.fieldHeights || {};
    state.wireColors = d.wireColors || {};
    state.clipColors = d.clipColors || {};
    state.walls = d.walls || [];
    state.wallConfig = d.wallConfig || state.wallConfig;
    state.shadeCloth = d.shadeCloth || {};
    state.shadeClothColors = d.shadeClothColors || {};
    state.terrain = d.terrain || {};
    state.houses = (d.houses || []).map(h => {
      // Migrate old rectangle format to polygon
      if (h.x1 != null && !h.vertices) {
        return {
          vertices: [
            { x: Math.min(h.x1, h.x2), y: Math.min(h.y1, h.y2) },
            { x: Math.max(h.x1, h.x2), y: Math.min(h.y1, h.y2) },
            { x: Math.max(h.x1, h.x2), y: Math.max(h.y1, h.y2) },
            { x: Math.min(h.x1, h.x2), y: Math.max(h.y1, h.y2) },
          ],
          height: h.height, barva: h.barva, roofType: h.roofType, roofBarva: h.roofBarva || 'hneda',
        };
      }
      if (!h.roofBarva) h.roofBarva = 'hneda';
      return h;
    });
    if (d.houseConfig) {
      state.houseConfig = d.houseConfig;
      if (!state.houseConfig.roofBarva) state.houseConfig.roofBarva = 'hneda';
    }
    state.showDimensions = d.showDimensions || false;
    if (d.zoom) { state.zoom = d.zoom; state.panX = d.panX; state.panY = d.panY; }
  } catch(e) {}
}
// MAX_FIELD_M is now dynamic via state.config.maxFieldM (with optional per-segment override)
function getMaxFieldM(segFromIdx) {
  if (segFromIdx !== undefined) {
    const s = state.segmentStyles[segFromIdx];
    if (s && s.maxFieldM) return s.maxFieldM;
  }
  return (state.config && state.config.maxFieldM) || 2.5;
}
const SNAP_RADIUS = 15; // px snap radius
const POST_RADIUS = 7;
const STRUT_LENGTH = 18;

// ============================================================
// CANVAS SETUP
// ============================================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  render();
}

// Restore saved state before first render
appAutoRestore();
// Sync UI inputs from restored state
try {
  const ft = document.querySelector(`input[name="fenceType"][value="${state.fenceType}"]`);
  if (ft) ft.checked = true;
  document.getElementById('cfgHeight').value = state.config.height;
  document.getElementById('showDimensions').checked = state.showDimensions;
  // Sync house config UI
  const hhi = document.getElementById('houseHeight');
  const hri = document.getElementById('houseRoofType');
  if (hhi) hhi.value = state.houseConfig.height;
  if (hri) hri.value = state.houseConfig.roofType;
} catch(e) {}

window.addEventListener('resize', resizeCanvas);

// ============================================================
// COORDINATE HELPERS
// ============================================================
function screenToWorld(sx, sy) {
  return {
    x: (sx - state.panX) / (CELL_SIZE * state.zoom),
    y: (sy - state.panY) / (CELL_SIZE * state.zoom),
  };
}

function worldToScreen(wx, wy) {
  return {
    x: wx * CELL_SIZE * state.zoom + state.panX,
    y: wy * CELL_SIZE * state.zoom + state.panY,
  };
}

function snapToGrid(wx, wy) {
  return {
    x: Math.round(wx),
    y: Math.round(wy),
  };
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist({ x: px, y: py }, { x: ax, y: ay });
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// ============================================================
// HISTORY (UNDO)
// ============================================================
function saveHistory() {
  const snapshot = {
    vertices: JSON.parse(JSON.stringify(state.vertices)),
    gates: JSON.parse(JSON.stringify(state.gates)),
    manualStruts: [...state.manualStruts],
    segmentStyles: JSON.parse(JSON.stringify(state.segmentStyles)),
    postColors: JSON.parse(JSON.stringify(state.postColors)),
    strutColors: JSON.parse(JSON.stringify(state.strutColors)),
    fieldColors: JSON.parse(JSON.stringify(state.fieldColors)),
    intermediatePostColors: JSON.parse(JSON.stringify(state.intermediatePostColors)),
    postHeights: JSON.parse(JSON.stringify(state.postHeights)),
    intPostHeights: JSON.parse(JSON.stringify(state.intPostHeights)),
    fieldHeights: JSON.parse(JSON.stringify(state.fieldHeights)),
    wireColors: JSON.parse(JSON.stringify(state.wireColors)),
    clipColors: JSON.parse(JSON.stringify(state.clipColors)),
    pathBreaks: [...state.pathBreaks],
    walls: JSON.parse(JSON.stringify(state.walls)),
    terrain: JSON.parse(JSON.stringify(state.terrain)),
    shadeCloth: JSON.parse(JSON.stringify(state.shadeCloth)),
    shadeClothColors: JSON.parse(JSON.stringify(state.shadeClothColors)),
    houses: JSON.parse(JSON.stringify(state.houses)),
  };
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
  if (state.history.length > 100) {
    state.history.shift();
    state.historyIndex--;
  }
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    const snap = state.history[state.historyIndex];
    state.vertices = JSON.parse(JSON.stringify(snap.vertices));
    state.gates = JSON.parse(JSON.stringify(snap.gates));
    state.manualStruts = [...snap.manualStruts];
    state.segmentStyles = JSON.parse(JSON.stringify(snap.segmentStyles || {}));
    state.postColors = JSON.parse(JSON.stringify(snap.postColors || {}));
    state.strutColors = JSON.parse(JSON.stringify(snap.strutColors || {}));
    state.fieldColors = JSON.parse(JSON.stringify(snap.fieldColors || {}));
    state.intermediatePostColors = JSON.parse(JSON.stringify(snap.intermediatePostColors || {}));
    state.postHeights = JSON.parse(JSON.stringify(snap.postHeights || snap.postSizes || {}));
    state.intPostHeights = JSON.parse(JSON.stringify(snap.intPostHeights || snap.intPostSizes || {}));
    state.fieldHeights = JSON.parse(JSON.stringify(snap.fieldHeights || snap.fieldSizes || {}));
    state.wireColors = JSON.parse(JSON.stringify(snap.wireColors || {}));
    state.clipColors = JSON.parse(JSON.stringify(snap.clipColors || {}));
    state.pathBreaks = new Set(snap.pathBreaks || []);
    state.walls = JSON.parse(JSON.stringify(snap.walls || []));
    state.terrain = JSON.parse(JSON.stringify(snap.terrain || {}));
    state.shadeCloth = JSON.parse(JSON.stringify(snap.shadeCloth || {}));
    state.shadeClothColors = JSON.parse(JSON.stringify(snap.shadeClothColors || {}));
    state.houses = JSON.parse(JSON.stringify(snap.houses || state.houses));
    state.selectedVertex = -1;
    recalcAndRender();
  }
}

// ============================================================
// FENCE GEOMETRY COMPUTATION
// ============================================================
function getSegments() {
  const segs = [];
  for (let i = 0; i < state.vertices.length - 1; i++) {
    // Skip path breaks (no segment between i and i+1)
    if (state.pathBreaks.has(i)) continue;
    const a = state.vertices[i];
    const b = state.vertices[i + 1];
    const lengthGrid = dist(a, b);
    const lengthM = lengthGrid * GRID_M;
    const gate = state.gates.find(g => g.segmentIndex === i);

    if (gate) {
      const gateWidthM = gate.width / 100;
      // Gate position: positionM = meters from segment start to gate center
      // Support legacy ratio format (position 0-1) and new meters format (positionM)
      let gateCenterM;
      if (gate.positionM != null) {
        gateCenterM = gate.positionM;
      } else {
        // Legacy: position is ratio 0-1
        gateCenterM = lengthM * (gate.position ?? 0.5);
      }
      const halfGate = gateWidthM / 2;
      const gateStartM = Math.max(0, gateCenterM - halfGate);
      const gateEndM = Math.min(lengthM, gateCenterM + halfGate);
      const leftLen = gateStartM;
      const rightLen = lengthM - gateEndM;

      // Compute fields for left and right zones (max spacing, evenly distributed)
      const leftFields = leftLen > 0.1 ? Math.max(1, Math.ceil(leftLen / getMaxFieldM(i))) : 0;
      const rightFields = rightLen > 0.1 ? Math.max(1, Math.ceil(rightLen / getMaxFieldM(i))) : 0;

      segs.push({
        from: i,
        to: i + 1,
        a,
        b,
        lengthM,
        fields: leftFields + rightFields, // total fields excluding gate
        gate,
        gateStartM,
        gateEndM,
        leftFields,
        rightFields,
      });
    } else {
      segs.push({
        from: i,
        to: i + 1,
        a,
        b,
        lengthM,
        fields: Math.max(1, Math.ceil(lengthM / getMaxFieldM(i))),
        gate: null,
      });
    }
  }
  return segs;
}

// Find segment by its `from` vertex index (not array index)
function findSegByFrom(segments, fromIdx) {
  return segments.find(s => s.from === fromIdx) || null;
}

// Get gate center position as ratio (0-1) on a segment
function getGateCenterT(gate, segLengthM) {
  let centerM;
  if (gate.positionM != null) {
    centerM = gate.positionM;
  } else {
    centerM = segLengthM * (gate.position ?? 0.5);
  }
  return centerM / segLengthM;
}

function getIntermediatePosts(segments) {
  // Returns all post positions including intermediate ones
  // Gate segments: posts are only in left/right zones; gate posts replace intermediate posts
  const posts = [];
  if (state.vertices.length === 0) return posts;

  posts.push({ ...state.vertices[0], vertexIndex: 0, type: 'vertex' });

  for (const seg of segments) {
    if (seg.gate) {
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const tGateStart = seg.gateStartM / seg.lengthM;
      const tGateEnd = seg.gateEndM / seg.lengthM;
      const leftFields = seg.leftFields || 0;
      const rightFields = seg.rightFields || 0;

      // Left zone intermediate posts
      for (let f = 1; f < leftFields; f++) {
        const t = (f / leftFields) * tGateStart;
        posts.push({
          x: seg.a.x + dx * t,
          y: seg.a.y + dy * t,
          vertexIndex: -1,
          type: 'intermediate',
        });
      }
      // Gate posts (2)
      posts.push({
        x: seg.a.x + dx * tGateStart,
        y: seg.a.y + dy * tGateStart,
        vertexIndex: -1,
        type: 'gatePost',
      });
      posts.push({
        x: seg.a.x + dx * tGateEnd,
        y: seg.a.y + dy * tGateEnd,
        vertexIndex: -1,
        type: 'gatePost',
      });
      // Right zone intermediate posts
      for (let f = 1; f < rightFields; f++) {
        const t = tGateEnd + (f / rightFields) * (1 - tGateEnd);
        posts.push({
          x: seg.a.x + dx * t,
          y: seg.a.y + dy * t,
          vertexIndex: -1,
          type: 'intermediate',
        });
      }
    } else {
      const fields = seg.fields;
      if (fields > 1) {
        for (let f = 1; f < fields; f++) {
          const t = f / fields;
          posts.push({
            x: seg.a.x + (seg.b.x - seg.a.x) * t,
            y: seg.a.y + (seg.b.y - seg.a.y) * t,
            vertexIndex: -1,
            type: 'intermediate',
          });
        }
      }
    }
    posts.push({ ...seg.b, vertexIndex: seg.to, type: 'vertex' });
  }

  return posts;
}

function isCorner(i) {
  if (i <= 0 || i >= state.vertices.length - 1) return false;
  // Don't detect corners across path breaks
  if (state.pathBreaks.has(i - 1) || state.pathBreaks.has(i)) return false;
  const prev = state.vertices[i - 1];
  const curr = state.vertices[i];
  const next = state.vertices[i + 1];
  const dx1 = curr.x - prev.x;
  const dy1 = curr.y - prev.y;
  const dx2 = next.x - curr.x;
  const dy2 = next.y - curr.y;
  const cross = dx1 * dy2 - dy1 * dx2;
  return Math.abs(cross) > 0.01;
}

function getAngleAtVertex(i) {
  if (i <= 0 || i >= state.vertices.length - 1) return 0;
  if (state.pathBreaks.has(i - 1) || state.pathBreaks.has(i)) return 0;
  const prev = state.vertices[i - 1];
  const curr = state.vertices[i];
  const next = state.vertices[i + 1];
  const a1 = Math.atan2(prev.y - curr.y, prev.x - curr.x);
  const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
  return (a1 + a2) / 2;
}

function getStrutPositions(segments) {
  const struts = [];
  if (state.vertices.length < 2) return struts;

  const last = state.vertices.length - 1;

  function angleToward(fromIdx, toIdx) {
    const from = state.vertices[fromIdx];
    const to = state.vertices[toIdx];
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  function pushVertex(idx, reason, angle2D) {
    const v = state.vertices[idx];
    struts.push({ vertexIndex: idx, wx: v.x, wy: v.y, reason, angle2D });
  }

  // Find all path section start/end vertices (respecting pathBreaks)
  // Each section is a contiguous run of vertices with no break between them
  const sectionStarts = new Set();
  const sectionEnds = new Set();
  {
    let sectionStart = 0;
    for (let i = 0; i < state.vertices.length; i++) {
      if (i === 0 || state.pathBreaks.has(i - 1)) {
        sectionStart = i;
        sectionStarts.add(i);
      }
      if (i === state.vertices.length - 1 || state.pathBreaks.has(i)) {
        sectionEnds.add(i);
      }
    }
  }

  // Start/End struts for each section
  for (const seg of segments) {
    // Start of section: strut pointing inward (toward next vertex)
    if (sectionStarts.has(seg.from)) {
      pushVertex(seg.from, 'začátek', angleToward(seg.from, seg.to));
    }
    // End of section: strut pointing inward (toward previous vertex)
    if (sectionEnds.has(seg.to)) {
      pushVertex(seg.to, 'konec', angleToward(seg.to, seg.from));
    }
  }

  // Corners: TWO struts – one along each fence arm, both pointing away from corner
  for (let i = 1; i < state.vertices.length - 1; i++) {
    if (isCorner(i)) {
      pushVertex(i, 'změna směru', angleToward(i, i - 1));
      pushVertex(i, 'změna směru', angleToward(i, i + 1));
    }
  }

  // Group segments into contiguous sections (split by pathBreaks)
  const sections = [];
  {
    let currentSection = [];
    for (const seg of segments) {
      if (currentSection.length > 0) {
        const prevSeg = currentSection[currentSection.length - 1];
        if (prevSeg.to !== seg.from) {
          // Discontinuity — start new section
          sections.push(currentSection);
          currentSection = [];
        }
      }
      currentSection.push(seg);
    }
    if (currentSection.length > 0) sections.push(currentSection);
  }

  // Process each section independently for 25m struts
  for (const section of sections) {
    // Build list of every post with cumulative distance from section start
    const allPosts = [];
    let d = 0;
    for (const seg of section) {
      const segAngle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
      const fieldRanges = getFieldRanges(seg);

      allPosts.push({
        wx: seg.a.x, wy: seg.a.y,
        dist: d, segAngle,
        vertexIndex: seg.from,
      });

      for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
        const t = fieldRanges[fi].t1;
        allPosts.push({
          wx: seg.a.x + (seg.b.x - seg.a.x) * t,
          wy: seg.a.y + (seg.b.y - seg.a.y) * t,
          dist: d + seg.lengthM * t,
          segAngle,
          vertexIndex: -1,
        });
      }

      allPosts.push({
        wx: seg.b.x, wy: seg.b.y,
        dist: d + seg.lengthM, segAngle,
        vertexIndex: seg.to,
      });

      d += seg.lengthM;
    }
    // Deduplicate
    const deduped = [];
    for (const p of allPosts) {
      if (deduped.length === 0 || Math.abs(p.dist - deduped[deduped.length - 1].dist) > 0.01) {
        deduped.push(p);
      }
    }
    allPosts.length = 0;
    allPosts.push(...deduped);

    const totalLen = d;

    // Gate exclusion zones within this section
    const gateZones = [];
    {
      let cumDist = 0;
      for (const seg of section) {
        if (seg.gate) {
          gateZones.push({
            d0: cumDist + seg.gateStartM,
            d1: cumDist + seg.gateEndM,
            segAngle: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x),
          });
        }
        cumDist += seg.lengthM;
      }
    }

    function isInGateZone(dist) {
      for (const gz of gateZones) {
        if (dist >= gz.d0 - 0.05 && dist <= gz.d1 + 0.05) return true;
      }
      return false;
    }

    // Fixed strut distances (start, end, corners, gate boundaries)
    const fixedStrutDists = [0, totalLen];
    {
      let cumD = 0;
      for (const seg of section) {
        if (seg.from > 0 && isCorner(seg.from)) {
          fixedStrutDists.push(cumD);
        }
        cumD += seg.lengthM;
      }
    }
    for (const gz of gateZones) {
      fixedStrutDists.push(gz.d0);
      fixedStrutDists.push(gz.d1);
    }
    fixedStrutDists.sort((a, b) => a - b);

    // For each gap between consecutive fixed strut points, add 25m struts if needed
    if (totalLen > 0) {
      const usedPostKeys = new Set();
      for (let g = 0; g < fixedStrutDists.length - 1; g++) {
        const gapStart = fixedStrutDists[g];
        const gapEnd = fixedStrutDists[g + 1];
        const gapLen = gapEnd - gapStart;
        if (gapLen <= 25) continue;

        const intervals = Math.ceil(gapLen / 25);
        const spacing = gapLen / intervals;

        for (let i = 1; i < intervals; i++) {
          const markDist = gapStart + i * spacing;
          let best = null;
          let bestDiff = Infinity;
          for (const p of allPosts) {
            if (p.dist < 0.01 || p.dist > totalLen - 0.01) continue;
            if (isInGateZone(p.dist)) continue;
            const diff = Math.abs(p.dist - markDist);
            if (diff < bestDiff) { bestDiff = diff; best = p; }
          }
          if (!best) continue;
          const key = Math.round(best.dist * 100);
          if (usedPostKeys.has(key)) continue;
          usedPostKeys.add(key);
          if (best.vertexIndex >= 0 && struts.find(s => s.vertexIndex === best.vertexIndex)) continue;
          let onGateBoundary = false;
          for (const gz of gateZones) {
            if (Math.abs(best.dist - gz.d0) < 0.5 || Math.abs(best.dist - gz.d1) < 0.5) {
              onGateBoundary = true;
              break;
            }
          }
          if (onGateBoundary) continue;
          struts.push({ vertexIndex: best.vertexIndex, wx: best.wx, wy: best.wy, reason: 'po 25 m', angle2D: best.segAngle + Math.PI });
          struts.push({ vertexIndex: best.vertexIndex, wx: best.wx, wy: best.wy, reason: 'po 25 m', angle2D: best.segAngle });
        }
      }
    }
  }

  // At gates – always place vzpěry at the actual gate posts, pointing away from gate
  for (const gate of state.gates) {
    const seg = findSegByFrom(segments, gate.segmentIndex);
    if (!seg) continue;
    const segAngle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
    const tGateStart = seg.gateStartM / seg.lengthM;
    const tGateEnd = seg.gateEndM / seg.lengthM;
    // Left gate post – vzpěra pointing away from gate (toward segment start)
    const gp1x = seg.a.x + (seg.b.x - seg.a.x) * tGateStart;
    const gp1y = seg.a.y + (seg.b.y - seg.a.y) * tGateStart;
    struts.push({ vertexIndex: -1, wx: gp1x, wy: gp1y, reason: 'u brány/branky', angle2D: segAngle + Math.PI });
    // Right gate post – vzpěra pointing away from gate (toward segment end)
    const gp2x = seg.a.x + (seg.b.x - seg.a.x) * tGateEnd;
    const gp2y = seg.a.y + (seg.b.y - seg.a.y) * tGateEnd;
    struts.push({ vertexIndex: -1, wx: gp2x, wy: gp2y, reason: 'u brány/branky', angle2D: segAngle });
  }

  // Manual struts
  for (const ms of state.manualStruts) {
    if (!struts.find(s => s.vertexIndex === ms)) {
      const angle = ms < last ? angleToward(ms, ms + 1) : angleToward(ms, ms - 1);
      pushVertex(ms, 'ruční', angle);
    }
  }

  return struts;
}

// ============================================================
// RENDERING
// ============================================================
function render() {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  ctx.save();

  // Draw terrain cells (before grid)
  drawTerrainCells2D(w, h);

  // Draw grid
  drawGrid(w, h);

  // Draw houses (behind walls and fence)
  drawHouses2D();

  // Draw walls (behind fence)
  drawWalls2D();

  // Draw fence
  const segments = getSegments();
  drawConcreteFoundations2D(segments);
  drawFenceSegments(segments);
  drawBindingWires2D(segments);
  drawGates(segments);
  drawIntermediatePosts(segments);
  drawVertexPosts();
  drawPrichytky2D(segments);
  drawStruts(segments);
  drawMeasurements(segments);
  drawDetailedDimensions(segments);
  drawGhostPreview();

  ctx.restore();
  appAutoSave();
}

// ============================================================
// GHOST/PREVIEW LINE
// ============================================================
function drawGhostPreview() {
  if (!state.ghostCursor) return;

  if (state.tool === 'draw' && state.vertices.length > 0) {
    // Find the last vertex that is the "current" drawing endpoint
    const lastIdx = state.vertices.length - 1;
    // Don't show ghost if the path is "finished" (has a break at the end)
    if (state.pathBreaks.has(lastIdx)) return;
    const last = state.vertices[lastIdx];
    // Only draw if not at the same position
    if (last.x === state.ghostCursor.x && last.y === state.ghostCursor.y) return;
    const s1 = worldToScreen(last.x, last.y);
    const s2 = worldToScreen(state.ghostCursor.x, state.ghostCursor.y);

    // Ghost line
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();

    // Ghost endpoint circle
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
    ctx.beginPath();
    ctx.arc(s2.x, s2.y, POST_RADIUS * state.zoom * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Length label
    const dx = state.ghostCursor.x - last.x;
    const dy = state.ghostCursor.y - last.y;
    const lengthM = Math.sqrt(dx * dx + dy * dy) * GRID_M;
    if (lengthM > 0.1) {
      const mx = (s1.x + s2.x) / 2;
      const my = (s1.y + s2.y) / 2;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(52, 152, 219, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(lengthM.toFixed(1) + ' m', mx, my - 6);
    }
    ctx.restore();
  }

  if (state.tool === 'wall' && state.wallDrawing && state.wallDrawing.vertices.length > 0) {
    const last = state.wallDrawing.vertices[state.wallDrawing.vertices.length - 1];
    if (last.x === state.ghostCursor.x && last.y === state.ghostCursor.y) return;
    const s1 = worldToScreen(last.x, last.y);
    const s2 = worldToScreen(state.ghostCursor.x, state.ghostCursor.y);

    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(149, 165, 166, 0.6)';
    ctx.lineWidth = getWallThicknessPx(state.wallConfig.thickness);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();

    // Length label
    const dx = state.ghostCursor.x - last.x;
    const dy = state.ghostCursor.y - last.y;
    const lengthM = Math.sqrt(dx * dx + dy * dy) * GRID_M;
    if (lengthM > 0.1) {
      const mx = (s1.x + s2.x) / 2;
      const my = (s1.y + s2.y) / 2;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(127, 140, 141, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(lengthM.toFixed(1) + ' m', mx, my - 6);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // House tool ghost preview (polygon)
  if (state.tool === 'house' && state.houseDrawing && state.houseDrawing.vertices.length > 0 && state.ghostCursor) {
    const verts = state.houseDrawing.vertices;
    const screenVerts = verts.map(v => worldToScreen(v.x, v.y));
    const ghostScreen = worldToScreen(state.ghostCursor.x, state.ghostCursor.y);

    ctx.save();
    // Draw filled polygon
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(142, 68, 173, 0.7)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(142, 68, 173, 0.12)';
    ctx.beginPath();
    ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
    for (let i = 1; i < screenVerts.length; i++) {
      ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
    }
    ctx.lineTo(ghostScreen.x, ghostScreen.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw vertex dots
    ctx.setLineDash([]);
    for (const sv of screenVerts) {
      ctx.fillStyle = 'rgba(142, 68, 173, 0.6)';
      ctx.beginPath();
      ctx.arc(sv.x, sv.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ghost line from last vertex to cursor
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const lastS = screenVerts[screenVerts.length - 1];
    ctx.moveTo(lastS.x, lastS.y);
    ctx.lineTo(ghostScreen.x, ghostScreen.y);
    ctx.stroke();

    // Length label
    const lastV = verts[verts.length - 1];
    const edgeLen = Math.sqrt((state.ghostCursor.x - lastV.x) ** 2 + (state.ghostCursor.y - lastV.y) ** 2) * GRID_M;
    if (edgeLen > 0.1) {
      ctx.setLineDash([]);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(142, 68, 173, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(edgeLen.toFixed(1) + ' m', (lastS.x + ghostScreen.x) / 2, Math.min(lastS.y, ghostScreen.y) - 4);
    }
    ctx.restore();
  }
}

function getWallThicknessPx(thicknessCm) {
  // Convert wall thickness in cm to screen pixels
  return Math.max(4, (thicknessCm / 100) * CELL_SIZE * state.zoom);
}

// ============================================================
// HOUSE COLORS & 2D RENDERING
// ============================================================
const HOUSE_COLORS_2D = {
  bila: '#ecf0f1', zluta: '#f8e473', oranzova: '#e8a040',
  cervena: '#c0392b', modra: '#5dade2', zelena: '#58d68d',
};
const HOUSE_COLORS_3D = {
  bila: 0xecf0f1, zluta: 0xf8e473, oranzova: 0xe8a040,
  cervena: 0xc0392b, modra: 0x5dade2, zelena: 0x58d68d,
};
const HOUSE_ROOF_COLORS_3D = {
  hneda: 0x8b4513, cervena: 0x8b2500, seda: 0x6e6e6e,
  cerna: 0x2c2c2c, zelena: 0x2d572c, modra: 0x34495e,
};

function drawHouses2D() {
  for (const house of state.houses) {
    _drawHouse2D(house, 1.0);
  }
}

function _drawHouse2D(house, alpha) {
  if (!house.vertices || house.vertices.length < 3) return;
  const screenVerts = house.vertices.map(v => worldToScreen(v.x, v.y));
  const color = HOUSE_COLORS_2D[house.barva] || '#ecf0f1';

  ctx.save();
  ctx.globalAlpha = alpha;

  // Filled polygon
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
  for (let i = 1; i < screenVerts.length; i++) {
    ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label at centroid
  const cx = screenVerts.reduce((s, v) => s + v.x, 0) / screenVerts.length;
  const cy = screenVerts.reduce((s, v) => s + v.y, 0) / screenVerts.length;
  // Compute bounding box for size
  const xs = house.vertices.map(v => v.x);
  const ys = house.vertices.map(v => v.y);
  const widthM = (Math.max(...xs) - Math.min(...xs)) * GRID_M;
  const depthM = (Math.max(...ys) - Math.min(...ys)) * GRID_M;
  ctx.fillStyle = '#2c3e50';
  ctx.font = `bold ${Math.max(10, 11 * state.zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🏠 ${widthM.toFixed(1)}×${depthM.toFixed(1)}m`, cx, cy);

  ctx.restore();
}

const WALL_COLORS_2D = {
  stribrna: '#bdc3c7',
  zelena: '#27ae60',
  antracit: '#4a4f52',
  bila: '#ecf0f1',
  hneda: '#8b6914',
  cervena: '#c0392b',
};
const WALL_COLORS_3D = {
  stribrna: 0xbdc3c7,
  zelena: 0x2ecc71,
  antracit: 0x4a4f52,
  bila: 0xecf0f1,
  hneda: 0x8b6914,
  cervena: 0xc0392b,
};

function drawWalls2D() {
  // Draw completed walls
  for (const wall of state.walls) {
    drawWallPath2D(wall.vertices, wall.thickness, wall.barva, 1.0);
  }
  // Draw wall being drawn
  if (state.wallDrawing && state.wallDrawing.vertices.length >= 2) {
    drawWallPath2D(state.wallDrawing.vertices, state.wallConfig.thickness, state.wallConfig.barva, 0.7);
  }
}

function drawWallPath2D(vertices, thicknessCm, barva, alpha) {
  if (vertices.length < 2) return;
  const color = WALL_COLORS_2D[barva] || '#bdc3c7';
  const thickPx = getWallThicknessPx(thicknessCm);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const s0 = worldToScreen(vertices[0].x, vertices[0].y);
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = worldToScreen(vertices[i].x, vertices[i].y);
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = thickPx + 2;
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = worldToScreen(vertices[i].x, vertices[i].y);
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();

  // Redraw fill on top of border
  ctx.strokeStyle = color;
  ctx.lineWidth = thickPx;
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = worldToScreen(vertices[i].x, vertices[i].y);
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();

  // Vertex dots for wall
  for (let i = 0; i < vertices.length; i++) {
    const s = worldToScreen(vertices[i].x, vertices[i].y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// Generate procedural texture patterns (cached)
const _terrainPatternCache = {};
function getTerrainPattern(surface) {
  if (_terrainPatternCache[surface]) return _terrainPatternCache[surface];
  const sz = 48;
  const oc = document.createElement('canvas');
  oc.width = sz; oc.height = sz;
  const ox = oc.getContext('2d');
  const def = TERRAIN_SURFACES[surface];
  ox.fillStyle = def.color2D;
  ox.fillRect(0, 0, sz, sz);

  if (surface === 'trava') {
    // Soft color variation (no dark patches)
    for (let i = 0; i < 30; i++) {
      const v = Math.random();
      ox.fillStyle = v < 0.5
        ? `rgba(${55+Math.random()*30},${100+Math.random()*35},${30+Math.random()*20},0.15)`
        : `rgba(${65+Math.random()*30},${115+Math.random()*30},${40+Math.random()*20},0.12)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 2+Math.random()*5, 1+Math.random()*4);
    }
    // Grass blades - medium to bright greens, curved
    for (let i = 0; i < 100; i++) {
      const rx = Math.random() * sz, ry = Math.random() * sz;
      const shade = Math.random();
      const r = shade < 0.4 ? 50+Math.random()*30 : 65+Math.random()*35;
      const g = shade < 0.4 ? 100+Math.random()*35 : 120+Math.random()*30;
      const b = shade < 0.4 ? 25+Math.random()*18 : 35+Math.random()*18;
      ox.strokeStyle = `rgba(${r},${g},${b},${0.4+Math.random()*0.3})`;
      ox.lineWidth = 0.5 + Math.random() * 0.5;
      const bladeH = 2 + Math.random() * 4;
      const sway = (Math.random()-0.5) * 2;
      ox.beginPath(); ox.moveTo(rx, ry); ox.quadraticCurveTo(rx + sway*0.5, ry - bladeH*0.6, rx + sway, ry - bladeH); ox.stroke();
    }
  } else if (surface === 'hlina') {
    // Layered dirt: dark moist patches, lighter dry areas, stones, cracks
    // Moisture/dark patches
    for (let i = 0; i < 12; i++) {
      ox.fillStyle = `rgba(${55+Math.random()*30},${40+Math.random()*20},${20+Math.random()*15},0.3)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 2+Math.random()*5, 0, Math.PI*2); ox.fill();
    }
    // Grainy texture
    for (let i = 0; i < 150; i++) {
      const v = Math.random();
      const r = v < 0.4 ? 90+Math.random()*40 : 110+Math.random()*50;
      const g = v < 0.4 ? 65+Math.random()*30 : 80+Math.random()*40;
      const b = v < 0.4 ? 30+Math.random()*20 : 40+Math.random()*25;
      ox.fillStyle = `rgba(${r},${g},${b},${0.2+Math.random()*0.25})`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 0.8+Math.random()*2.5, 0.5+Math.random()*1.5);
    }
    // Small stones
    for (let i = 0; i < 8; i++) {
      const sv = 100+Math.random()*60;
      ox.fillStyle = `rgba(${sv},${sv-10},${sv-20},0.4)`;
      const rx = Math.random()*sz, ry = Math.random()*sz, rr = 0.8+Math.random()*1.8;
      ox.beginPath(); ox.ellipse(rx, ry, rr, rr*0.7, Math.random()*Math.PI, 0, Math.PI*2); ox.fill();
    }
    // Fine cracks
    ox.strokeStyle = 'rgba(50,35,18,0.15)';
    ox.lineWidth = 0.4;
    for (let i = 0; i < 3; i++) {
      ox.beginPath();
      let cx = Math.random()*sz, cy = Math.random()*sz;
      ox.moveTo(cx, cy);
      for (let j = 0; j < 3; j++) { cx += (Math.random()-0.5)*8; cy += (Math.random()-0.5)*8; ox.lineTo(cx, cy); }
      ox.stroke();
    }
  } else if (surface === 'beton') {
    // Concrete: aggregate speckle, surface variation, cracks, subtle staining
    // Surface color variation (light/dark patches)
    for (let i = 0; i < 25; i++) {
      const v = 120+Math.random()*50;
      ox.fillStyle = `rgba(${v},${v+2},${v+5},0.15)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 2+Math.random()*6, 0, Math.PI*2); ox.fill();
    }
    // Aggregate speckle (tiny stones visible in concrete)
    for (let i = 0; i < 100; i++) {
      const v = Math.random();
      const bright = v < 0.5 ? 105+Math.random()*35 : 150+Math.random()*40;
      ox.fillStyle = `rgba(${bright},${bright-3},${bright+2},${0.15+Math.random()*0.2})`;
      const r = 0.3 + Math.random() * 1.2;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, r, 0, Math.PI*2); ox.fill();
    }
    // Fine surface texture
    for (let i = 0; i < 60; i++) {
      ox.fillStyle = `rgba(${125+Math.random()*45},${128+Math.random()*45},${132+Math.random()*40},0.12)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 1+Math.random()*3, 0.5+Math.random()*2);
    }
    // Hairline cracks
    ox.strokeStyle = 'rgba(90,90,95,0.18)';
    ox.lineWidth = 0.3;
    for (let i = 0; i < 3; i++) {
      ox.beginPath();
      let cx = Math.random()*sz, cy = Math.random()*sz;
      ox.moveTo(cx, cy);
      for (let j = 0; j < 5; j++) { cx += (Math.random()-0.5)*10; cy += (Math.random()-0.5)*10; ox.lineTo(cx, cy); }
      ox.stroke();
    }
    // Subtle dark stain
    for (let i = 0; i < 4; i++) {
      ox.fillStyle = `rgba(70,72,75,0.06)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 3+Math.random()*5, 0, Math.PI*2); ox.fill();
    }
  } else if (surface === 'pisek') {
    for (let i = 0; i < 200; i++) {
      const v = Math.random();
      ox.fillStyle = `rgba(${170+Math.random()*60},${145+Math.random()*50},${80+Math.random()*40},${0.2+Math.random()*0.25})`;
      const r = 0.3 + Math.random() * 1.2;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, r, 0, Math.PI*2); ox.fill();
    }
    // Wave ripples
    ox.strokeStyle = 'rgba(160,130,70,0.1)';
    ox.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = 6 + i * 10 + Math.random()*4;
      ox.beginPath(); ox.moveTo(0, y);
      for (let x = 0; x <= sz; x += 4) ox.quadraticCurveTo(x+2, y+(Math.random()-0.5)*2, x+4, y);
      ox.stroke();
    }
  } else if (surface === 'dlazba') {
    ox.strokeStyle = 'rgba(40,40,40,0.35)';
    ox.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      const y = row * 12;
      ox.beginPath(); ox.moveTo(0, y); ox.lineTo(sz, y); ox.stroke();
      const offset = row % 2 === 0 ? 0 : 12;
      for (let col = offset; col < sz; col += 24) {
        ox.beginPath(); ox.moveTo(col, y); ox.lineTo(col, y + 12); ox.stroke();
      }
    }
    // Subtle color variation per brick
    for (let i = 0; i < 30; i++) {
      ox.fillStyle = `rgba(${80+Math.random()*50},${80+Math.random()*50},${80+Math.random()*50},0.08)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 8+Math.random()*8, 4+Math.random()*6);
    }
  }
  const pattern = ctx.createPattern(oc, 'repeat');
  _terrainPatternCache[surface] = pattern;
  return pattern;
}

function drawTerrainCells2D(w, h) {
  const cellPx = CELL_SIZE * state.zoom;
  const keys = Object.keys(state.terrain);
  if (keys.length === 0) return;

  for (const key of keys) {
    const cell = state.terrain[key];
    const surface = cell.surface || 'trava';
    const elev = cell.elevation || 0;
    // Skip flat grass (default background)
    if (surface === 'trava' && elev === 0) continue;

    const parts = key.split(',');
    const gx = parseInt(parts[0]), gy = parseInt(parts[1]);
    const sx = gx * cellPx * GRID_M + state.panX;
    const sy = gy * cellPx * GRID_M + state.panY;
    // Skip if off-screen
    if (sx + cellPx < 0 || sx > w || sy + cellPx < 0 || sy > h) continue;

    // Draw surface
    if (surface !== 'trava') {
      const pattern = getTerrainPattern(surface);
      ctx.fillStyle = pattern;
      ctx.fillRect(sx - cellPx/2, sy - cellPx/2, cellPx, cellPx);
    }

    // Draw elevation label for elevated blocks
    if (elev > 0) {
      // Slight border to indicate raised block
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - cellPx/2, sy - cellPx/2, cellPx, cellPx);
      // Height label
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `${Math.max(8, cellPx * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + (elev * 100).toFixed(0) + 'cm', sx, sy);
    }
  }
}

function drawGrid(w, h) {
  const cellPx = CELL_SIZE * state.zoom;
  const startX = state.panX % cellPx;
  const startY = state.panY % cellPx;

  // Minor grid
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim() || '#e8e8e8';
  ctx.lineWidth = 0.5;
  for (let x = startX; x < w; x += cellPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = startY; y < h; y += cellPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Major grid (every 5 cells = 5m)
  const majorStep = cellPx * 5;
  const majorStartX = state.panX % majorStep;
  const majorStartY = state.panY % majorStep;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-line-major').trim() || '#d0d0d0';
  ctx.lineWidth = 1;
  for (let x = majorStartX; x < w; x += majorStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = majorStartY; y < h; y += majorStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Grid intersection dots
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-line-major').trim() || '#d0d0d0';
  for (let x = startX; x < w; x += cellPx) {
    for (let y = startY; y < h; y += cellPx) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// PER-SEGMENT STYLE HELPERS
// ============================================================
const FENCE_COLORS_2D = {
  zelena:   '#27ae60',
  antracit: '#4a4f52',
  stribrna: '#c8d0d4',
};
const FENCE_COLORS_3D = {
  zelena:   0x2ecc71,
  antracit: 0x4a4f52,
  stribrna: 0xc8d0d4,
};
const POST_COLORS_2D = {
  zelena:   '#27ae60',
  antracit: '#4a4f52',
  stribrna: '#c8d0d4',
};
const POST_COLORS_3D = {
  zelena:   0x2ecc71,
  antracit: 0x4a4f52,
  stribrna: 0xc8d0d4,
};
const SHADE_COLORS_2D = {
  zelena:   '#1a7a3f',
  antracit: '#3a3f42',
  stribrna: '#a0a8ac',
};
const SHADE_COLORS_3D = {
  zelena:   0x1a7a3f,
  antracit: 0x3a3f42,
  stribrna: 0xa0a8ac,
};

function getShadeClothColor2D(segFromIdx) {
  const barva = state.shadeClothColors[segFromIdx] || 'zelena';
  return SHADE_COLORS_2D[barva] || SHADE_COLORS_2D.zelena;
}
function getShadeClothColor3D(segFromIdx) {
  const barva = state.shadeClothColors[segFromIdx] || 'zelena';
  return SHADE_COLORS_3D[barva] || SHADE_COLORS_3D.zelena;
}

function getPostColor2D(vertexIndex) {
  // Betonový plot: concrete post color
  if (state.fenceType === 'betonovy') {
    const bc = { seda: '#aaaaaa', piskova: '#c8b88a', hneda: '#8b6f4e', cervena: '#a0584a' };
    return bc[state.config.betonBarva] || '#aaaaaa';
  }
  const barva = state.postColors[vertexIndex];
  if (!barva || barva === 'zelena') return '#27ae60'; // default green
  if (barva === 'antracit') return '#4a4f52';
  if (barva === 'stribrna') return '#c8d0d4';
  return '#27ae60';
}

function getPostColor3D(vertexIndex) {
  // Betonový plot: concrete post color
  if (state.fenceType === 'betonovy') {
    return BETON_COLORS_3D[state.config.betonBarva] || BETON_COLORS_3D.seda;
  }
  const barva = state.postColors[vertexIndex];
  if (!barva || barva === 'zelena') return 0x2ecc71; // default green
  if (barva === 'antracit') return 0x4a4f52;
  if (barva === 'stribrna') return 0xc8d0d4;
  return 0x2ecc71;
}

function getStrutKey(strut) {
  return `${strut.wx.toFixed(2)},${strut.wy.toFixed(2)}`;
}

function getStrutColor2D(strut) {
  const barva = state.strutColors[getStrutKey(strut)];
  if (!barva) return '#27ae60'; // no color set = default green
  if (barva === 'zelena') return '#27ae60';
  if (barva === 'antracit') return '#4a4f52';
  if (barva === 'stribrna') return '#c8d0d4';
  return '#27ae60';
}

function getStrutColor3D(strut) {
  const barva = state.strutColors[getStrutKey(strut)];
  if (!barva) return 0x2ecc71; // default green
  if (barva === 'zelena') return 0x2ecc71;
  if (barva === 'antracit') return 0x4a4f52;
  if (barva === 'stribrna') return 0xc8d0d4;
  return 0x2ecc71;
}

function getClipKey(type, id1, id2) {
  // type='v' for vertex post, type='i' for intermediate post
  if (type === 'v') return `v:${id1}`;
  return `i:${id1}:${id2}`;
}

function getClipColor2D(key) {
  const barva = state.clipColors[key];
  if (!barva) return '#34c766'; // default green
  if (barva === 'zelena') return '#34c766';
  if (barva === 'antracit') return '#4a4f52';
  if (barva === 'stribrna') return '#e8eef2';
  return '#34c766';
}

function getClipColor3D(key) {
  const barva = state.clipColors[key];
  if (!barva) return 0x34c766; // default green
  if (barva === 'zelena') return 0x34c766;
  if (barva === 'antracit') return 0x4a4f52;
  if (barva === 'stribrna') return 0xe8eef2;
  return 0x34c766;
}

function getSegStyle(seg) {
  // Returns { fenceType, barva, noPodhrab, height, podhrabVyska, typSloupku } for this segment
  const s = state.segmentStyles[seg.from];
  let noPodhrab = false;
  if (s && typeof s.podhrab === 'boolean') {
    noPodhrab = !s.podhrab;
  } else {
    noPodhrab = !state.config.podhraboveDesky;
  }
  return {
    fenceType: (s && s.fenceType) ? s.fenceType : state.fenceType,
    barva:     (s && s.barva)     ? s.barva     : (state.config.barva2D || 'zelena'),
    noPodhrab,
    height:    (s && s.height)    ? s.height    : state.config.height, // cm
    podhrabVyska: (s && s.podhrabVyska) ? s.podhrabVyska : state.config.podhrabovaVyska, // cm
    maxFieldM: (s && s.maxFieldM) ? s.maxFieldM : (state.config.maxFieldM || 2.5),
    typSloupku: (s && s.typSloupku) ? s.typSloupku : state.config.typSloupku,
    flipped: !!(s && s.flipped),
  };
}

// Effective fence height for a segment (cm)
function getSegFenceH(seg) {
  return getSegStyle(seg).height;
}

// Effective podhrab height for a segment (cm), 0 if no podhrab
function getSegPodhrabH(seg) {
  const ss = getSegStyle(seg);
  return ss.noPodhrab ? 0 : ss.podhrabVyska;
}

// Default post height for a segment context (cm) = fenceH + podhrabH + 70 underground
function getSegDefaultPostH(seg) {
  const fH = getSegFenceH(seg);
  const pH = getSegPodhrabH(seg);
  return fH + pH + 70; // výška pletiva + podhrab + 70 cm (10 cm mezery/čepička + 60 cm zapuštění)
}

// Effective field fence height (cm) - per-field override or segment default
function getFieldFenceH(segFrom, fieldIdx, seg) {
  const key = getFieldKey(segFrom, fieldIdx);
  const override = state.fieldHeights[key];
  if (override && override > 0) return override;
  return getSegFenceH(seg);
}

// Wire count for a segment: 4 if fenceH > 180, 3 if > 125, else 2
function getSegWireCount(seg) {
  const h = getSegFenceH(seg);
  return h > 180 ? 4 : h > 125 ? 3 : 2;
}

// Effective post height for vertex post (cm) - takes max of all adjacent segments
function getVertexPostH(vertIdx) {
  const override = state.postHeights[vertIdx];
  if (override && override > 0) return override;
  // Find max default from adjacent segments
  const segments = getSegments();
  let maxH = 0;
  for (const seg of segments) {
    if (seg.from === vertIdx || seg.to === vertIdx) {
      maxH = Math.max(maxH, getSegDefaultPostH(seg));
    }
  }
  return maxH || (state.config.height + 70);
}

// Effective intermediate post height (cm)
function getIntPostH(segFrom, intPostIdx, seg) {
  const key = getFieldKey(segFrom, intPostIdx);
  const override = state.intPostHeights[key];
  if (override && override > 0) return override;
  return getSegDefaultPostH(seg);
}

// Returns Three.js hex color for a segment's barva (used in 3D panel override)
function getPanelColor3D(segFromIdx) {
  const s = state.segmentStyles[segFromIdx];
  const barva = s && s.barva ? s.barva : null;
  if (!barva) return null;
  return FENCE_COLORS_3D[barva] || null;
}

function getSegColor2D(seg) {
  const { fenceType, barva } = getSegStyle(seg);
  if (fenceType === 'betonovy') return '#7f8c8d';
  if (fenceType === 'panely_2d' || fenceType === 'panely_3d') return FENCE_COLORS_2D[barva] || FENCE_COLORS_2D.zelena;
  // pletivo – barva
  return FENCE_COLORS_2D[barva] || FENCE_COLORS_2D.zelena;
}

function getSegColor3D(seg) {
  const { fenceType, barva } = getSegStyle(seg);
  if (fenceType === 'betonovy') return 0x999999;
  return FENCE_COLORS_3D[barva] || FENCE_COLORS_3D.zelena;
}

// Per-field color helpers
function getFieldKey(segIdx, fieldIdx) {
  return segIdx + ':' + fieldIdx;
}

function getFieldColor2D(segIdx, fieldIdx, fallbackColor) {
  const barva = state.fieldColors[getFieldKey(segIdx, fieldIdx)];
  if (!barva) return fallbackColor;
  return FENCE_COLORS_2D[barva] || fallbackColor;
}

function getFieldColor3D(segIdx, fieldIdx, fallbackColor) {
  const barva = state.fieldColors[getFieldKey(segIdx, fieldIdx)];
  if (!barva) return fallbackColor;
  return FENCE_COLORS_3D[barva] || fallbackColor;
}

function getIntPostColor2D(segIdx, intPostIdx) {
  const barva = state.intermediatePostColors[getFieldKey(segIdx, intPostIdx)];
  if (!barva || barva === 'zelena') return '#27ae60'; // default green
  if (barva === 'antracit') return '#4a4f52';
  if (barva === 'stribrna') return '#c8d0d4';
  return '#27ae60';
}

function getIntPostColor3D(segIdx, intPostIdx) {
  const barva = state.intermediatePostColors[getFieldKey(segIdx, intPostIdx)];
  if (!barva || barva === 'zelena') return 0x2ecc71; // default green
  if (barva === 'antracit') return 0x4a4f52;
  if (barva === 'stribrna') return 0xc8d0d4;
  return 0x2ecc71;
}

// Wire color helpers
function getWireColor3D(segIdx, fieldIdx) {
  const barva = state.wireColors[getFieldKey(segIdx, fieldIdx)];
  if (!barva) return 0x2ecc71; // default green
  if (barva === 'zelena') return 0x2ecc71;
  if (barva === 'antracit') return 0x4a4f52;
  if (barva === 'stribrna') return 0xc8d0d4;
  return 0x2ecc71;
}

function getWireColor2D(segIdx, fieldIdx) {
  const barva = state.wireColors[getFieldKey(segIdx, fieldIdx)];
  if (!barva) return '#27ae60'; // default green
  if (barva === 'zelena') return '#27ae60';
  if (barva === 'antracit') return '#4a4f52';
  if (barva === 'stribrna') return '#c8d0d4';
  return '#27ae60';
}

// Build a canvas texture with the chain-link diamond pattern (čtyřhranné pletivo)
function makeChainLinkTexture(hexColor) {
  // One diamond cell: 64×64 px, wire is thick so it survives mipmap shrinking
  const cell = 64;
  const c = document.createElement('canvas');
  c.width = cell;
  c.height = cell;
  const cx = c.getContext('2d');

  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;
  const colorStr = `rgb(${r},${g},${b})`;

  cx.clearRect(0, 0, cell, cell);
  cx.strokeStyle = colorStr;
  cx.lineWidth = 7;   // thick wire – survives mipmap blur
  cx.lineCap = 'square';

  // Draw a single diamond that fills the cell and tiles seamlessly:
  const hw = cell / 2;

  cx.beginPath();
  // Main diamond
  cx.moveTo(hw,    0);
  cx.lineTo(cell,  hw);
  cx.lineTo(hw,    cell);
  cx.lineTo(0,     hw);
  cx.closePath();
  cx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

// Build a welded mesh texture (svařované pletivo) — rectangular grid pattern
function makeWeldedMeshTexture(hexColor) {
  const cell = 64;
  const c = document.createElement('canvas');
  c.width = cell;
  c.height = cell;
  const cx = c.getContext('2d');

  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;
  const colorStr = `rgb(${r},${g},${b})`;

  cx.clearRect(0, 0, cell, cell);
  cx.strokeStyle = colorStr;
  cx.lineWidth = 5;
  cx.lineCap = 'square';

  // Rectangular grid — horizontal and vertical lines
  cx.beginPath();
  // Vertical line left
  cx.moveTo(0, 0); cx.lineTo(0, cell);
  // Vertical line right (wraps)
  cx.moveTo(cell, 0); cx.lineTo(cell, cell);
  // Horizontal line top
  cx.moveTo(0, 0); cx.lineTo(cell, 0);
  // Horizontal line bottom (wraps)
  cx.moveTo(0, cell); cx.lineTo(cell, cell);
  cx.stroke();

  // Weld spots at intersections
  cx.fillStyle = colorStr;
  cx.beginPath();
  cx.arc(0, 0, 4, 0, Math.PI * 2);
  cx.arc(cell, 0, 4, 0, Math.PI * 2);
  cx.arc(0, cell, 4, 0, Math.PI * 2);
  cx.arc(cell, cell, 4, 0, Math.PI * 2);
  cx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

// Build a panel texture (2D/3D plotové dílce) — vertical bars with horizontal wires
function makePanelTexture(hexColor, is3D) {
  const w = 128, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');

  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;
  const colorStr = `rgb(${r},${g},${b})`;
  const darkStr = `rgb(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)})`;

  cx.clearRect(0, 0, w, h);

  // Background fill — slightly lighter version of fence color
  cx.fillStyle = `rgba(${r},${g},${b},0.15)`;
  cx.fillRect(0, 0, w, h);

  // Vertical bars (svislé dráty)
  cx.strokeStyle = colorStr;
  cx.lineWidth = 3;
  const barSpacing = 16;
  for (let x = barSpacing / 2; x < w; x += barSpacing) {
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, h);
    cx.stroke();
  }

  // Horizontal wires (vodorovné dráty) — thicker, zdvojené
  cx.strokeStyle = darkStr;
  cx.lineWidth = 4;
  const hSpacing = 32;
  for (let y = hSpacing / 2; y < h; y += hSpacing) {
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(w, y);
    cx.stroke();
    // Double wire
    cx.beginPath();
    cx.moveTo(0, y + 3);
    cx.lineTo(w, y + 3);
    cx.stroke();
  }

  // 3D panels: add prolis marks (horizontal bends)
  if (is3D) {
    cx.strokeStyle = `rgba(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)},0.6)`;
    cx.lineWidth = 6;
    const prolisY = [h * 0.2, h * 0.5, h * 0.8];
    for (const y of prolisY) {
      cx.beginPath();
      cx.moveTo(0, y);
      cx.lineTo(w, y);
      cx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

// Concrete color map
const BETON_COLORS_3D = {
  seda:    0xaaaaaa,
  piskova: 0xc8b88a,
  hneda:   0x8b6f4e,
  cervena: 0xa0584a,
};

// Build concrete surface texture
function makeConcreteTexture(hexColor) {
  const sz = 128;
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const cx = c.getContext('2d');

  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;

  // Base color
  cx.fillStyle = `rgb(${r},${g},${b})`;
  cx.fillRect(0, 0, sz, sz);

  // Subtle noise for concrete texture
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * sz;
    const y = Math.random() * sz;
    const variation = (Math.random() - 0.5) * 30;
    const nr = Math.max(0, Math.min(255, r + variation));
    const ng = Math.max(0, Math.min(255, g + variation));
    const nb = Math.max(0, Math.min(255, b + variation));
    cx.fillStyle = `rgba(${nr|0},${ng|0},${nb|0},0.4)`;
    cx.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }

  // Fine surface scratches for realism
  cx.strokeStyle = `rgba(${Math.max(0,r-20)},${Math.max(0,g-20)},${Math.max(0,b-20)},0.15)`;
  cx.lineWidth = 0.5;
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * sz;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(sz, y + (Math.random() - 0.5) * 4);
    cx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

function getSeg3DMaterial(seg) {
  const { fenceType } = getSegStyle(seg);
  const color = getSegColor3D(seg);
  if (fenceType === 'betonovy') {
    const betonColor = BETON_COLORS_3D[state.config.betonBarva] || BETON_COLORS_3D.seda;
    const tex = makeConcreteTexture(betonColor);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  }
  if (fenceType === 'panely_2d') {
    const tex = makePanelTexture(color, false);
    return new THREE.MeshStandardMaterial({ map: tex, color, metalness: 0.4, roughness: 0.5 });
  }
  if (fenceType === 'panely_3d') {
    const tex = makePanelTexture(color, true);
    return new THREE.MeshStandardMaterial({ map: tex, color, metalness: 0.4, roughness: 0.5 });
  }
  if (fenceType === 'svarovane') {
    const tex = makeWeldedMeshTexture(color);
    return new THREE.MeshStandardMaterial({
      alphaMap: tex,
      color,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
  }
  if (fenceType.startsWith('ctyrhranne')) {
    const tex = makeChainLinkTexture(color);
    return new THREE.MeshStandardMaterial({
      alphaMap: tex,
      color,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
}

function getFenceColor() {
  const type = state.fenceType;
  if (type.startsWith('ctyrhranne')) return '#27ae60';
  if (type === 'svarovane') return '#27ae60';
  if (type === 'panely_2d') return FENCE_COLORS_2D[state.config.barva2D] || '#2980b9';
  if (type === 'panely_3d') return FENCE_COLORS_2D[state.config.barva3D] || '#2980b9';
  if (type === 'betonovy') {
    const bc = { seda: '#aaaaaa', piskova: '#c8b88a', hneda: '#8b6f4e', cervena: '#a0584a' };
    return bc[state.config.betonBarva] || '#7f8c8d';
  }
  return '#27ae60';
}

// Returns array of { t0, t1 } parametric ranges for each field in a segment
// For gate segments, fields are split into left zone and right zone
function getFieldRanges(seg) {
  const ranges = [];
  if (seg.gate) {
    const tGateStart = seg.gateStartM / seg.lengthM;
    const tGateEnd = seg.gateEndM / seg.lengthM;
    const leftFields = seg.leftFields || 0;
    const rightFields = seg.rightFields || 0;

    // Left zone fields
    for (let fi = 0; fi < leftFields; fi++) {
      ranges.push({
        t0: (fi / leftFields) * tGateStart,
        t1: ((fi + 1) / leftFields) * tGateStart,
      });
    }
    // Right zone fields
    for (let fi = 0; fi < rightFields; fi++) {
      ranges.push({
        t0: tGateEnd + (fi / rightFields) * (1 - tGateEnd),
        t1: tGateEnd + ((fi + 1) / rightFields) * (1 - tGateEnd),
      });
    }
  } else {
    const fields = seg.fields;
    for (let fi = 0; fi < fields; fi++) {
      ranges.push({
        t0: fi / fields,
        t1: (fi + 1) / fields,
      });
    }
  }
  return ranges;
}

function drawConcreteFoundations2D(segments) {
  if (segments.length === 0) return;
  const concreteColor = '#b0b0b0';
  const concreteAlpha = 0.45;
  const baseRadius = POST_RADIUS * 1.8;

  // Gather gate post positions
  const gatePostPositions = new Set();
  for (const gate of state.gates) {
    const seg = findSegByFrom(segments, gate.segmentIndex);
    if (!seg) continue;
    const gateCenterT = getGateCenterT(gate, seg.lengthM);
    const gateWidthM = gate.width / 100;
    const halfGateT = (gateWidthM / 2) / seg.lengthM;
    const tStart = Math.max(0, gateCenterT - halfGateT);
    const tEnd = Math.min(1, gateCenterT + halfGateT);
    // Gate post 1
    const gp1x = seg.a.x + (seg.b.x - seg.a.x) * tStart;
    const gp1y = seg.a.y + (seg.b.y - seg.a.y) * tStart;
    const gp2x = seg.a.x + (seg.b.x - seg.a.x) * tEnd;
    const gp2y = seg.a.y + (seg.b.y - seg.a.y) * tEnd;
    // Draw larger foundation for gate posts (2 pytle)
    const s1 = worldToScreen(gp1x, gp1y);
    const s2 = worldToScreen(gp2x, gp2y);
    const gateR = baseRadius * 1.35 * state.zoom;
    ctx.globalAlpha = concreteAlpha;
    ctx.fillStyle = concreteColor;
    ctx.beginPath();
    ctx.arc(s1.x, s1.y, gateR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s2.x, s2.y, gateR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    gatePostPositions.add(`${gp1x.toFixed(4)},${gp1y.toFixed(4)}`);
    gatePostPositions.add(`${gp2x.toFixed(4)},${gp2y.toFixed(4)}`);
  }

  const r = baseRadius * state.zoom;

  // Vertex posts
  for (let i = 0; i < state.vertices.length; i++) {
    const v = state.vertices[i];
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)}`;
    if (gatePostPositions.has(key)) continue; // already drawn as gate post
    const s = worldToScreen(v.x, v.y);
    ctx.globalAlpha = concreteAlpha;
    ctx.fillStyle = concreteColor;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Intermediate posts
  for (const seg of segments) {
    const fieldRanges = getFieldRanges(seg);
    for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
      const t = fieldRanges[fi].t1;
      const px = seg.a.x + (seg.b.x - seg.a.x) * t;
      const py = seg.a.y + (seg.b.y - seg.a.y) * t;
      const key = `${px.toFixed(4)},${py.toFixed(4)}`;
      if (gatePostPositions.has(key)) continue;
      const s = worldToScreen(px, py);
      ctx.globalAlpha = concreteAlpha;
      ctx.fillStyle = concreteColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Strut base positions
  const isPanels = state.fenceType === 'panely_2d' || state.fenceType === 'panely_3d';
  if (!isPanels) {
    const struts = getStrutPositions(segments);
    for (const strut of struts) {
      // Strut foot position (end of strut on the ground)
      const s = worldToScreen(strut.wx, strut.wy);
      const ang = strut.angle2D;
      const strutFootDist = STRUT_LENGTH * state.zoom;
      const fx = s.x + Math.cos(ang) * strutFootDist;
      const fy = s.y + Math.sin(ang) * strutFootDist;
      ctx.globalAlpha = concreteAlpha;
      ctx.fillStyle = concreteColor;
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawFenceSegments(segments) {
  if (segments.length === 0) return;

  for (const seg of segments) {
    const sa = worldToScreen(seg.a.x, seg.a.y);
    const sb = worldToScreen(seg.b.x, seg.b.y);
    const { fenceType } = getSegStyle(seg);
    const segColor = getSegColor2D(seg);

    // Build field ranges as parametric t0..t1 pairs
    const fieldRanges = getFieldRanges(seg);

    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const fx0 = sa.x + (sb.x - sa.x) * t0;
      const fy0 = sa.y + (sb.y - sa.y) * t0;
      const fx1 = sa.x + (sb.x - sa.x) * t1;
      const fy1 = sa.y + (sb.y - sa.y) * t1;
      const fieldColor = getFieldColor2D(seg.from, fi, segColor);

      ctx.strokeStyle = fieldColor;
      ctx.lineWidth = (fenceType === 'betonovy' ? 6 : 3);
      ctx.lineCap = 'round';

      if (fenceType.startsWith('ctyrhranne')) {
        drawChainLink(fx0, fy0, fx1, fy1, fieldColor, fenceType === 'ctyrhranne_s_nd');
      } else if (fenceType === 'svarovane') {
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy1);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (fenceType === 'panely_2d' || fenceType === 'panely_3d') {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy1);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy1);
        ctx.stroke();
      }

      // Highlight selected field
      const fieldKey = getFieldKey(seg.from, fi);
      if (state.selectedFields.has(fieldKey)) {
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
        ctx.lineWidth = 12;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy1);
        ctx.stroke();
      }
    }

    // Podhrabová deska indicator (2D) - per-segment
    {
      const segStyle = getSegStyle(seg);
      const hasPodhrab = !segStyle.noPodhrab;
      if (hasPodhrab) {
        // Gray line offset below fence line to indicate gravel board
        const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        const flipSign = segStyle.flipped ? -1 : 1;
        const off = -5 * state.zoom * flipSign;
        const ox = Math.cos(ang + Math.PI / 2) * off;
        const oy = Math.sin(ang + Math.PI / 2) * off;
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2.5 * state.zoom;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sa.x + ox, sa.y + oy);
        ctx.lineTo(sb.x + ox, sb.y + oy);
        ctx.stroke();
      }
    }

    // Stínicí tkanina indicator (2D) – dashed line on the other side
    {
      const hasSegShade = !!state.shadeCloth[seg.from];
      const hasGateShade = seg.gate && seg.gate.shadeCloth;
      if (hasSegShade || hasGateShade) {
        const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        const flipSign2D = getSegStyle(seg).flipped ? -1 : 1;
        const off = 7 * state.zoom * flipSign2D;
        const ox = Math.cos(ang + Math.PI / 2) * off;
        const oy = Math.sin(ang + Math.PI / 2) * off;

        // Helper to draw shade line between t0..t1
        function _draw2DShade(t0, t1, color) {
          const x0 = sa.x + (sb.x - sa.x) * t0 + ox;
          const y0 = sa.y + (sb.y - sa.y) * t0 + oy;
          const x1 = sa.x + (sb.x - sa.x) * t1 + ox;
          const y1 = sa.y + (sb.y - sa.y) * t1 + oy;
          ctx.strokeStyle = color;
          ctx.lineWidth = 3 * state.zoom;
          ctx.setLineDash([6, 4]);
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;
        }

        if (hasSegShade && seg.gate) {
          const tGS = seg.gateStartM / seg.lengthM;
          const tGE = seg.gateEndM / seg.lengthM;
          if (tGS > 0.01) _draw2DShade(0, tGS, getShadeClothColor2D(seg.from));
          if (tGE < 0.99) _draw2DShade(tGE, 1, getShadeClothColor2D(seg.from));
        } else if (hasSegShade) {
          _draw2DShade(0, 1, getShadeClothColor2D(seg.from));
        }

        // Gate shade cloth indicator
        if (hasGateShade) {
          const tGS = seg.gateStartM / seg.lengthM;
          const tGE = seg.gateEndM / seg.lengthM;
          const gateShadeColor = SHADE_COLORS_2D[seg.gate.shadeClothBarva] || SHADE_COLORS_2D.zelena;
          _draw2DShade(tGS, tGE, gateShadeColor);
        }

        // "S" label
        if (hasSegShade) {
          const mx = (sa.x + sb.x) / 2 + ox;
          const my = (sa.y + sb.y) / 2 + oy;
          ctx.font = `bold ${Math.round(10 * state.zoom)}px sans-serif`;
          ctx.fillStyle = getShadeClothColor2D(seg.from);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', mx, my);
        }
      }
    }

    // Highlight selected segment (whole)
    if (state.selectedSegments.has(seg.from)) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
      ctx.lineWidth = 12;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }

    // Highlight hovered segment
    if (seg.from === state.hoveredSegment) {
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.lineWidth = 10;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }
  }
}

// Draw binding wires (vázací drát) in 2D - small perpendicular tick marks at wire positions
function drawBindingWires2D(segments) {
  const type = state.fenceType;
  if (!type.startsWith('ctyrhranne') && type !== 'svarovane') return;
  const cfg = state.config;

  for (const seg of segments) {
    const segStyle = getSegStyle(seg);
    const ft = segStyle.fenceType;
    if (!ft.startsWith('ctyrhranne') && ft !== 'svarovane') continue;

    const sa = worldToScreen(seg.a.x, seg.a.y);
    const sb = worldToScreen(seg.b.x, seg.b.y);
    const sdx = sb.x - sa.x;
    const sdy = sb.y - sa.y;
    const sLen = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sLen < 2) continue;

    // Perpendicular normal
    const nx = -sdy / sLen;
    const ny = sdx / sLen;
    const tickHalf = Math.max(3, 6 * state.zoom / 20); // half length of tick mark

    const fieldRanges = getFieldRanges(seg);
    // Wire count per segment
    const wireCount = getSegWireCount(seg);

    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const wireColor = getWireColor2D(seg.from, fi);
      const wireKey = getFieldKey(seg.from, fi);
      const isSelected = state.selectedWires.has(wireKey);

      // Draw tick marks at even spacing along the field
      for (let w = 0; w < wireCount; w++) {
        // Distribute wire positions evenly across the field
        const wt = t0 + (t1 - t0) * ((w + 1) / (wireCount + 1));
        const wx = sa.x + sdx * wt;
        const wy = sa.y + sdy * wt;

        ctx.strokeStyle = isSelected ? '#3498db' : wireColor;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(wx - nx * tickHalf, wy - ny * tickHalf);
        ctx.lineTo(wx + nx * tickHalf, wy + ny * tickHalf);
        ctx.stroke();
      }
    }
  }
}

// Draw chain-link diamond mesh pattern (čtyřhranné pletivo)
// The pattern is a row of diamonds (rotated squares) along the fence centre line
function drawChainLink(x1, y1, x2, y2, color, hasND) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  // Unit vectors along and perpendicular to fence
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;  // perpendicular (across fence width)
  const ny = ux;

  // Diamond size adapts to zoom, but stays readable
  const diamondHalfW = Math.max(5, Math.min(14, len / 10));  // half-width along fence
  const diamondHalfH = diamondHalfW * 0.75;                  // half-height across fence
  const cols = Math.max(1, Math.round(len / (diamondHalfW * 2)));
  const step = len / cols;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw each diamond: left → top → right → bottom → close
  for (let col = 0; col < cols; col++) {
    const tCentre = (col + 0.5) * step;
    const pcx = x1 + ux * tCentre;
    const pcy = y1 + uy * tCentre;

    const left   = { x: pcx - ux * diamondHalfW,              y: pcy - uy * diamondHalfW };
    const right  = { x: pcx + ux * diamondHalfW,              y: pcy + uy * diamondHalfW };
    const top    = { x: pcx + nx * diamondHalfH,              y: pcy + ny * diamondHalfH };
    const bottom = { x: pcx - nx * diamondHalfH,              y: pcy - ny * diamondHalfH };

    ctx.beginPath();
    ctx.moveTo(left.x,   left.y);
    ctx.lineTo(top.x,    top.y);
    ctx.lineTo(right.x,  right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.stroke();
  }

  // Napínací dráty (ND) – two parallel lines along fence edges
  if (hasND) {
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x1 + nx * diamondHalfH * side, y1 + ny * diamondHalfH * side);
      ctx.lineTo(x2 + nx * diamondHalfH * side, y2 + ny * diamondHalfH * side);
      ctx.stroke();
    }
  }
}

function drawIntermediatePosts(segments) {
  for (const seg of segments) {
    if (seg.gate) {
      // Gate segment: draw posts in left zone and right zone, gate posts shown by drawGates
      const leftFields = seg.leftFields || 0;
      const rightFields = seg.rightFields || 0;
      const tGateStart = seg.gateStartM / seg.lengthM;
      const tGateEnd = seg.gateEndM / seg.lengthM;

      // Left zone intermediate posts
      for (let f = 1; f < leftFields; f++) {
        const t = (f / leftFields) * tGateStart;
        _drawIntPost2D(seg, t, f - 1);
      }
      // Right zone intermediate posts
      for (let f = 1; f < rightFields; f++) {
        const t = tGateEnd + (f / rightFields) * (1 - tGateEnd);
        _drawIntPost2D(seg, t, leftFields + f - 1);
      }
    } else {
      const fields = seg.fields;
      if (fields <= 1) continue;
      for (let f = 1; f < fields; f++) {
        const t = f / fields;
        _drawIntPost2D(seg, t, f - 1);
      }
    }
  }
}

function _drawIntPost2D(seg, t, intPostIdx) {
  const px = seg.a.x + (seg.b.x - seg.a.x) * t;
  const py = seg.a.y + (seg.b.y - seg.a.y) * t;
  const s = worldToScreen(px, py);
  const intKey = getFieldKey(seg.from, intPostIdx);
  const isSelected = state.selectedIntPosts.has(intKey);
  const color = getIntPostColor2D(seg.from, intPostIdx);

  if (isSelected) {
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, POST_RADIUS * 0.7 * state.zoom + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.globalAlpha = isSelected ? 1 : 0.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y, POST_RADIUS * 0.7 * state.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawVertexPosts() {
  for (let i = 0; i < state.vertices.length; i++) {
    const v = state.vertices[i];
    const s = worldToScreen(v.x, v.y);
    const r = POST_RADIUS * state.zoom;
    const isSelected = state.selectedPosts.has(i);
    const isHovered = i === state.hoveredVertex;

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Highlight selected (drag tool)
    if (i === state.selectedVertex) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Post circle with per-post color (or square for betonový)
    const rScaled = r;
    ctx.fillStyle = getPostColor2D(i);
    if (state.fenceType === 'betonovy') {
      // Square post for concrete
      const side = rScaled * 1.8;
      ctx.fillRect(s.x - side / 2, s.y - side / 2, side, side);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(s.x - side / 2, s.y - side / 2, side, side);
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, rScaled, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rScaled, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Corner indicator
    if (isCorner(i)) {
      ctx.fillStyle = 'rgba(243,156,18,0.7)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover highlight
    if (isHovered) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPrichytky2D(segments) {
  const type = state.fenceType;
  if (!type.startsWith('ctyrhranne') && type !== 'svarovane') return;
  const cfg = state.config;
  const clipW = Math.max(2, 4 * state.zoom / 20); // width of clip rectangle
  const clipH = Math.max(1, 2 * state.zoom / 20); // height of clip rectangle

  for (const seg of segments) {
    const segStyle = getSegStyle(seg);
    const ft = segStyle.fenceType;
    if (!ft.startsWith('ctyrhranne') && ft !== 'svarovane') continue;

    const sa = worldToScreen(seg.a.x, seg.a.y);
    const sb = worldToScreen(seg.b.x, seg.b.y);
    const sdx = sb.x - sa.x;
    const sdy = sb.y - sa.y;
    const sLen = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sLen < 2) continue;

    // Perpendicular direction
    const nx = -sdy / sLen;
    const ny = sdx / sLen;
    // Along direction
    const tx = sdx / sLen;
    const ty = sdy / sLen;

    // Collect all post t-values for this segment (vertex + intermediate, excluding gate posts)
    const fieldRanges = getFieldRanges(seg);
    const wireCount = getSegWireCount(seg);
    const postTsWithKeys = [{ t: 0, clipKey: getClipKey('v', seg.from) }]; // start vertex
    for (let fi = 0; fi < fieldRanges.length; fi++) {
      if (fi < fieldRanges.length - 1) {
        // Between consecutive ranges there is a post
        postTsWithKeys.push({ t: fieldRanges[fi].t1, clipKey: getClipKey('i', seg.from, fi) });
      }
    }
    postTsWithKeys.push({ t: 1, clipKey: getClipKey('v', seg.to) }); // end vertex

    for (const { t: pt, clipKey } of postTsWithKeys) {
      const px = sa.x + sdx * pt;
      const py = sa.y + sdy * pt;
      const clipColor = getClipColor2D(clipKey);

      for (let w = 0; w < wireCount; w++) {
        // Offset each clip slightly along perpendicular so they don't overlap
        const offset = (w - (wireCount - 1) / 2) * clipH * 1.8;
        const cx = px + nx * offset;
        const cy = py + ny * offset;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(sdy, sdx));
        ctx.fillStyle = clipColor;
        ctx.fillRect(-clipH / 2, -clipW / 2, clipH, clipW);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-clipH / 2, -clipW / 2, clipH, clipW);
        ctx.restore();
      }
    }
  }
}

function drawStruts(segments) {
  const ft = state.fenceType;
  if (ft !== 'ctyrhranne_bez_nd' && ft !== 'ctyrhranne_s_nd' && ft !== 'svarovane') return;

  const struts = getStrutPositions(segments);
  for (let _si = 0; _si < struts.length; _si++) {
    const strut = struts[_si];
    const s = worldToScreen(strut.wx, strut.wy);
    const len = STRUT_LENGTH * state.zoom;

    // angle2D is pre-computed in getStrutPositions – always along fence, away from post
    const angle = strut.angle2D;

    const ex = s.x + Math.cos(angle) * len;
    const ey = s.y + Math.sin(angle) * len;

    const strutColor = getStrutColor2D(strut);
    ctx.strokeStyle = strutColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Small circle at strut end
    ctx.fillStyle = strutColor;
    ctx.beginPath();
    ctx.arc(ex, ey, 3 * state.zoom, 0, Math.PI * 2);
    ctx.fill();

    // Selection highlight
    if (state.selectedStruts.has(_si)) {
      ctx.strokeStyle = 'rgba(52,152,219,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10 * state.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawGates(segments) {
  for (const gate of state.gates) {
    const seg = findSegByFrom(segments, gate.segmentIndex);
    if (!seg) continue;

    // Gate center as ratio (t) for rendering
    let gateCenterM;
    if (gate.positionM != null) {
      gateCenterM = gate.positionM;
    } else {
      gateCenterM = seg.lengthM * (gate.position ?? 0.5);
    }
    const gateCenterT = gateCenterM / seg.lengthM;
    const gateWidthM = gate.width / 100;
    const halfGateT = (gateWidthM / 2) / seg.lengthM;

    const tStart = Math.max(0, gateCenterT - halfGateT);
    const tEnd = Math.min(1, gateCenterT + halfGateT);

    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const ang = Math.atan2(dy, dx);

    // Gate post positions in world
    const gp1w = { x: seg.a.x + dx * tStart, y: seg.a.y + dy * tStart };
    const gp2w = { x: seg.a.x + dx * tEnd, y: seg.a.y + dy * tEnd };
    const gp1s = worldToScreen(gp1w.x, gp1w.y);
    const gp2s = worldToScreen(gp2w.x, gp2w.y);
    const midS = { x: (gp1s.x + gp2s.x) / 2, y: (gp1s.y + gp2s.y) / 2 };

    // Gate color from gate.barva
    const GATE_COLORS_2D = { zelena: '#27ae60', antracit: '#4a4f52', stribrna: '#c8d0d4' };
    const gateColor = GATE_COLORS_2D[gate.barva] || GATE_COLORS_2D.zelena;

    // Selection highlight
    const gateKey = 'gate:' + gate.segmentIndex;
    const isSelected = state.selectedGates && state.selectedGates.has(gateKey);
    if (isSelected) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
      ctx.lineWidth = 14;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(gp1s.x, gp1s.y);
      ctx.lineTo(gp2s.x, gp2s.y);
      ctx.stroke();
    }

    // Gate opening line (dashed)
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(gp1s.x, gp1s.y);
    ctx.lineTo(gp2s.x, gp2s.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gate posts (square)
    ctx.fillStyle = gateColor;
    ctx.beginPath();
    ctx.rect(gp1s.x - 4, gp1s.y - 4, 8, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(gp2s.x - 4, gp2s.y - 4, 8, 8);
    ctx.fill();

    // Arc (gate swing)
    const gateWidthPx = Math.sqrt((gp2s.x - gp1s.x) ** 2 + (gp2s.y - gp1s.y) ** 2);
    const arcR = gateWidthPx / 2 * 0.8;
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    if (gate.type === 'branka') {
      ctx.arc(gp1s.x, gp1s.y, arcR, ang - Math.PI / 2, ang, false);
    } else {
      ctx.arc(gp1s.x, gp1s.y, arcR * 0.5, ang - Math.PI / 2, ang, false);
      ctx.moveTo(gp2s.x + Math.cos(ang + Math.PI / 2) * arcR * 0.5, gp2s.y + Math.sin(ang + Math.PI / 2) * arcR * 0.5);
      ctx.arc(gp2s.x, gp2s.y, arcR * 0.5, ang + Math.PI / 2, ang + Math.PI, false);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = gateColor;
    ctx.font = `${11 * state.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    const posLabel = `@ ${gateCenterM.toFixed(1)}m`;
    ctx.fillText(
      `${gate.type === 'branka' ? 'Branka' : 'Brána'} ${gate.width}×${gate.height || state.config.height}cm ${posLabel}`,
      midS.x,
      midS.y - 12 * state.zoom
    );
  }
}

function drawMeasurements(segments) {
  ctx.font = `${10 * state.zoom}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#666';

  for (const seg of segments) {
    const sa = worldToScreen(seg.a.x, seg.a.y);
    const sb = worldToScreen(seg.b.x, seg.b.y);
    const mx = (sa.x + sb.x) / 2;
    const my = (sa.y + sb.y) / 2;
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const ang = Math.atan2(dy, dx);
    const offset = 14 * state.zoom;
    const lx = mx + Math.cos(ang + Math.PI / 2) * offset;
    const ly = my + Math.sin(ang + Math.PI / 2) * offset;

    ctx.save();
    ctx.translate(lx, ly);
    let textAngle = ang;
    if (textAngle > Math.PI / 2) textAngle -= Math.PI;
    if (textAngle < -Math.PI / 2) textAngle += Math.PI;
    ctx.rotate(textAngle);
    ctx.fillText(`${seg.lengthM.toFixed(1)} m`, 0, 0);
    ctx.restore();
  }
}

function drawDetailedDimensions(segments) {
  if (!state.showDimensions || segments.length === 0) return;

  const cfg = state.config;
  const type = state.fenceType;
  const isBeton = type === 'betonovy';
  const isPanels = type === 'panely_2d' || type === 'panely_3d';

  // Compute heights
  const fenceH = cfg.height; // cm
  const podhrabHcm = cfg.podhrabovaVyska; // always available for per-segment use
  const anyHasPodhrab = segments.some(seg => !getSegStyle(seg).noPodhrab);
  const maxPodhrabH = anyHasPodhrab ? podhrabHcm : 0;
  const totalFenceH = fenceH + maxPodhrabH; // total height above ground
  let postH; // cm
  if (isBeton) {
    postH = cfg.betonDesky * 50 + (cfg.betonSokl ? cfg.betonSoklVyska : 0) + 70;
  } else {
    postH = fenceH + maxPodhrabH + 70;
  }

  const dimColor = '#e74c3c';
  const dimBg = 'rgba(255,255,255,0.85)';
  const fontSize = Math.max(8, Math.min(12, 10 * state.zoom));

  // --- Per-field dimensions (length of each field) ---
  for (const seg of segments) {
    const sa = worldToScreen(seg.a.x, seg.a.y);
    const sb = worldToScreen(seg.b.x, seg.b.y);
    const sdx = sb.x - sa.x;
    const sdy = sb.y - sa.y;
    const sLen = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sLen < 20) continue;

    const ang = Math.atan2(sdy, sdx);
    const fieldRanges = getFieldRanges(seg);
    const segStyle = getSegStyle(seg);
    const ft = segStyle.fenceType;

    // Per-field height from helpers
    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const fieldLenM = (t1 - t0) * seg.lengthM;
      const fieldH = isBeton ? cfg.betonDesky * 50 : getFieldFenceH(seg.from, fi, seg);

      // Midpoint of field
      const tMid = (t0 + t1) / 2;
      const mx = sa.x + sdx * tMid;
      const my = sa.y + sdy * tMid;

      // Offset below the segment
      const offsetBelow = 24 * state.zoom;
      const lx = mx + Math.cos(ang + Math.PI / 2) * offsetBelow;
      const ly = my + Math.sin(ang + Math.PI / 2) * offsetBelow;

      let textAngle = ang;
      if (textAngle > Math.PI / 2) textAngle -= Math.PI;
      if (textAngle < -Math.PI / 2) textAngle += Math.PI;

      // Field length
      const lenText = `${(fieldLenM * 100).toFixed(0)} cm`;
      // Field height
      const hText = `v: ${fieldH} cm`;
      // Podhrab - respect per-segment override
      const segNoPodhrab = segStyle.noPodhrab;
      const segPodhrabH = segNoPodhrab ? 0 : podhrabHcm;
      const pText = segPodhrabH > 0 ? ` +${segPodhrabH} pd` : '';

      const fullText = `${lenText} × ${hText}${pText}`;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(textAngle);
      ctx.font = `bold ${fontSize}px sans-serif`;

      // Background
      const tm = ctx.measureText(fullText);
      const pad = 3;
      ctx.fillStyle = dimBg;
      ctx.fillRect(-tm.width / 2 - pad, -fontSize / 2 - pad, tm.width + pad * 2, fontSize + pad * 2);

      // Text
      ctx.fillStyle = dimColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fullText, 0, 0);
      ctx.restore();
    }

    // --- Post heights at vertex posts ---
    for (let vi = 0; vi < 2; vi++) {
      const vertIdx = vi === 0 ? seg.from : seg.to;
      const v = vi === 0 ? seg.a : seg.b;
      const sv = worldToScreen(v.x, v.y);
      const thisPostH = getVertexPostH(vertIdx);

      // Only draw once per vertex (avoid duplicates: skip 'to' if not last segment)
      if (vi === 1 && seg.to < state.vertices.length - 1) continue;

      const postLabel = `Sl: ${thisPostH} cm`;
      ctx.save();
      ctx.font = `bold ${fontSize}px sans-serif`;
      const ptm = ctx.measureText(postLabel);
      const postOffY = -16 * state.zoom;

      // Background
      ctx.fillStyle = dimBg;
      const pad = 2;
      ctx.fillRect(sv.x - ptm.width / 2 - pad, sv.y + postOffY - fontSize / 2 - pad, ptm.width + pad * 2, fontSize + pad * 2);

      ctx.fillStyle = dimColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(postLabel, sv.x, sv.y + postOffY);
      ctx.restore();
    }

    // --- Gate dimensions ---
    if (seg.gate) {
      const gate = seg.gate;
      const gateCenterT = getGateCenterT(gate, seg.lengthM);
      const gateWidthM = gate.width / 100;
      const halfGateT = (gateWidthM / 2) / seg.lengthM;
      const tStart = Math.max(0, gateCenterT - halfGateT);
      const tEnd = Math.min(1, gateCenterT + halfGateT);
      const tMid = (tStart + tEnd) / 2;
      const gx = sa.x + sdx * tMid;
      const gy = sa.y + sdy * tMid;
      const gateOffBelow = 38 * state.zoom;
      const glx = gx + Math.cos(ang + Math.PI / 2) * gateOffBelow;
      const gly = gy + Math.sin(ang + Math.PI / 2) * gateOffBelow;

      let textAngle = ang;
      if (textAngle > Math.PI / 2) textAngle -= Math.PI;
      if (textAngle < -Math.PI / 2) textAngle += Math.PI;

      const gateH = gate.height || cfg.height;
      const gateLabel = `${gate.type === 'branka' ? 'Br' : 'Brána'}: ${gate.width}×${gateH} cm`;

      ctx.save();
      ctx.translate(glx, gly);
      ctx.rotate(textAngle);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const gtm = ctx.measureText(gateLabel);
      const pad = 3;
      ctx.fillStyle = 'rgba(52,152,219,0.15)';
      ctx.fillRect(-gtm.width / 2 - pad, -fontSize / 2 - pad, gtm.width + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = '#2980b9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gateLabel, 0, 0);
      ctx.restore();
    }
  }

  // --- Intermediate post heights ---
  for (const seg of segments) {
    const fieldRanges = getFieldRanges(seg);
    for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
      const t = fieldRanges[fi].t1;
      const px = seg.a.x + (seg.b.x - seg.a.x) * t;
      const py = seg.a.y + (seg.b.y - seg.a.y) * t;
      const sv = worldToScreen(px, py);
      const intKey = getFieldKey(seg.from, fi);
      const thisPostH = getIntPostH(seg.from, fi, seg);

      const postLabel = `Sl: ${thisPostH} cm`;
      ctx.save();
      ctx.font = `${fontSize - 1}px sans-serif`;
      const ptm = ctx.measureText(postLabel);
      const postOffY = -14 * state.zoom;
      const pad = 2;
      ctx.fillStyle = dimBg;
      ctx.fillRect(sv.x - ptm.width / 2 - pad, sv.y + postOffY - fontSize / 2 - pad, ptm.width + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = '#c0392b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(postLabel, sv.x, sv.y + postOffY);
      ctx.restore();
    }
  }
}

// ============================================================
// CALCULATION ENGINE
// ============================================================
function calculate() {
  const result = {};
  if (state.vertices.length < 2) return null;

  const segments = getSegments();
  const cfg = state.config;
  const type = state.fenceType;
  const isPanels = type === 'panely_2d' || type === 'panely_3d';
  const isBeton = type === 'betonovy';
  const isSvar = type === 'svarovane';
  const isCtyr = type.startsWith('ctyrhranne');
  const isBezND = type === 'ctyrhranne_bez_nd';

  // Total length
  const totalLength = segments.reduce((s, seg) => s + seg.lengthM, 0);
  result.totalLength = totalLength;

  // Total fields
  const totalFields = segments.reduce((s, seg) => s + seg.fields, 0);
  result.totalFields = totalFields;

  // Gate data
  const gateCount = { branka: 0, brana: 0 };
  let gatePostsReplaced = 0;
  for (const gate of state.gates) {
    gateCount[gate.type]++;
    gatePostsReplaced += 2; // Each gate replaces 2 fence posts with its own
  }
  result.gates = gateCount;

  // Post height (based on whether any segment has podhrab)
  const anySegPodhrab = segments.some(seg => !getSegStyle(seg).noPodhrab);
  let postHeight; // cm
  if (isBeton) {
    postHeight = cfg.betonDesky * 50 + (cfg.betonSokl ? cfg.betonSoklVyska : 0) + 70;
  } else {
    postHeight = cfg.height + (anySegPodhrab ? cfg.podhrabovaVyska : 0) + 70;
  }
  result.postHeight = postHeight;

  // Posts count
  const allPosts = getIntermediatePosts(segments);
  const totalPosts = allPosts.length;
  const fencePosts = totalPosts - gatePostsReplaced;
  result.totalPosts = totalPosts;
  result.fencePosts = Math.max(0, fencePosts);

  // Struts — only for čtyřhranné pletivo (s/bez ND) and svařované pletivo
  const hasStruts = (type === 'ctyrhranne_bez_nd' || type === 'ctyrhranne_s_nd' || type === 'svarovane');
  const strutPositions = hasStruts ? getStrutPositions(segments) : [];
  const strutCount = strutPositions.length;
  result.strutCount = strutCount;
  result.strutLength = cfg.height + 50; // cm – délka vzpěry = výška pletiva + 50 cm (dle DOCX pravidel)

  // Ráčny - per strut post, count wires on nearest segment
  // Group struts by post position (same as 3D rendering does)
  {
    const strutsByPostCalc = {};
    for (const strut of strutPositions) {
      const pk = `${strut.wx.toFixed(3)},${strut.wy.toFixed(3)}`;
      if (!strutsByPostCalc[pk]) strutsByPostCalc[pk] = [];
      strutsByPostCalc[pk].push(strut);
    }
    let totalRacny = 0;
    for (const pk of Object.keys(strutsByPostCalc)) {
      const postStruts = strutsByPostCalc[pk];
      const s0 = postStruts[0];
      // Find nearest segment (same logic as 3D)
      let nearSeg = null, minD = Infinity;
      for (const seg of segments) {
        const d1 = Math.hypot(s0.wx - seg.a.x, s0.wy - seg.a.y);
        const d2 = Math.hypot(s0.wx - seg.b.x, s0.wy - seg.b.y);
        const d = Math.min(d1, d2);
        if (d < minD) { minD = d; nearSeg = seg; }
      }
      const wireCount = nearSeg ? getSegWireCount(nearSeg) : 2;
      // Each strut at this post gets its own set of ratchets
      totalRacny += postStruts.length * wireCount;
    }
    result.racnyCount = totalRacny;
  }

  // Napínací dráty (only čtyřhranné bez ND) - per segment wire count
  // IMPORTANT: Napínací dráty are always per-section, NOT summed together!
  // Each wire needs its own individual roll/package per section.
  if (isBezND) {
    let maxNapDratCount = 0;
    let napDratSections = []; // { lengthM, wireCount } per distinct section
    // Group connected segments into sections (between path breaks)
    let currentSectionLen = 0;
    let currentSectionWires = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const wc = getSegWireCount(seg);
      if (wc > maxNapDratCount) maxNapDratCount = wc;
      if (wc > currentSectionWires) currentSectionWires = wc;
      currentSectionLen += seg.lengthM;
      // Check if next segment is a break or end
      const isLast = i === segments.length - 1;
      const nextBreak = !isLast && state.pathBreaks.has(seg.to);
      if (isLast || nextBreak) {
        napDratSections.push({ lengthM: currentSectionLen, wireCount: currentSectionWires });
        currentSectionLen = 0;
        currentSectionWires = 0;
      }
    }
    result.napDratCount = maxNapDratCount;
    result.napDratSections = napDratSections;
    // Total: each section needs wireCount separate rolls, each roll = section length
    let totalNapDratLengthM = 0;
    for (const sec of napDratSections) {
      totalNapDratLengthM += sec.lengthM * sec.wireCount;
    }
    result.napDratLength = totalNapDratLengthM;
  }

  // Vázací drát (svařované)
  if (isSvar) {
    result.vazaciDrat = true;
    if (cfg.svarSloupky === 'prolis_bekaclip') {
      result.bekaclip = true;
    }
  }

  // Spony Roca Fix (čtyřhranné) — 1 spona každých 20 cm na každém napínacím drátě
  if (isCtyr) {
    let totalSponyRocaFix = 0;
    for (const seg of segments) {
      const wc = getSegWireCount(seg);
      const segLenCm = seg.lengthM * 100;
      totalSponyRocaFix += Math.ceil(segLenCm / 20) * wc;
    }
    result.sponyRocaFix = totalSponyRocaFix;
    // Balení: 1000 ks a 200 ks
    const bal1000 = Math.floor(totalSponyRocaFix / 1000);
    const zbytek = totalSponyRocaFix - bal1000 * 1000;
    const bal200 = Math.ceil(zbytek / 200);
    result.sponyRocaFixBal = { bal1000, bal200, celkem: bal1000 * 1000 + bal200 * 200 };
  }

  // Spony BEKACLIP (svařované) — na každém oku na každém sloupku
  if (isSvar) {
    const okoVyskaCm = cfg.svarOkoVyska || 5;
    let totalBekaclipSpony = 0;
    for (const seg of segments) {
      const fenceHCm = getSegFenceH(seg);
      const sponyNaSloupek = Math.floor(fenceHCm / okoVyskaCm);
      totalBekaclipSpony += sponyNaSloupek * (seg.fields + 1);
    }
    result.sponyBekaclip = totalBekaclipSpony;
  }

  // Příchytky
  if (isPanels) {
    result.prichytky = totalPosts * 5;
    result.prichytkyExtra = 10;
  } else if (isCtyr || isSvar) {
    // Per-segment wire count for příchytky: use max of adjacent segments per post
    let totalClips = 0;
    let maxWc = 0;
    for (const seg of segments) {
      const wc = getSegWireCount(seg);
      if (wc > maxWc) maxWc = wc;
      totalClips += (seg.fields + 1) * wc; // each field boundary post + 1
    }
    result.prichytky = totalClips;
    result.prichytkyNaDrat = maxWc; // počet příchytek na sloupek per drát
  }

  // Podhrabové desky (per-segment: respects individual overrides and global default)
  if (!isBeton) {
    let podhrabFields = 0;
    for (const seg of segments) {
      const ss = getSegStyle(seg);
      if (!ss.noPodhrab) podhrabFields += seg.fields;
    }
    if (podhrabFields > 0) {
      result.podhrabDesky = podhrabFields;
      result.podhrabKryty = podhrabFields * 2;
      result.sroubVZP = true;

      // ====== Průběžný vs Koncový držáky ======
      // Průběžný holder = 1 per intermediate post (wraps around post, holds boards from BOTH sides)
      // Koncový holder = 1 per end/corner post (board ends from one side only)
      // Total holders = number of posts touching podhrab boards = fields + 1 per segment
      // Example: 20m fence, 2.5m spacing → 8 boards, 9 posts → 7 průběžné + 2 koncové = 9 total
      // Holders only work on kulaté (round) posts!
      let drzakyPrubezny = 0;
      let drzakyKoncovy = 0;
      let drzakyTotal = 0;
      let hasHranateWarning = false;

      for (const seg of segments) {
        const ss = getSegStyle(seg);
        if (ss.noPodhrab) continue;
        const segTyp = ss.typSloupku || cfg.typSloupku;
        const isRoundSeg = segTyp === 'kulate_38' || segTyp === 'kulate_48';

        if (!isRoundSeg) {
          hasHranateWarning = true;
        }

        const fields = seg.fields;
        if (isRoundSeg) {
          const isStartEnd = seg.from === 0 || state.pathBreaks.has(seg.from - 1) || isCorner(seg.from);
          const lastVtx = state.vertices.length - 1;
          const isEndEnd = seg.to === lastVtx || state.pathBreaks.has(seg.to) || isCorner(seg.to);

          // Start post: koncový if end/corner, průběžný if connecting to adjacent segment
          if (isStartEnd) drzakyKoncovy++; else drzakyPrubezny++;
          // Intermediate posts: 1 průběžný each (holds boards from both sides)
          drzakyPrubezny += (fields - 1);
          // End post: koncový if end/corner, průběžný if connecting
          if (isEndEnd) drzakyKoncovy++; else drzakyPrubezny++;
        } else {
          drzakyTotal += fields + 1;
        }
      }

      if (drzakyPrubezny > 0 || drzakyKoncovy > 0) {
        result.podhrabDrzakyPrubezny = drzakyPrubezny;
        result.podhrabDrzakyKoncovy = drzakyKoncovy;
        result.podhrabDrzaky = drzakyPrubezny + drzakyKoncovy;
      } else {
        // All hranaté or mixed
        result.podhrabDrzaky = drzakyTotal || podhrabFields + 1;
      }
      result.podhrabHranateWarning = hasHranateWarning;
      // Šrouby pro držáky: 2 samovrtné šrouby na každý držák (dle DOCX pravidel)
      result.podhrabDrzakySrouby = ((result.podhrabDrzakyPrubezny || 0) + (result.podhrabDrzakyKoncovy || 0) + (drzakyTotal || 0)) * 2;

      // Bracket count for struts on gravel board segments
      let strutBrackets = 0;
      if (!isPanels) {
        const strutPos = getStrutPositions(segments);
        for (const strut of strutPos) {
          // Find the segment the strut points toward (not just nearest)
          const probeLen = 0.5;
          const probeTipX = strut.wx + Math.cos(strut.angle2D) * probeLen;
          const probeTipY = strut.wy + Math.sin(strut.angle2D) * probeLen;
          let bestSeg = null, bestDist = Infinity;
          for (const seg of segments) {
            const ax = seg.a.x, ay = seg.a.y, bx = seg.b.x, by = seg.b.y;
            const abx = bx - ax, aby = by - ay;
            const apx = probeTipX - ax, apy = probeTipY - ay;
            const abLen2 = abx * abx + aby * aby;
            if (abLen2 < 0.0001) continue;
            const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
            const closestX = ax + abx * t, closestY = ay + aby * t;
            const d = Math.hypot(probeTipX - closestX, probeTipY - closestY);
            if (d < bestDist) { bestDist = d; bestSeg = seg; }
          }
          if (bestSeg) {
            const ss = getSegStyle(bestSeg);
            if (!ss.noPodhrab) strutBrackets++;
          }
        }
      }
      result.strutBrackets = strutBrackets;
    }
  }

  // Beton - detailed breakdown
  if (cfg.povrch === 'zemina') {
    const gatePostCount = state.gates.length * 2;
    const normalPostCount = totalPosts - gatePostCount;

    // Detailed bag counts per category
    const bagsSloupky = normalPostCount * 1.5;
    const bagsBranky = gatePostCount * 2;
    const bagsVzpery = strutCount * 1.5;
    const totalBags = bagsSloupky + bagsBranky + bagsVzpery;

    // Cubic meters: betonový sloupek = 0.04 m³, normální sloupek = 0.03 m³, vzpěra = 0.03 m³
    const kubikyPerSloupek = isBeton ? 0.04 : 0.03;
    const kubiky = totalPosts * kubikyPerSloupek + strutCount * 0.03;

    // Store detailed breakdown always (both options)
    result.betonDetail = {
      normalPostCount,
      gatePostCount,
      strutCount,
      bagsSloupky: Math.ceil(bagsSloupky),
      bagsBranky: Math.ceil(bagsBranky),
      bagsVzpery: Math.ceil(bagsVzpery),
      totalBags: Math.ceil(totalBags),
      kubiky: kubiky,
      kubikyFormatted: kubiky.toFixed(2),
      kubikyPerSloupek: kubikyPerSloupek,
      totalLength: totalLength,
    };

    // Recommended option
    if (totalLength <= 30) {
      result.betonPytle = Math.ceil(totalBags);
      result.betonTyp = 'pytle';
    } else {
      result.betonKubiky = kubiky.toFixed(2);
      result.betonTyp = 'betonarka';
    }
  } else {
    result.patky = totalPosts;
  }

  // Pletivo / panely
  if (isCtyr || isSvar) {
    const pletLength = totalLength * 1.05; // +5% reserve
    const roleLen = isCtyr ? cfg.roleDelka : cfg.svarRoleDelka;
    result.pletivoLength = pletLength;
    result.roleCount = Math.ceil(pletLength / roleLen);
    result.roleDelka = roleLen;
  }

  if (isPanels) {
    result.panelCount = totalFields;
    // Gate segments don't need panels
    let gateFields = 0;
    for (const gate of state.gates) {
      gateFields += Math.ceil((gate.width / 100) / getMaxFieldM(gate.segmentIndex));
    }
    result.panelCount = Math.max(0, totalFields - gateFields);
    result.sprej = 1;
    const barva = type === 'panely_2d' ? cfg.barva2D : cfg.barva3D;
    result.barvaSprej = barva;
  }

  // Betonový plot
  if (isBeton) {
    result.betonoveDesky = totalFields * cfg.betonDesky;
    result.betonoveSloupky = totalPosts;
    result.chemickaKotva = Math.ceil(totalFields * 0.2); // 0,2 chemické kotvy na 1 pole
    if (cfg.betonSokl) {
      result.sokly = totalFields;
    }

    // Klasifikace betonových sloupků: průběžný / koncový / rohový / 2×koncový
    let slPrubezny = 0, slKoncovy = 0, slRohovy = 0, slDvojkoncovy = 0;
    for (const post of allPosts) {
      if (post.type === 'gatePost') {
        slKoncovy++;
        continue;
      }
      const vi = post.vertexIndex;
      if (vi < 0) {
        // intermediate post between two vertices = průběžný
        slPrubezny++;
        continue;
      }
      // vertex post — check if end, corner, or through
      const isStart = vi === 0 || state.pathBreaks.has(vi - 1);
      const isEnd = vi === state.vertices.length - 1 || state.pathBreaks.has(vi);
      if (isStart || isEnd) {
        // Path endpoint = koncový
        if (isStart && isEnd) {
          // Isolated point, shouldn't happen but handle
          slKoncovy++;
        } else {
          slKoncovy++;
        }
      } else if (isCorner(vi)) {
        // Corner — check angle
        const prev = state.vertices[vi - 1];
        const curr = state.vertices[vi];
        const next = state.vertices[vi + 1];
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;
        const dot = dx1 * dx2 + dy1 * dy2;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const cosAngle = dot / (len1 * len2 + 0.0001);
        const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
        // 90° corner (with tolerance ±10°) = rohový sloupek
        if (Math.abs(angleDeg - 90) <= 10) {
          slRohovy++;
        } else {
          // Non-90° corner = 2× koncový sloupek
          slDvojkoncovy++;
        }
      } else {
        // Not a corner = průběžný
        slPrubezny++;
      }
    }
    result.betonSloupkyPrubezny = slPrubezny;
    result.betonSloupkyKoncovy = slKoncovy;
    result.betonSloupkyRohovy = slRohovy;
    result.betonSloupkyDvojkoncovy = slDvojkoncovy;
  }

  // ═══════════════════════════════════════
  // DOPRAVA A LOGISTIKA
  // ═══════════════════════════════════════

  // 1) Doprava montážníka
  if (cfg.doprMontKm > 0) {
    const km = cfg.doprMontKm;
    const cest = Math.max(1, cfg.doprMontCest);
    const sazba = cfg.doprMontSazba;
    const mytne = cfg.doprMontMytne ? cfg.doprMontMytneKc : 0;
    const nasobek = cfg.doprMontZpat ? 2 : 1;
    const celkem = km * nasobek * cest * sazba + mytne * cest;
    result.dopravaMontaznik = { km, cest, sazba, mytne, nasobek, celkem: Math.max(500, celkem) };
  }

  // 2) Doprava betonových produktů (individuální)
  if (cfg.dopravaBetProduktu) {
    let hmotnostKg = 0;
    const betProduktyDetail = [];
    // Betonové sloupky
    if (isBeton && result.betonoveSloupky > 0) {
      const hmKs = 45;
      const hm = result.betonoveSloupky * hmKs;
      hmotnostKg += hm;
      betProduktyDetail.push({ nazev: 'Betonové sloupky', pocet: result.betonoveSloupky, hmKs, hmCelkem: hm });
    }
    // Betonové desky
    if (isBeton && result.betonoveDesky > 0) {
      const hmKs = 34;
      const hm = result.betonoveDesky * hmKs;
      hmotnostKg += hm;
      betProduktyDetail.push({ nazev: 'Betonové desky', pocet: result.betonoveDesky, hmKs, hmCelkem: hm });
    }
    // Pytlový beton
    if (result.betonDetail && result.betonTyp === 'pytle') {
      const hmKs = 25;
      const hm = result.betonDetail.totalBags * hmKs;
      hmotnostKg += hm;
      betProduktyDetail.push({ nazev: 'Pytlový beton (25 kg)', pocet: result.betonDetail.totalBags, hmKs, hmCelkem: hm });
    }
    // Podhrabové desky
    if (result.podhrabDesky > 0) {
      const hmKs = 100;
      const hm = result.podhrabDesky * hmKs;
      hmotnostKg += hm;
      betProduktyDetail.push({ nazev: 'Podhrabové desky', pocet: result.podhrabDesky, hmKs, hmCelkem: hm });
    }

    // Palety
    let paletPytlu = 0, paletDesek = 0, paletSloupku = 0;
    if (result.betonDetail && result.betonTyp === 'pytle') paletPytlu = Math.ceil(result.betonDetail.totalBags / 53);
    if (isBeton && result.betonoveDesky > 0) paletDesek = Math.ceil(result.betonoveDesky / 20);
    if (isBeton && result.betonoveSloupky > 0) paletSloupku = Math.ceil(result.betonoveSloupky / 25);
    if (result.podhrabDesky > 0) paletDesek += Math.ceil(result.podhrabDesky / 20);
    let paletCelkem = paletPytlu + paletDesek + paletSloupku;
    if (cfg.doprBetPaletCustom > 0) paletCelkem = cfg.doprBetPaletCustom;
    const vkladkaCelkem = paletCelkem * cfg.vkladkaPaleta;

    // Vozidlo limity
    const vozidloLimity = { dodavka: 1500, vlek: 2500, hydraulicka: 25000 };
    const vozidloNazvy = { dodavka: 'Dodávka (do 1,5 t)', vlek: 'Auto s vlekem (do 2,5 t)', hydraulicka: 'Auto s hydraulickou rukou (do 25 t)' };
    const limitKg = vozidloLimity[cfg.doprBetVozidlo] || 1500;
    const doporuceneCest = hmotnostKg > 0 ? Math.ceil(hmotnostKg / limitKg) : 1;

    const km = cfg.doprBetKm;
    const cest = Math.max(1, cfg.doprBetCest || doporuceneCest);
    const sazba = cfg.doprBetSazba;
    const mytne = cfg.doprBetMytne ? cfg.doprBetMytneKc : 0;
    const nasobek = cfg.doprBetZpat ? 2 : 1;
    const celkem = km * nasobek * cest * sazba + mytne * cest;

    result.dopravaBetProduktu = {
      detail: betProduktyDetail,
      hmotnostKg,
      vozidlo: cfg.doprBetVozidlo,
      vozidloNazev: vozidloNazvy[cfg.doprBetVozidlo],
      limitKg,
      doporuceneCest,
      km, cest, sazba, mytne, nasobek,
      celkem: Math.max(0, celkem),
      palety: { pytlu: paletPytlu, desek: paletDesek, sloupku: paletSloupku, celkem: paletCelkem, vkladka: vkladkaCelkem },
    };
  }

  // 3) Doprava betonu z betonárky
  if (cfg.doprBetonKm > 0 && result.betonTyp === 'betonarka') {
    const km = cfg.doprBetonKm;
    const cest = Math.max(1, cfg.doprBetonCest);
    const sazba = cfg.doprBetonSazba;
    const mytne = cfg.doprBetonMytne ? cfg.doprBetonMytneKc : 0;
    const nasobek = cfg.doprBetonZpat ? 2 : 1;
    const celkem = km * nasobek * cest * sazba + mytne * cest;
    result.dopravaBetonarka = { km, cest, sazba, mytne, nasobek, celkem };
  }

  // Rohy
  let cornerCount = 0;
  for (let i = 1; i < state.vertices.length - 1; i++) {
    if (isCorner(i)) cornerCount++;
  }
  result.cornerCount = cornerCount;
  // Roh accessories: opasek + 2 ráčny + šroubek + očko per corner
  result.cornerOpasky = cornerCount;
  result.cornerRacny = cornerCount * 2;

  return result;
}

// ============================================================
// UI UPDATE - CALCULATIONS PANEL
// ============================================================
function updateCalcPanel() {
  const el = document.getElementById('calcResults');
  const result = calculate();

  if (!result) {
    el.innerHTML = '<p class="calc-empty">Nakreslete trasu plotu pro zobrazení výpočtů.</p>';
    return;
  }

  const type = state.fenceType;
  const isPanels = type === 'panely_2d' || type === 'panely_3d';
  const isBeton = type === 'betonovy';
  const isCtyr = type.startsWith('ctyrhranne');
  const isSvar = type === 'svarovane';

  let html = '';

  // Základní
  html += `<div class="calc-highlight">
    <div class="calc-row"><span class="label">Celková délka plotu</span><span class="value">${result.totalLength.toFixed(1)} m</span></div>
    <div class="calc-row"><span class="label">Počet polí (úseků)</span><span class="value">${result.totalFields}</span></div>
    <div class="calc-row"><span class="label">Počet rohů</span><span class="value">${result.cornerCount}</span></div>
  </div>`;

  // Sloupky
  const typSloupkuLabels = { kulate_38: 'Kulaté 38 mm', kulate_48: 'Kulaté 48 mm', hranate_60x40: 'Hranaté 60×40 mm', hranate_60x60: 'Hranaté 60×60 mm', klasicke_48: 'Kulaté 48 mm', prolis_bekaclip: 'S prolisem (Bekaclip)' };
  const globalTyp = state.config.typSloupku;
  const sloupkyNadpis = isBeton ? 'Betonové sloupky' : 'Sloupky';
  const typSloupkuDisplay = isBeton ? 'Betonové' : isPanels ? 'Hranaté 60×40 mm' : (state.config.stiniciTkanina ? 'STRONG' : (typSloupkuLabels[globalTyp] || globalTyp));
  html += `<div class="calc-section"><h4>${sloupkyNadpis}</h4>
    <div class="calc-row"><span class="label">Celkem sloupků</span><span class="value">${result.fencePosts}</span></div>
    <div class="calc-row"><span class="label">Délka sloupku</span><span class="value">${result.postHeight} cm</span></div>
    <div class="calc-row"><span class="label">Typ sloupků</span><span class="value">${typSloupkuDisplay}</span></div>`;
  // Show per-segment overrides if any
  {
    const segOverrides = [];
    for (const key of Object.keys(state.segmentStyles)) {
      const s = state.segmentStyles[key];
      if (s && s.typSloupku && s.typSloupku !== globalTyp) {
        segOverrides.push({ seg: parseInt(key), typ: s.typSloupku });
      }
    }
    if (segOverrides.length > 0) {
      html += `<div class="calc-row" style="font-size:11px;color:#888;"><span class="label">Úseky s jiným typem:</span></div>`;
      for (const o of segOverrides) {
        html += `<div class="calc-row" style="font-size:11px;padding-left:12px;"><span class="label">Úsek ${o.seg + 1}</span><span class="value">${typSloupkuLabels[o.typ] || o.typ}</span></div>`;
      }
    }
  }
  html += `</div>`;

  // Vzpěry
  if (!isPanels && !isBeton) {
    html += `<div class="calc-section"><h4>Vzpěry</h4>
      <div class="calc-row"><span class="label">Počet vzpěr</span><span class="value">${result.strutCount}</span></div>
      <div class="calc-row"><span class="label">Délka vzpěry</span><span class="value">${result.strutLength} cm</span></div>
    </div>`;
  }

  // Napínací drát
  if (result.napDratCount) {
    html += `<div class="calc-section"><h4>Napínací drát</h4>
      <div class="calc-row"><span class="label">Počet drátů na sekci</span><span class="value">${result.napDratCount}×</span></div>`;
    if (result.napDratSections && result.napDratSections.length > 0) {
      html += `<div class="calc-row" style="font-size:11px;color:#e74c3c;font-weight:600;">⚠️ Každý drát = samostatné balení na sekci!</div>`;
      for (let si = 0; si < result.napDratSections.length; si++) {
        const sec = result.napDratSections[si];
        html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">Sekce ${si + 1} (${sec.lengthM.toFixed(1)} m)</span><span class="value">${sec.wireCount}× balení po ${sec.lengthM.toFixed(1)} m</span></div>`;
      }
    }
    html += `<div class="calc-row"><span class="label">Celkem délka drátů</span><span class="value">${result.napDratLength.toFixed(1)} m</span></div>
    </div>`;
  }

  // Spony Roca Fix (čtyřhranné)
  if (result.sponyRocaFix) {
    const b = result.sponyRocaFixBal;
    html += `<div class="calc-section"><h4>Spony Roca Fix</h4>
      <div class="calc-row"><span class="label">Celkem spon</span><span class="value">${result.sponyRocaFix} ks</span></div>
      <div class="calc-row" style="font-size:11px;color:#888"><span class="label">(1 spona každých 20 cm na každém napínacím drátě)</span></div>
      <div class="calc-row"><span class="label">Balení</span><span class="value">${b.bal1000 > 0 ? b.bal1000 + '× 1000 ks' : ''}${b.bal1000 > 0 && b.bal200 > 0 ? ' + ' : ''}${b.bal200 > 0 ? b.bal200 + '× 200 ks' : ''} = ${b.celkem} ks</span></div>
    </div>`;
  }

  // Vázací drát + Spony BEKACLIP (svařované)
  if (result.vazaciDrat) {
    html += `<div class="calc-section"><h4>Vázací drát</h4>
      <div class="calc-row"><span class="label">Vázací drát</span><span class="value">ANO</span></div>`;
    if (result.bekaclip) {
      html += `<div class="calc-row"><span class="label">Kleště Bekaclip + spony</span><span class="value">ANO</span></div>`;
    }
    if (result.sponyBekaclip) {
      html += `<div class="calc-row"><span class="label">Spony BEKACLIP</span><span class="value">${result.sponyBekaclip} ks</span></div>
      <div class="calc-row" style="font-size:11px;color:#888"><span class="label">(na každém oku na každém sloupku, oko ${state.config.svarOkoVyska} cm)</span></div>`;
    }
    html += `</div>`;
  }

  // Příchytky
  if (result.prichytky) {
    html += `<div class="calc-section"><h4>Příchytky</h4>
      <div class="calc-row"><span class="label">Počet příchytek</span><span class="value">${result.prichytky}${result.prichytkyExtra ? ' + ' + result.prichytkyExtra + ' ks navíc' : ''}</span></div>`;
    if (result.prichytkyNaDrat) {
      html += `<div class="calc-row" style="font-size:11px;color:#888"><span class="label">(${result.prichytkyNaDrat} příchytek na sloupek — 1 na každý napínací drát)</span></div>`;
    }
    html += `</div>`;
  }

  // Ráčny
  if (!isPanels && !isBeton && result.racnyCount > 0) {
    html += `<div class="calc-section"><h4>Ráčny (napínáky)</h4>
      <div class="calc-row"><span class="label">Počet ráčen</span><span class="value">${result.racnyCount} ks</span></div>
      <div class="calc-row" style="font-size:11px;color:#888"><span class="label">(na každém napínacím drátě u vzpěry)</span></div>
    </div>`;
  }

  // Pletivo
  if (result.pletivoLength) {
    const pletivoNadpis = type === 'svarovane' ? 'Svařované pletivo' : 'Čtyřhranné pletivo';
    html += `<div class="calc-section"><h4>${pletivoNadpis}</h4>
      <div class="calc-row"><span class="label">Potřebná délka (+5%)</span><span class="value">${result.pletivoLength.toFixed(1)} m</span></div>
      <div class="calc-row"><span class="label">Počet rolí (${result.roleDelka} m)</span><span class="value">${result.roleCount}</span></div>
    </div>`;
  }

  // Panely (plotové dílce)
  if (result.panelCount !== undefined) {
    const panelNadpis = type === 'panely_2d' ? 'Plotové dílce 2D' : 'Plotové dílce 3D';
    html += `<div class="calc-section"><h4>${panelNadpis}</h4>
      <div class="calc-row"><span class="label">Počet dílců (2,5 m)</span><span class="value">${result.panelCount}</span></div>
      <div class="calc-row"><span class="label">Sprej v barvě plotu</span><span class="value">${result.sprej}× (${result.barvaSprej})</span></div>
    </div>`;
  }

  // Betonový plot
  if (isBeton) {
    const betonBarvaLabels = { seda: 'Šedá', piskova: 'Písková', hneda: 'Hnědá', cervena: 'Cihlově červená' };
    const barvaLabel = betonBarvaLabels[state.config.betonBarva] || 'Šedá';
    html += `<div class="calc-section"><h4>Betonový plot</h4>
      <div class="calc-row"><span class="label">Betonové desky</span><span class="value">${result.betonoveDesky} ks</span></div>
      <div class="calc-row"><span class="label">Barva desek</span><span class="value">${barvaLabel}</span></div>
      <div class="calc-row"><span class="label">Betonové sloupky celkem</span><span class="value">${result.betonoveSloupky} ks</span></div>`;
    if (result.betonSloupkyPrubezny > 0) {
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">↳ Průběžný sloupek</span><span class="value">${result.betonSloupkyPrubezny} ks</span></div>`;
    }
    if (result.betonSloupkyKoncovy > 0) {
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">↳ Koncový sloupek</span><span class="value">${result.betonSloupkyKoncovy} ks</span></div>`;
    }
    if (result.betonSloupkyRohovy > 0) {
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">↳ Rohový sloupek (90°)</span><span class="value">${result.betonSloupkyRohovy} ks</span></div>`;
    }
    if (result.betonSloupkyDvojkoncovy > 0) {
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;color:#e67e22;"><span class="label">↳ 2× koncový sloupek (≠90°)</span><span class="value">${result.betonSloupkyDvojkoncovy} ks</span></div>`;
    }
    html += `<div class="calc-row"><span class="label">Chemická kotva</span><span class="value">${result.chemickaKotva} ks</span></div>`;
    if (result.sokly) {
      html += `<div class="calc-row"><span class="label">Sokly</span><span class="value">${result.sokly} ks</span></div>`;
    }
    html += `</div>`;
  }

  // Podhrabové desky
  if (result.podhrabDesky) {
    html += `<div class="calc-section"><h4>Podhrabové desky</h4>
      <div class="calc-row"><span class="label">Počet desek</span><span class="value">${result.podhrabDesky}</span></div>
      <div class="calc-row"><span class="label">Držáky desek celkem</span><span class="value">${result.podhrabDrzaky}</span></div>`;
    if (result.podhrabDrzakyPrubezny != null) {
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">↳ Průběžné držáky</span><span class="value">${result.podhrabDrzakyPrubezny} ks</span></div>`;
      html += `<div class="calc-row" style="padding-left:12px;font-size:12px;"><span class="label">↳ Koncové držáky</span><span class="value">${result.podhrabDrzakyKoncovy} ks</span></div>`;
    }
    if (result.podhrabHranateWarning) {
      html += `<div class="calc-row" style="color:#e74c3c;font-size:11px;font-weight:600;">⚠️ Hranaté sloupky – standardní držáky podhr. desek nelze použít!</div>`;
    }
    html += `<div class="calc-row"><span class="label">Kryty na desky</span><span class="value">${result.podhrabKryty}</span></div>`;
    if (result.podhrabDrzakySrouby > 0) {
      html += `<div class="calc-row"><span class="label">Šrouby pro držáky desek</span><span class="value">${result.podhrabDrzakySrouby} ks</span></div>`;
    }
    if (result.strutBrackets > 0) {
      html += `<div class="calc-row"><span class="label">Držáky vzpěr na desku</span><span class="value">${result.strutBrackets}</span></div>`;
    }
    html += `<div class="calc-row"><span class="label">Šroub VZP</span><span class="value">ANO</span></div>
    </div>`;
  }

  // Beton / patky
  if (result.betonDetail) {
    const bd = result.betonDetail;
    const isPytleRec = result.betonTyp === 'pytle';
    const pytleColor = isPytleRec ? '#27ae60' : '#e74c3c';
    const betonarkaColor = !isPytleRec ? '#27ae60' : '#e74c3c';
    const pytleLabel = isPytleRec ? 'DOPORUČENO' : 'méně výhodné';
    const betonarkaLabel = !isPytleRec ? 'DOPORUČENO' : 'méně výhodné';
    const pytleNote = isPytleRec ? '(do 30 m délky plotu)' : '(nad 30 m je výhodnější betonárka)';
    const betonarkaNote = !isPytleRec ? '(nad 30 m délky plotu)' : '(pod 30 m se nevyplatí dovoz)';

    html += `<div class="calc-section beton-section"><h4>🧱 Beton</h4>`;

    // Breakdown header
    html += `<div class="calc-row" style="font-size:11px;color:#7f8c8d;margin-bottom:4px"><span class="label">Rozpad spotřeby betonu:</span></div>`;
    if (bd.normalPostCount > 0) {
      html += `<div class="calc-row beton-detail"><span class="label">  Sloupky (${bd.normalPostCount}× po 1,5 pytli)</span><span class="value">${bd.bagsSloupky} pytlů</span></div>`;
    }
    if (bd.gatePostCount > 0) {
      html += `<div class="calc-row beton-detail"><span class="label">  Brány/branky (${bd.gatePostCount}× po 2 pytlích)</span><span class="value">${bd.bagsBranky} pytlů</span></div>`;
    }
    if (bd.strutCount > 0) {
      html += `<div class="calc-row beton-detail"><span class="label">  Vzpěry (${bd.strutCount}× po 1,5 pytli)</span><span class="value">${bd.bagsVzpery} pytlů</span></div>`;
    }
    html += `<div class="calc-row" style="font-weight:600;margin-top:2px"><span class="label">Celkem</span><span class="value">${bd.totalBags} pytlů</span></div>`;
    html += `<div class="calc-row" style="font-size:11px;color:#7f8c8d"><span class="label">Přepočet na kubíky</span><span class="value">${bd.kubikyFormatted} m³</span></div>`;
    html += `<div style="height:8px"></div>`;

    // Option A: Pytlovaný beton
    html += `<div class="beton-option" style="border-left:3px solid ${pytleColor};padding:6px 10px;margin-bottom:6px;border-radius:4px;background:${isPytleRec ? '#eafaf1' : '#fdf2f2'}">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
    html += `<span style="font-weight:600">Pytlovaný beton</span>`;
    html += `<span style="font-size:11px;font-weight:600;color:${pytleColor};padding:1px 6px;border-radius:8px;border:1px solid ${pytleColor}">${pytleLabel}</span>`;
    html += `</div>`;
    html += `<div style="font-size:11px;color:#555;margin-top:2px">${pytleNote}</div>`;
    html += `<div class="calc-row" style="margin-top:4px"><span class="label">Pytle betonu (kód 2693)</span><span class="value" style="font-weight:700">${bd.totalBags} ks</span></div>`;
    html += `</div>`;

    // Option B: Betonárka
    html += `<div class="beton-option" style="border-left:3px solid ${betonarkaColor};padding:6px 10px;margin-bottom:4px;border-radius:4px;background:${!isPytleRec ? '#eafaf1' : '#fdf2f2'}">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
    html += `<span style="font-weight:600">Beton z betonárky</span>`;
    html += `<span style="font-size:11px;font-weight:600;color:${betonarkaColor};padding:1px 6px;border-radius:8px;border:1px solid ${betonarkaColor}">${betonarkaLabel}</span>`;
    html += `</div>`;
    html += `<div style="font-size:11px;color:#555;margin-top:2px">${betonarkaNote}</div>`;
    html += `<div class="calc-row" style="margin-top:4px"><span class="label">Kubíky betonu</span><span class="value" style="font-weight:700">${bd.kubikyFormatted} m³</span></div>`;
    html += `<div style="font-size:10px;color:#888;margin-top:2px">Vzorec: (${bd.normalPostCount + bd.gatePostCount} sloupků + ${bd.strutCount} vzpěr) ÷ 37</div>`;
    html += `</div>`;

    html += `</div>`;
  } else if (result.patky) {
    html += `<div class="calc-section"><h4>Ukotvení</h4>
      <div class="calc-row"><span class="label">Patky na sloupky</span><span class="value">${result.patky} ks</span></div>
    </div>`;
  }

  // Brány/branky
  if (result.gates.branka > 0 || result.gates.brana > 0) {
    html += `<div class="calc-section"><h4>Brány a branky</h4>`;
    if (result.gates.branka > 0) {
      html += `<div class="calc-row"><span class="label">Branky</span><span class="value">${result.gates.branka} ks</span></div>`;
    }
    if (result.gates.brana > 0) {
      html += `<div class="calc-row"><span class="label">Brány</span><span class="value">${result.gates.brana} ks</span></div>`;
    }
    html += `</div>`;
  }

  // Rohy — příslušenství (ne pro betonový plot)
  if (result.cornerCount > 0 && !isBeton) {
    html += `<div class="calc-section"><h4>Příslušenství rohů</h4>
      <div class="calc-row"><span class="label">Opasky</span><span class="value">${result.cornerOpasky}</span></div>
      <div class="calc-row"><span class="label">Ráčny (rohové)</span><span class="value">${result.cornerRacny}</span></div>
      <div class="calc-row"><span class="label">Šroubky + očka</span><span class="value">${result.cornerCount} sad</span></div>
    </div>`;
  }

  // Povinné položky pro betonový plot (cenová nabídka)
  if (isBeton) {
    html += `<div class="calc-section" style="border:2px solid #e74c3c;background:#fdf2f2;padding:8px;">
      <h4 style="color:#e74c3c;">⚠️ Povinné položky – cenová nabídka</h4>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">1. Montáž ruční kopání</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">2. Montáž zarezávání betonových panelů</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">3. Montáž zakopávání betonových desek</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">4. Individuální doprava betonových produktů</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">5. Platba: 65 % předem / 35 % po dokončení</span></div>
    </div>`;
  }

  // Povinné položky pro čtyřhranné/svařované pletivo (cenová nabídka)
  if (isCtyr || isSvar) {
    const hasPodhrab = result.podhrabDesky > 0;
    html += `<div class="calc-section" style="border:2px solid #e74c3c;background:#fdf2f2;padding:8px;">
      <h4 style="color:#e74c3c;">⚠️ Povinné položky – cenová nabídka</h4>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">1. Montáž ruční kopání</span></div>`;
    if (hasPodhrab) {
      html += `<div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">2. Montáž zarezávání podhrabových desek</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">3. Montáž zakopávání podhrabových desek</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">4. Individuální doprava betonových produktů</span></div>
      <div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">5. Platba: 65 % předem / 35 % po dokončení</span></div>`;
    } else {
      html += `<div class="calc-row" style="color:#c0392b;font-weight:600;"><span class="label">2. Platba: 65 % předem / 35 % po dokončení</span></div>`;
    }
    html += `</div>`;
  }

  // Doprava
  if (result.dopravaMontaznik || result.dopravaBetonarka || result.dopravaBetProduktu) {
    html += `<div class="calc-section"><h4>🚛 Doprava</h4>`;

    // Montážník
    if (result.dopravaMontaznik) {
      const m = result.dopravaMontaznik;
      html += `<div class="calc-row" style="margin-top:4px;"><span class="label">🧑‍🔧 Doprava montážníka</span><span class="value"><strong>${formatPrice(m.celkem)}</strong></span></div>`;
      html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">${m.km} km × ${m.nasobek} × ${m.cest} cest × ${m.sazba} Kč/km</span></div>`;
      if (m.mytne > 0) html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">🛣️ Mýtné</span><span class="value">${formatPrice(m.mytne)} × ${m.cest} cest</span></div>`;
    }

    // Betonárka
    if (result.dopravaBetonarka) {
      const b = result.dopravaBetonarka;
      html += `<div class="calc-row" style="margin-top:6px;border-top:1px dashed #ddd;padding-top:6px;"><span class="label">🏭 Doprava betonu z betonárky</span><span class="value"><strong>${formatPrice(b.celkem)}</strong></span></div>`;
      html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">${b.km} km × ${b.nasobek} × ${b.cest} cest × ${b.sazba} Kč/km</span></div>`;
      if (b.mytne > 0) html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">🛣️ Mýtné</span><span class="value">${formatPrice(b.mytne)} × ${b.cest} cest</span></div>`;
    }

    // Betonové produkty
    if (result.dopravaBetProduktu) {
      const bp = result.dopravaBetProduktu;
      html += `<div class="calc-row" style="margin-top:6px;border-top:1px dashed #ddd;padding-top:6px;"><span class="label">🧱 Doprava betonových produktů</span><span class="value"><strong>${formatPrice(bp.celkem)}</strong></span></div>`;
      html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">${bp.km} km × ${bp.nasobek} × ${bp.cest} cest × ${bp.sazba} Kč/km</span></div>`;
      if (bp.mytne > 0) html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">🛣️ Mýtné</span><span class="value">${formatPrice(bp.mytne)} × ${bp.cest} cest</span></div>`;
      html += `<div class="calc-row" style="font-size:11px;color:#888;padding-left:12px"><span class="label">🚗 Vozidlo</span><span class="value">${bp.vozidloNazev}</span></div>`;

      if (bp.detail && bp.detail.length > 0) {
        html += `<div class="calc-row" style="font-size:11px;color:#7f8c8d;margin-top:4px;padding-left:12px"><span class="label">Hmotnost produktů:</span></div>`;
        for (const item of bp.detail) {
          html += `<div class="calc-row" style="font-size:11px;padding-left:20px"><span class="label">${item.nazev} (${item.pocet}× po ${item.hmKs} kg)</span><span class="value">${(item.hmCelkem / 1000).toFixed(2)} t</span></div>`;
        }
        html += `<div class="calc-row" style="font-size:12px;font-weight:600;padding-left:12px;margin-top:2px"><span class="label">Celková hmotnost</span><span class="value">${(bp.hmotnostKg / 1000).toFixed(2)} t</span></div>`;
        if (bp.hmotnostKg > bp.limitKg) {
          html += `<div class="calc-row" style="font-size:11px;color:#e74c3c;padding-left:12px"><span class="label">⚠️ Hmotnost překračuje limit vozidla! Doporučeno min. ${bp.doporuceneCest} cest.</span></div>`;
        }
      }

      // Palety
      const p = bp.palety;
      if (p.celkem > 0) {
        html += `<div class="calc-row" style="font-size:11px;color:#7f8c8d;margin-top:4px;padding-left:12px"><span class="label">📦 Palety:</span></div>`;
        if (p.pytlu > 0) html += `<div class="calc-row" style="font-size:11px;padding-left:20px"><span class="label">Pytlový beton</span><span class="value">${p.pytlu} palet (53 pytlů/pal.)</span></div>`;
        if (p.desek > 0) html += `<div class="calc-row" style="font-size:11px;padding-left:20px"><span class="label">Desky</span><span class="value">${p.desek} palet (20 desek/pal.)</span></div>`;
        if (p.sloupku > 0) html += `<div class="calc-row" style="font-size:11px;padding-left:20px"><span class="label">Sloupky</span><span class="value">${p.sloupku} palet (25 sloupků/pal.)</span></div>`;
        html += `<div class="calc-row" style="font-size:12px;font-weight:600;padding-left:12px"><span class="label">Celkem palet</span><span class="value">${p.celkem} pal.</span></div>`;
        html += `<div class="calc-row" style="font-size:12px;padding-left:12px"><span class="label">Vykládka palet</span><span class="value">${formatPrice(p.vkladka)}</span></div>`;
      }
    }

    html += `</div>`;
  }

  el.innerHTML = html;

  // Update sidebar pallet breakdown in the transport section
  const betVysledekEl = document.getElementById('betProduktyVysledek');
  if (betVysledekEl && result) {
    let bhtml = '';
    // Always show weight/pallet breakdown if there's a fence drawn
    const isBeton = type === 'betonovy';
    const hasBags = result.betonDetail && result.betonTyp === 'pytle' && result.betonDetail.totalBags > 0;
    const hasDesky = isBeton && result.betonoveDesky > 0;
    const hasSloupky = isBeton && result.betonoveSloupky > 0;
    const hasPodhrab = result.podhrabDesky > 0;

    if (hasBags || hasDesky || hasSloupky || hasPodhrab) {
      bhtml += '<div style="border-top:1px dashed #e0c080; padding-top:4px; margin-top:4px;">';
      bhtml += '<strong style="font-size:11px;">📋 Rozpis produktů a palet:</strong><br>';

      let totalKg = 0;
      let paletCelkem = 0;

      if (hasSloupky) {
        const kg = result.betonoveSloupky * 45;
        const pal = Math.ceil(result.betonoveSloupky / 25);
        totalKg += kg;
        paletCelkem += pal;
        bhtml += `<span style="font-size:11px;">• Bet. sloupky: ${result.betonoveSloupky} ks × 45 kg = ${kg} kg → <b>${pal} palet</b> (25 ks/pal.)</span><br>`;
      }
      if (hasDesky) {
        const kg = result.betonoveDesky * 34;
        const pal = Math.ceil(result.betonoveDesky / 20);
        totalKg += kg;
        paletCelkem += pal;
        bhtml += `<span style="font-size:11px;">• Bet. desky: ${result.betonoveDesky} ks × 34 kg = ${kg} kg → <b>${pal} palet</b> (20 ks/pal.)</span><br>`;
      }
      if (hasBags) {
        const bags = result.betonDetail.totalBags;
        const kg = bags * 25;
        const pal = Math.ceil(bags / 53);
        totalKg += kg;
        paletCelkem += pal;
        bhtml += `<span style="font-size:11px;">• Pytlový beton: ${bags} ks × 25 kg = ${kg} kg → <b>${pal} palet</b> (53 pytlů/pal.)</span><br>`;
      }
      if (hasPodhrab) {
        const kg = result.podhrabDesky * 100;
        const pal = Math.ceil(result.podhrabDesky / 20);
        totalKg += kg;
        paletCelkem += pal;
        bhtml += `<span style="font-size:11px;">• Podhr. desky: ${result.podhrabDesky} ks × 100 kg = ${kg} kg → <b>${pal} palet</b> (20 ks/pal.)</span><br>`;
      }

      bhtml += `<div style="margin-top:4px; font-weight:600; font-size:12px;">Celkem: ${(totalKg / 1000).toFixed(2)} t, ${paletCelkem} palet</div>`;

      // Auto-fill pallet custom field if it's 0
      const paletInput = document.getElementById('cfgDoprBetPaletCustom');
      if (paletInput && parseInt(paletInput.value) === 0) {
        // Show auto-calculated value as placeholder
        paletInput.placeholder = paletCelkem + ' (auto)';
      }

      bhtml += '</div>';
    }
    betVysledekEl.innerHTML = bhtml;
  }
}

function formatPrice(val) {
  return Math.round(val).toLocaleString('cs-CZ') + ' Kč';
}

// ============================================================
// DOPRAVA – Geocoding + Routing (Nominatim + OSRM)
// ============================================================

async function geocodeAddress(address) {
  const url = `/api/geocode?q=${encodeURIComponent(address)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Geocoding selhal');
  const data = await resp.json();
  if (!data.length) throw new Error('Adresa nenalezena: ' + address);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

async function getRouteDistance(lat1, lon1, lat2, lon2) {
  const url = `/api/route?from=${lon1},${lat1}&to=${lon2},${lat2}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Routing selhal');
  const data = await resp.json();
  if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('Trasa nenalezena');
  return {
    distanceKm: Math.round(data.routes[0].distance / 100) / 10,
    durationMin: Math.round(data.routes[0].duration / 60),
  };
}

async function vypocitatVzdalenostOnline() {
  const adresaStavby = document.getElementById('cfgAdresaStavby').value.trim();
  const betonarka = document.getElementById('cfgBetonarka').value.trim();
  const statusEl = document.getElementById('vzdalenostStatus');

  if (!adresaStavby || !betonarka) {
    statusEl.textContent = '⚠️ Vyplňte obě adresy';
    statusEl.style.color = 'orange';
    return;
  }

  statusEl.textContent = '⏳ Hledám adresy...';
  statusEl.style.color = 'var(--text-muted)';

  try {
    const [geo1, geo2] = await Promise.all([
      geocodeAddress(adresaStavby),
      geocodeAddress(betonarka),
    ]);

    statusEl.textContent = '⏳ Počítám trasu po silnici...';

    const route = await getRouteDistance(geo1.lat, geo1.lon, geo2.lat, geo2.lon);

    document.getElementById('cfgDoprMontKm').value = route.distanceKm;
    document.getElementById('cfgDoprBetKm').value = route.distanceKm;
    document.getElementById('cfgDoprBetonKm').value = route.distanceKm;
    state.config.doprMontKm = route.distanceKm;
    state.config.doprBetKm = route.distanceKm;
    state.config.doprBetonKm = route.distanceKm;
    state.config.adresaStavby = adresaStavby;
    state.config.betonarka = betonarka;

    statusEl.innerHTML = `✅ <strong>${route.distanceKm} km</strong> (cca ${route.durationMin} min)<br>` +
      `<small>📍 ${geo1.display.split(',').slice(0,3).join(',')}</small><br>` +
      `<small>🏭 ${geo2.display.split(',').slice(0,3).join(',')}</small>`;
    statusEl.style.color = 'var(--accent)';

    recalcAndRender();
  } catch (err) {
    statusEl.textContent = '❌ ' + err.message;
    statusEl.style.color = 'red';
  }
}

// Uložené betonárky (localStorage)
function loadSavedBetonarky() {
  const saved = JSON.parse(localStorage.getItem('plotyBetonarky') || '[]');
  const select = document.getElementById('cfgBetonarkaSelect');
  select.innerHTML = '<option value="">— Uložené betonárky —</option>';
  saved.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.adresa;
    opt.textContent = b.nazev || b.adresa;
    select.appendChild(opt);
  });
}

function ulozBetonarku() {
  const adresa = document.getElementById('cfgBetonarka').value.trim();
  if (!adresa) return;
  const nazev = prompt('Název betonárky (volitelné):', adresa) || adresa;
  const saved = JSON.parse(localStorage.getItem('plotyBetonarky') || '[]');
  if (saved.some(b => b.adresa === adresa)) {
    alert('Tato betonárka už je uložená.');
    return;
  }
  saved.push({ nazev, adresa });
  localStorage.setItem('plotyBetonarky', JSON.stringify(saved));
  loadSavedBetonarky();
}

function smazBetonarku() {
  const select = document.getElementById('cfgBetonarkaSelect');
  const adresa = select.value;
  if (!adresa) return;
  const saved = JSON.parse(localStorage.getItem('plotyBetonarky') || '[]');
  const filtered = saved.filter(b => b.adresa !== adresa);
  localStorage.setItem('plotyBetonarky', JSON.stringify(filtered));
  loadSavedBetonarky();
}

// Hledat betonárky v okolí stavby
async function hledatBetonarky() {
  const adresaStavby = document.getElementById('cfgAdresaStavby').value.trim();
  const vysledkyEl = document.getElementById('betonarkyVysledky');

  if (!adresaStavby) {
    vysledkyEl.innerHTML = '<div style="color:orange; font-size:12px;">⚠️ Nejdřív vyplňte adresu stavby</div>';
    return;
  }

  vysledkyEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">⏳ Hledám adresu stavby...</div>';

  try {
    // 1. Geocode stavba address
    const geo = await geocodeAddress(adresaStavby);

    vysledkyEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">⏳ Hledám betonárky v okolí...</div>';

    // 2. Load local betonárky database
    const resp = await fetch('/betonarky.json');
    if (!resp.ok) {
      vysledkyEl.innerHTML = '<div style="font-size:12px; color:red;">❌ Databáze betonáren nenalezena. Spusťte: node scraper_betonarky.js</div>';
      return;
    }
    const betonarky = await resp.json();

    // 3. Calculate distances and filter
    const withDist = betonarky
      .filter(b => b.lat && b.lon)
      .map(b => ({
        ...b,
        _dist: haversineKm(geo.lat, geo.lon, b.lat, b.lon),
      }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 20);

    if (withDist.length === 0) {
      vysledkyEl.innerHTML = '<div style="font-size:12px; color:orange;">Žádné betonárky v databázi. Spusťte: node scraper_betonarky.js</div>';
      return;
    }

    // 4. Display results
    let html = `<div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Nejbližší betonárky (${betonarky.filter(b=>b.lat).length} v databázi):</div>`;
    withDist.forEach(b => {
      const name = b.name.replace(/&amp;/g, '&');
      const addr = [b.ulice, b.mesto].filter(Boolean).join(', ');
      const dist = b._dist.toFixed(1);
      html += `<div class="betonarka-item" data-addr="${escapeHtml(addr || name)}" data-name="${escapeHtml(name)}" style="padding:4px 6px; margin:2px 0; background:var(--btn-bg); border-radius:4px; cursor:pointer; font-size:12px; border:1px solid var(--border);" onmouseover="this.style.background='var(--btn-hover)'" onmouseout="this.style.background='var(--btn-bg)'">`
        + `<strong>${escapeHtml(name)}</strong> <span style="color:var(--accent); font-weight:600;">${dist} km</span>`
        + (addr ? `<br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(addr)}</span>` : '')
        + `</div>`;
    });
    vysledkyEl.innerHTML = html;

    // Click handlers
    vysledkyEl.querySelectorAll('.betonarka-item').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        const addr = el.dataset.addr;
        const text = addr || name;
        document.getElementById('cfgBetonarka').value = text;
        state.config.betonarka = text;
        vysledkyEl.innerHTML = `<div style="font-size:12px; color:var(--accent);">✅ Vybrána: <strong>${escapeHtml(name)}</strong></div>`;
      });
    });

  } catch (err) {
    vysledkyEl.innerHTML = `<div style="font-size:12px; color:red;">❌ ${err.message}</div>`;
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// EXPORT
// ============================================================
function getExportText() {
  const result = calculate();
  if (!result) return 'Žádná data k exportu.';

  const cfg = state.config;
  const type = state.fenceType;
  const isBeton = type === 'betonovy';
  const isPanels = type === 'panely_2d' || type === 'panely_3d';
  const isCtyr = type.startsWith('ctyrhranne');
  const isSvar = type === 'svarovane';
  const L = [];
  const sep = '─'.repeat(50);
  const sep2 = '═'.repeat(50);

  L.push(sep2);
  L.push('  PLOTY DOBRÝ – KALKULACE OPLOCENÍ');
  L.push(sep2);
  L.push('');

  // ── ZÁKLADNÍ ÚDAJE ──
  L.push('▶ ZÁKLADNÍ ÚDAJE');
  L.push(sep);
  L.push(`  Typ oplocení:      ${getFenceTypeName()}`);
  if (isBeton) {
    L.push(`  Počet desek:       ${cfg.betonDesky} ks (výška ${cfg.betonDesky * 50} cm)`);
    L.push(`  Barva:             ${cfg.betonBarva}`);
    if (cfg.betonSokl) L.push(`  Sokl:              ANO (${cfg.betonSoklVyska} cm)`);
  } else {
    L.push(`  Výška pletiva:     ${cfg.height} cm`);
  }
  L.push(`  Délka sloupku:     ${result.postHeight} cm`);
  L.push(`  Celková délka:     ${result.totalLength.toFixed(1)} m`);
  L.push(`  Počet polí:        ${result.totalFields}`);
  L.push(`  Počet rohů:        ${result.cornerCount}`);
  if (result.gates.branka > 0) L.push(`  Branky:            ${result.gates.branka} ks`);
  if (result.gates.brana > 0) L.push(`  Brány:             ${result.gates.brana} ks`);
  L.push('');

  // ── SLOUPKY ──
  L.push('▶ SLOUPKY');
  L.push(sep);
  L.push(`  Celkem sloupků:    ${result.fencePosts} ks`);
  L.push(`  Délka sloupku:     ${result.postHeight} cm`);
  if (!isBeton && !isPanels) {
    L.push(`  Typ:               ${cfg.typSloupku}`);
  }
  L.push('');

  // ── VZPĚRY (jen pletiva) ──
  if (result.strutCount > 0) {
    L.push('▶ VZPĚRY');
    L.push(sep);
    L.push(`  Vzpěry:            ${result.strutCount} ks`);
    L.push(`  Délka vzpěry:      ${result.strutLength} cm (= výška pletiva + 50 cm)`);
    L.push(`  Ráčny:             ${result.racnyCount} ks`);
    L.push('');
  }

  // ── PLETIVO / PANELY / BETONOVÉ DESKY ──
  L.push('▶ VÝPLŇ OPLOCENÍ');
  L.push(sep);
  if (isCtyr || isSvar) {
    L.push(`  Pletivo:           ${result.pletivoLength.toFixed(1)} m (vč. 5% rezervy)`);
    L.push(`  Role:              ${result.roleCount}× po ${result.roleDelka} m`);
  }
  if (isPanels) {
    L.push(`  Panely 2,5 m:      ${result.panelCount} ks`);
    L.push(`  Sprej (barva):     ${result.sprej}× (${result.barvaSprej})`);
  }
  if (isBeton) {
    L.push(`  Betonové desky:    ${result.betonoveDesky} ks`);
    L.push(`  Betonové sloupky:  ${result.betonoveSloupky} ks`);
    if (result.betonSloupkyPrubezny > 0) L.push(`    - průběžný:      ${result.betonSloupkyPrubezny} ks`);
    if (result.betonSloupkyKoncovy > 0) L.push(`    - koncový:       ${result.betonSloupkyKoncovy} ks`);
    if (result.betonSloupkyRohovy > 0) L.push(`    - rohový (90°):  ${result.betonSloupkyRohovy} ks`);
    if (result.betonSloupkyDvojkoncovy > 0) L.push(`    - 2× koncový:   ${result.betonSloupkyDvojkoncovy} ks`);
    L.push(`  Chemická kotva:    ${result.chemickaKotva} ks (0,2 na pole)`);
    if (result.sokly) L.push(`  Sokly:             ${result.sokly} ks`);
  }
  L.push('');

  // ── NAPÍNACÍ DRÁTY ──
  if (result.napDratCount) {
    L.push('▶ NAPÍNACÍ DRÁTY');
    L.push(sep);
    L.push(`  Počet drátů:       ${result.napDratCount}×`);
    L.push(`  Celk. délka:       ${result.napDratLength.toFixed(1)} m`);
    L.push(`  ⚠ Každý drát = samostatné balení na sekci!`);
    if (result.napDratSections) {
      for (let si = 0; si < result.napDratSections.length; si++) {
        const sec = result.napDratSections[si];
        L.push(`    Sekce ${si + 1}: ${sec.wireCount}× balení po ${sec.lengthM.toFixed(1)} m`);
      }
    }
    L.push('');
  }

  // ── SPONY ROCA FIX (čtyřhranné) ──
  if (result.sponyRocaFix) {
    const b = result.sponyRocaFixBal;
    L.push('▶ SPONY ROCA FIX');
    L.push(sep);
    L.push(`  Celkem spon:       ${result.sponyRocaFix} ks`);
    L.push(`  (1 spona každých 20 cm na každém napínacím drátě)`);
    L.push(`  Balení:            ${b.bal1000 > 0 ? b.bal1000 + '× 1000 ks' : ''}${b.bal1000 > 0 && b.bal200 > 0 ? ' + ' : ''}${b.bal200 > 0 ? b.bal200 + '× 200 ks' : ''} = ${b.celkem} ks`);
    L.push('');
  }

  // ── VÁZACÍ DRÁT / BEKACLIP ──
  if (result.vazaciDrat) {
    L.push('▶ VÁZACÍ DRÁT');
    L.push(sep);
    L.push(`  Vázací drát:       ANO (délka plotu)`);
    if (result.bekaclip) L.push(`  Kleště Bekaclip:   ANO + spony`);
    if (result.sponyBekaclip) {
      L.push(`  Spony BEKACLIP:    ${result.sponyBekaclip} ks`);
      L.push(`  (na každém oku na každém sloupku, oko ${state.config.svarOkoVyska} cm)`);
    }
    L.push('');
  }

  // ── PŘÍCHYTKY ──
  if (result.prichytky) {
    L.push('▶ PŘÍCHYTKY');
    L.push(sep);
    L.push(`  Příchytky:         ${result.prichytky} ks`);
    if (result.prichytkyNaDrat) L.push(`  (${result.prichytkyNaDrat} na sloupek — 1 na každý napínací drát)`);
    if (result.prichytkyExtra) L.push(`  Navíc rezerva:     +${result.prichytkyExtra} ks`);
    L.push('');
  }

  // ── PODHRABOVÉ DESKY ──
  if (result.podhrabDesky) {
    L.push('▶ PODHRABOVÉ DESKY');
    L.push(sep);
    L.push(`  Podhrabové desky:  ${result.podhrabDesky} ks`);
    L.push(`  Držáky celkem:     ${result.podhrabDrzaky} ks`);
    if (result.podhrabDrzakyPrubezny != null) {
      L.push(`    - průběžné:      ${result.podhrabDrzakyPrubezny} ks`);
      L.push(`    - koncové:       ${result.podhrabDrzakyKoncovy} ks`);
    }
    if (result.podhrabHranateWarning) {
      L.push(`  ⚠ Hranaté sloupky – standardní držáky nelze použít!`);
    }
    if (result.podhrabDrzakySrouby > 0) {
      L.push(`  Samovrtné šrouby:  ${result.podhrabDrzakySrouby} ks (2 na držák)`);
    }
    if (result.strutBrackets > 0) {
      L.push(`  Držáky vzpěr:      ${result.strutBrackets} ks`);
    }
    L.push(`  Šroub VZP:         ANO`);
    L.push('');
  }

  // ── ROHY (ne pro betonový) ──
  if (result.cornerCount > 0 && !isBeton) {
    L.push('▶ PŘÍSLUŠENSTVÍ ROHŮ');
    L.push(sep);
    L.push(`  Rohové opasky:     ${result.cornerOpasky} ks`);
    L.push(`  Rohové ráčny:      ${result.cornerRacny} ks (2 na roh)`);
    L.push(`  Šroubky + očka:    ${result.cornerCount} sad`);
    L.push('');
  }

  // ── BETON ──
  if (result.betonDetail) {
    const bd = result.betonDetail;
    const isPytleRec = result.betonTyp === 'pytle';
    L.push('▶ BETON / UKOTVENÍ');
    L.push(sep);
    if (bd.normalPostCount > 0)
      L.push(`  Sloupky:           ${bd.normalPostCount}× po 1,5 pytl. = ${bd.bagsSloupky} pytlů`);
    if (bd.gatePostCount > 0)
      L.push(`  Br./brk. sloupky:  ${bd.gatePostCount}× po 2 pytl. = ${bd.bagsBranky} pytlů`);
    if (bd.strutCount > 0)
      L.push(`  Vzpěry:            ${bd.strutCount}× po 1,5 pytl. = ${bd.bagsVzpery} pytlů`);
    L.push('');
    L.push(`  ▸ Varianta A: Pytlovaný beton ${isPytleRec ? '✅ DOPORUČENO' : ''}`);
    L.push(`    Pytlů:           ${bd.totalBags} ks (kód 2693)`);
    L.push(`  ▸ Varianta B: Beton z betonárky ${!isPytleRec ? '✅ DOPORUČENO' : ''}`);
    L.push(`    Kubíky:          ${bd.kubikyFormatted} m³`);
    L.push('');
  } else if (result.patky) {
    L.push('▶ UKOTVENÍ');
    L.push(sep);
    L.push(`  Patky:             ${result.patky} ks`);
    L.push('');
  }

  // ── POVINNÉ POLOŽKY (betonový plot) ──
  if (isBeton) {
    L.push('▶ ⚠ POVINNÉ POLOŽKY – CENOVÁ NABÍDKA');
    L.push(sep);
    L.push('  1. Montáž ruční kopání');
    L.push('  2. Montáž zarezávání betonových panelů');
    L.push('  3. Montáž zakopávání betonových desek');
    L.push('  4. Individuální doprava betonových produktů');
    L.push('  5. Platba: 65 % předem / 35 % po dokončení');
    L.push('');
  }

  // ── POVINNÉ POLOŽKY (čtyřhranné/svařované) ──
  if (isCtyr || isSvar) {
    const hasPodhrab = result.podhrabDesky > 0;
    L.push('▶ ⚠ POVINNÉ POLOŽKY – CENOVÁ NABÍDKA');
    L.push(sep);
    L.push('  1. Montáž ruční kopání');
    if (hasPodhrab) {
      L.push('  2. Montáž zarezávání podhrabových desek');
      L.push('  3. Montáž zakopávání podhrabových desek');
      L.push('  4. Individuální doprava betonových produktů');
      L.push('  5. Platba: 65 % předem / 35 % po dokončení');
    } else {
      L.push('  2. Platba: 65 % předem / 35 % po dokončení');
    }
    L.push('');
  }

  // ── DOPRAVA ──
  if (result.dopravaMontaznik || result.dopravaBetonarka || result.dopravaBetProduktu) {
    L.push('▶ DOPRAVA');
    L.push(sep);
    if (result.dopravaMontaznik) {
      const m = result.dopravaMontaznik;
      L.push(`  Montážník:         ${formatPrice(m.celkem)}`);
      L.push(`    ${m.km} km × ${m.nasobek} × ${m.cest} cest × ${m.sazba} Kč/km`);
      if (m.mytne > 0) L.push(`    + mýtné ${formatPrice(m.mytne)} × ${m.cest} cest`);
    }
    if (result.dopravaBetonarka) {
      const b = result.dopravaBetonarka;
      L.push(`  Betonárka:         ${formatPrice(b.celkem)}`);
      L.push(`    ${b.km} km × ${b.nasobek} × ${b.cest} cest × ${b.sazba} Kč/km`);
      if (b.mytne > 0) L.push(`    + mýtné ${formatPrice(b.mytne)} × ${b.cest} cest`);
    }
    if (result.dopravaBetProduktu) {
      const bp = result.dopravaBetProduktu;
      L.push(`  Bet. produkty:     ${formatPrice(bp.celkem)}`);
      L.push(`    ${bp.km} km × ${bp.nasobek} × ${bp.cest} cest × ${bp.sazba} Kč/km`);
      if (bp.mytne > 0) L.push(`    + mýtné ${formatPrice(bp.mytne)} × ${bp.cest} cest`);
      L.push(`    Vozidlo: ${bp.vozidloNazev}`);
      L.push(`    Hmotnost: ${(bp.hmotnostKg / 1000).toFixed(2)} t`);
      if (bp.detail && bp.detail.length > 0) {
        for (const item of bp.detail) {
          L.push(`      ${item.nazev}: ${item.pocet} ks × ${item.hmKs} kg = ${(item.hmCelkem / 1000).toFixed(2)} t`);
        }
      }
      if (bp.palety.celkem > 0) {
        L.push(`    Palety: ${bp.palety.celkem} pal.`);
        if (bp.palety.pytlu > 0) L.push(`      Pytlový beton: ${bp.palety.pytlu} pal. (53 pytlů/pal.)`);
        if (bp.palety.desek > 0) L.push(`      Desky: ${bp.palety.desek} pal. (20 ks/pal.)`);
        if (bp.palety.sloupku > 0) L.push(`      Sloupky: ${bp.palety.sloupku} pal. (25 ks/pal.)`);
        L.push(`    Vykládka: ${formatPrice(bp.palety.vkladka)} (${bp.palety.celkem} × ${cfg.vkladkaPaleta} Kč)`);
      }
    }
    L.push('');
  }

  if (!isBeton) {
    L.push(`  Ruční kopání:      0 Kč (v protokolu dle reality)`);
    L.push('');
  }
  L.push(sep2);
  L.push('  Ploty Dobrý a Urbánek s.r.o. | levne-pletivo.cz');
  L.push(sep2);

  return L.join('\n');
}

function getFenceTypeName() {
  const names = {
    'ctyrhranne_bez_nd': 'Čtyřhranné pletivo (bez ND)',
    'ctyrhranne_s_nd': 'Čtyřhranné pletivo (s ND)',
    'svarovane': 'Svařované pletivo',
    'panely_2d': 'Plotové panely 2D',
    'panely_3d': 'Plotové panely 3D',
    'betonovy': 'Betonový plot',
  };
  return names[state.fenceType] || state.fenceType;
}

function copyToClipboard() {
  const text = getExportText();
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Zkopírováno do schránky!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showNotification('Zkopírováno do schránky!');
  });
}

function printExport() {
  const result = calculate();
  if (!result) { showNotification('Nejdříve nakreslete plot!'); return; }

  const cfg = state.config;
  const type = state.fenceType;
  const isBeton = type === 'betonovy';
  const isPanels = type === 'panely_2d' || type === 'panely_3d';
  const isCtyr = type.startsWith('ctyrhranne');
  const isSvar = type === 'svarovane';

  // Capture 2D canvas as image
  const canvasImg = canvas.toDataURL('image/png');

  // Build HTML
  let h = '';
  const sec = (title) => `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#27ae60;border-bottom:1px solid #27ae60;padding-bottom:1px;margin-bottom:4px;">${title}</div>`;
  const row = (label, val) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0;border-bottom:1px dotted #eee;"><span>${label}</span><strong>${val}</strong></div>`;
  const note = (text) => `<div style="font-size:10px;color:#e67e22;margin:1px 0;">⚠ ${text}</div>`;
  const endSec = '</div>';

  h += `<div style="text-align:center;margin-bottom:6px;">
    <div style="font-size:16px;font-weight:700;color:#27ae60;">PLOTY DOBRÝ</div>
    <div style="font-size:9px;color:#888;">Ploty Dobrý a Urbánek s.r.o. | levne-pletivo.cz | 377 223 120</div>
  </div>`;

  h += `<div style="text-align:center;margin-bottom:6px;">
    <img src="${canvasImg}" style="max-width:100%;max-height:140px;border:1px solid #ddd;">
  </div>`;

  // Základní údaje
  h += sec('Základní údaje');
  h += row('Typ oplocení', getFenceTypeName());
  if (isBeton) {
    h += row('Betonové desky', `${cfg.betonDesky} ks (výška ${cfg.betonDesky * 50} cm)`);
    h += row('Barva', cfg.betonBarva);
    if (cfg.betonSokl) h += row('Sokl', `ANO (${cfg.betonSoklVyska} cm)`);
  } else {
    h += row('Výška pletiva', `${cfg.height} cm`);
  }
  h += row('Délka sloupku', `${result.postHeight} cm`);
  h += row('Celková délka', `${result.totalLength.toFixed(1)} m`);
  h += row('Počet polí', result.totalFields);
  h += row('Počet rohů', result.cornerCount);
  if (result.gates.branka > 0) h += row('Branky', `${result.gates.branka} ks`);
  if (result.gates.brana > 0) h += row('Brány', `${result.gates.brana} ks`);
  h += endSec;

  // Sloupky
  h += sec('Sloupky');
  h += row('Celkem sloupků', `${result.fencePosts} ks`);
  h += row('Délka sloupku', `${result.postHeight} cm`);
  h += endSec;

  // Vzpěry
  if (result.strutCount > 0) {
    h += sec('Vzpěry');
    h += row('Vzpěry', `${result.strutCount} ks`);
    h += row('Délka vzpěry', `${result.strutLength} cm`);
    h += row('Ráčny', `${result.racnyCount} ks`);
    h += endSec;
  }

  // Výplň
  h += sec('Výplň oplocení');
  if (result.pletivoLength) {
    h += row('Pletivo', `${result.pletivoLength.toFixed(1)} m (vč. 5% rezervy)`);
    h += row('Role', `${result.roleCount}× po ${result.roleDelka} m`);
  }
  if (result.panelCount !== undefined) {
    h += row('Panely 2,5 m', `${result.panelCount} ks`);
    h += row('Sprej', `${result.sprej}× (${result.barvaSprej})`);
  }
  if (isBeton) {
    h += row('Betonové desky', `${result.betonoveDesky} ks`);
    h += row('Betonové sloupky', `${result.betonoveSloupky} ks`);
    if (result.betonSloupkyPrubezny > 0) h += row('  - průběžný', `${result.betonSloupkyPrubezny} ks`);
    if (result.betonSloupkyKoncovy > 0) h += row('  - koncový', `${result.betonSloupkyKoncovy} ks`);
    if (result.betonSloupkyRohovy > 0) h += row('  - rohový (90°)', `${result.betonSloupkyRohovy} ks`);
    if (result.betonSloupkyDvojkoncovy > 0) h += row('  - 2× koncový (≠90°)', `${result.betonSloupkyDvojkoncovy} ks`);
    h += row('Chemická kotva', `${result.chemickaKotva} ks`);
    if (result.sokly) h += row('Sokly', `${result.sokly} ks`);
  }
  h += endSec;

  // Napínací dráty
  if (result.napDratCount) {
    h += sec('Napínací dráty');
    h += row('Počet drátů', `${result.napDratCount}×`);
    h += row('Celk. délka', `${result.napDratLength.toFixed(1)} m`);
    h += note('Každý drát = samostatné balení na sekci!');
    if (result.napDratSections) {
      for (let si = 0; si < result.napDratSections.length; si++) {
        const s = result.napDratSections[si];
        h += row(`Sekce ${si + 1}`, `${s.wireCount}× balení po ${s.lengthM.toFixed(1)} m`);
      }
    }
    h += endSec;
  }

  // Spony Roca Fix (čtyřhranné)
  if (result.sponyRocaFix) {
    const b = result.sponyRocaFixBal;
    h += sec('Spony Roca Fix');
    h += row('Celkem spon', `${result.sponyRocaFix} ks`);
    h += note('1 spona každých 20 cm na každém napínacím drátě');
    h += row('Balení', `${b.bal1000 > 0 ? b.bal1000 + '× 1000 ks' : ''}${b.bal1000 > 0 && b.bal200 > 0 ? ' + ' : ''}${b.bal200 > 0 ? b.bal200 + '× 200 ks' : ''} = ${b.celkem} ks`);
    h += endSec;
  }

  // Vázací drát / BEKACLIP (svařované)
  if (result.vazaciDrat) {
    h += sec('Vázací drát');
    h += row('Vázací drát', 'ANO');
    if (result.bekaclip) h += row('Kleště Bekaclip', 'ANO + spony');
    if (result.sponyBekaclip) {
      h += row('Spony BEKACLIP', `${result.sponyBekaclip} ks`);
      h += note(`Na každém oku na každém sloupku, oko ${state.config.svarOkoVyska} cm`);
    }
    h += endSec;
  }

  // Příchytky
  if (result.prichytky) {
    h += sec('Příchytky');
    h += row('Příchytky', `${result.prichytky} ks`);
    if (result.prichytkyNaDrat) h += note(`${result.prichytkyNaDrat} na sloupek — 1 na každý napínací drát`);
    if (result.prichytkyExtra) h += row('Rezerva navíc', `+${result.prichytkyExtra} ks`);
    h += endSec;
  }

  // Podhrabové desky
  if (result.podhrabDesky) {
    h += sec('Podhrabové desky');
    h += row('Podhrabové desky', `${result.podhrabDesky} ks`);
    h += row('Držáky celkem', `${result.podhrabDrzaky} ks`);
    if (result.podhrabDrzakyPrubezny != null) {
      h += row('  - průběžné', `${result.podhrabDrzakyPrubezny} ks`);
      h += row('  - koncové', `${result.podhrabDrzakyKoncovy} ks`);
    }
    if (result.podhrabDrzakySrouby > 0) h += row('Samovrtné šrouby', `${result.podhrabDrzakySrouby} ks`);
    if (result.strutBrackets > 0) h += row('Držáky vzpěr', `${result.strutBrackets} ks`);
    h += row('Šroub VZP', 'ANO');
    if (result.podhrabHranateWarning) h += note('Hranaté sloupky – standardní držáky nelze použít!');
    h += endSec;
  }

  // Rohy (ne pro betonový)
  if (result.cornerCount > 0 && !isBeton) {
    h += sec('Příslušenství rohů');
    h += row('Opasky', `${result.cornerOpasky} ks`);
    h += row('Ráčny', `${result.cornerRacny} ks`);
    h += row('Šroubky + očka', `${result.cornerCount} sad`);
    h += endSec;
  }

  // Beton
  if (result.betonDetail) {
    const bd = result.betonDetail;
    const isPytleRec = result.betonTyp === 'pytle';
    h += sec('Beton / ukotvení');
    if (bd.normalPostCount > 0) h += row('Sloupky', `${bd.normalPostCount}× 1,5 pytl. = ${bd.bagsSloupky} pytlů`);
    if (bd.gatePostCount > 0) h += row('Brány/branky', `${bd.gatePostCount}× 2 pytl. = ${bd.bagsBranky} pytlů`);
    if (bd.strutCount > 0) h += row('Vzpěry', `${bd.strutCount}× 1,5 pytl. = ${bd.bagsVzpery} pytlů`);
    h += `<div style="margin-top:6px;padding:3px 6px;background:${isPytleRec ? '#eafaf1' : '#fdf2f2'};border-left:2px solid ${isPytleRec ? '#27ae60' : '#e74c3c'};">`;
    h += row('Varianta A: Pytlovaný beton' + (isPytleRec ? ' ✅' : ''), `${bd.totalBags} ks (kód 2693)`);
    h += `</div>`;
    h += `<div style="margin-top:3px;padding:3px 6px;background:${!isPytleRec ? '#eafaf1' : '#fdf2f2'};border-left:2px solid ${!isPytleRec ? '#27ae60' : '#e74c3c'};">`;
    h += row('Varianta B: Beton z betonárky' + (!isPytleRec ? ' ✅' : ''), `${bd.kubikyFormatted} m³`);
    h += `</div>`;
    h += endSec;
  } else if (result.patky) {
    h += sec('Ukotvení');
    h += row('Patky', `${result.patky} ks`);
    h += endSec;
  }

  // Povinné položky pro betonový plot
  if (isBeton) {
    h += `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#e74c3c;border-bottom:1px solid #e74c3c;padding-bottom:1px;margin-bottom:4px;">⚠ Povinné položky – cenová nabídka</div>`;
    const mandRow = (text) => `<div style="font-size:11px;padding:1px 0;color:#c0392b;font-weight:600;">${text}</div>`;
    h += mandRow('1. Montáž ruční kopání');
    h += mandRow('2. Montáž zarezávání betonových panelů');
    h += mandRow('3. Montáž zakopávání betonových desek');
    h += mandRow('4. Individuální doprava betonových produktů');
    h += mandRow('5. Platba: 65 % předem / 35 % po dokončení');
    h += endSec;
  }

  // Povinné položky pro čtyřhranné/svařované
  if (isCtyr || isSvar) {
    const hasPodhrab = result.podhrabDesky > 0;
    h += `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#e74c3c;border-bottom:1px solid #e74c3c;padding-bottom:1px;margin-bottom:4px;">⚠ Povinné položky – cenová nabídka</div>`;
    const mandRow2 = (text) => `<div style="font-size:11px;padding:1px 0;color:#c0392b;font-weight:600;">${text}</div>`;
    h += mandRow2('1. Montáž ruční kopání');
    if (hasPodhrab) {
      h += mandRow2('2. Montáž zarezávání podhrabových desek');
      h += mandRow2('3. Montáž zakopávání podhrabových desek');
      h += mandRow2('4. Individuální doprava betonových produktů');
      h += mandRow2('5. Platba: 65 % předem / 35 % po dokončení');
    } else {
      h += mandRow2('2. Platba: 65 % předem / 35 % po dokončení');
    }
    h += endSec;
  }

  // Doprava
  if (result.dopravaMontaznik || result.dopravaBetonarka || result.dopravaBetProduktu) {
    h += sec('Doprava');
    if (result.dopravaMontaznik) {
      const m = result.dopravaMontaznik;
      h += `<div style="font-size:10px;font-weight:600;color:#27ae60;margin-top:3px;">🧑‍🔧 Doprava montážníka</div>`;
      h += row('Celkem', formatPrice(m.celkem));
      h += `<div style="font-size:9px;color:#888;padding-left:8px;">${m.km} km × ${m.nasobek} × ${m.cest} cest × ${m.sazba} Kč/km${m.mytne > 0 ? ' + mýtné ' + formatPrice(m.mytne) : ''}</div>`;
    }
    if (result.dopravaBetonarka) {
      const b = result.dopravaBetonarka;
      h += `<div style="font-size:10px;font-weight:600;color:#3498db;margin-top:3px;">🏭 Doprava betonu z betonárky</div>`;
      h += row('Celkem', formatPrice(b.celkem));
      h += `<div style="font-size:9px;color:#888;padding-left:8px;">${b.km} km × ${b.nasobek} × ${b.cest} cest × ${b.sazba} Kč/km${b.mytne > 0 ? ' + mýtné ' + formatPrice(b.mytne) : ''}</div>`;
    }
    if (result.dopravaBetProduktu) {
      const bp = result.dopravaBetProduktu;
      h += `<div style="font-size:10px;font-weight:600;color:#e67e22;margin-top:3px;">🧱 Doprava betonových produktů</div>`;
      h += row('Celkem', formatPrice(bp.celkem));
      h += `<div style="font-size:9px;color:#888;padding-left:8px;">${bp.km} km × ${bp.nasobek} × ${bp.cest} cest × ${bp.sazba} Kč/km</div>`;
      h += row('  Vozidlo', bp.vozidloNazev);
      h += row('  Hmotnost', `${(bp.hmotnostKg / 1000).toFixed(2)} t`);
      if (bp.palety.celkem > 0) {
        h += row('  Palety', `${bp.palety.celkem} pal.`);
        h += row('  Vykládka', formatPrice(bp.palety.vkladka));
      }
    }
    h += endSec;
  }

  if (!isBeton) {
    h += `<div style="margin-top:6px;font-size:11px;border-top:1px solid #27ae60;padding-top:2px;">
      ${row('Ruční kopání', '0 Kč (dle reality)')}
    </div>`;
  }

  // Download as PDF
  const container = document.createElement('div');
  container.style.cssText = 'font-family: "Segoe UI", Arial, sans-serif; color: #222; max-width: 700px; padding: 10px;';
  container.innerHTML = h;
  document.body.appendChild(container);

  const opt = {
    margin: [6, 8, 6, 8],
    filename: `kalkulace-ploty-dobry-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
    showNotification('PDF staženo!');
  }).catch(() => {
    document.body.removeChild(container);
    showNotification('Chyba při generování PDF');
  });
}

function showNotification(msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:60px;right:20px;background:var(--accent);color:#fff;padding:10px 20px;border-radius:8px;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 1500);
  setTimeout(() => { document.body.removeChild(el); }, 2000);
}

// ============================================================
// EVENT HANDLERS - CANVAS
// ============================================================
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findVertexAt(sx, sy) {
  const threshold = POST_RADIUS * state.zoom + SNAP_RADIUS;
  for (let i = 0; i < state.vertices.length; i++) {
    const s = worldToScreen(state.vertices[i].x, state.vertices[i].y);
    if (Math.abs(s.x - sx) < threshold && Math.abs(s.y - sy) < threshold) {
      return i;
    }
  }
  return -1;
}

function findSegmentAt(sx, sy) {
  const threshold = 12;
  for (let i = 0; i < state.vertices.length - 1; i++) {
    if (state.pathBreaks.has(i)) continue; // skip path breaks
    const sa = worldToScreen(state.vertices[i].x, state.vertices[i].y);
    const sb = worldToScreen(state.vertices[i + 1].x, state.vertices[i + 1].y);
    const d = distPointToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
    if (d < threshold) return i;
  }
  return -1;
}

function findStrutAt(sx, sy) {
  const segments = getSegments();
  const struts = getStrutPositions(segments);
  const threshold = 12;
  for (let i = 0; i < struts.length; i++) {
    const s = worldToScreen(struts[i].wx, struts[i].wy);
    if (Math.abs(s.x - sx) < threshold && Math.abs(s.y - sy) < threshold) {
      return i; // returns index into struts array
    }
  }
  return -1;
}

function findIntPostAt(sx, sy) {
  const segments = getSegments();
  const threshold = POST_RADIUS * 0.7 * state.zoom + 8;
  for (const seg of segments) {
    const fields = seg.fields;
    if (fields <= 1) continue;
    for (let f = 1; f < fields; f++) {
      const t = f / fields;
      const px = seg.a.x + (seg.b.x - seg.a.x) * t;
      const py = seg.a.y + (seg.b.y - seg.a.y) * t;
      const s = worldToScreen(px, py);
      if (Math.abs(s.x - sx) < threshold && Math.abs(s.y - sy) < threshold) {
        return getFieldKey(seg.from, f - 1);
      }
    }
  }
  return null;
}

function findFieldAt(sx, sy) {
  const segments = getSegments();
  const threshold = 12;
  for (const seg of segments) {
    const fieldRanges = getFieldRanges(seg);
    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const ax = seg.a.x + (seg.b.x - seg.a.x) * t0;
      const ay = seg.a.y + (seg.b.y - seg.a.y) * t0;
      const bx = seg.a.x + (seg.b.x - seg.a.x) * t1;
      const by = seg.a.y + (seg.b.y - seg.a.y) * t1;
      const sa = worldToScreen(ax, ay);
      const sb = worldToScreen(bx, by);
      const d = distPointToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
      if (d < threshold) return getFieldKey(seg.from, fi);
    }
  }
  return null;
}

function findClipAt(sx, sy) {
  const type = state.fenceType;
  if (!type.startsWith('ctyrhranne') && type !== 'svarovane') return null;
  const segments = getSegments();
  const threshold = 10;
  for (const seg of segments) {
    const segStyle = getSegStyle(seg);
    const ft = segStyle.fenceType;
    if (!ft.startsWith('ctyrhranne') && ft !== 'svarovane') continue;
    const fieldRanges = getFieldRanges(seg);
    // Check vertex posts
    const sa = worldToScreen(seg.a.x, seg.a.y);
    if (Math.abs(sa.x - sx) < threshold && Math.abs(sa.y - sy) < threshold) {
      return getClipKey('v', seg.from);
    }
    const sb = worldToScreen(seg.b.x, seg.b.y);
    if (Math.abs(sb.x - sx) < threshold && Math.abs(sb.y - sy) < threshold) {
      return getClipKey('v', seg.to);
    }
    // Check intermediate posts
    for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
      const t = fieldRanges[fi].t1;
      const px = seg.a.x + (seg.b.x - seg.a.x) * t;
      const py = seg.a.y + (seg.b.y - seg.a.y) * t;
      const s = worldToScreen(px, py);
      if (Math.abs(s.x - sx) < threshold && Math.abs(s.y - sy) < threshold) {
        return getClipKey('i', seg.from, fi);
      }
    }
  }
  return null;
}

function findWallAt(sx, sy) {
  for (let i = state.walls.length - 1; i >= 0; i--) {
    const wall = state.walls[i];
    if (!wall.vertices || wall.vertices.length < 2) continue;
    const thickPx = (wall.thickness || 20) * state.zoom / 100;
    const threshold = Math.max(thickPx / 2 + 5, 12);
    for (let j = 0; j < wall.vertices.length - 1; j++) {
      const sa = worldToScreen(wall.vertices[j].x, wall.vertices[j].y);
      const sb = worldToScreen(wall.vertices[j + 1].x, wall.vertices[j + 1].y);
      const d = distPointToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
      if (d < threshold) return i;
    }
  }
  return -1;
}

function findHouseAt(sx, sy) {
  const world = screenToWorld(sx, sy);
  for (let i = state.houses.length - 1; i >= 0; i--) {
    const h = state.houses[i];
    if (h.vertices && h.vertices.length >= 3) {
      if (_pointInPolygon(world.x, world.y, h.vertices)) return i;
    }
  }
  return -1;
}

function _pointInPolygon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findGateAt(sx, sy) {
  const segments = getSegments();
  const threshold = 15;
  for (const gate of state.gates) {
    const seg = findSegByFrom(segments, gate.segmentIndex);
    if (!seg) continue;
    let gateCenterM;
    if (gate.positionM != null) {
      gateCenterM = gate.positionM;
    } else {
      gateCenterM = seg.lengthM * (gate.position ?? 0.5);
    }
    const gateCenterT = gateCenterM / seg.lengthM;
    const gateWidthM = gate.width / 100;
    const halfGateT = (gateWidthM / 2) / seg.lengthM;
    const tStart = Math.max(0, gateCenterT - halfGateT);
    const tEnd = Math.min(1, gateCenterT + halfGateT);
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const ax = seg.a.x + dx * tStart;
    const ay = seg.a.y + dy * tStart;
    const bx = seg.a.x + dx * tEnd;
    const by = seg.a.y + dy * tEnd;
    const sa = worldToScreen(ax, ay);
    const sb = worldToScreen(bx, by);
    const d = distPointToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
    if (d < threshold) return gate;
  }
  return null;
}

canvas.addEventListener('mousedown', (e) => {
  const pos = getMousePos(e);
  hideContextMenu();

  // Middle mouse or space for panning
  if (e.button === 1) {
    e.preventDefault();
    state.panning = true;
    state.panStartX = pos.x - state.panX;
    state.panStartY = pos.y - state.panY;
    canvas.classList.add('cursor-grabbing');
    return;
  }

  if (e.button === 2) return; // handled by contextmenu

  if (e.button !== 0) return;

  // Tool-based actions
  if (state.tool === 'draw') {
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapToGrid(world.x, world.y);

    const existingIdx = findVertexAt(pos.x, pos.y);
    const lastIdx = state.vertices.length - 1;
    const lastHasBreak = lastIdx >= 0 && state.pathBreaks.has(lastIdx);
    const isNewSection = state.vertices.length === 0 || lastHasBreak;

    if (existingIdx >= 0 && isNewSection) {
      // Start a new fence section from an existing vertex (T-shape / branch)
      saveHistory();
      const v = state.vertices[existingIdx];
      state.vertices.push({ x: v.x, y: v.y });
      // The break is already set on lastIdx (or we're starting fresh)
      state.selectedVertex = state.vertices.length - 1;
    } else if (existingIdx >= 0 && existingIdx !== lastIdx) {
      // Mid-drawing: clicking a different existing vertex = connect to it and finish section
      saveHistory();
      const v = state.vertices[existingIdx];
      state.vertices.push({ x: v.x, y: v.y });
      // Finish this section with a path break
      state.pathBreaks.add(state.vertices.length - 1);
      state.selectedVertex = -1;
    } else if (existingIdx >= 0) {
      // Clicking the same last vertex = select + drag
      state.selectedVertex = existingIdx;
      state.dragging = true;
      state.dragStartX = pos.x;
      state.dragStartY = pos.y;
    } else {
      saveHistory();
      state.vertices.push({ x: snapped.x, y: snapped.y });
      state.selectedVertex = state.vertices.length - 1;
    }
    recalcAndRender();

  } else if (state.tool === 'select') {
    const vertIdx = findVertexAt(pos.x, pos.y);
    const intPostKey = vertIdx < 0 ? findIntPostAt(pos.x, pos.y) : null;
    const strutIdx = (vertIdx < 0 && !intPostKey) ? findStrutAt(pos.x, pos.y) : -1;
    const gateHit = (vertIdx < 0 && !intPostKey && strutIdx < 0) ? findGateAt(pos.x, pos.y) : null;
    const fieldKey = (vertIdx < 0 && !intPostKey && strutIdx < 0 && !gateHit) ? findFieldAt(pos.x, pos.y) : null;
    const segIdx = (vertIdx < 0 && !intPostKey && strutIdx < 0 && !gateHit && !fieldKey) ? findSegmentAt(pos.x, pos.y) : -1;

    if (vertIdx >= 0) {
      // POST clicked
      if (e.shiftKey) {
        if (state.selectedPosts.has(vertIdx)) state.selectedPosts.delete(vertIdx);
        else state.selectedPosts.add(vertIdx);
      } else {
        state.selectedPosts.clear();
        state.selectedSegments.clear();
        state.selectedStruts.clear();
        state.selectedFields.clear();
        state.selectedIntPosts.clear();
        state.selectedWires.clear();
        state.selectedPosts.add(vertIdx);
      }
      showColorToolbarAt(pos.x, pos.y, 'sloupek');
      state.selectedVertex = vertIdx;
      state.dragging = true;
      state.dragStartX = pos.x;
      state.dragStartY = pos.y;
    } else if (intPostKey) {
      // INTERMEDIATE POST clicked
      if (e.shiftKey) {
        if (state.selectedIntPosts.has(intPostKey)) state.selectedIntPosts.delete(intPostKey);
        else state.selectedIntPosts.add(intPostKey);
      } else {
        state.selectedPosts.clear();
        state.selectedSegments.clear();
        state.selectedStruts.clear();
        state.selectedFields.clear();
        state.selectedIntPosts.clear();
        state.selectedWires.clear();
        state.selectedIntPosts.add(intPostKey);
      }
      showColorToolbarAt(pos.x, pos.y, 'sloupek');
      state.selectedVertex = -1;
    } else if (strutIdx >= 0) {
      // STRUT clicked
      if (e.shiftKey) {
        if (state.selectedStruts.has(strutIdx)) state.selectedStruts.delete(strutIdx);
        else state.selectedStruts.add(strutIdx);
      } else {
        state.selectedPosts.clear();
        state.selectedSegments.clear();
        state.selectedStruts.clear();
        state.selectedFields.clear();
        state.selectedIntPosts.clear();
        state.selectedWires.clear();
        state.selectedStruts.add(strutIdx);
      }
      showColorToolbarAt(pos.x, pos.y, 'vzpěra');
      state.selectedVertex = -1;
    } else if (gateHit) {
      // GATE clicked - start dragging along segment
      state.draggingGate = { gate: gateHit, segFrom: gateHit.segmentIndex };
      state.selectedVertex = -1;
      // Clear other selections
      state.selectedPosts.clear();
      state.selectedSegments.clear();
      state.selectedStruts.clear();
      state.selectedFields.clear();
      state.selectedIntPosts.clear();
      state.selectedWires.clear();
      state.selectedGates.clear();
      state.selectedGates.add('gate:' + gateHit.segmentIndex);
      saveHistory();
    } else if (fieldKey) {
      // INDIVIDUAL FIELD clicked
      if (e.shiftKey) {
        if (state.selectedFields.has(fieldKey)) state.selectedFields.delete(fieldKey);
        else state.selectedFields.add(fieldKey);
      } else {
        state.selectedPosts.clear();
        state.selectedSegments.clear();
        state.selectedStruts.clear();
        state.selectedFields.clear();
        state.selectedIntPosts.clear();
        state.selectedWires.clear();
        state.selectedFields.add(fieldKey);
      }
      showColorToolbarAt(pos.x, pos.y, 'pole');
      state.selectedVertex = -1;
    } else if (segIdx >= 0) {
      // SEGMENT clicked (fallback, unlikely now)
      if (e.shiftKey) {
        if (state.selectedSegments.has(segIdx)) state.selectedSegments.delete(segIdx);
        else state.selectedSegments.add(segIdx);
        state.selectedPosts.clear();
        state.selectedStruts.clear();
      } else {
        state.selectedSegments.clear();
        state.selectedPosts.clear();
        state.selectedStruts.clear();
        state.selectedFields.clear();
        state.selectedIntPosts.clear();
        state.selectedWires.clear();
        state.selectedSegments.add(segIdx);
      }
      showColorToolbarAt(pos.x, pos.y, 'úsek');
      state.selectedVertex = -1;
    } else {
      state.selectedPosts.clear();
      state.selectedSegments.clear();
      state.selectedStruts.clear();
      state.selectedFields.clear();
      state.selectedIntPosts.clear();
      state.selectedWires.clear();
      hideColorToolbar();
      state.selectedVertex = -1;
      state.panning = true;
      state.panStartX = pos.x - state.panX;
      state.panStartY = pos.y - state.panY;
      canvas.classList.add('cursor-grabbing');
    }
    render();

  } else if (state.tool === 'gate') {
    const segIdx = findSegmentAt(pos.x, pos.y);
    if (segIdx >= 0) {
      const existingGate = state.gates.find(g => g.segmentIndex === segIdx);
      openGateDialog(segIdx, existingGate || null);
    }

  } else if (state.tool === 'delete') {
    const vertIdx = findVertexAt(pos.x, pos.y);
    if (vertIdx >= 0) {
      saveHistory();
      state.vertices.splice(vertIdx, 1);
      // Adjust gates
      state.gates = state.gates.filter(g => g.segmentIndex !== vertIdx && g.segmentIndex !== vertIdx - 1);
      state.gates.forEach(g => { if (g.segmentIndex > vertIdx) g.segmentIndex--; });
      // Adjust pathBreaks
      const newBreaks = new Set();
      for (const b of state.pathBreaks) {
        if (b === vertIdx || b === vertIdx - 1) continue; // remove breaks at/around deleted vertex
        newBreaks.add(b > vertIdx ? b - 1 : b);
      }
      state.pathBreaks = newBreaks;
      // Adjust segment styles
      const newStyles = {};
      for (const [key, val] of Object.entries(state.segmentStyles || {})) {
        const k = parseInt(key);
        if (k === vertIdx) continue;
        newStyles[k > vertIdx ? k - 1 : k] = val;
      }
      state.segmentStyles = newStyles;
      state.selectedVertex = -1;
      recalcAndRender();
    } else {
      // Check for gate click first
      const gateHit = findGateAt(pos.x, pos.y);
      if (gateHit) {
        const gateIdx = state.gates.findIndex(g => g.segmentIndex === gateHit.segmentIndex);
        if (gateIdx >= 0) {
          saveHistory();
          state.gates.splice(gateIdx, 1);
          recalcAndRender();
        }
      } else {
        const segIdx = findSegmentAt(pos.x, pos.y);
        if (segIdx >= 0) {
          // Delete segment by removing gate if present, or disconnecting (path break)
          const gIdx = state.gates.findIndex(g => g.segmentIndex === segIdx);
          if (gIdx >= 0) {
            saveHistory();
            state.gates.splice(gIdx, 1);
            recalcAndRender();
          } else {
            // Disconnect the segment (add a path break)
            saveHistory();
            state.pathBreaks.add(segIdx);
            recalcAndRender();
          }
        } else {
          // Check if clicked on a wall
          const wallIdx = findWallAt(pos.x, pos.y);
          if (wallIdx >= 0) {
            saveHistory();
            state.walls.splice(wallIdx, 1);
            recalcAndRender();
          } else {
            // Check if clicked on a house
            const houseIdx = findHouseAt(pos.x, pos.y);
            if (houseIdx >= 0) {
              saveHistory();
              state.houses.splice(houseIdx, 1);
              recalcAndRender();
            }
          }
        }
      }
    }
  } else if (state.tool === 'wall') {
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapToGrid(world.x, world.y);
    if (!state.wallDrawing) {
      saveHistory();
      state.wallDrawing = { vertices: [{ x: snapped.x, y: snapped.y }] };
    } else {
      state.wallDrawing.vertices.push({ x: snapped.x, y: snapped.y });
    }
    recalcAndRender();
  } else if (state.tool === 'terrain') {
    const world = screenToWorld(pos.x, pos.y);
    applyTerrainBrush(world.x, world.y);
    state._terrainPainting = true;
  } else if (state.tool === 'house') {
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapToGrid(world.x, world.y);
    if (!state.houseDrawing) {
      state.houseDrawing = { vertices: [{ x: snapped.x, y: snapped.y }] };
    } else {
      state.houseDrawing.vertices.push({ x: snapped.x, y: snapped.y });
    }
    render();
  }
});

canvas.addEventListener('mousemove', (e) => {
  const pos = getMousePos(e);

  if (state.panning) {
    state.panX = pos.x - state.panStartX;
    state.panY = pos.y - state.panStartY;
    render();
    return;
  }

  if (state.dragging && state.selectedVertex >= 0) {
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapToGrid(world.x, world.y);
    state.vertices[state.selectedVertex] = { x: snapped.x, y: snapped.y };
    recalcAndRender();
    return;
  }

  // Gate dragging along segment
  if (state.draggingGate) {
    const gate = state.draggingGate.gate;
    const segments = getSegments();
    const seg = findSegByFrom(segments, state.draggingGate.segFrom);
    if (seg) {
      const world = screenToWorld(pos.x, pos.y);
      // Project mouse position onto segment line
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 0) {
        let t = ((world.x - seg.a.x) * dx + (world.y - seg.a.y) * dy) / lenSq;
        const gateWidthM = gate.width / 100;
        const halfGateT = (gateWidthM / 2) / seg.lengthM;
        t = Math.max(halfGateT, Math.min(1 - halfGateT, t));
        gate.positionM = t * seg.lengthM;
        // Remove legacy position field
        delete gate.position;
        recalcAndRender();
      }
    }
    return;
  }

  // Terrain drag painting
  if (state._terrainPainting && state.tool === 'terrain') {
    const world = screenToWorld(pos.x, pos.y);
    applyTerrainBrush(world.x, world.y);
    return;
  }

  // Hover detection
  const prevHV = state.hoveredVertex;
  const prevHS = state.hoveredSegment;
  state.hoveredVertex = findVertexAt(pos.x, pos.y);
  state.hoveredSegment = findSegmentAt(pos.x, pos.y);

  // Ghost/preview line: track cursor when in draw or wall mode
  const prevGhost = state.ghostCursor;
  if (state.tool === 'draw' || state.tool === 'wall' || state.tool === 'house') {
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapToGrid(world.x, world.y);
    state.ghostCursor = { x: snapped.x, y: snapped.y };
  } else {
    state.ghostCursor = null;
  }

  const ghostChanged = (!prevGhost && state.ghostCursor) || (prevGhost && !state.ghostCursor) ||
    (prevGhost && state.ghostCursor && (prevGhost.x !== state.ghostCursor.x || prevGhost.y !== state.ghostCursor.y));

  if (prevHV !== state.hoveredVertex || prevHS !== state.hoveredSegment || ghostChanged) {
    render();
  }

  // Tooltip
  updateTooltip(pos);

  // Cursor
  if (state.draggingGate) {
    canvas.classList.add('cursor-move');
    canvas.classList.remove('cursor-pointer');
  } else if (state.hoveredVertex >= 0) {
    canvas.classList.add('cursor-pointer');
    canvas.classList.remove('cursor-move');
  } else if (state.tool === 'select' && findGateAt(pos.x, pos.y)) {
    canvas.classList.add('cursor-move');
    canvas.classList.remove('cursor-pointer');
  } else if (state.tool === 'select') {
    canvas.classList.add('cursor-move');
    canvas.classList.remove('cursor-pointer');
  } else {
    canvas.classList.remove('cursor-pointer');
    canvas.classList.remove('cursor-move');
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (state.dragging && state.selectedVertex >= 0) {
    const pos = getMousePos(e);
    if (Math.abs(pos.x - state.dragStartX) > 3 || Math.abs(pos.y - state.dragStartY) > 3) {
      if (state.tool === 'select') {
        saveHistory();
      }
    }
  }
  // Stop gate dragging
  if (state.draggingGate) {
    state.draggingGate = null;
  }
  // Stop terrain painting
  if (state._terrainPainting) {
    state._terrainPainting = false;
  }
  state.dragging = false;
  state.panning = false;
  canvas.classList.remove('cursor-grabbing');
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pos = getMousePos(e);
  const worldBefore = screenToWorld(pos.x, pos.y);

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  state.zoom = Math.max(0.2, Math.min(5, state.zoom * zoomFactor));

  const worldAfter = screenToWorld(pos.x, pos.y);
  state.panX += (worldAfter.x - worldBefore.x) * CELL_SIZE * state.zoom;
  state.panY += (worldAfter.y - worldBefore.y) * CELL_SIZE * state.zoom;

  document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
  render();
}, { passive: false });

// Context menu
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const pos = getMousePos(e);
  const vertIdx = findVertexAt(pos.x, pos.y);
  const segIdx = findSegmentAt(pos.x, pos.y);

  if (vertIdx >= 0 || segIdx >= 0) {
    showContextMenu(e.clientX, e.clientY, vertIdx, segIdx);
  }
});

// ============================================================
// COLOR PICKER INTERACTION (click/shift+click on posts/panels)
// ============================================================
canvas.addEventListener('dblclick', (e) => {
  // Double-click in draw mode = finish current path section
  if (state.tool === 'draw' && state.vertices.length > 0) {
    const lastIdx = state.vertices.length - 1;
    // If last vertex already has a break, check if it's orphaned (no segment connects to it)
    // Remove orphan vertex created by second click of dblclick
    if (state.pathBreaks.has(lastIdx) && lastIdx > 0 && state.pathBreaks.has(lastIdx - 1)) {
      // Orphan: both this and previous have breaks, remove the extra vertex
      state.vertices.splice(lastIdx, 1);
      state.pathBreaks.delete(lastIdx);
    } else if (!state.pathBreaks.has(lastIdx)) {
      // Normal finish: add path break
      state.pathBreaks.add(lastIdx);
    }
    state.selectedVertex = -1;
    render();
    e.stopPropagation();
    return;
  }
  // Double-click in wall mode = finish current wall
  if (state.tool === 'wall' && state.wallDrawing && state.wallDrawing.vertices.length >= 2) {
    saveHistory();
    state.walls.push({
      vertices: state.wallDrawing.vertices,
      thickness: state.wallConfig.thickness,
      height: state.wallConfig.height,
      barva: state.wallConfig.barva,
    });
    state.wallDrawing = null;
    recalcAndRender();
    e.stopPropagation();
    return;
  }
  // Double-click in house mode = finish polygon house
  if (state.tool === 'house' && state.houseDrawing && state.houseDrawing.vertices.length >= 3) {
    // Remove the last vertex (added by second click of dblclick, duplicate)
    const verts = state.houseDrawing.vertices;
    const last = verts[verts.length - 1];
    const prev = verts[verts.length - 2];
    if (last.x === prev.x && last.y === prev.y) verts.pop();
    if (verts.length >= 3) {
      saveHistory();
      state.houses.push({
        vertices: verts,
        height: state.houseConfig.height,
        barva: state.houseConfig.barva,
        roofType: state.houseConfig.roofType,
        roofBarva: state.houseConfig.roofBarva,
      });
    }
    state.houseDrawing = null;
    recalcAndRender();
    e.stopPropagation();
    return;
  }

  const pos = getMousePos(e);

  // Double-click on gate = open edit dialog
  const gateHit = findGateAt(pos.x, pos.y);
  if (gateHit) {
    openGateDialog(gateHit.segmentIndex, gateHit);
    e.stopPropagation();
    return;
  }

  const postHit = findPostAt(pos.x, pos.y);
  const segIdx = findSegmentAt(pos.x, pos.y);

  if (postHit) {
    // Double-click on post → show color picker
    if (e.shiftKey) {
      // Shift + dblclick → add to selection then show picker
      if (!state.selectedPosts.includes(postHit.key)) {
        state.selectedPosts.push(postHit.key);
      }
      const keys = [...state.selectedPosts];
      showColorPicker(pos.x, pos.y, 'post', keys);
    } else {
      // Clear other selections, select just this post
      state.selectedPosts = [postHit.key];
      state.selectedPanels = [];
      showColorPicker(pos.x, pos.y, 'post', [postHit.key]);
    }
    render();
    e.stopPropagation();
    return;
  }

  if (segIdx >= 0 && !postHit) {
    // Double-click on panel/segment → show color picker
    if (e.shiftKey) {
      if (!state.selectedPanels.includes(segIdx)) {
        state.selectedPanels.push(segIdx);
      }
      const keys = [...state.selectedPanels];
      showColorPicker(pos.x, pos.y, 'panel', keys);
    } else {
      state.selectedPanels = [segIdx];
      state.selectedPosts = [];
      showColorPicker(pos.x, pos.y, 'panel', [segIdx]);
    }
    render();
    e.stopPropagation();
    return;
  }
});

// Shift+click to add to multi-selection without opening picker
canvas.addEventListener('click', (e) => {
  if (!e.shiftKey) return;
  const pos = getMousePos(e);
  const postHit = findPostAt(pos.x, pos.y);
  const segIdx = findSegmentAt(pos.x, pos.y);

  if (postHit) {
    const idx = state.selectedPosts.indexOf(postHit.key);
    if (idx >= 0) {
      state.selectedPosts.splice(idx, 1); // deselect
    } else {
      state.selectedPosts.push(postHit.key);
    }
    render();
    e.stopPropagation();
    return;
  }

  if (segIdx >= 0) {
    const idx = state.selectedPanels.indexOf(segIdx);
    if (idx >= 0) {
      state.selectedPanels.splice(idx, 1); // deselect
    } else {
      state.selectedPanels.push(segIdx);
    }
    render();
    e.stopPropagation();
    return;
  }
});

// Tooltip
function updateTooltip(pos) {
  const tooltip = document.getElementById('infoTooltip');
  if (state.hoveredVertex >= 0) {
    const result = calculate();
    const postH = result ? result.postHeight : '—';
    const corner = isCorner(state.hoveredVertex) ? ' (roh)' : '';
    const segments = getSegments();
    const struts = (state.fenceType === 'ctyrhranne_bez_nd' || state.fenceType === 'ctyrhranne_s_nd' || state.fenceType === 'svarovane')
      ? getStrutPositions(segments) : [];
    const hasStrut = struts.find(s => s.vertexIndex === state.hoveredVertex);
    const strutInfo = hasStrut ? ` | Vzpěra (${hasStrut.reason})` : '';

    tooltip.textContent = `Bod #${state.hoveredVertex + 1}${corner} | Sloupek ${postH} cm${strutInfo}`;
    tooltip.style.display = 'block';
    const rect = canvas.getBoundingClientRect();
    tooltip.style.left = (pos.x + rect.left + 15) + 'px';
    tooltip.style.top = (pos.y + rect.top - 10) + 'px';
  } else if (state.hoveredSegment >= 0) {
    const segments = getSegments();
    const seg = segments[state.hoveredSegment];
    if (seg) {
      const gate = state.gates.find(g => g.segmentIndex === state.hoveredSegment);
      const gateInfo = gate ? ` | ${gate.type === 'branka' ? 'Branka' : 'Brána'} ${gate.width} cm` : '';
      tooltip.textContent = `Úsek #${state.hoveredSegment + 1} | ${seg.lengthM.toFixed(1)} m | ${seg.fields} polí${gateInfo}`;
      tooltip.style.display = 'block';
      const rect = canvas.getBoundingClientRect();
      tooltip.style.left = (pos.x + rect.left + 15) + 'px';
      tooltip.style.top = (pos.y + rect.top - 10) + 'px';
    }
  } else {
    tooltip.style.display = 'none';
  }
}

canvas.addEventListener('mouseleave', () => {
  document.getElementById('infoTooltip').style.display = 'none';
  state.hoveredVertex = -1;
  state.hoveredSegment = -1;
  state.hoveredPostKey = null;
  state.hoveredPanelKey = null;
  state.ghostCursor = null;
  render();
});

// ============================================================
// CONTEXT MENU
// ============================================================
let ctxVertexIdx = -1;
let ctxSegmentIdx = -1;

function showContextMenu(x, y, vertIdx, segIdx) {
  ctxVertexIdx = vertIdx;
  ctxSegmentIdx = segIdx;
  const menu = document.getElementById('contextMenu');
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  document.getElementById('ctxDeletePoint').style.display = vertIdx >= 0 ? 'block' : 'none';
  const strutTypes = ['ctyrhranne_bez_nd', 'ctyrhranne_s_nd', 'svarovane'];
  document.getElementById('ctxAddStrut').style.display = (vertIdx >= 0 && strutTypes.includes(state.fenceType)) ? 'block' : 'none';
  document.getElementById('ctxAddGate').style.display = segIdx >= 0 ? 'block' : 'none';
  document.getElementById('ctxSetSegStyle').style.display = segIdx >= 0 ? 'block' : 'none';
  const shadeBtn = document.getElementById('ctxToggleShade');
  shadeBtn.style.display = segIdx >= 0 ? 'block' : 'none';
  if (segIdx >= 0) {
    const hasShade = !!state.shadeCloth[segIdx];
    shadeBtn.textContent = hasShade ? '🌿 Odebrat stínicí tkaninu' : '🌿 Stínicí tkanina';
  }
  const flipBtn = document.getElementById('ctxFlipFence');
  flipBtn.style.display = segIdx >= 0 ? 'block' : 'none';
}

function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#contextMenu')) {
    hideContextMenu();
  }
});

document.getElementById('ctxDeletePoint').addEventListener('click', () => {
  if (ctxVertexIdx >= 0) {
    saveHistory();
    state.vertices.splice(ctxVertexIdx, 1);
    state.gates = state.gates.filter(g => g.segmentIndex !== ctxVertexIdx && g.segmentIndex !== ctxVertexIdx - 1);
    state.gates.forEach(g => { if (g.segmentIndex > ctxVertexIdx) g.segmentIndex--; });
    state.selectedVertex = -1;
    recalcAndRender();
  }
  hideContextMenu();
});

document.getElementById('ctxAddStrut').addEventListener('click', () => {
  if (ctxVertexIdx >= 0) {
    saveHistory();
    if (!state.manualStruts.includes(ctxVertexIdx)) {
      state.manualStruts.push(ctxVertexIdx);
    }
    recalcAndRender();
  }
  hideContextMenu();
});

document.getElementById('ctxAddGate').addEventListener('click', () => {
  if (ctxSegmentIdx >= 0) {
    openGateDialog(ctxSegmentIdx);
  }
  hideContextMenu();
});

document.getElementById('ctxSetSegStyle').addEventListener('click', () => {
  if (ctxSegmentIdx >= 0) {
    openSegStyleDialog(ctxSegmentIdx);
  }
  hideContextMenu();
});

document.getElementById('ctxToggleShade').addEventListener('click', () => {
  if (ctxSegmentIdx >= 0) {
    saveHistory();
    if (state.shadeCloth[ctxSegmentIdx]) {
      delete state.shadeCloth[ctxSegmentIdx];
      delete state.shadeClothColors[ctxSegmentIdx];
    } else {
      state.shadeCloth[ctxSegmentIdx] = true;
    }
    recalcAndRender();
  }
  hideContextMenu();
});

document.getElementById('ctxFlipFence').addEventListener('click', () => {
  if (ctxSegmentIdx >= 0) {
    saveHistory();
    if (!state.segmentStyles[ctxSegmentIdx]) state.segmentStyles[ctxSegmentIdx] = {};
    state.segmentStyles[ctxSegmentIdx].flipped = !state.segmentStyles[ctxSegmentIdx].flipped;
    recalcAndRender();
  }
  hideContextMenu();
});

// ============================================================
// COLOR TOOLBAR
// ============================================================
function showColorToolbarAt(x, y, label) {
  const toolbar = document.getElementById('colorToolbar');
  const playground = document.getElementById('playground');
  const rect = playground.getBoundingClientRect();
  // Position near cursor, but keep within bounds
  let tx = x + 15;
  let ty = y - 60;
  if (tx + 350 > rect.width) tx = x - 360;
  if (ty < 10) ty = y + 20;
  toolbar.style.left = tx + 'px';
  toolbar.style.top = ty + 'px';
  toolbar.style.bottom = '';
  toolbar.style.transform = '';
  document.getElementById('colorToolbarLabel').textContent = label + ':';
  toolbar.style.display = 'flex';

  // Show size controls for posts, intPosts, fields (not struts/wires)
  const sizeGroup = document.getElementById('sizeControlGroup');
  const showSize = (label === 'sloupek' || label === 'pole');
  sizeGroup.style.display = showSize ? 'flex' : 'none';

  // Show clip color controls when a post is selected
  const clipGroup = document.getElementById('clipColorGroup');
  const showClips = (label === 'sloupek');
  clipGroup.style.display = showClips ? 'inline-flex' : 'none';
}

function hideColorToolbar() {
  document.getElementById('colorToolbar').style.display = 'none';
}

function updateColorToolbar() {
  const hasPosts = state.selectedPosts.size > 0;
  const hasSegs = state.selectedSegments.size > 0;
  const hasStruts = state.selectedStruts.size > 0;
  const hasFields = state.selectedFields.size > 0;
  const hasIntPosts = state.selectedIntPosts.size > 0;
  const hasWires = state.selectedWires.size > 0;
  const hasShade = state.selectedShadeCloth.size > 0;
  if (!hasPosts && !hasSegs && !hasStruts && !hasFields && !hasIntPosts && !hasWires && !hasShade) {
    hideColorToolbar();
  }
}

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const barva = btn.dataset.barva;
    saveHistory();
    const segments = getSegments();
    const struts = getStrutPositions(segments);
    state.selectedPosts.forEach(idx => { state.postColors[idx] = barva; });
    state.selectedSegments.forEach(segIdx => {
      if (!state.segmentStyles[segIdx]) state.segmentStyles[segIdx] = {};
      state.segmentStyles[segIdx].barva = barva;
    });
    state.selectedStruts.forEach(strutIdx => {
      const strut = struts[strutIdx];
      if (strut) state.strutColors[getStrutKey(strut)] = barva;
    });
    state.selectedFields.forEach(key => { state.fieldColors[key] = barva; });
    state.selectedIntPosts.forEach(key => { state.intermediatePostColors[key] = barva; });
    state.selectedWires.forEach(key => { state.wireColors[key] = barva; });
    state.selectedShadeCloth.forEach(idx => { state.shadeClothColors[idx] = barva; });
    // Clear selection and hide toolbar after color pick
    state.selectedPosts.clear();
    state.selectedSegments.clear();
    state.selectedStruts.clear();
    state.selectedFields.clear();
    state.selectedIntPosts.clear();
    state.selectedWires.clear();
    state.selectedShadeCloth.clear();
    hideColorToolbar();
    recalcAndRender();
  });
});

document.getElementById('colorToolbarClear').addEventListener('click', () => {
  saveHistory();
  state.selectedPosts.forEach(idx => { delete state.postColors[idx]; });
  state.selectedSegments.forEach(segIdx => {
    if (state.segmentStyles[segIdx]) delete state.segmentStyles[segIdx].barva;
  });
  const segments = getSegments();
  const struts = getStrutPositions(segments);
  state.selectedStruts.forEach(strutIdx => {
    const strut = struts[strutIdx];
    if (strut) delete state.strutColors[getStrutKey(strut)];
  });
  state.selectedFields.forEach(key => { delete state.fieldColors[key]; });
  state.selectedIntPosts.forEach(key => { delete state.intermediatePostColors[key]; });
  state.selectedWires.forEach(key => { delete state.wireColors[key]; });
  state.selectedShadeCloth.forEach(idx => { delete state.shadeClothColors[idx]; });
  state.selectedPosts.clear();
  state.selectedSegments.clear();
  state.selectedStruts.clear();
  state.selectedFields.clear();
  state.selectedIntPosts.clear();
  state.selectedWires.clear();
  state.selectedShadeCloth.clear();
  hideColorToolbar();
  recalcAndRender();
});

// Height input for selected elements
function applyHeightToSelection(heightCm) {
  if (!heightCm || heightCm <= 0) return;
  saveHistory();
  state.selectedPosts.forEach(idx => { state.postHeights[idx] = heightCm; });
  state.selectedIntPosts.forEach(key => { state.intPostHeights[key] = heightCm; });
  state.selectedFields.forEach(key => { state.fieldHeights[key] = heightCm; });
  // Clear selection and hide toolbar
  state.selectedPosts.clear();
  state.selectedSegments.clear();
  state.selectedStruts.clear();
  state.selectedFields.clear();
  state.selectedIntPosts.clear();
  state.selectedWires.clear();
  hideColorToolbar();
  recalcAndRender();
}
const heightInput = document.getElementById('heightInput');
if (heightInput) {
  heightInput.addEventListener('change', () => {
    applyHeightToSelection(parseInt(heightInput.value));
  });
  heightInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyHeightToSelection(parseInt(heightInput.value));
  });
}
const heightApplyBtn = document.getElementById('heightApplyBtn');
if (heightApplyBtn) {
  heightApplyBtn.addEventListener('click', () => {
    applyHeightToSelection(parseInt(heightInput.value));
  });
}

// Helper: get clip keys for all selected posts and intPosts
function getClipKeysForSelection() {
  const keys = [];
  state.selectedPosts.forEach(idx => { keys.push(getClipKey('v', idx)); });
  state.selectedIntPosts.forEach(key => {
    // key is "segIdx:intPostIdx"
    const parts = key.split(':');
    keys.push(getClipKey('i', parts[0], parts[1]));
  });
  return keys;
}

// Clip color buttons
document.querySelectorAll('.clip-color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const barva = btn.dataset.barva;
    saveHistory();
    const clipKeys = getClipKeysForSelection();
    clipKeys.forEach(key => { state.clipColors[key] = barva; });
    state.selectedPosts.clear();
    state.selectedSegments.clear();
    state.selectedStruts.clear();
    state.selectedFields.clear();
    state.selectedIntPosts.clear();
    state.selectedWires.clear();
    hideColorToolbar();
    recalcAndRender();
  });
});

document.getElementById('clipColorClear').addEventListener('click', () => {
  saveHistory();
  const clipKeys = getClipKeysForSelection();
  clipKeys.forEach(key => { delete state.clipColors[key]; });
  state.selectedPosts.clear();
  state.selectedSegments.clear();
  state.selectedStruts.clear();
  state.selectedFields.clear();
  state.selectedIntPosts.clear();
  state.selectedWires.clear();
  hideColorToolbar();
  recalcAndRender();
});

// ============================================================
// SEGMENT STYLE DIALOG
// ============================================================
let segStyleSegIdx = -1;

function openSegStyleDialog(segIdx) {
  segStyleSegIdx = segIdx;
  const existing = state.segmentStyles[segIdx] || {};
  // Pre-fill with current segment style or global default
  const curType = existing.fenceType || state.fenceType;
  const curBarva = existing.barva || state.config.barva2D || 'zelena';
  document.getElementById('segStyleType').value = curType;
  const barvaRadio = document.querySelector(`input[name="segBarva"][value="${curBarva}"]`);
  if (barvaRadio) barvaRadio.checked = true;
  // Fence height
  const segHeightInput = document.getElementById('segHeight');
  segHeightInput.value = existing.height || state.config.height;
  // Typ sloupku per segment
  const segTypSloupkuSelect = document.getElementById('segTypSloupku');
  segTypSloupkuSelect.value = existing.typSloupku || '';
  // Show podhrab toggle (always visible for per-segment control)
  const podhrabGroup = document.getElementById('segPodhrabGroup');
  const podhrabCb = document.getElementById('segNoPodhrab');
  podhrabGroup.style.display = '';
  // Determine current state: explicit per-segment or global fallback
  if (existing && typeof existing.podhrab === 'boolean') {
    podhrabCb.checked = existing.podhrab;
  } else {
    podhrabCb.checked = !!state.config.podhraboveDesky;
  }
  // Podhrab height
  const podhrabVyskaGroup = document.getElementById('segPodhrabVyskaGroup');
  const podhrabVyskaSelect = document.getElementById('segPodhrabVyska');
  podhrabVyskaSelect.value = existing.podhrabVyska || state.config.podhrabovaVyska || 20;
  podhrabVyskaGroup.style.display = podhrabCb.checked ? '' : 'none';
  // Use a named handler to avoid accumulating listeners
  if (podhrabCb._segDialogHandler) podhrabCb.removeEventListener('change', podhrabCb._segDialogHandler);
  podhrabCb._segDialogHandler = function() {
    podhrabVyskaGroup.style.display = podhrabCb.checked ? '' : 'none';
  };
  podhrabCb.addEventListener('change', podhrabCb._segDialogHandler);
  // Max šířka pole
  const segMaxFieldInput = document.getElementById('segMaxField');
  segMaxFieldInput.value = existing.maxFieldM || state.config.maxFieldM || 2.5;
  document.getElementById('segStyleDialog').style.display = 'flex';
}

document.getElementById('segStyleConfirm').addEventListener('click', () => {
  if (segStyleSegIdx >= 0) {
    saveHistory();
    const fenceType = document.getElementById('segStyleType').value;
    const barvaEl = document.querySelector('input[name="segBarva"]:checked');
    const barva = barvaEl ? barvaEl.value : 'zelena';
    const podhrab = document.getElementById('segNoPodhrab').checked;
    const height = parseInt(document.getElementById('segHeight').value) || state.config.height;
    const podhrabVyska = parseInt(document.getElementById('segPodhrabVyska').value) || 20;
    const segMaxFieldVal = parseFloat(document.getElementById('segMaxField').value);
    const maxFieldM = (segMaxFieldVal >= 1 && segMaxFieldVal <= 5) ? segMaxFieldVal : undefined;
    const typSloupku = document.getElementById('segTypSloupku').value || undefined;
    state.segmentStyles[segStyleSegIdx] = { fenceType, barva, podhrab, height, podhrabVyska, maxFieldM, typSloupku };
    recalcAndRender();
  }
  document.getElementById('segStyleDialog').style.display = 'none';
});

document.getElementById('segStyleReset').addEventListener('click', () => {
  if (segStyleSegIdx >= 0) {
    saveHistory();
    delete state.segmentStyles[segStyleSegIdx];
    recalcAndRender();
  }
  document.getElementById('segStyleDialog').style.display = 'none';
});

document.getElementById('segStyleCancel').addEventListener('click', () => {
  document.getElementById('segStyleDialog').style.display = 'none';
});

// ============================================================
// GATE DIALOG
// ============================================================
function openGateDialog(segIdx, editExisting) {
  state.gateSegmentIndex = segIdx;
  const existing = editExisting || state.gates.find(g => g.segmentIndex === segIdx);
  const isEdit = !!existing;
  document.getElementById('gateDialogTitle').textContent = isEdit ? 'Upravit branku / bránu' : 'Přidat branku / bránu';
  document.getElementById('gateConfirm').textContent = isEdit ? 'Uložit' : 'Přidat';
  document.getElementById('gateDelete').style.display = isEdit ? '' : 'none';

  // Get segment length for this segment
  const segments = getSegments();
  const seg = findSegByFrom(segments, segIdx);
  const segLenM = seg ? seg.lengthM : 10;

  if (existing) {
    document.querySelector(`input[name="gateType"][value="${existing.type}"]`).checked = true;
    document.getElementById('gateWidth').value = existing.width;
    document.getElementById('gateHeight').value = existing.height || state.config.height;
    // Convert center positionM to left edge for display
    let posM;
    if (existing.positionM != null) {
      posM = existing.positionM;
    } else {
      posM = segLenM * (existing.position ?? 0.5);
    }
    const halfGateDisplay = (existing.width / 100) / 2;
    const leftEdgeM = Math.max(0, posM - halfGateDisplay);
    document.getElementById('gatePosition').value = Math.round(leftEdgeM * 10) / 10;
    const barvaRadio = document.querySelector(`input[name="gateBarva"][value="${existing.barva || 'zelena'}"]`);
    if (barvaRadio) barvaRadio.checked = true;
    document.getElementById('gateStyle').value = existing.fenceType || 'ctyrhranne_s_nd';
    document.getElementById('gateShadeCloth').checked = !!existing.shadeCloth;
    const shadeBarvaR = document.querySelector(`input[name="gateShadeBarva"][value="${existing.shadeClothBarva || 'zelena'}"]`);
    if (shadeBarvaR) shadeBarvaR.checked = true;
    document.getElementById('gateShadeColorGroup').style.display = existing.shadeCloth ? '' : 'none';
  } else {
    document.querySelector('input[name="gateType"][value="branka"]').checked = true;
    document.getElementById('gateWidth').value = 120;
    document.getElementById('gateHeight').value = state.config.height;
    // Show left edge position for new gate (default: centered)
    const defaultGateW = 120 / 100; // default branka width in meters
    document.getElementById('gatePosition').value = Math.round((segLenM / 2 - defaultGateW / 2) * 10) / 10;
    document.querySelector('input[name="gateBarva"][value="zelena"]').checked = true;
    document.getElementById('gateStyle').value = state.fenceType;
    document.getElementById('gateShadeCloth').checked = false;
    document.querySelector('input[name="gateShadeBarva"][value="zelena"]').checked = true;
    document.getElementById('gateShadeColorGroup').style.display = 'none';
  }
  updateGatePositionLabel(segLenM);
  updateGateHeightHint();
  document.getElementById('gateDialog').style.display = 'flex';
}

function updateGateHeightHint() {
  const gateH = parseInt(document.getElementById('gateHeight').value) || 0;
  const fenceH = state.config.height;
  const hint = document.getElementById('gateHeightHint');
  hint.style.display = gateH >= fenceH ? '' : 'none';
}

function updateGatePositionLabel(segLenM) {
  const label = document.getElementById('gatePositionLabel');
  if (segLenM != null) {
    label.textContent = `/ ${segLenM.toFixed(1)} m`;
    // Store segment length on label element for later use
    label.dataset.segLen = segLenM;
  }
  // Clamp input max
  const posInput = document.getElementById('gatePosition');
  if (label.dataset.segLen) {
    posInput.max = parseFloat(label.dataset.segLen);
  }
}

document.getElementById('gatePosition').addEventListener('input', () => {
  // No special update needed for meters display
});

document.getElementById('gateHeight').addEventListener('input', updateGateHeightHint);

document.querySelectorAll('input[name="gateType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isBranka = document.querySelector('input[name="gateType"]:checked').value === 'branka';
    const widthInput = document.getElementById('gateWidth');
    if (isBranka && parseInt(widthInput.value) > 200) widthInput.value = 120;
    if (!isBranka && parseInt(widthInput.value) < 200) widthInput.value = 360;
  });
});

document.getElementById('gateShadeCloth').addEventListener('change', () => {
  document.getElementById('gateShadeColorGroup').style.display = document.getElementById('gateShadeCloth').checked ? '' : 'none';
});

document.getElementById('gateConfirm').addEventListener('click', () => {
  const gateType = document.querySelector('input[name="gateType"]:checked').value;
  const width = parseInt(document.getElementById('gateWidth').value) || 120;
  const height = parseInt(document.getElementById('gateHeight').value) || state.config.height;
  const leftEdgeInput = parseFloat(document.getElementById('gatePosition').value) || 0;
  const barvaEl = document.querySelector('input[name="gateBarva"]:checked');
  const barva = barvaEl ? barvaEl.value : 'zelena';
  const fenceType = document.getElementById('gateStyle').value;
  const gateShadeCloth = document.getElementById('gateShadeCloth').checked;
  const gateShadeBarvaEl = document.querySelector('input[name="gateShadeBarva"]:checked');
  const gateShadeBarva = gateShadeBarvaEl ? gateShadeBarvaEl.value : 'zelena';

  saveHistory();

  // Validate: gate must fit in segment
  const segments = getSegments();
  const seg = findSegByFrom(segments, state.gateSegmentIndex);
  if (seg) {
    const gateWidthM = width / 100;
    const halfGate = gateWidthM / 2;
    // Convert left edge input to center position, then clamp
    const centerFromInput = leftEdgeInput + halfGate;
    const clampedPosM = Math.max(halfGate, Math.min(seg.lengthM - halfGate, centerFromInput));

    // Remove existing gate on this segment
    state.gates = state.gates.filter(g => g.segmentIndex !== state.gateSegmentIndex);

    state.gates.push({
      segmentIndex: state.gateSegmentIndex,
      type: gateType,
      width: width,
      height: height,
      positionM: clampedPosM,
      barva: barva,
      fenceType: fenceType,
      shadeCloth: gateShadeCloth,
      shadeClothBarva: gateShadeBarva,
    });
  }

  document.getElementById('gateDialog').style.display = 'none';
  recalcAndRender();
});

document.getElementById('gateDelete').addEventListener('click', () => {
  saveHistory();
  state.gates = state.gates.filter(g => g.segmentIndex !== state.gateSegmentIndex);
  document.getElementById('gateDialog').style.display = 'none';
  recalcAndRender();
});

document.getElementById('gateCancel').addEventListener('click', () => {
  document.getElementById('gateDialog').style.display = 'none';
});

// ============================================================
// UI CONFIGURATION HANDLERS
// ============================================================
function setupConfigHandlers() {
  // Fence type
  document.querySelectorAll('input[name="fenceType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.fenceType = radio.value;
      updateTypeOptions();
      recalcAndRender();
    });
  });

  // Height
  document.getElementById('cfgHeight').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    if (v >= 50 && v <= 300) {
      state.config.height = v;
      recalcAndRender();
    }
  });

  // Max šířka pole (global change clears per-segment overrides)
  document.getElementById('cfgMaxField').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (v >= 1 && v <= 5) {
      state.config.maxFieldM = v;
      // Clear per-segment overrides so global takes effect
      for (const key of Object.keys(state.segmentStyles)) {
        if (state.segmentStyles[key].maxFieldM) delete state.segmentStyles[key].maxFieldM;
      }
      recalcAndRender();
    }
  });

  // Podhrabové desky
  document.getElementById('cfgPodhrab').addEventListener('change', (e) => {
    state.config.podhraboveDesky = e.target.checked;
    document.getElementById('grpPodhrabVyska').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });

  document.getElementById('cfgPodhrabVyska').addEventListener('change', (e) => {
    state.config.podhrabovaVyska = parseInt(e.target.value);
    recalcAndRender();
  });

  // Povrch
  document.getElementById('cfgPovrch').addEventListener('change', (e) => {
    state.config.povrch = e.target.value;
    recalcAndRender();
  });

  // Stínění
  document.getElementById('cfgStineni').addEventListener('change', (e) => {
    state.config.stiniciTkanina = e.target.checked;
    recalcAndRender();
  });

  // Čtyřhranné
  document.getElementById('cfgPrumerDratu').addEventListener('change', (e) => {
    state.config.prumerDratu = parseFloat(e.target.value);
    recalcAndRender();
  });
  document.getElementById('cfgTypSloupku').addEventListener('change', (e) => {
    state.config.typSloupku = e.target.value;
    recalcAndRender();
  });
  document.getElementById('cfgRoleDelka').addEventListener('change', (e) => {
    state.config.roleDelka = parseInt(e.target.value);
    recalcAndRender();
  });

  // Svařované
  document.getElementById('cfgSvarSloupky').addEventListener('change', (e) => {
    state.config.svarSloupky = e.target.value;
    recalcAndRender();
  });
  document.getElementById('cfgSvarRoleDelka').addEventListener('change', (e) => {
    state.config.svarRoleDelka = parseInt(e.target.value);
    recalcAndRender();
  });
  document.getElementById('cfgSvarOkoVyska').addEventListener('change', (e) => {
    state.config.svarOkoVyska = parseFloat(e.target.value);
    recalcAndRender();
  });

  // 2D
  document.getElementById('cfgSila2D').addEventListener('change', (e) => {
    state.config.sila2D = e.target.value;
    recalcAndRender();
  });
  document.getElementById('cfgBarva2D').addEventListener('change', (e) => {
    state.config.barva2D = e.target.value;
    recalcAndRender();
  });

  // 3D
  document.getElementById('cfgSila3D').addEventListener('change', (e) => {
    state.config.sila3D = parseInt(e.target.value);
    recalcAndRender();
  });
  document.getElementById('cfgBarva3D').addEventListener('change', (e) => {
    state.config.barva3D = e.target.value;
    recalcAndRender();
  });

  // Betonový
  document.getElementById('cfgBetonBarva').addEventListener('change', (e) => {
    state.config.betonBarva = e.target.value;
    recalcAndRender();
  });
  document.getElementById('cfgBetonVzor').addEventListener('change', (e) => {
    state.config.betonVzor = e.target.value;
    recalcAndRender();
  });
  document.getElementById('cfgBetonDesky').addEventListener('change', (e) => {
    state.config.betonDesky = parseInt(e.target.value);
    recalcAndRender();
  });
  document.getElementById('cfgBetonSokl').addEventListener('change', (e) => {
    state.config.betonSokl = e.target.checked;
    document.getElementById('grpBetonSoklVyska').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });
  document.getElementById('cfgBetonSoklVyska').addEventListener('change', (e) => {
    state.config.betonSoklVyska = parseInt(e.target.value);
    recalcAndRender();
  });

  // ── Doprava montážníka ──
  document.getElementById('cfgDoprMontZpat').addEventListener('change', (e) => {
    state.config.doprMontZpat = e.target.checked;
    recalcAndRender();
  });
  ['cfgDoprMontKm', 'cfgDoprMontCest', 'cfgDoprMontSazba'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const key = { cfgDoprMontKm: 'doprMontKm', cfgDoprMontCest: 'doprMontCest', cfgDoprMontSazba: 'doprMontSazba' }[id];
      state.config[key] = Math.max(0, parseFloat(e.target.value) || 0);
      recalcAndRender();
    });
  });
  document.getElementById('cfgDoprMontMytne').addEventListener('change', (e) => {
    state.config.doprMontMytne = e.target.checked;
    document.getElementById('grpDoprMontMytne').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });
  document.getElementById('cfgDoprMontMytneKc').addEventListener('input', (e) => {
    state.config.doprMontMytneKc = Math.max(0, parseFloat(e.target.value) || 0);
    recalcAndRender();
  });

  // ── Doprava betonových produktů ──
  document.getElementById('cfgDoprBetZpat').addEventListener('change', (e) => {
    state.config.doprBetZpat = e.target.checked;
    recalcAndRender();
  });
  document.getElementById('cfgDopravaBetProduktu').addEventListener('change', (e) => {
    state.config.dopravaBetProduktu = e.target.checked;
    document.getElementById('grpBetProdukty').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });
  document.getElementById('cfgDoprBetVozidlo').addEventListener('change', (e) => {
    state.config.doprBetVozidlo = e.target.value;
    recalcAndRender();
  });
  ['cfgDoprBetKm', 'cfgDoprBetCest', 'cfgDoprBetSazba'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const key = { cfgDoprBetKm: 'doprBetKm', cfgDoprBetCest: 'doprBetCest', cfgDoprBetSazba: 'doprBetSazba' }[id];
      state.config[key] = Math.max(0, parseFloat(e.target.value) || 0);
      recalcAndRender();
    });
  });
  document.getElementById('cfgDoprBetMytne').addEventListener('change', (e) => {
    state.config.doprBetMytne = e.target.checked;
    document.getElementById('grpDoprBetMytne').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });
  document.getElementById('cfgDoprBetMytneKc').addEventListener('input', (e) => {
    state.config.doprBetMytneKc = Math.max(0, parseFloat(e.target.value) || 0);
    recalcAndRender();
  });

  // ── Doprava betonu z betonárky ──
  document.getElementById('cfgDoprBetonZpat').addEventListener('change', (e) => {
    state.config.doprBetonZpat = e.target.checked;
    recalcAndRender();
  });
  ['cfgDoprBetonKm', 'cfgDoprBetonCest', 'cfgDoprBetonSazba'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const key = { cfgDoprBetonKm: 'doprBetonKm', cfgDoprBetonCest: 'doprBetonCest', cfgDoprBetonSazba: 'doprBetonSazba' }[id];
      state.config[key] = Math.max(0, parseFloat(e.target.value) || 0);
      recalcAndRender();
    });
  });
  document.getElementById('cfgDoprBetonMytne').addEventListener('change', (e) => {
    state.config.doprBetonMytne = e.target.checked;
    document.getElementById('grpDoprBetonMytne').style.display = e.target.checked ? '' : 'none';
    recalcAndRender();
  });
  document.getElementById('cfgDoprBetonMytneKc').addEventListener('input', (e) => {
    state.config.doprBetonMytneKc = Math.max(0, parseFloat(e.target.value) || 0);
    recalcAndRender();
  });

  // ── Palety a vykládka ──
  document.getElementById('cfgVkladkaPaleta').addEventListener('input', (e) => {
    state.config.vkladkaPaleta = Math.max(0, parseFloat(e.target.value) || 0);
    recalcAndRender();
  });
  document.getElementById('cfgDoprBetPaletCustom').addEventListener('input', (e) => {
    state.config.doprBetPaletCustom = Math.max(0, parseInt(e.target.value) || 0);
    recalcAndRender();
  });

  // Spočítat vzdálenost
  document.getElementById('btnSpocitatVzdalenost').addEventListener('click', vypocitatVzdalenostOnline);

  // Uložené betonárky
  loadSavedBetonarky();
  document.getElementById('cfgBetonarkaSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('cfgBetonarka').value = e.target.value;
      state.config.betonarka = e.target.value;
    }
  });
  document.getElementById('btnUlozBetonarku').addEventListener('click', ulozBetonarku);
  document.getElementById('btnSmazBetonarku').addEventListener('click', smazBetonarku);
  document.getElementById('btnHledatBetonarky').addEventListener('click', hledatBetonarky);
}

function updateTypeOptions() {
  const type = state.fenceType;
  document.querySelectorAll('.type-options').forEach(el => el.style.display = 'none');

  if (type.startsWith('ctyrhranne')) {
    document.getElementById('optCtyrhranne').style.display = '';
  } else if (type === 'svarovane') {
    document.getElementById('optSvarovane').style.display = '';
  } else if (type === 'panely_2d') {
    document.getElementById('optPanely2d').style.display = '';
  } else if (type === 'panely_3d') {
    document.getElementById('optPanely3d').style.display = '';
  } else if (type === 'betonovy') {
    document.getElementById('optBetonovy').style.display = '';
  }

  // Dynamic label for height
  const lblH = document.getElementById('lblHeight');
  if (type.startsWith('ctyrhranne') || type === 'svarovane') {
    lblH.textContent = 'Výška pletiva (cm)';
  } else if (type === 'panely_2d' || type === 'panely_3d') {
    lblH.textContent = 'Výška panelu (cm)';
  } else if (type === 'betonovy') {
    lblH.textContent = 'Výška plotu (cm)';
  }

  const isBeton = type === 'betonovy';
  const isPanels = type === 'panely_2d' || type === 'panely_3d';

  // Hide height input if betonový (calculated from desky count)
  document.getElementById('grpHeight').style.display = isBeton ? 'none' : '';

  // Max field width not applicable for betonový (always 2m) and panels (always 2.5m)
  document.getElementById('grpMaxField').style.display = (isBeton || isPanels) ? 'none' : '';

  // Podhrabové desky — not for betonový (has sokl instead)
  document.getElementById('grpPodhrab').style.display = isBeton ? 'none' : '';
  if (isBeton) document.getElementById('grpPodhrabVyska').style.display = 'none';

  // Stínící tkanina — only for čtyřhranné/svařované
  document.getElementById('grpStineni').style.display = (type.startsWith('ctyrhranne') || type === 'svarovane') ? '' : 'none';
}

// ============================================================
// TOOL BUTTONS
// ============================================================
function setupToolButtons() {
  const tools = ['Draw', 'Select', 'Gate', 'Delete', 'Wall', 'Terrain', 'House'];
  tools.forEach(t => {
    const el = document.getElementById('tool' + t);
    if (!el) return;
    el.addEventListener('click', () => {
      state.tool = t.toLowerCase();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      state.selectedVertex = -1;
      // If switching away from wall tool, finish any in-progress wall
      if (t.toLowerCase() !== 'wall' && state.wallDrawing && state.wallDrawing.vertices.length >= 2) {
        saveHistory();
        state.walls.push({
          vertices: state.wallDrawing.vertices,
          thickness: state.wallConfig.thickness,
          height: state.wallConfig.height,
          barva: state.wallConfig.barva,
        });
        state.wallDrawing = null;
      } else if (t.toLowerCase() !== 'wall') {
        state.wallDrawing = null;
      }
      // Cancel house drawing if switching away
      if (t.toLowerCase() !== 'house') {
        state.houseDrawing = null;
        state._houseDragging = false;
      }
      // Show/hide wall config panel
      const wallConfig = document.getElementById('wallConfig');
      if (wallConfig) wallConfig.style.display = t.toLowerCase() === 'wall' ? 'block' : 'none';
      // Show/hide terrain config panel
      const terrainConfig = document.getElementById('terrainConfig');
      if (terrainConfig) terrainConfig.style.display = t.toLowerCase() === 'terrain' ? 'block' : 'none';
      // Show/hide house config panel
      const houseConfig = document.getElementById('houseConfig');
      if (houseConfig) {
        houseConfig.style.display = t.toLowerCase() === 'house' ? 'block' : 'none';
        if (t.toLowerCase() === 'house') syncHouseConfigUI();
      }
      render();
    });
  });

  // Wall config inputs
  const wallThicknessInput = document.getElementById('wallThickness');
  const wallHeightInput = document.getElementById('wallHeight');
  if (wallThicknessInput) {
    wallThicknessInput.addEventListener('input', () => {
      state.wallConfig.thickness = parseInt(wallThicknessInput.value) || 20;
    });
  }
  if (wallHeightInput) {
    wallHeightInput.addEventListener('input', () => {
      state.wallConfig.height = parseInt(wallHeightInput.value) || 200;
    });
  }

  // Wall color buttons
  document.querySelectorAll('.wall-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.wallConfig.barva = btn.dataset.color;
      document.querySelectorAll('.wall-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // Set initial active wall color
  const initWallColorBtn = document.querySelector('.wall-color-btn[data-color="stribrna"]');
  if (initWallColorBtn) initWallColorBtn.classList.add('active');

  // House config inputs
  function syncHouseConfigUI() {
    const hi = document.getElementById('houseHeight');
    const ri = document.getElementById('houseRoofType');
    if (hi) hi.value = state.houseConfig.height;
    if (ri) ri.value = state.houseConfig.roofType;
    document.querySelectorAll('.house-color-btn').forEach(b => {
      b.style.borderColor = b.dataset.color === state.houseConfig.barva ? '#333' : 'transparent';
    });
    document.querySelectorAll('.roof-color-btn').forEach(b => {
      b.style.borderColor = b.dataset.color === state.houseConfig.roofBarva ? '#333' : 'transparent';
    });
  }
  const houseHeightInput = document.getElementById('houseHeight');
  if (houseHeightInput) {
    houseHeightInput.addEventListener('input', () => {
      state.houseConfig.height = parseInt(houseHeightInput.value) || 300;
    });
  }
  const houseRoofTypeInput = document.getElementById('houseRoofType');
  if (houseRoofTypeInput) {
    houseRoofTypeInput.addEventListener('change', () => {
      state.houseConfig.roofType = houseRoofTypeInput.value;
    });
  }
  document.querySelectorAll('.house-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.houseConfig.barva = btn.dataset.color;
      document.querySelectorAll('.house-color-btn').forEach(b => { b.style.borderColor = 'transparent'; });
      btn.style.borderColor = '#333';
    });
  });
  document.querySelectorAll('.roof-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.houseConfig.roofBarva = btn.dataset.color;
      document.querySelectorAll('.roof-color-btn').forEach(b => { b.style.borderColor = 'transparent'; });
      btn.style.borderColor = '#333';
    });
  });
  const initHouseColorBtn = document.querySelector('.house-color-btn[data-color="bila"]');
  if (initHouseColorBtn) initHouseColorBtn.style.borderColor = '#333';
  const initRoofColorBtn = document.querySelector('.roof-color-btn[data-color="hneda"]');
  if (initRoofColorBtn) initRoofColorBtn.style.borderColor = '#333';

  // Terrain tool - surface buttons
  document.querySelectorAll('.terrain-surface-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.terrainSurface = btn.dataset.surface;
      document.querySelectorAll('.terrain-surface-btn').forEach(b => { b.style.borderColor = 'transparent'; });
      btn.style.borderColor = '#27ae60';
    });
  });

  // Terrain block height selector
  const terrainBlockHeightSel = document.getElementById('terrainBlockHeight');
  if (terrainBlockHeightSel) {
    terrainBlockHeightSel.addEventListener('change', () => {
      state.terrainBlockHeight = parseFloat(terrainBlockHeightSel.value) || 0;
    });
  }

  // Terrain brush size
  const terrainBrushSel = document.getElementById('terrainBrushSize');
  if (terrainBrushSel) {
    terrainBrushSel.addEventListener('change', () => {
      state.terrainBrush = parseInt(terrainBrushSel.value) || 1;
    });
  }

  document.getElementById('btnUndo').addEventListener('click', undo);

  document.getElementById('btnReset').addEventListener('click', () => {
    if ((state.vertices.length > 0 || state.houses.length > 0 || state.walls.length > 0 || Object.keys(state.terrain).length > 0) && !confirm('Opravdu chcete vymazat celý plán?')) return;
    saveHistory();
    state.vertices = [];
    state.gates = [];
    state.manualStruts = [];
    state.segmentStyles = {};
    state.postColors = {};
    state.strutColors = {};
    state.fieldColors = {};
    state.intermediatePostColors = {};
    state.postHeights = {};
    state.intPostHeights = {};
    state.fieldHeights = {};
    state.wireColors = {};
    state.clipColors = {};
    state.pathBreaks = new Set();
    state.walls = [];
    state.wallDrawing = null;
    state.houses = [];
    state.houseDrawing = null;
    state._houseDragging = false;
    state.terrain = {};
    state.selectedPosts.clear();
    state.selectedSegments.clear();
    state.selectedStruts.clear();
    state.selectedFields.clear();
    state.selectedIntPosts.clear();
    state.selectedWires.clear();
    state.selectedGates.clear();
    state.selectedVertex = -1;
    // Force immediate save of empty state so reload can't bring it back
    localStorage.removeItem(APP_SAVE_KEY);
    recalcAndRender();
  });
}

// ============================================================
// ZOOM BUTTONS
// ============================================================
function setupZoomButtons() {
  document.getElementById('zoomIn').addEventListener('click', () => {
    state.zoom = Math.min(5, state.zoom * 1.2);
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    render();
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    state.zoom = Math.max(0.2, state.zoom / 1.2);
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    render();
  });

  document.getElementById('zoomFit').addEventListener('click', () => {
    if (state.vertices.length === 0) {
      state.zoom = 1;
      state.panX = canvas.width / window.devicePixelRatio / 2;
      state.panY = canvas.height / window.devicePixelRatio / 2;
    } else {
      const xs = state.vertices.map(v => v.x);
      const ys = state.vertices.map(v => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const rangeX = maxX - minX + 4;
      const rangeY = maxY - minY + 4;
      const vw = canvas.width / window.devicePixelRatio;
      const vh = canvas.height / window.devicePixelRatio;
      state.zoom = Math.min(vw / (rangeX * CELL_SIZE), vh / (rangeY * CELL_SIZE), 3);
      state.panX = vw / 2 - ((minX + maxX) / 2) * CELL_SIZE * state.zoom;
      state.panY = vh / 2 - ((minY + maxY) / 2) * CELL_SIZE * state.zoom;
    }
    document.getElementById('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    render();
  });
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
document.getElementById('sidebarToggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  const btn = document.getElementById('sidebarToggle');
  btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  setTimeout(resizeCanvas, 350);
});

// ============================================================
// THEME TOGGLE
// ============================================================
document.getElementById('themeToggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  render();
});

// ============================================================
// KATALOG PRODUKTŮ
// ============================================================
(function() {
  let catalogData = null;
  let catalogFiltered = [];
  const CATEGORY_NAMES = {
    '/poplastovane-pletivo-pvc/': 'Poplastované pletivo PVC',
    '/pozinkovane-pletivo-ctyrhranne/': 'Pozinkované pletivo čtyřhranné',
    '/svarovane-pletivo/': 'Svařované pletivo',
    '/levne-uzlove-lesnicke-pletivo/': 'Uzlové lesnické pletivo',
    '/chovatelske-kralici-pletivo/': 'Chovatelské králičí pletivo',
    '/pletivo-na-voliery-svarovane/': 'Pletivo na voliéry',
    '/ovci-pletivo/': 'Ovčí pletivo',
    '/oborove-pletivo/': 'Oborové pletivo',
    '/vcelarske-pletivo/': 'Včelařské pletivo',
    '/okrasne-pletivo/': 'Okrasné pletivo',
    '/celoplastove-pletivo/': 'Celoplastové pletivo',
    '/zebirkovy-vyplet/': 'Žebírkový výplet',
    '/tenisove-pletivo/': 'Tenisové pletivo',
    '/katrovaci-pletivo/': 'Kátrovací pletivo',
    '/kovove-tkaniny-rabicove-pletivo/': 'Kovové tkaniny / rabicové pletivo',
    '/ziletkove-pletivo/': 'Žiletkové pletivo',
    '/pletivo-site-proti-hmyzu/': 'Pletivo/sítě proti hmyzu',
    '/plotove-dily-panely/': 'Plotové díly / panely',
    '/gabiony/': 'Gabiony',
    '/betonove-ploty/': 'Betonové ploty',
    '/plotovky/': 'Plotovky',
    '/mobilni-oploceni/': 'Mobilní oplocení',
    '/dalnicni-oploceni/': 'Dálniční oplocení',
    '/bezpecnostni-oploceni/': 'Bezpečnostní oplocení',
    '/vinohradnicky-system/': 'Vinohradnický systém',
    '/kovove-plotove-vyplne/': 'Kovové plotové výplně',
    '/hlinikove-oploceni/': 'Hliníkové oplocení',
    '/vyprodej-plot-pletiv/': 'Výprodej',
    '/zdene-ploty/': 'Zděné ploty',
    '/sloupky-a-vzpery-zelene/': 'Sloupky a vzpěry zelené',
    '/pozinkovane-sloupky-vzpery/': 'Pozinkované sloupky a vzpěry',
    '/sloupky-a-vzpery-antracit/': 'Sloupky a vzpěry antracit',
    '/patky-na-sloupky/': 'Patky na sloupky',
    '/silnostenne-sloupky/': 'Silnostěnné sloupky',
    '/cepicky-na-sloupky/': 'Čepičky na sloupky',
    '/spojky-a-prodlouzeni-sloupku/': 'Spojky a prodloužení sloupků',
    '/sloupky-k-brankam-a-branam/': 'Sloupky k brankám a bránám',
    '/napinaci--vazaci--ziletkove-a-ostnate-draty/': 'Napínací a vázací dráty',
    '/prislusenstvi-k-pletivum-a-sloupkum/': 'Příslušenství k pletivům',
    '/zastineni-na-plot/': 'Zastínění na plot',
    '/podhrabove-desky/': 'Podhrabové desky',
    '/zemni-vruty/': 'Zemní vruty',
    '/ochranne-pracovni-pomucky/': 'Ochranné pracovní pomůcky',
    '/ochrana-stromku-proti-okusu/': 'Ochrana stromků',
    '/textilie/': 'Textilie',
    '/zahrada/': 'Zahrada',
    '/dilna-zahrada/': 'Dílna a zahrada',
    '/barvy-laky/': 'Barvy a laky',
    '/schranky-boxy/': 'Schránky a boxy',
    '/fve/': 'FVE',
    '/zahradni-jednokridle-branky/': 'Jednokřídlé branky',
    '/dvoukridle-brany-zahradni/': 'Dvoukřídlé brány',
    '/posuvne-brany/': 'Posuvné brány',
    '/teleskopicke-brany/': 'Teleskopické brány',
    '/prislusenstvi-branky-brany/': 'Příslušenství branky a brány',
    '/pohony-pro-brany-a-souvisejici-prislusenstvi/': 'Pohony pro brány',
    '/zavory/': 'Závory',
  };

  function getCatLabel(catStr) {
    const cats = catStr.split(', ');
    return cats.map(c => CATEGORY_NAMES[c.trim()] || c.trim().replace(/\//g, '')).join(', ');
  }

  async function loadCatalog() {
    try {
      const resp = await fetch('products.json?t=' + Date.now());
      if (!resp.ok) throw new Error('Soubor products.json nenalezen');
      catalogData = await resp.json();
      populateCategories();
      filterAndRender();
      const d = new Date(catalogData.scraped);
      document.getElementById('catalogStatus').textContent =
        `${catalogData.totalProducts} produktů • aktualizováno ${d.toLocaleDateString('cs-CZ')} ${d.toLocaleTimeString('cs-CZ', {hour:'2-digit',minute:'2-digit'})}`;
    } catch (e) {
      document.getElementById('catalogGrid').innerHTML =
        '<p style="padding:20px;color:#e55;">Nepodařilo se načíst katalog. Klikněte na "Aktualizovat" pro stažení dat.</p>';
      document.getElementById('catalogStatus').textContent = '';
    }
  }

  function populateCategories() {
    const sel = document.getElementById('catalogCategory');
    sel.innerHTML = '<option value="">Všechny kategorie</option>';
    const cats = new Set();
    catalogData.products.forEach(p => {
      p.category.split(', ').forEach(c => cats.add(c.trim()));
    });
    const sorted = [...cats].sort((a, b) => {
      const la = CATEGORY_NAMES[a] || a;
      const lb = CATEGORY_NAMES[b] || b;
      return la.localeCompare(lb, 'cs');
    });
    sorted.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = CATEGORY_NAMES[c] || c.replace(/\//g, '');
      sel.appendChild(opt);
    });
  }

  // Normalize Czech text: strip diacritics for fuzzy search
  function stripDia(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Generate fuzzy stems from a word: try prefix matches (min 3 chars)
  function fuzzyMatch(word, hay) {
    if (hay.includes(word)) return true;
    // Strip diacritics from both
    const w = stripDia(word);
    const h = stripDia(hay);
    if (h.includes(w)) return true;
    // Stem prefix: if word is 4+ chars, try matching just the stem (first N-1, N-2 chars)
    if (w.length >= 4) {
      // Try progressively shorter prefixes (min 3 chars)
      for (let len = w.length - 1; len >= Math.max(3, w.length - 3); len--) {
        const stem = w.substring(0, len);
        // Check if any word in hay starts with this stem
        const words = h.split(/[\s,./()–\-]+/);
        if (words.some(hw => hw.startsWith(stem))) return true;
      }
    }
    return false;
  }

  let catalogPage = 1;
  const PAGE_SIZE = 40;

  function filterAndRender() {
    if (!catalogData) return;
    const query = document.getElementById('catalogSearch').value.toLowerCase().trim();
    const cat = document.getElementById('catalogCategory').value;
    catalogFiltered = catalogData.products.filter(p => {
      if (cat && !p.category.includes(cat)) return false;
      if (query) {
        const hay = (p.name + ' ' + p.code + ' ' + p.price).toLowerCase();
        return query.split(/\s+/).every(w => fuzzyMatch(w, hay));
      }
      return true;
    });
    catalogPage = 1;
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('catalogGrid');
    const totalPages = Math.max(1, Math.ceil(catalogFiltered.length / PAGE_SIZE));
    if (catalogPage > totalPages) catalogPage = totalPages;
    const start = (catalogPage - 1) * PAGE_SIZE;
    const showing = catalogFiltered.slice(start, start + PAGE_SIZE);

    // Update count + pagination
    const countEl = document.getElementById('catalogCount');
    const from = catalogFiltered.length ? start + 1 : 0;
    const to = start + showing.length;
    countEl.innerHTML = '';
    if (catalogFiltered.length > 0) {
      const info = document.createElement('span');
      info.textContent = `${from}–${to} z ${catalogFiltered.length} produktů`;
      countEl.appendChild(info);

      if (totalPages > 1) {
        const nav = document.createElement('span');
        nav.className = 'catalog-paging';
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '◀';
        prevBtn.className = 'btn-secondary catalog-page-btn';
        prevBtn.disabled = catalogPage <= 1;
        prevBtn.onclick = () => { catalogPage--; renderGrid(); grid.scrollTop = 0; };
        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` ${catalogPage} / ${totalPages} `;
        pageInfo.className = 'catalog-page-info';
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '▶';
        nextBtn.className = 'btn-secondary catalog-page-btn';
        nextBtn.disabled = catalogPage >= totalPages;
        nextBtn.onclick = () => { catalogPage++; renderGrid(); grid.scrollTop = 0; };
        nav.appendChild(prevBtn);
        nav.appendChild(pageInfo);
        nav.appendChild(nextBtn);
        countEl.appendChild(nav);
      }
    } else {
      countEl.textContent = '0 produktů';
    }

    if (showing.length === 0) {
      grid.innerHTML = '<p style="padding:20px;text-align:center;opacity:0.6;">Žádné produkty neodpovídají filtru.</p>';
      return;
    }

    grid.innerHTML = showing.map(p => {
      const imgSrc = p.image || '';
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'catalog-no-img\\'>📷</div>'">`
        : '<div class="catalog-no-img">📷</div>';
      const catLabel = getCatLabel(p.category);
      const link = p.url ? `<a href="${p.url}" target="_blank" rel="noopener" title="Otevřít na e-shopu">🔗</a>` : '';
      return `<div class="catalog-card">
        <div class="catalog-card-img">${imgHtml}</div>
        <div class="catalog-card-body">
          <div class="catalog-card-name">${p.name} ${link}</div>
          <div class="catalog-card-code">Kód: ${p.code || '–'}</div>
          <div class="catalog-card-cat">${catLabel}</div>
          <div class="catalog-card-price">${p.price || '–'}</div>
          ${p.stock ? `<div class="catalog-card-stock">${p.stock}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // Open / close
  document.getElementById('btnCatalog').addEventListener('click', () => {
    document.getElementById('catalogOverlay').style.display = 'flex';
    if (!catalogData) loadCatalog();
  });
  document.getElementById('catalogClose').addEventListener('click', () => {
    document.getElementById('catalogOverlay').style.display = 'none';
  });

  // Search & filter
  let searchTimer;
  document.getElementById('catalogSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterAndRender, 250);
  });
  document.getElementById('catalogCategory').addEventListener('change', filterAndRender);

  // Refresh / re-scrape button
  document.getElementById('catalogRefresh').addEventListener('click', async () => {
    const btn = document.getElementById('catalogRefresh');
    const status = document.getElementById('catalogStatus');
    btn.disabled = true;
    btn.textContent = '⏳ Scrapuji…';
    status.textContent = 'Probíhá aktualizace katalogu z e-shopu… Může to trvat několik minut.';

    try {
      const resp = await fetch('/api/scrape', { method: 'POST' });
      if (resp.ok) {
        status.textContent = '✅ Aktualizace dokončena! Načítám nová data…';
        await loadCatalog();
      } else {
        status.textContent = '⚠️ Pro aktualizaci spusťte v terminálu: node scraper.js';
        // Still try to reload in case the file was updated manually
        setTimeout(loadCatalog, 1000);
      }
    } catch (e) {
      status.textContent = '⚠️ Server neběží. Spusťte v terminálu: node scraper.js a pak klikněte znovu.';
      // Try to reload anyway in case products.json was updated
      setTimeout(loadCatalog, 2000);
    }
    btn.disabled = false;
    btn.textContent = '🔄 Aktualizovat';
  });
})();

// ============================================================
// CENOVÁ NABÍDKA – HELPER / PRŮVODCE
// ============================================================
(function() {
  const GUIDES = {
    ctyrhranne: {
      title: '🔗 Čtyřhranné pletivo (klasické)',
      intro: 'Nejprodávanější typ. Poplastované (PVC zelené/antracit) nebo pozinkované (Zn). Prodej <b>pouze po rolích</b> (15 m, 25 m) → vždy dej rezervu!',
      warnings: [
        'V 99,9 % případů se VŽDY dává pletivo <b>BEZ napínacího drátu (bez ND)</b>!',
        'Pletivo s ND = napínací drát integrovaný, od 120/125 cm se přidává 3. prostřední drát.',
        'Při stínící tkanině → VŽDY volit <b>STRONG sloupky</b> (silnostěnné).',
        'Přebytečné pletivo se NEVRACÍ (prodej v rolích)!',
      ],
      checklist: [
        { item: 'Pletivo', note: 'Role 15 m nebo 25 m. Bez ND / s ND. Průměr drátu 2,5 mm nebo 3,0 mm. Oko 50×50 mm.', required: true },
        { item: 'Sloupky', note: 'Kulaté 38 mm (menší), <b>48 mm (standard)</b>, hranaté 60×40 / 60×60. Rozestupy 2,5 m. Délka = výška pletiva + 50–70 cm (bez podhr.) nebo + výška desky + 70 cm (s podhr.). Na svahu delší!', required: true },
        { item: 'Vzpěry', note: 'VŽDY na začátku a konci plotu, při změně směru, po 25 m (max 30 m). Délka = výška pletiva + 50 cm. S podhr. deskami → držáky na vzpěry + ŠROUB VZP.', required: true },
        { item: 'Napínací drát', note: 'U pletiva <b>bez ND</b>: 3× délka plotu (při výšce > 120 cm). U pletiva s ND: není potřeba. ⚠️ <b>Každý drát = samostatné balení na každou sekci!</b> Nesčítat délky!', required: true },
        { item: 'Ráčny (napínáky)', note: 'VŽDY na koncové sloupky. <b>Pravidlo: co vzpěra, to 3 ráčny.</b> V rohu: opasek + 2 ráčny + šroubek + očko.', required: true },
        { item: 'Vázací drát + spony', note: 'Na napínací drát se připíná pletivo. Spony = jednodušší (naše montáž). Vázací drát = na koncové sloupky.', required: true },
        { item: 'Příchytky', note: 'Na KAŽDÝ sloupek na KAŽDÝ napínací drát. Na existující sloupky → vždy příchytky STRONG.', required: true },
        { item: 'Opasky', note: 'Alternativa k vyvazování. Estetičtější, ale dražší. Každý opasek = šroubek + matička. Velikost dle průměru sloupku.', required: false },
        { item: 'Beton / ukotvení', note: 'Zemina: VŽDY doporučit betonování. 1,5 pytle/sloupek. Do 30 m → pytlový beton (kód 2693). Nad 30 m → betonárka (betonserver.cz). Kubíky = (sloupky + vzpěry) ÷ 37.', required: true },
        { item: 'Podhrabové desky', note: '20 cm (rovinka) nebo 30 cm (svah). Držáky: <b>průběžný</b> (mezilehlé sloupky) + <b>koncový</b> (krajní/rohové). ⚠️ Držáky fungují JEN na kulaté sloupky! ŠROUB VZP na vzpěry.', required: false },
        { item: 'Kryty na podhrabové desky', note: 'Koncové krytky na konce podhrabových desek (estetika).', required: false },
        { item: 'Ruční kopání', note: 'V CN VŽDY položka "ruční kopání" za <b>0 Kč</b>. V protokolu dle reality → cca 1 000 Kč/díra.', required: true },
        { item: 'Stínící tkanina', note: 'Pokud zákazník chce → STRONG sloupky!', required: false },
        { item: 'Doprava', note: 'Do 12 000 Kč = 389 Kč. Nad 12 000 Kč = ZDARMA. Beton = individuální. Min. dopravné 500 Kč.', required: true },
      ],
      formulas: [
        'Počet sloupků = (délka plotu ÷ 2,5) + 1',
        'Počet vzpěr = začátek + konec + rohy + po 25 m',
        'Počet ráčen = počet vzpěr × 3',
        'Napínací dráty = 3× délka plotu (u bez ND, výška > 120 cm)',
        'Pytle betonu = (sloupky + vzpěry) × 1,5',
        'Kubíky z betonárky = (sloupky + vzpěry) ÷ 37',
        'Délka sloupku = výška pletiva + 70 cm (bez podhr.)',
        'Délka sloupku = výška pletiva + výška desky + 70 cm (s podhr.)',
        'Délka vzpěry = výška pletiva + 50 cm',
      ],
      tips: [
        'Záloha 65 % předem, 35 % po montáži.',
        'Beton z betonárky: dopravné = vzdálenost × 2 × 18 Kč/km.',
        'U brány nepotřebuješ nový plotový sloupek – brána má vlastní.',
        'Příchytky a drobný materiál lze vrátit → snížení konečné částky.',
      ],
    },

    svarovane: {
      title: '🔗 Svařované pletivo',
      intro: 'Pevnější než čtyřhranné → ideální kde je <b>pes</b>. Máme JEN poplastované (PVC). Prodej po rolích, vždy rezerva. <b>POUZE BEZ ND</b> (bez napínacího drátu).',
      warnings: [
        'Svařované pletivo NEMÁ napínací dráty, pouze VÁZACÍ dráty!',
        'Spony Bekaclip se používají POUZE u sloupků s prolisem.',
        'Přebytečné pletivo se NEVRACÍ (prodej v rolích)!',
      ],
      checklist: [
        { item: 'Pletivo', note: 'Pouze PVC. Značky: Light Plus, Pilonet Middle/Heavy/Super, Pilonet Antracit. Výška 40–200 cm.', required: true },
        { item: 'Sloupky', note: '<b>Varianta A:</b> klasické kulaté 48 mm (příchytky, vázací drát). <b>Varianta B:</b> s prolisem (kleště Bekaclip, dražší ale pevnější).', required: true },
        { item: 'Vzpěry', note: 'Začátek, konec, rohy, po 25 m. S podhr. deskami → držáky + ŠROUB VZP.', required: true },
        { item: 'Ráčny', note: 'Co vzpěra, to 3 ráčny.', required: true },
        { item: 'Vázací drát + spony', note: 'Na koncové sloupky vázací drát. Průběžné → příchytky nebo Bekaclip spony.', required: true },
        { item: 'Příchytky', note: 'U klasických sloupků: příchytky na průběžné sloupky.', required: true },
        { item: 'Kleště Bekaclip', note: 'Pouze při sloupkách s prolisem! Co oko, to spona.', required: false },
        { item: 'Beton / ukotvení', note: '1,5 pytle/sloupek. Nad 30 m → betonárka.', required: true },
        { item: 'Podhrabové desky', note: 'Viz čtyřhranné pletivo. Držáky: <b>průběžné</b> + <b>koncové</b>. ⚠️ JEN kulaté sloupky!', required: false },
        { item: 'Opasky', note: 'Volitelně (estetičtější).', required: false },
        { item: 'Ruční kopání', note: 'Položka za 0 Kč v CN, dle reality cca 1 000 Kč/díra.', required: true },
        { item: 'Doprava', note: 'Nad 12 000 Kč ZDARMA. Beton individuální.', required: true },
      ],
      formulas: [
        'Počet sloupků = (délka plotu ÷ 2,5) + 1',
        'Počet ráčen = počet vzpěr × 3',
        'Pytle betonu = (sloupky + vzpěry) × 1,5',
      ],
      tips: [
        'Pes → svařované pletivo je lepší volba než čtyřhranné.',
        'Sloupky s prolisem = dražší ale výrazně pevnější.',
      ],
    },

    panely2d: {
      title: '📐 Plotové panely 2D',
      intro: 'Pevnější než svařované pletivo. Panel má <b>VŽDY 2,5 m na šířku</b>. Povrch: komaxit (prášková barva). Barvy: zelená, antracit, zinek. Síla: 5/4/5, 6/5/6, 8/6/8 mm. <b>Nemají prolisy nahoře</b>.',
      warnings: [
        'VŽDY přidávat 1× sprej barva v barvě plotu!',
        'Krácení panelů se platí!',
        'Průměr drátu se udává VČETNĚ komaxitu!',
        'VŽDY dávat navíc cca 10 ks příchytek!',
        'Nepotřebují napínací drát, vázací drát ani vzpěry!',
      ],
      checklist: [
        { item: 'Panely 2D', note: 'Šířka 2,5 m, síla drátu: 5/4/5, 6/5/6 nebo 8/6/8. Výška 63–203 cm (−3 cm kvůli přesahu). Barva: zelená/antracit/zinek.', required: true },
        { item: 'Sloupky', note: 'Hranaté <b>60×40 mm</b> (nejčastější) nebo 60×60 mm. Nepotřebují napínací drát ani vzpěry.', required: true },
        { item: 'Příchytky', note: '<b>5 příchytek na 1 sloupek.</b> Průběžná / rohová / koncová (MEZI sloupky) nebo U-tvar (Z ČELA). + navíc cca 10 ks!', required: true },
        { item: 'Sprej barva', note: 'V barvě plotu! Na ošetření řezů a škrábanců.', required: true },
        { item: 'Podhrabové desky', note: 'Přidává se nacenění ZAKOPÁNÍ podhrabových desek.', required: false },
        { item: 'Beton / ukotvení', note: '1,5 pytle/sloupek. Panely jsou nosné, méně nároků na základ.', required: true },
        { item: 'Ruční kopání', note: 'Položka za 0 Kč v CN.', required: true },
        { item: 'Spojka', note: 'Pro nekonečnou montáž (panel > 2,5 m) – ale NENÍ pevné! Raději mezisloupek.', required: false },
        { item: 'Doprava', note: 'Nad 12 000 Kč ZDARMA.', required: true },
      ],
      formulas: [
        'Počet panelů = délka plotu ÷ 2,5',
        'Počet sloupků = (délka plotu ÷ 2,5) + 1',
        'Příchytky = počet sloupků × 5 + 10 ks navíc',
        'Pytle betonu = sloupky × 1,5',
      ],
      tips: [
        'Velký pes / kopání míčem → volit tlustší drát 5 mm (8/6/8).',
        '2D panely NEMAJÍ prolisy → čistší vzhled.',
        'Do zdi / do kovu: U-tvar příchytky.',
        'Značení: první číslo = vodorovný, prostřední = svislý, poslední = zdvojený nahoře.',
      ],
    },

    panely3d: {
      title: '📐 Plotové panely 3D',
      intro: 'Stejná pravidla jako 2D, ale <b>MAJÍ prolisy nahoře</b>. Dělení jen podle tloušťky drátu: 4 mm nebo 5 mm. Panel 2,5 m šířka.',
      warnings: [
        'VŽDY přidávat 1× sprej barva v barvě plotu!',
        'Krácení panelů se platí!',
        'VŽDY dávat navíc cca 10 ks příchytek!',
      ],
      checklist: [
        { item: 'Panely 3D', note: 'Šířka 2,5 m, drát <b>4 mm nebo 5 mm</b>. S prolisy. Barva: zelená/antracit/zinek.', required: true },
        { item: 'Sloupky', note: 'Hranaté <b>60×40 mm</b> nebo 60×60 mm.', required: true },
        { item: 'Příchytky', note: '5 ks na sloupek + navíc cca 10 ks. Průběžná / rohová / koncová / U-tvar.', required: true },
        { item: 'Sprej barva', note: 'V barvě plotu!', required: true },
        { item: 'Podhrabové desky', note: 'S nacenění zakopání.', required: false },
        { item: 'Beton / ukotvení', note: '1,5 pytle/sloupek.', required: true },
        { item: 'Ruční kopání', note: 'Položka za 0 Kč v CN.', required: true },
        { item: 'Doprava', note: 'Nad 12 000 Kč ZDARMA.', required: true },
      ],
      formulas: [
        'Počet panelů = délka plotu ÷ 2,5',
        'Počet sloupků = (délka plotu ÷ 2,5) + 1',
        'Příchytky = počet sloupků × 5 + navíc 10 ks',
      ],
      tips: [
        '3D panely = robustnější díky prolisům.',
        'Pro velké psy volit 5 mm drát.',
      ],
    },

    betonovy: {
      title: '🧱 Betonový plot',
      intro: 'Betonové desky (šířka vždy 200 cm), sokly, betonové sloupky. Dle vzoru: jednostranný / oboustranný / bez vzoru.',
      warnings: [
        'VŽDY se dává chemická kotva! 1,5 chemické kotvy na 2 pole!',
        'Výška sloupku na e-shopu = výška OPLOCENÍ, ne sloupku samotného!',
        'V rohu s příliš velkým/malým úhlem → 2× koncový sloupek místo 1× rohový!',
        'Doprava betonu = individuální, nespadá pod doprava zdarma!',
      ],
      checklist: [
        { item: 'Betonové desky', note: 'Šířka 200 cm. Jednostranný / oboustranný / bez vzoru. Výška 50 cm.', required: true },
        { item: 'Sokly', note: 'Šířka 200 cm, výška <b>50 cm nebo 20 cm</b>.', required: false },
        { item: 'Betonové sloupky', note: 'Výška = výška oplocení (např. 3× deska 50 cm + sokl 20 cm = 170 cm → sloupek ~175 cm). Rohový / koncový / průběžný.', required: true },
        { item: 'Chemická kotva', note: '<b>VŽDY! 1,5 chemické kotvy na 2 pole (ne na desku)!</b>', required: true },
        { item: 'Kovové sloupky (alternativa)', note: 'S 12mm závitovými tyčemi. Alternativa k betonovým sloupkům.', required: false },
        { item: 'Doprava', note: 'INDIVIDUÁLNÍ! Beton = těžký materiál, nutno řešit speciálně.', required: true },
      ],
      formulas: [
        'Počet polí = délka plotu ÷ 2 (desky jsou 200 cm)',
        'Počet sloupků = počet polí + 1',
        'Chemická kotva = počet polí × 0,75 (zaokrouhlit nahoru)',
      ],
      tips: [
        'Zákazník může koupit desky a složit záhon sám – cena vychází stejně.',
        'Volba sloupku dle vzoru desek (jednostranný/oboustranný).',
        'Velké zakázky → doprava autem s rukou.',
      ],
    },

    plotovky: {
      title: '🪵 WPC Plotovky',
      intro: 'V nabídce: <b>WPC plotovky</b> (60 % dřevo, 40 % plast HDPE), <b>Pilwood-Sand</b> (50 % dřevo, 30 % plast), <b>Dřevoplus</b> (60/40). Doporučujeme WPC nebo Dřevoplus.',
      warnings: [
        'Plotovky potřebují nosníky (60×40 mm)!',
        'Příslušenství pro montáž se prodává zvlášť!',
      ],
      checklist: [
        { item: 'Plotovky', note: 'WPC / Pilwood-Sand / Dřevoplus. Barva, výška, počet ks.', required: true },
        { item: 'Nosníky', note: 'Hranaté 60×40 mm (Zn+PVC). Délka 200 cm. Barva sladěná s plotovkami.', required: true },
        { item: 'Sloupky', note: 'Hranaté sloupky pro uchycení nosníků.', required: true },
        { item: 'Příslušenství pro montáž', note: 'Klipy, šrouby, distanční podložky, kryty, ukončovací lišty.', required: true },
        { item: 'Beton / ukotvení', note: 'Sloupky do betonu.', required: true },
        { item: 'Doprava', note: 'Nad 12 000 Kč ZDARMA.', required: true },
      ],
      formulas: [
        'Počet plotovek = (výška plotu ÷ šířka plotovky) × počet polí',
        'Počet nosníků = dle výšky (typicky 2–3 na pole)',
      ],
      tips: [
        'Pilwood-Sand = levnější, přírodnější vzhled.',
        'WPC = moderní, výrazná textura.',
        'Dřevoplus = přírodní vzhled, bez hluboké textury.',
        'Návod na montáž na webu: levne-pletivo.cz/navod-na-montaz-wpc-plotovek/',
      ],
    },

    hlinikove: {
      title: '🔩 Hliníkové oplocení',
      intro: 'Moderní design, nízká hmotnost, bezúdržbovost, odolnost korozi. Systém <b>Alupass</b> – hliníkové lamely.',
      warnings: [
        'Info o dostupnosti na vyžádání u některých lamel!',
      ],
      checklist: [
        { item: 'Hliníkové lamely', note: 'Alupass lamely (výška 55 mm nebo 100 mm), délka 183 cm. Antracit.', required: true },
        { item: 'Sloupky', note: 'Hliníkové sloupky k systému Alupass.', required: true },
        { item: 'Příslušenství', note: 'Uchycovací prvky, kryty, ukončení.', required: true },
        { item: 'Beton / ukotvení', note: 'Sloupky do betonu nebo na patky.', required: true },
        { item: 'Doprava', note: 'Standard.', required: true },
      ],
      formulas: [
        'Počet lamel na pole = výška plotu ÷ výška lamely',
        'Počet polí = délka plotu ÷ šířka lamely (183 cm)',
      ],
      tips: [
        'Snadná a rychlá montáž.',
        'Soukromí – lamelový design.',
        'Fotogalerie na webu: levne-pletivo.cz/alupass-fotogalerie/',
        'Poptat montáž přes obchodní zástupce.',
      ],
    },

    gabiony: {
      title: '🪨 Gabiony',
      intro: 'Drátěné svařované konstrukce pro kamennou výplň. Gabionové sypané stěny, koše, sítě. <b>Opěrné zdi z gabionů NEDĚLÁME</b> (max prodáme materiál).',
      warnings: [
        'Opěrné zdi = velká stavařina → NEDĚLÁME montáž!',
        'Gabionové koše chodí rozložené!',
      ],
      checklist: [
        { item: 'Gabionové koše / sítě', note: 'Oka: 50×50, 100×50, 100×100, 100×25 mm. Rozměr dle přání.', required: true },
        { item: 'Příslušenství pro montáž', note: 'Spirály, svorky, distanční prvky, víka.', required: true },
        { item: 'Výplň (kamenivo)', note: 'Klasické kamenivo nebo Lightstone (lehčí). Řešit s dodavatelem kamene.', required: true },
        { item: 'Doprava', note: 'Gabiony = těžší materiál, dle celkové hmotnosti.', required: true },
      ],
      formulas: [],
      tips: [
        'Gabionový plot na klíč: nezávazná poptávka u obchodních zástupců.',
        'Kalkulace a zaměření zdarma.',
        'Montujeme gabionové sypané stěny (NE opěrné zdi).',
      ],
    },

    lesnicke: {
      title: '🌲 Lesnické / speciální pletivo',
      intro: 'Lesnické, králičí, voliérové, oborové, ovčí a další speciální pletiva. Většinou montáž svépomocí.',
      warnings: [
        'Lesnické pletivo NEDÁVÁ napínací drát!',
        'Dřevěné kůly s U svorkami = nutná technika, není levné!',
      ],
      checklist: [
        { item: 'Pletivo', note: 'Lesnické / králičí / voliérové / oborové / ovčí. Dle zvířete a účelu.', required: true },
        { item: 'Sloupky', note: 'Kovové (vázací drát/příchytky), Préria (háčky), dřevěné kůly (U svorky).', required: true },
        { item: 'Vzpěry', note: 'Dle potřeby.', required: false },
        { item: 'Vázací drát / příchytky', note: 'K uchycení na sloupky.', required: true },
        { item: 'Beton / ukotvení', note: 'Dle typu sloupků.', required: false },
        { item: 'Doprava', note: 'Standard.', required: true },
      ],
      formulas: [],
      tips: [
        'Králičí: HOBBY (menší balení, dražší) vs PROFI (větší balení, levnější).',
        'Oborové: větší oka 100×100 mm, silnější drát.',
        'Okrasné: nízké 25–120 cm, sloupky 2 m od sebe, 30 cm do země.',
        'Žebírkové: jen doplnění starých plotů, NE jako nový!',
      ],
    },

    brany: {
      title: '🚪 Brány a branky',
      intro: 'Jednokřídlé branky, dvoukřídlé brány, posuvné brány, teleskopické brány. Výplně: pletivo, panel, tahokov, děrovaný plech.',
      warnings: [
        'Brána/branka má VLASTNÍ sloupky → vedle brány NENÍ potřeba nový plotový sloupek!',
        'V rohu u brány: sloupek brány slouží jako rohový!',
      ],
      checklist: [
        { item: 'Brána / branka', note: 'Typ: jednokřídlá, dvoukřídlá, posuvná, teleskopická. Šířka, výška, výplň, barva.', required: true },
        { item: 'Sloupky k bráně', note: 'Brána má vlastní sloupky! Nepřidávej plotové sloupky vedle.', required: true },
        { item: 'Příslušenství', note: 'Zástrče, panty, petlice, kování, dorazy, očka na zámky, vložky, zámky, samozavírače.', required: true },
        { item: 'Elektrický otvírač / pohon', note: 'Pokud zákazník chce automatiku.', required: false },
        { item: 'Beton pro sloupky', note: 'Sloupky brány také betonovat!', required: true },
      ],
      formulas: [],
      tips: [
        'Posuvné brány: výplň panel, tahokov, plech nebo bez výplně.',
        'Pohony (motory) k branám – na e-shopu.',
        'Závory – pokud zákazník potřebuje.',
        'Kování a zámky nabízet proaktivně!',
      ],
    },

    zastineni: {
      title: '🌿 Zastínění na plot',
      intro: 'Stínící tkaniny, stínící pásy do panelů, štípaný bambus, rákosová rohož, umělý živý plot, ratanové zastínění, plastové vertikální pásky.',
      warnings: [
        'Stínící tkanina na čtyřhranné/svařované pletivo → VŽDY STRONG sloupky!',
        'Stínící pásy = do plotových panelů (2D/3D).',
      ],
      checklist: [
        { item: 'Stínění', note: 'Typ: tkanina, pásy, bambus, rákos, umělý živý plot, ratan, plastové pásky.', required: true },
        { item: 'STRONG sloupky', note: 'Pokud stínění na pletivo → VŽDY silnostěnné sloupky!', required: false },
        { item: 'Příchytky / úchyty', note: 'K uchycení stínění na plot.', required: true },
      ],
      formulas: [
        'Délka stínění = délka plotu (+ rezerva)',
        'Výška dle plotu',
      ],
      tips: [
        'Stínící tkaniny = nejčastější volba pro soukromí.',
        'Plastové pásky do panelů = moderní vzhled, snadná instalace.',
        'Bambus a rákos = přírodní vzhled.',
      ],
    },
  };

  // Render guide for selected type
  function renderGuide(type) {
    const container = document.getElementById('quoteContent');
    if (!type || !GUIDES[type]) {
      container.innerHTML = '<p style="opacity:0.5; text-align:center; padding:30px;">👆 Vyberte typ oplocení výše pro zobrazení průvodce cenovou nabídkou.</p>';
      return;
    }
    const g = GUIDES[type];
    let html = '';

    // Title & intro
    html += `<h4 class="qg-title">${g.title}</h4>`;
    html += `<p class="qg-intro">${g.intro}</p>`;

    // Inject calculated data if fence is drawn
    const calcResult = calculate();
    if (calcResult) {
      const exportText = getExportText();
      html += `<div style="background:#f0faf0;border:2px solid #27ae60;padding:10px;margin:10px 0;border-radius:4px;">`;
      html += `<h5 style="margin:0 0 6px 0;color:#27ae60;font-size:14px;">📋 Kalkulace z aktuálního plotu</h5>`;
      html += `<pre style="font-size:11px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;margin:0;font-family:'Courier New',monospace;max-height:400px;overflow-y:auto;">${escapeHtml(exportText)}</pre>`;
      html += `<div style="margin-top:8px;text-align:center;">`;
      html += `<button class="btn-accent" style="margin-right:6px;font-size:12px;padding:4px 12px;" onclick="copyToClipboard();showNotification('Zkopírováno!')">📋 Kopírovat do schránky</button>`;
      html += `<button class="btn-accent" style="font-size:12px;padding:4px 12px;" onclick="printExport()">📥 Stáhnout PDF</button>`;
      html += `</div></div>`;
    }

    // Warnings
    if (g.warnings && g.warnings.length) {
      html += '<div class="qg-warnings">';
      g.warnings.forEach(w => { html += `<div class="qg-warn">⚠️ ${w}</div>`; });
      html += '</div>';
    }

    // Checklist
    html += '<h5 class="qg-section">✅ Checklist – co musí být v CN</h5>';

    // Povinné položky pro betonový plot — červeně
    if (type === 'betonovy') {
      html += `<div style="background:#fdf2f2;border:2px solid #e74c3c;padding:10px 14px;margin:0 0 12px 0;border-radius:4px;">`;
      html += `<h5 style="margin:0 0 6px 0;color:#e74c3c;font-size:14px;font-weight:700;">⚠️ Povinné položky – MUSÍ být v cenové nabídce</h5>`;
      html += `<div style="color:#c0392b;font-weight:600;font-size:13px;line-height:1.8;">`;
      html += `1. Montáž ruční kopání<br>`;
      html += `2. Montáž zarezávání betonových panelů<br>`;
      html += `3. Montáž zakopávání betonových desek<br>`;
      html += `4. Individuální doprava betonových produktů<br>`;
      html += `5. Platba: 65 % předem / 35 % po dokončení`;
      html += `</div></div>`;
    }

    // Povinné položky pro čtyřhranné/svařované — červeně
    if (type.startsWith('ctyrhranne') || type === 'svarovane') {
      const hasPodhrab = calcResult && calcResult.podhrabDesky > 0;
      html += `<div style="background:#fdf2f2;border:2px solid #e74c3c;padding:10px 14px;margin:0 0 12px 0;border-radius:4px;">`;
      html += `<h5 style="margin:0 0 6px 0;color:#e74c3c;font-size:14px;font-weight:700;">⚠️ Povinné položky – MUSÍ být v cenové nabídce</h5>`;
      html += `<div style="color:#c0392b;font-weight:600;font-size:13px;line-height:1.8;">`;
      html += `1. Montáž ruční kopání<br>`;
      if (hasPodhrab) {
        html += `2. Montáž zarezávání podhrabových desek<br>`;
        html += `3. Montáž zakopávání podhrabových desek<br>`;
        html += `4. Individuální doprava betonových produktů<br>`;
        html += `5. Platba: 65 % předem / 35 % po dokončení`;
      } else {
        html += `2. Platba: 65 % předem / 35 % po dokončení`;
      }
      html += `</div></div>`;
    }

    html += '<div class="qg-checklist">';
    g.checklist.forEach((c, i) => {
      const req = c.required ? '<span class="qg-req">POVINNÉ</span>' : '<span class="qg-opt">volitelné</span>';
      html += `<label class="qg-check-item">
        <input type="checkbox" data-idx="${i}">
        <span class="qg-check-label"><b>${c.item}</b> ${req}</span>
        <span class="qg-check-note">${c.note}</span>
      </label>`;
    });
    html += '</div>';

    // Formulas
    if (g.formulas && g.formulas.length) {
      html += '<h5 class="qg-section">🔢 Výpočetní vzorce</h5>';
      html += '<ul class="qg-formulas">';
      g.formulas.forEach(f => { html += `<li>${f}</li>`; });
      html += '</ul>';
    }

    // Tips
    if (g.tips && g.tips.length) {
      html += '<h5 class="qg-section">💡 Tipy a poznámky</h5>';
      html += '<ul class="qg-tips">';
      g.tips.forEach(t => { html += `<li>${t}</li>`; });
      html += '</ul>';
    }

    // General reminders
    html += '<h5 class="qg-section">📋 Obecné připomínky</h5>';
    html += '<ul class="qg-general">';
    html += '<li>Záloha <b>65 % předem</b>, 35 % po montáži.</li>';
    html += '<li>Doprava: do 12 000 Kč = 389 Kč, nad 12 000 Kč = ZDARMA. Min. dopravné 500 Kč.</li>';
    html += '<li>Beton, bet. desky a sloupky = doprava INDIVIDUÁLNÍ (nespadá pod zdarma).</li>';
    html += '<li>Přebytečné pletivo se NEVRACÍ (prodej v rolích). Příchytky a drobný materiál ano.</li>';
    html += '<li>Ruční kopání: v CN za 0 Kč, v protokolu cca 1 000 Kč/díra.</li>';
    html += '<li>U brány vedle plotu: brána má svůj sloupek → nepřidávej plotový sloupek navíc.</li>';
    html += '</ul>';

    // Open catalog button
    html += '<div style="text-align:center; margin-top:16px;">';
    html += '<button class="btn-primary" onclick="document.getElementById(\'quoteOverlay\').style.display=\'none\'; document.getElementById(\'btnCatalog\').click();">📦 Otevřít katalog produktů</button>';
    html += '</div>';

    container.innerHTML = html;
  }

  document.getElementById('btnQuote').addEventListener('click', () => {
    document.getElementById('quoteOverlay').style.display = 'flex';
    renderGuide(document.getElementById('quoteType').value);
  });
  document.getElementById('quoteClose').addEventListener('click', () => {
    document.getElementById('quoteOverlay').style.display = 'none';
  });
  document.getElementById('quoteType').addEventListener('change', (e) => {
    renderGuide(e.target.value);
  });

  // ============ EXPORT FENCE IMAGE FOR SKETCHER ============
  document.getElementById('btnNacrt').addEventListener('click', (e) => {
    if (state.vertices.length < 2) return; // no fence, just navigate

    // Save current state
    const savedZoom = state.zoom, savedPanX = state.panX, savedPanY = state.panY;
    const savedShowDim = state.showDimensions;
    const savedGhost = state.ghostCursor;
    const savedSelectedVertex = state.selectedVertex;
    const savedHoveredVertex = state.hoveredVertex;
    const savedHoveredSegment = state.hoveredSegment;
    const savedHoveredPostKey = state.hoveredPostKey;
    const savedHoveredPanelKey = state.hoveredPanelKey;
    const savedSelectedPosts = new Set(state.selectedPosts);
    const savedSelectedSegments = new Set(state.selectedSegments);
    const savedSelectedStruts = new Set(state.selectedStruts);
    const savedSelectedFields = new Set(state.selectedFields);
    const savedSelectedIntPosts = new Set(state.selectedIntPosts);
    const savedSelectedWires = new Set(state.selectedWires);

    // Clear all UI states for clean export
    state.ghostCursor = null;
    state.selectedVertex = -1;
    state.hoveredVertex = -1;
    state.hoveredSegment = -1;
    state.hoveredPostKey = null;
    state.hoveredPanelKey = null;
    state.selectedPosts.clear();
    state.selectedSegments.clear();
    state.selectedStruts.clear();
    state.selectedFields.clear();
    state.selectedIntPosts.clear();
    state.selectedWires.clear();

    // Calculate bounding box including houses and walls
    const allXs = [...state.vertices.map(v => v.x)];
    const allYs = [...state.vertices.map(v => v.y)];
    for (const h of state.houses) {
      allXs.push(h.x1, h.x2);
      allYs.push(h.y1, h.y2);
    }
    for (const w of state.walls) {
      for (const v of w.vertices) { allXs.push(v.x); allYs.push(v.y); }
    }
    const minX = Math.min(...allXs), maxX = Math.max(...allXs);
    const minY = Math.min(...allYs), maxY = Math.max(...allYs);
    const rangeX = maxX - minX + 6;
    const rangeY = maxY - minY + 6;

    // Use fixed export canvas (no dpr scaling) to keep data URL small enough for localStorage
    const oldW = canvas.width, oldH = canvas.height;
    const oldStyle = canvas.style.cssText;
    const capW = 1200, capH = 900;
    canvas.width = capW; canvas.height = capH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Fit fence
    const fitZoom = Math.min(capW / (rangeX * CELL_SIZE), capH / (rangeY * CELL_SIZE), 4);
    state.zoom = fitZoom;
    state.panX = capW / 2 - ((minX + maxX) / 2) * CELL_SIZE * fitZoom;
    state.panY = capH / 2 - ((minY + maxY) / 2) * CELL_SIZE * fitZoom;

    // Helper: flatten canvas onto white background and encode as JPEG
    function _canvasToJpeg() {
      const flat = document.createElement('canvas');
      flat.width = capW; flat.height = capH;
      const fc = flat.getContext('2d');
      fc.fillStyle = '#ffffff';
      fc.fillRect(0, 0, capW, capH);
      fc.drawImage(canvas, 0, 0);
      return flat.toDataURL('image/jpeg', 0.82);
    }

    // Render WITH dimensions
    state.showDimensions = true;
    render();
    const imgWithDims = _canvasToJpeg();

    // Render WITHOUT dimensions
    state.showDimensions = false;
    render();
    const imgNoDims = _canvasToJpeg();

    // Restore everything
    canvas.width = oldW; canvas.height = oldH;
    canvas.style.cssText = oldStyle;
    state.zoom = savedZoom; state.panX = savedPanX; state.panY = savedPanY;
    state.showDimensions = savedShowDim;
    state.ghostCursor = savedGhost;
    state.selectedVertex = savedSelectedVertex;
    state.hoveredVertex = savedHoveredVertex;
    state.hoveredSegment = savedHoveredSegment;
    state.hoveredPostKey = savedHoveredPostKey;
    state.hoveredPanelKey = savedHoveredPanelKey;
    state.selectedPosts = savedSelectedPosts;
    state.selectedSegments = savedSelectedSegments;
    state.selectedStruts = savedSelectedStruts;
    state.selectedFields = savedSelectedFields;
    state.selectedIntPosts = savedSelectedIntPosts;
    state.selectedWires = savedSelectedWires;
    resizeCanvas();
    render();

    // Store both versions – JPEG at 1200×900 is ~200–400 KB, well within the 5 MB localStorage limit
    try {
      localStorage.setItem('plotyNacrtImage', JSON.stringify({
        withDims: imgWithDims,
        noDims: imgNoDims,
        width: capW,
        height: capH,
        timestamp: Date.now()
      }));
    } catch(ex) {
      console.warn('Export too large for localStorage even as JPEG', ex);
    }
    // Let the default link navigation happen
  });
})();

// ============================================================
// EXPORT BUTTONS
// ============================================================
document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
document.getElementById('btnPrint').addEventListener('click', printExport);

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.key === 'Delete' && state.selectedVertex >= 0) {
    saveHistory();
    const idx = state.selectedVertex;
    state.vertices.splice(idx, 1);
    state.gates = state.gates.filter(g => g.segmentIndex !== idx && g.segmentIndex !== idx - 1);
    state.gates.forEach(g => { if (g.segmentIndex > idx) g.segmentIndex--; });
    // Adjust pathBreaks
    const newBreaks = new Set();
    for (const b of state.pathBreaks) {
      if (b === idx || b === idx - 1) continue;
      newBreaks.add(b > idx ? b - 1 : b);
    }
    state.pathBreaks = newBreaks;
    state.selectedVertex = -1;
    recalcAndRender();
  }
  if (e.key === 'Escape') {
    // Cancel house drawing
    if (state.tool === 'house' && state.houseDrawing) {
      state.houseDrawing = null;
      state._houseDragging = false;
      render();
      return;
    }
    // Finish wall drawing
    if (state.tool === 'wall' && state.wallDrawing && state.wallDrawing.vertices.length >= 2) {
      saveHistory();
      state.walls.push({
        vertices: state.wallDrawing.vertices,
        thickness: state.wallConfig.thickness,
        height: state.wallConfig.height,
        barva: state.wallConfig.barva,
      });
      state.wallDrawing = null;
      recalcAndRender();
      return;
    }
    // Finish fence path section
    if (state.tool === 'draw' && state.vertices.length > 0) {
      state.pathBreaks.add(state.vertices.length - 1);
      state.selectedVertex = -1;
      render();
      return;
    }
    state.selectedVertex = -1;
    document.getElementById('gateDialog').style.display = 'none';
    hideContextMenu();
    render();
  }
  // Number keys for tools
  if (e.key === '1') { document.getElementById('toolDraw').click(); }
  if (e.key === '2') { document.getElementById('toolSelect').click(); }
  if (e.key === '3') { document.getElementById('toolGate').click(); }
  if (e.key === '4') { document.getElementById('toolDelete').click(); }
  if (e.key === '5') { document.getElementById('toolWall').click(); }
  if (e.key === '6') { const el = document.getElementById('toolTerrain'); if (el) el.click(); }
  if (e.key === '7') { const el = document.getElementById('toolHouse'); if (el) el.click(); }
});

// ============================================================
// HELPER: RECALC + RENDER
// ============================================================
function recalcAndRender() {
  render();
  updateCalcPanel();
  // Update 3D view if active
  if (typeof view3D !== 'undefined' && view3D.active && view3D.scene) {
    rebuildTerrainMesh3D();
    build3DFence();
  }
}

// ============================================================
// INIT
// ============================================================
function init() {
  setupConfigHandlers();
  setupToolButtons();
  setupZoomButtons();
  updateTypeOptions();

  // Center the canvas
  resizeCanvas();
  state.panX = canvas.width / window.devicePixelRatio / 2;
  state.panY = canvas.height / window.devicePixelRatio / 2;

  // Initial history snapshot
  saveHistory();

  render();
  updateCalcPanel();
}

// Start
init();

// ============================================================
// 3D VIEW (Three.js)
// ============================================================
const view3D = {
  active: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  animFrameId: null,
  fenceGroup: null,
  cameraInitialized: false,
};

function init3D() {
  const container = document.getElementById('three-container');
  const rect = container.parentElement.getBoundingClientRect();

  view3D.scene = new THREE.Scene();
  view3D.scene.background = new THREE.Color(0xe8f5e9);

  // Camera
  view3D.camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
  view3D.camera.position.set(10, 8, 15);
  view3D.camera.lookAt(0, 1, 0);

  // Renderer
  view3D.renderer = new THREE.WebGLRenderer({ antialias: true });
  view3D.renderer.setSize(rect.width, rect.height);
  view3D.renderer.setPixelRatio(window.devicePixelRatio);
  view3D.renderer.shadowMap.enabled = true;
  view3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(view3D.renderer.domElement);

  // Controls
  view3D.controls = new THREE.OrbitControls(view3D.camera, view3D.renderer.domElement);
  view3D.controls.enableDamping = true;
  view3D.controls.dampingFactor = 0.08;
  view3D.controls.maxPolarAngle = Math.PI / 2 - 0.05;
  view3D.controls.minDistance = 2;
  view3D.controls.maxDistance = 200;

  // 3D click selection
  view3D.renderer.domElement.addEventListener('click', (e) => {
    if (!view3D.active) return;
    const rect = view3D.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, view3D.camera);
    const hits = raycaster.intersectObjects(view3D.fenceGroup.children, false)
      .filter(h => !h.object.userData._outline);
    if (hits.length === 0) {
      state.selectedPosts.clear();
      state.selectedSegments.clear();
      state.selectedStruts.clear();
      state.selectedFields.clear();
      state.selectedIntPosts.clear();
      state.selectedWires.clear();
      state.selectedShadeCloth.clear();
      hideColorToolbar();
      build3DFence();
      return;
    }
    const hit = hits[0].object;
    const ud = hit.userData;
    if (!ud || !ud.elementType) return;

    const playgroundRect = document.getElementById('playground').getBoundingClientRect();
    const px = e.clientX - playgroundRect.left;
    const py = e.clientY - playgroundRect.top;

    if (ud.elementType === 'post') {
      const idx = ud.vertexIndex;
      if (e.shiftKey) {
        if (state.selectedPosts.has(idx)) state.selectedPosts.delete(idx);
        else state.selectedPosts.add(idx);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedPosts.add(idx);
      }
      showColorToolbarAt(px, py, 'sloupek');
    } else if (ud.elementType === 'intPost') {
      const key = ud.intKey;
      if (e.shiftKey) {
        if (state.selectedIntPosts.has(key)) state.selectedIntPosts.delete(key);
        else state.selectedIntPosts.add(key);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedIntPosts.add(key);
      }
      showColorToolbarAt(px, py, 'sloupek');
    } else if (ud.elementType === 'field') {
      const key = ud.fieldKey;
      if (e.shiftKey) {
        if (state.selectedFields.has(key)) state.selectedFields.delete(key);
        else state.selectedFields.add(key);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedFields.add(key);
      }
      showColorToolbarAt(px, py, 'pole');
    } else if (ud.elementType === 'segment') {
      const idx = ud.segmentIndex;
      if (e.shiftKey) {
        if (state.selectedSegments.has(idx)) state.selectedSegments.delete(idx);
        else state.selectedSegments.add(idx);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedSegments.add(idx);
      }
      showColorToolbarAt(px, py, 'úsek');
    } else if (ud.elementType === 'strut') {
      const idx = ud.strutIndex;
      if (e.shiftKey) {
        if (state.selectedStruts.has(idx)) state.selectedStruts.delete(idx);
        else state.selectedStruts.add(idx);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedStruts.add(idx);
      }
      showColorToolbarAt(px, py, 'vzpěra');
    } else if (ud.elementType === 'wire') {
      const key = ud.wireKey;
      if (e.shiftKey) {
        if (state.selectedWires.has(key)) state.selectedWires.delete(key);
        else state.selectedWires.add(key);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedWires.add(key);
      }
      showColorToolbarAt(px, py, 'drát');
    } else if (ud.elementType === 'shadeCloth') {
      const idx = ud.segmentIndex;
      if (e.shiftKey) {
        if (state.selectedShadeCloth.has(idx)) state.selectedShadeCloth.delete(idx);
        else state.selectedShadeCloth.add(idx);
      } else {
        state.selectedPosts.clear(); state.selectedSegments.clear(); state.selectedStruts.clear();
        state.selectedFields.clear(); state.selectedIntPosts.clear(); state.selectedWires.clear();
        state.selectedShadeCloth.clear();
        state.selectedShadeCloth.add(idx);
      }
      showColorToolbarAt(px, py, 'tkanina');
    } else if (ud.elementType === 'gate' || ud.elementType === 'gatePost') {
      // Open gate edit dialog
      const gate = state.gates.find(g => g.segmentIndex === ud.segmentIndex);
      if (gate) openGateDialog(ud.segmentIndex, gate);
    }
    build3DFence();
  });

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  view3D.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 30, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  view3D.scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.3);
  view3D.scene.add(hemiLight);

  // Ground plane (terrain mesh - will be rebuilt with terrain data)
  view3D.groundGroup = new THREE.Group();
  view3D.scene.add(view3D.groundGroup);
  rebuildTerrainMesh3D();

  // Grid helper
  const gridHelper = new THREE.GridHelper(200, 80, 0x558844, 0x669955);
  gridHelper.position.y = 0.01;
  view3D.scene.add(gridHelper);
  view3D.gridHelper = gridHelper;

  // Fence group
  view3D.fenceGroup = new THREE.Group();
  view3D.scene.add(view3D.fenceGroup);
}

function dispose3D() {
  if (view3D.animFrameId) {
    cancelAnimationFrame(view3D.animFrameId);
    view3D.animFrameId = null;
  }
  if (view3D.renderer) {
    view3D.renderer.dispose();
    const container = document.getElementById('three-container');
    while (container.firstChild) container.removeChild(container.firstChild);
  }
  if (view3D.controls) view3D.controls.dispose();
  view3D.scene = null;
  view3D.camera = null;
  view3D.renderer = null;
  view3D.controls = null;
  view3D.fenceGroup = null;
  view3D.cameraInitialized = false;
}

function animate3D() {
  if (!view3D.active) return;
  view3D.animFrameId = requestAnimationFrame(animate3D);
  view3D.controls.update();
  view3D.renderer.render(view3D.scene, view3D.camera);
}

function resize3D() {
  if (!view3D.active || !view3D.renderer) return;
  const container = document.getElementById('three-container');
  const rect = container.getBoundingClientRect();
  view3D.camera.aspect = rect.width / rect.height;
  view3D.camera.updateProjectionMatrix();
  view3D.renderer.setSize(rect.width, rect.height);
}

// ---- Materials ----
function get3DPostMaterial() {
  const type = state.fenceType;
  if (type === 'betonovy') {
    const betonColor = BETON_COLORS_3D[state.config.betonBarva] || BETON_COLORS_3D.seda;
    return new THREE.MeshStandardMaterial({ color: betonColor, metalness: 0.0, roughness: 0.85 });
  }
  if (type === 'panely_2d' || type === 'panely_3d') {
    const barva = type === 'panely_2d' ? state.config.barva2D : state.config.barva3D;
    const color = FENCE_COLORS_3D[barva] || 0x4a4f52;
    return new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
  }
  return new THREE.MeshStandardMaterial({ color: 0x2ecc71, metalness: 0.3, roughness: 0.5 });
}

function get3DFenceColor() {
  const type = state.fenceType;
  if (type.startsWith('ctyrhranne')) return 0x2ecc71;
  if (type === 'svarovane') return 0x2ecc71;
  if (type === 'panely_2d') return FENCE_COLORS_3D[state.config.barva2D] || 0x3498db;
  if (type === 'panely_3d') return FENCE_COLORS_3D[state.config.barva3D] || 0x2980b9;
  if (type === 'betonovy') return BETON_COLORS_3D[state.config.betonBarva] || 0x999999;
  return 0x2ecc71;
}

function get3DFenceMaterial() {
  const type = state.fenceType;
  if (type === 'betonovy') {
    return new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.9, metalness: 0.0 });
  }
  if (type === 'panely_2d' || type === 'panely_3d') {
    return new THREE.MeshStandardMaterial({ color: get3DFenceColor(), metalness: 0.4, roughness: 0.5 });
  }
  // Mesh/chain-link → semi-transparent
  return new THREE.MeshStandardMaterial({
    color: get3DFenceColor(),
    metalness: 0.3,
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
}

// ---- Convert world coordinates (grid) to 3D (XZ plane) ----
function gridTo3D(gx, gy) {
  // Each grid cell = GRID_M meters
  return { x: gx * GRID_M, y: getTerrainElevation(gx, gy), z: gy * GRID_M };
}

// ---- Procedural terrain textures for 3D ----
const _terrain3DTexCache = {};
function getTerrainTexture3D(surface) {
  if (_terrain3DTexCache[surface]) return _terrain3DTexCache[surface];
  const sz = 256;
  const oc = document.createElement('canvas');
  oc.width = sz; oc.height = sz;
  const ox = oc.getContext('2d');
  const def = TERRAIN_SURFACES[surface];
  ox.fillStyle = def.color2D;
  ox.fillRect(0, 0, sz, sz);

  if (surface === 'trava') {
    // Soft color variation (no dark patches)
    for (let i = 0; i < 50; i++) {
      const v = Math.random();
      ox.fillStyle = v < 0.5
        ? `rgba(${55+Math.random()*30},${100+Math.random()*35},${30+Math.random()*20},0.15)`
        : `rgba(${65+Math.random()*30},${115+Math.random()*30},${40+Math.random()*20},0.12)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 3+Math.random()*8, 2+Math.random()*6);
    }
    // Grass blades - medium to bright greens, curved
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * sz, ry = Math.random() * sz;
      const shade = Math.random();
      const r = shade < 0.4 ? 50+Math.random()*30 : 65+Math.random()*35;
      const g = shade < 0.4 ? 100+Math.random()*35 : 120+Math.random()*30;
      const b = shade < 0.4 ? 25+Math.random()*18 : 35+Math.random()*18;
      ox.strokeStyle = `rgba(${r},${g},${b},${0.35+Math.random()*0.35})`;
      ox.lineWidth = 0.4 + Math.random() * 0.6;
      const bladeH = 3 + Math.random() * 7;
      const sway = (Math.random()-0.5) * 3.5;
      ox.beginPath(); ox.moveTo(rx, ry); ox.quadraticCurveTo(rx+sway*0.4, ry-bladeH*0.6, rx+sway, ry-bladeH); ox.stroke();
    }
    // Light highlight blades
    for (let i = 0; i < 40; i++) {
      ox.strokeStyle = `rgba(${80+Math.random()*30},${140+Math.random()*35},${45+Math.random()*20},0.2)`;
      ox.lineWidth = 0.3;
      const rx = Math.random()*sz, ry = Math.random()*sz;
      ox.beginPath(); ox.moveTo(rx, ry); ox.lineTo(rx+(Math.random()-0.5)*2, ry-2-Math.random()*4); ox.stroke();
    }
  } else if (surface === 'hlina') {
    // Moist dark patches
    for (let i = 0; i < 18; i++) {
      ox.fillStyle = `rgba(${45+Math.random()*25},${32+Math.random()*18},${15+Math.random()*12},0.3)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 3+Math.random()*7, 0, Math.PI*2); ox.fill();
    }
    // Dry lighter patches
    for (let i = 0; i < 12; i++) {
      ox.fillStyle = `rgba(${130+Math.random()*40},${100+Math.random()*35},${55+Math.random()*30},0.15)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 2+Math.random()*5, 0, Math.PI*2); ox.fill();
    }
    // Grainy texture - multi-tone
    for (let i = 0; i < 350; i++) {
      const v = Math.random();
      const r = v < 0.35 ? 70+Math.random()*35 : (v < 0.7 ? 95+Math.random()*45 : 120+Math.random()*40);
      const g = v < 0.35 ? 50+Math.random()*25 : (v < 0.7 ? 70+Math.random()*35 : 85+Math.random()*30);
      const b = v < 0.35 ? 25+Math.random()*15 : (v < 0.7 ? 35+Math.random()*20 : 45+Math.random()*20);
      ox.fillStyle = `rgba(${r},${g},${b},${0.15+Math.random()*0.2})`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 0.5+Math.random()*3, 0.3+Math.random()*2);
    }
    // Stones/pebbles
    for (let i = 0; i < 15; i++) {
      const sv = 90+Math.random()*70;
      ox.fillStyle = `rgba(${sv},${sv-8},${sv-15},0.35)`;
      const rx = Math.random()*sz, ry = Math.random()*sz;
      const rr = 0.8+Math.random()*2.5;
      ox.beginPath(); ox.ellipse(rx, ry, rr, rr*(0.5+Math.random()*0.4), Math.random()*Math.PI, 0, Math.PI*2); ox.fill();
      // Stone highlight
      ox.fillStyle = `rgba(${sv+30},${sv+25},${sv+20},0.15)`;
      ox.beginPath(); ox.ellipse(rx-rr*0.2, ry-rr*0.2, rr*0.5, rr*0.3, Math.random()*Math.PI, 0, Math.PI*2); ox.fill();
    }
    // Cracks
    ox.strokeStyle = 'rgba(40,28,12,0.18)';
    ox.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) {
      ox.beginPath();
      let cx = Math.random()*sz, cy = Math.random()*sz;
      ox.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) { cx += (Math.random()-0.5)*15; cy += (Math.random()-0.5)*15; ox.lineTo(cx, cy); }
      ox.stroke();
    }
    // Root/organic bits
    for (let i = 0; i < 6; i++) {
      ox.strokeStyle = `rgba(${60+Math.random()*30},${45+Math.random()*20},${20+Math.random()*15},0.2)`;
      ox.lineWidth = 0.5;
      ox.beginPath();
      let rx = Math.random()*sz, ry = Math.random()*sz;
      ox.moveTo(rx, ry);
      ox.quadraticCurveTo(rx+(Math.random()-0.5)*10, ry+(Math.random()-0.5)*5, rx+(Math.random()-0.5)*15, ry+(Math.random()-0.5)*8);
      ox.stroke();
    }
  } else if (surface === 'beton') {
    // Base color variation (pour marks)
    for (let i = 0; i < 30; i++) {
      const v = 115+Math.random()*50;
      ox.fillStyle = `rgba(${v},${v+2},${v+4},0.12)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 3+Math.random()*10, 0, Math.PI*2); ox.fill();
    }
    // Aggregate (visible small stones in concrete)
    for (let i = 0; i < 200; i++) {
      const v = Math.random();
      const bright = v < 0.4 ? 95+Math.random()*30 : (v < 0.7 ? 130+Math.random()*35 : 155+Math.random()*40);
      ox.fillStyle = `rgba(${bright},${bright-2},${bright+3},${0.1+Math.random()*0.18})`;
      const r = 0.3 + Math.random() * 1.5;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, r, 0, Math.PI*2); ox.fill();
    }
    // Fine sandy texture
    for (let i = 0; i < 120; i++) {
      ox.fillStyle = `rgba(${110+Math.random()*40},${112+Math.random()*40},${118+Math.random()*38},0.08)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 0.5+Math.random()*2, 0.3+Math.random()*1.5);
    }
    // Hairline cracks
    for (let i = 0; i < 6; i++) {
      ox.strokeStyle = `rgba(${70+Math.random()*25},${72+Math.random()*25},${78+Math.random()*25},0.15)`;
      ox.lineWidth = 0.25 + Math.random()*0.3;
      ox.beginPath();
      let cx = Math.random()*sz, cy = Math.random()*sz;
      ox.moveTo(cx, cy);
      for (let j = 0; j < 5+Math.random()*4; j++) { cx += (Math.random()-0.5)*12; cy += (Math.random()-0.5)*12; ox.lineTo(cx, cy); }
      ox.stroke();
    }
    // Dark water/oil stains
    for (let i = 0; i < 5; i++) {
      ox.fillStyle = `rgba(65,68,72,0.06)`;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, 2+Math.random()*6, 0, Math.PI*2); ox.fill();
    }
    // Trowel marks
    ox.strokeStyle = 'rgba(100,102,108,0.06)';
    ox.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = Math.random()*sz;
      ox.beginPath(); ox.moveTo(0, y); ox.lineTo(sz, y+(Math.random()-0.5)*6); ox.stroke();
    }
  } else if (surface === 'pisek') {
    for (let i = 0; i < 500; i++) {
      const v = Math.random();
      ox.fillStyle = `rgba(${155+Math.random()*65},${130+Math.random()*55},${70+Math.random()*45},${0.15+Math.random()*0.25})`;
      const r = 0.3 + Math.random() * 1.5;
      ox.beginPath(); ox.arc(Math.random()*sz, Math.random()*sz, r, 0, Math.PI*2); ox.fill();
    }
    // Wave ripples
    ox.strokeStyle = 'rgba(140,110,55,0.08)';
    ox.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      const y = 5 + i * (sz/5) + Math.random()*5;
      ox.beginPath(); ox.moveTo(0, y);
      for (let x = 0; x <= sz; x += 4) ox.quadraticCurveTo(x+2, y+(Math.random()-0.5)*2, x+4, y);
      ox.stroke();
    }
  } else if (surface === 'dlazba') {
    ox.strokeStyle = 'rgba(35,35,35,0.4)';
    ox.lineWidth = 1.8;
    const brickH = sz / 4;
    for (let row = 0; row <= 4; row++) {
      const y = row * brickH;
      ox.beginPath(); ox.moveTo(0, y); ox.lineTo(sz, y); ox.stroke();
      const offset = row % 2 === 0 ? 0 : sz/4;
      for (let col = offset; col <= sz; col += sz/2) {
        ox.beginPath(); ox.moveTo(col, y); ox.lineTo(col, y + brickH); ox.stroke();
      }
    }
    // Per-brick color variation
    for (let i = 0; i < 40; i++) {
      const v = 60+Math.random()*50;
      ox.fillStyle = `rgba(${v},${v},${v},0.08)`;
      ox.fillRect(Math.random()*sz, Math.random()*sz, 10+Math.random()*10, 5+Math.random()*8);
    }
  }

  const tex = new THREE.CanvasTexture(oc);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  _terrain3DTexCache[surface] = tex;
  return tex;
}

// ---- Rebuild 3D terrain mesh from state.terrain ----
function rebuildTerrainMesh3D() {
  if (!view3D.groundGroup) return;

  // Clear old terrain meshes
  while (view3D.groundGroup.children.length > 0) {
    const child = view3D.groundGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    view3D.groundGroup.remove(child);
  }

  // Base ground plane (flat grass, no elevation)
  const baseGeo = new THREE.PlaneGeometry(200, 200);
  const baseTex = getTerrainTexture3D('trava');
  baseTex.repeat.set(40, 40);
  const baseMat = new THREE.MeshLambertMaterial({ map: baseTex });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.rotation.x = -Math.PI / 2;
  baseMesh.position.y = -0.005;
  baseMesh.receiveShadow = true;
  view3D.groundGroup.add(baseMesh);

  // Terrain cells as flat blocks
  const terrainKeys = Object.keys(state.terrain);
  // Group by surface + elevation for batching
  const byGroup = {};
  for (const key of terrainKeys) {
    const cell = state.terrain[key];
    const surface = cell.surface || 'trava';
    const elev = cell.elevation || 0;
    // Skip flat grass cells (that's the base plane)
    if (surface === 'trava' && elev === 0) continue;
    const groupKey = `${surface}:${elev}`;
    if (!byGroup[groupKey]) byGroup[groupKey] = { surface, elev, keys: [] };
    byGroup[groupKey].keys.push(key);
  }

  const sideMat = new THREE.MeshLambertMaterial({ color: 0x665544, side: THREE.DoubleSide }); // brown sides for elevated blocks
  // Darker tinted side material for surface-matched edges
  const darkSideMat = new THREE.MeshLambertMaterial({ color: 0x555555, side: THREE.DoubleSide });

  for (const groupKey of Object.keys(byGroup)) {
    const { surface, elev, keys } = byGroup[groupKey];
    const tex = getTerrainTexture3D(surface);
    const mat = new THREE.MeshLambertMaterial({ map: tex });

    for (const key of keys) {
      const parts = key.split(',');
      const gx = parseInt(parts[0]), gy = parseInt(parts[1]);
      const wx = gx * GRID_M, wz = gy * GRID_M;

      // Top face
      const topGeo = new THREE.PlaneGeometry(GRID_M, GRID_M);
      const topMesh = new THREE.Mesh(topGeo, mat);
      topMesh.rotation.x = -Math.PI / 2;
      topMesh.position.set(wx, elev + 0.005, wz);
      topMesh.receiveShadow = true;
      view3D.groundGroup.add(topMesh);

      // Thin edge border for ALL non-grass cells (even flat ones) so they're visible
      if (surface !== 'trava' || elev > 0.01) {
        const edgeH = elev > 0.01 ? 0 : 0.02; // flat cells get thin border
        const actualElev = Math.max(elev, 0.02);
        const half = GRID_M / 2;

        // 4 sides
        const sides = [
          { px: wx, pz: wz + half, ry: 0,              nk: `${gx},${gy+1}` },
          { px: wx, pz: wz - half, ry: Math.PI,        nk: `${gx},${gy-1}` },
          { px: wx - half, pz: wz, ry: Math.PI / 2,    nk: `${gx-1},${gy}` },
          { px: wx + half, pz: wz, ry: -Math.PI / 2,   nk: `${gx+1},${gy}` },
        ];
        for (const s of sides) {
          const neighbor = state.terrain[s.nk];
          const nElev = (neighbor && neighbor.elevation) || 0;
          const nSurface = (neighbor && neighbor.surface) || 'trava';

          // Skip if neighbor is same surface at same or higher elevation
          if (nElev >= actualElev && nSurface === surface) continue;

          const wallBottom = Math.min(nElev, actualElev);
          const wallH = actualElev - wallBottom;
          if (wallH < 0.005) continue;

          const useMat = elev > 0.01 ? sideMat : darkSideMat;
          const wallGeo = new THREE.PlaneGeometry(GRID_M, wallH);
          const wallMesh = new THREE.Mesh(wallGeo, useMat);
          wallMesh.position.set(s.px, wallBottom + wallH / 2, s.pz);
          wallMesh.rotation.y = s.ry;
          wallMesh.receiveShadow = true;
          wallMesh.castShadow = true;
          view3D.groundGroup.add(wallMesh);
        }
      }
    }
  }

  // Update grid helper
  if (view3D.gridHelper) {
    view3D.gridHelper.position.y = 0.02;
  }
}

// ---- Build the 3D scene from state ----
function build3DFence() {
  if (!view3D.fenceGroup) return;

  // Clear old fence
  while (view3D.fenceGroup.children.length > 0) {
    const child = view3D.fenceGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
    view3D.fenceGroup.remove(child);
  }

  // Always build houses even without fence
  build3DHouses();

  if (state.vertices.length < 2) return;

  const segments = getSegments();
  const cfg = state.config;
  const type = state.fenceType;
  const isBeton = type === 'betonovy';
  const isPanels = type === 'panely_2d' || type === 'panely_3d';

  // Heights in meters
  const fenceHeightM = cfg.height / 100;
  // podhrabH = configured height (always available for per-segment use)
  const podhrabH = cfg.podhrabovaVyska / 100;
  // Check if ANY segment has podhrab (for post height calculation)
  const anySegHasPodhrab = segments.some(seg => !getSegStyle(seg).noPodhrab);
  const maxPodhrabH = anySegHasPodhrab ? podhrabH : 0;
  const totalFenceH = fenceHeightM + maxPodhrabH;
  const postMat = get3DPostMaterial();
  const strutMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, metalness: 0.5, roughness: 0.4 });
  const podhrabMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95, metalness: 0.0 });

  // Determine post shape - now per-segment via getSegStyle, fallback to global
  // Global isRound for general fence shape decisions
  const isRound = type.startsWith('ctyrhranne') && (cfg.typSloupku === 'kulate_38' || cfg.typSloupku === 'kulate_48');
  const postRadius = isRound
    ? (cfg.typSloupku === 'kulate_38' ? 0.04 : 0.05)
    : 0.06;

  // Helper to get per-segment post radius
  function getSegPostRadius(seg) {
    const ss = getSegStyle(seg);
    const segTyp = ss.typSloupku || cfg.typSloupku;
    const segRound = segTyp === 'kulate_38' || segTyp === 'kulate_48';
    return segRound ? (segTyp === 'kulate_38' ? 0.04 : 0.05) : 0.06;
  }
  function isSegRound(seg) {
    const ss = getSegStyle(seg);
    const segTyp = ss.typSloupku || cfg.typSloupku;
    return segTyp === 'kulate_38' || segTyp === 'kulate_48';
  }

  // ---- Draw posts (all: vertex + intermediate) with per-post colors ----
  // Iterate per segment to track intermediate post indices
  const drawnVertexPosts = new Set();
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const fields = seg.fields;

    // Draw start vertex post (if not already drawn)
    if (!drawnVertexPosts.has(seg.from)) {
      drawnVertexPosts.add(seg.from);
      const fromPostVisH = getVertexPostH(seg.from) / 100 - 0.70;
      const segPR = getSegPostRadius(seg);
      const segIR = isSegRound(seg);
      _add3DPost(state.vertices[seg.from], seg, { elementType: 'post', vertexIndex: seg.from },
        getPostColor3D(seg.from), postMat, segPR, segIR, isBeton, type, fromPostVisH, segments);
    }

    // Draw intermediate posts (gate-aware)
    if (seg.gate) {
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const tGateStart = seg.gateStartM / seg.lengthM;
      const tGateEnd = seg.gateEndM / seg.lengthM;
      const leftFields = seg.leftFields || 0;
      const rightFields = seg.rightFields || 0;
      let intIdx = 0;

      // Compute angle for gate panel rotation
      const a3g = gridTo3D(seg.a.x, seg.a.y);
      const b3g = gridTo3D(seg.b.x, seg.b.y);
      const gAngle = Math.atan2(-(b3g.z - a3g.z), b3g.x - a3g.x);

      // Left zone intermediate posts
      for (let f = 1; f < leftFields; f++) {
        const t = (f / leftFields) * tGateStart;
        const intPost = { x: seg.a.x + dx * t, y: seg.a.y + dy * t };
        const intKey = getFieldKey(seg.from, intIdx);
        const intColor = getIntPostColor3D(seg.from, intIdx);
        const intPostVisH = getIntPostH(seg.from, intIdx, seg) / 100 - 0.70;
        _add3DPost(intPost, seg, { elementType: 'intPost', segIndex: seg.from, intPostIndex: intIdx, intKey },
          intColor, postMat, getSegPostRadius(seg), isSegRound(seg), isBeton, type, intPostVisH, segments);
        intIdx++;
      }

      // Gate posts (use gate color)
      const GATE_COLORS_3D = { zelena: 0x2ecc71, antracit: 0x4a4f52, stribrna: 0xc8d0d4 };
      const gateColor3D = GATE_COLORS_3D[seg.gate.barva] || GATE_COLORS_3D.zelena;
      const gatePostMat = new THREE.MeshStandardMaterial({ color: gateColor3D, metalness: 0.4, roughness: 0.5 });
      const gateH = (seg.gate.height || cfg.height) / 100;
      const gatePostH = gateH + podhrabH;
      const gp1 = { x: seg.a.x + dx * tGateStart, y: seg.a.y + dy * tGateStart };
      const gp2 = { x: seg.a.x + dx * tGateEnd, y: seg.a.y + dy * tGateEnd };

      const gp1_3d = gridTo3D(gp1.x, gp1.y);
      const gp2_3d = gridTo3D(gp2.x, gp2.y);
      const gatePostGeo = new THREE.CylinderGeometry(0.05, 0.05, gatePostH + 0.15, 8);
      const gatePost1 = new THREE.Mesh(gatePostGeo, gatePostMat);
      gatePost1.position.set(gp1_3d.x, gp1_3d.y + (gatePostH + 0.15) / 2, gp1_3d.z);
      gatePost1.castShadow = true;
      gatePost1.userData = { elementType: 'gatePost', segmentIndex: seg.from };
      view3D.fenceGroup.add(gatePost1);

      const gatePost2 = new THREE.Mesh(gatePostGeo.clone(), gatePostMat);
      gatePost2.position.set(gp2_3d.x, gp2_3d.y + (gatePostH + 0.15) / 2, gp2_3d.z);
      gatePost2.castShadow = true;
      gatePost2.userData = { elementType: 'gatePost', segmentIndex: seg.from };
      view3D.fenceGroup.add(gatePost2);

      // Gate panel(s) – with fence texture, frame, and handles
      const gateWidthM = seg.gate.width / 100;
      const gatePanelH = gateH - 0.05; // gate height minus 5cm bottom clearance gap
      const gateMidX = (gp1_3d.x + gp2_3d.x) / 2;
      const gateMidZ = (gp1_3d.z + gp2_3d.z) / 2;
      const gateMidY = (gp1_3d.y + gp2_3d.y) / 2;
      const gatePanelY = gateMidY + podhrabH + gatePanelH / 2 + 0.05;

      // Determine gate fence type and create matching material
      const gateFT = seg.gate.fenceType || 'ctyrhranne_s_nd';
      const isGateChainLink = gateFT.startsWith('ctyrhranne') || gateFT === 'svarovane';
      let gatePanelMat;
      if (isGateChainLink) {
        const tex = makeChainLinkTexture(gateColor3D);
        gatePanelMat = new THREE.MeshStandardMaterial({
          alphaMap: tex,
          color: gateColor3D,
          metalness: 0.3,
          roughness: 0.5,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        });
      } else {
        gatePanelMat = new THREE.MeshStandardMaterial({
          color: gateColor3D,
          metalness: 0.4,
          roughness: 0.5,
        });
      }

      const isBrana = seg.gate.type === 'brana';
      const wingGap = 0.02; // 2cm gap between wings
      const frameR = 0.015; // frame tube radius
      const frameMat = new THREE.MeshStandardMaterial({ color: gateColor3D, metalness: 0.5, roughness: 0.4 });

      if (isBrana) {
        // Double-wing gate
        const wingW = (gateWidthM - wingGap) / 2;
        for (let wing = 0; wing < 2; wing++) {
          const wingSign = wing === 0 ? -1 : 1;
          const wingOffsetX = wingSign * (wingW / 2 + wingGap / 2);
          // Wing offset along fence direction
          const wox = Math.cos(gAngle) * wingOffsetX;
          const woz = -Math.sin(gAngle) * wingOffsetX;

          // Panel fill
          const wGeo = new THREE.PlaneGeometry(wingW, gatePanelH);
          if (isGateChainLink) {
            const wMat = gatePanelMat.clone();
            const cellSize = 0.06;
            const alphaClone = wMat.alphaMap.clone();
            alphaClone.needsUpdate = true;
            alphaClone.repeat.set(wingW / cellSize, gatePanelH / cellSize);
            wMat.alphaMap = alphaClone;
            const wMesh = new THREE.Mesh(wGeo, wMat);
            wMesh.position.set(gateMidX + wox, gatePanelY, gateMidZ + woz);
            wMesh.rotation.y = gAngle;
            wMesh.castShadow = true;
            wMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
            view3D.fenceGroup.add(wMesh);
          } else {
            const wMesh = new THREE.Mesh(wGeo, gatePanelMat);
            wMesh.position.set(gateMidX + wox, gatePanelY, gateMidZ + woz);
            wMesh.rotation.y = gAngle;
            wMesh.castShadow = true;
            wMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
            view3D.fenceGroup.add(wMesh);
          }

          // Frame: top, bottom, hinge side, latch side
          const topRail = new THREE.Mesh(new THREE.CylinderGeometry(frameR, frameR, wingW, 6), frameMat);
          topRail.geometry.rotateZ(Math.PI / 2);
          topRail.position.set(gateMidX + wox, gateMidY + podhrabH + gatePanelH + 0.05, gateMidZ + woz);
          topRail.rotation.y = gAngle;
          view3D.fenceGroup.add(topRail);

          const botRail = new THREE.Mesh(new THREE.CylinderGeometry(frameR, frameR, wingW, 6), frameMat);
          botRail.geometry.rotateZ(Math.PI / 2);
          botRail.position.set(gateMidX + wox, gateMidY + podhrabH + 0.05, gateMidZ + woz);
          botRail.rotation.y = gAngle;
          view3D.fenceGroup.add(botRail);

          // Vertical sides
          const sideH = gatePanelH;
          for (const sideFactor of [-1, 1]) {
            const sideOffX = Math.cos(gAngle) * (wingW / 2 * sideFactor);
            const sideOffZ = -Math.sin(gAngle) * (wingW / 2 * sideFactor);
            const sRail = new THREE.Mesh(new THREE.CylinderGeometry(frameR, frameR, sideH, 6), frameMat);
            sRail.position.set(gateMidX + wox + sideOffX, gatePanelY, gateMidZ + woz + sideOffZ);
            view3D.fenceGroup.add(sRail);
          }

          // Handle (on the inner side of each wing, near the gap)
          const handleSide = wing === 0 ? 1 : -1; // inner side
          const handleOffX = Math.cos(gAngle) * (wingW / 2 * handleSide * 0.85);
          const handleOffZ = -Math.sin(gAngle) * (wingW / 2 * handleSide * 0.85);
          // Handle forward offset (perpendicular to fence)
          const hFwdX = Math.sin(gAngle) * 0.03;
          const hFwdZ = Math.cos(gAngle) * 0.03;
          const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
          // Horizontal bar
          const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), handleMat);
          hBar.position.set(gateMidX + wox + handleOffX + hFwdX, gatePanelY, gateMidZ + woz + handleOffZ + hFwdZ);
          hBar.rotation.x = Math.PI / 2;
          hBar.rotation.y = gAngle;
          view3D.fenceGroup.add(hBar);
        }
      } else {
        // Single-wing branka
        // Panel fill
        const panelGeo = new THREE.PlaneGeometry(gateWidthM, gatePanelH);
        if (isGateChainLink) {
          const wMat = gatePanelMat.clone();
          const cellSize = 0.06;
          const alphaClone = wMat.alphaMap.clone();
          alphaClone.needsUpdate = true;
          alphaClone.repeat.set(gateWidthM / cellSize, gatePanelH / cellSize);
          wMat.alphaMap = alphaClone;
          const panelMesh = new THREE.Mesh(panelGeo, wMat);
          panelMesh.position.set(gateMidX, gatePanelY, gateMidZ);
          panelMesh.rotation.y = gAngle;
          panelMesh.castShadow = true;
          panelMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
          view3D.fenceGroup.add(panelMesh);
        } else {
          const panelMesh = new THREE.Mesh(panelGeo, gatePanelMat);
          panelMesh.position.set(gateMidX, gatePanelY, gateMidZ);
          panelMesh.rotation.y = gAngle;
          panelMesh.castShadow = true;
          panelMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
          view3D.fenceGroup.add(panelMesh);
        }

        // Frame: top rail
        const topRailGeo = new THREE.CylinderGeometry(frameR, frameR, gateWidthM, 6);
        topRailGeo.rotateZ(Math.PI / 2);
        const topRail = new THREE.Mesh(topRailGeo, frameMat);
        topRail.position.set(gateMidX, gateMidY + podhrabH + gatePanelH + 0.05, gateMidZ);
        topRail.rotation.y = gAngle;
        view3D.fenceGroup.add(topRail);

        // Bottom rail
        const botRailGeo = new THREE.CylinderGeometry(frameR, frameR, gateWidthM, 6);
        botRailGeo.rotateZ(Math.PI / 2);
        const botRail = new THREE.Mesh(botRailGeo, frameMat);
        botRail.position.set(gateMidX, gateMidY + podhrabH + 0.05, gateMidZ);
        botRail.rotation.y = gAngle;
        view3D.fenceGroup.add(botRail);

        // Vertical sides
        for (const sideFactor of [-1, 1]) {
          const sideOffX = Math.cos(gAngle) * (gateWidthM / 2 * sideFactor);
          const sideOffZ = -Math.sin(gAngle) * (gateWidthM / 2 * sideFactor);
          const sRail = new THREE.Mesh(new THREE.CylinderGeometry(frameR, frameR, gatePanelH, 6), frameMat);
          sRail.position.set(gateMidX + sideOffX, gatePanelY, gateMidZ + sideOffZ);
          view3D.fenceGroup.add(sRail);
        }

        // Handle (on the right side of branka)
        const handleOffX = Math.cos(gAngle) * (gateWidthM / 2 * 0.85);
        const handleOffZ = -Math.sin(gAngle) * (gateWidthM / 2 * 0.85);
        const hFwdX = Math.sin(gAngle) * 0.03;
        const hFwdZ = Math.cos(gAngle) * 0.03;
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
        const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), handleMat);
        hBar.position.set(gateMidX + handleOffX + hFwdX, gatePanelY, gateMidZ + handleOffZ + hFwdZ);
        hBar.rotation.x = Math.PI / 2;
        hBar.rotation.y = gAngle;
        view3D.fenceGroup.add(hBar);
      }

      // Right zone intermediate posts
      for (let f = 1; f < rightFields; f++) {
        const t = tGateEnd + (f / rightFields) * (1 - tGateEnd);
        const intPost = { x: seg.a.x + dx * t, y: seg.a.y + dy * t };
        const intKey2 = getFieldKey(seg.from, leftFields + f - 1);
        const intColor2 = getIntPostColor3D(seg.from, leftFields + f - 1);
        const intPostVisH2 = getIntPostH(seg.from, leftFields + f - 1, seg) / 100 - 0.70;
        _add3DPost(intPost, seg, { elementType: 'intPost', segIndex: seg.from, intPostIndex: leftFields + f - 1, intKey: intKey2 },
          intColor2, postMat, getSegPostRadius(seg), isSegRound(seg), isBeton, type, intPostVisH2, segments);
      }
    } else {
      for (let f = 1; f < fields; f++) {
        const t = f / fields;
        const intPost = {
          x: seg.a.x + (seg.b.x - seg.a.x) * t,
          y: seg.a.y + (seg.b.y - seg.a.y) * t,
        };
        const intKey = getFieldKey(seg.from, f - 1);
        const intColor = getIntPostColor3D(seg.from, f - 1);
        const intPostVisH = getIntPostH(seg.from, f - 1, seg) / 100 - 0.70;
        _add3DPost(intPost, seg, { elementType: 'intPost', segIndex: seg.from, intPostIndex: f - 1, intKey },
          intColor, postMat, getSegPostRadius(seg), isSegRound(seg), isBeton, type, intPostVisH, segments);
      }
    }

    // Draw end vertex post (if not already drawn)
    if (!drawnVertexPosts.has(seg.to)) {
      drawnVertexPosts.add(seg.to);
      const toPostVisH = getVertexPostH(seg.to) / 100 - 0.70;
      _add3DPost(state.vertices[seg.to], seg, { elementType: 'post', vertexIndex: seg.to },
        getPostColor3D(seg.to), postMat, getSegPostRadius(seg), isSegRound(seg), isBeton, type, toPostVisH, segments);
    }
  }

  function _add3DPost(postCoord, nearSeg, userData, colorOverride3D, defaultMat, postRadius, isRound, isBeton, type, totalFenceH, segments) {
    const p3 = gridTo3D(postCoord.x, postCoord.y);
    let geo;
    if (isRound || type === 'svarovane') {
      geo = new THREE.CylinderGeometry(postRadius, postRadius, totalFenceH + 0.15, 12);
    } else if (isBeton) {
      // Betonový sloupek — wider square post (0.14 × 0.14)
      geo = new THREE.BoxGeometry(0.14, totalFenceH + 0.15, 0.14);
    } else {
      geo = new THREE.BoxGeometry(0.08, totalFenceH + 0.15, 0.06);
    }

    let actualPostMat;
    if (isBeton) {
      // Concrete texture matching fence color
      const betonColor = BETON_COLORS_3D[state.config.betonBarva] || BETON_COLORS_3D.seda;
      const tex = makeConcreteTexture(betonColor);
      actualPostMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.0, roughness: 0.85 });
    } else {
      actualPostMat = new THREE.MeshStandardMaterial({ color: colorOverride3D, metalness: 0.3, roughness: 0.5 });
    }

    const mesh = new THREE.Mesh(geo, actualPostMat);
    mesh.position.set(p3.x, p3.y + (totalFenceH + 0.15) / 2, p3.z);
    mesh.castShadow = true;
    mesh.userData = userData;

    if (!isRound && type !== 'svarovane' && nearSeg) {
      const sa = gridTo3D(nearSeg.a.x, nearSeg.a.y);
      const sb = gridTo3D(nearSeg.b.x, nearSeg.b.y);
      const fdx = sb.x - sa.x;
      const fdz = sb.z - sa.z;
      mesh.rotation.y = Math.atan2(-fdz, fdx);
    }

    view3D.fenceGroup.add(mesh);

    if (isRound || type === 'svarovane') {
      const capGeo = new THREE.SphereGeometry(postRadius * 1.3, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, actualPostMat);
      cap.position.set(p3.x, p3.y + totalFenceH + 0.15 / 2, p3.z);
      view3D.fenceGroup.add(cap);
    }
  }

  // ---- Draw fence panels/mesh between posts ----
  for (const seg of segments) {
    const a3 = gridTo3D(seg.a.x, seg.a.y);
    const b3 = gridTo3D(seg.b.x, seg.b.y);

    const dx = b3.x - a3.x;
    const dz = b3.z - a3.z;
    const segLen = Math.sqrt(dx * dx + dz * dz);
    const rawAngle = Math.atan2(-dz, dx);
    const segStyle = getSegStyle(seg);
    const angle = segStyle.flipped ? rawAngle + Math.PI : rawAngle;

    // Per-segment material
    const segFenceMat = getSeg3DMaterial(seg);
    const segIsBeton = segStyle.fenceType === 'betonovy';
    const segPodhrabH = segStyle.noPodhrab ? 0 : podhrabH;

    // Use getFieldRanges for gate-aware field positions
    const fieldRanges = getFieldRanges(seg);

    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const f0x = a3.x + dx * t0;
      const f0z = a3.z + dz * t0;
      const f1x = a3.x + dx * t1;
      const f1z = a3.z + dz * t1;
      const fMidX = (f0x + f1x) / 2;
      const fMidZ = (f0z + f1z) / 2;
      const fMidY = a3.y + (b3.y - a3.y) * ((t0 + t1) / 2);
      const fieldLen = segLen * (t1 - t0);
      // Per-field color override
      const fieldColorOverride = getFieldColor3D(seg.from, fi, null);
      let fieldMat = segFenceMat;
      if (fieldColorOverride !== null) {
        fieldMat = segFenceMat.clone();
        fieldMat.color = new THREE.Color(fieldColorOverride);
      }
      const fieldFenceHM = getFieldFenceH(seg.from, fi, seg) / 100;
      const fieldTotalH = segPodhrabH + fieldFenceHM;
      addFencePanel(fMidX, fMidZ, fieldLen, fieldTotalH, segPodhrabH, angle, fieldMat, podhrabMat, segIsBeton, segStyle.fenceType, seg.from, fi, fMidY);
    }
  }

  // ---- Držáky podhrabových desek (průběžné + koncové) at post positions ----
  if (podhrabH > 0) {
    const drawnHolderPosts = new Set();
    const holderMatPrubezny = new THREE.MeshStandardMaterial({ color: 0xdd8800, metalness: 0.6, roughness: 0.3 }); // orange-ish for průběžný
    const holderMatKoncovy = new THREE.MeshStandardMaterial({ color: 0x2288dd, metalness: 0.6, roughness: 0.3 });  // blue for koncový

    for (const seg of segments) {
      const ss = getSegStyle(seg);
      if (ss.noPodhrab) continue;
      const segTyp = ss.typSloupku || cfg.typSloupku;
      const isRoundSeg = segTyp === 'kulate_38' || segTyp === 'kulate_48';
      if (!isRoundSeg) continue; // holders only on round posts

      const a3h = gridTo3D(seg.a.x, seg.a.y);
      const b3h = gridTo3D(seg.b.x, seg.b.y);
      const hdx = b3h.x - a3h.x;
      const hdz = b3h.z - a3h.z;
      const hAngle = Math.atan2(-hdz, hdx);
      const segPodhrabH = podhrabH;
      const fields = seg.fields;
      const lastVtx = state.vertices.length - 1;

      // Collect all post positions along this segment
      const postPositions = [];
      // Start post
      postPositions.push({ pos: a3h, t: 0, key: 'v' + seg.from, isVertex: true, idx: seg.from });
      // Intermediate posts (gate-aware)
      if (seg.gate) {
        const tGateStart = seg.gateStartM / seg.lengthM;
        const tGateEnd = seg.gateEndM / seg.lengthM;
        // Left zone
        for (let f = 1; f < seg.leftFields; f++) {
          const t = (f / seg.leftFields) * tGateStart;
          const px = a3h.x + hdx * t;
          const pz = a3h.z + hdz * t;
          const py = a3h.y + (b3h.y - a3h.y) * t;
          postPositions.push({ pos: { x: px, y: py, z: pz }, t, key: 'i' + seg.from + '_L' + (f - 1), isVertex: false });
        }
        // Gate start post and gate end post — skip holders here (gate zone)
        // Right zone
        for (let f = 1; f < seg.rightFields; f++) {
          const t = tGateEnd + (f / seg.rightFields) * (1 - tGateEnd);
          const px = a3h.x + hdx * t;
          const pz = a3h.z + hdz * t;
          const py = a3h.y + (b3h.y - a3h.y) * t;
          postPositions.push({ pos: { x: px, y: py, z: pz }, t, key: 'i' + seg.from + '_R' + (f - 1), isVertex: false });
        }
      } else {
        for (let f = 1; f < fields; f++) {
          const t = f / fields;
          const px = a3h.x + hdx * t;
          const pz = a3h.z + hdz * t;
          const py = a3h.y + (b3h.y - a3h.y) * t;
          postPositions.push({ pos: { x: px, y: py, z: pz }, t, key: 'i' + seg.from + '_' + (f - 1), isVertex: false });
        }
      }
      // End post
      postPositions.push({ pos: b3h, t: 1, key: 'v' + seg.to, isVertex: true, idx: seg.to });

      for (let pi = 0; pi < postPositions.length; pi++) {
        const pp = postPositions[pi];
        if (drawnHolderPosts.has(pp.key)) continue;
        drawnHolderPosts.add(pp.key);

        // Determine if this is a koncový or průběžný position
        let isKoncovy = false;
        if (pp.isVertex) {
          const vi = pp.idx;
          isKoncovy = vi === 0 || vi === lastVtx || state.pathBreaks.has(vi - 1) || state.pathBreaks.has(vi) || isCorner(vi);
        }

        const mat = isKoncovy ? holderMatKoncovy : holderMatPrubezny;
        const px = pp.pos.x;
        const py = pp.pos.y || 0;
        const pz = pp.pos.z;
        const segPR = getSegPostRadius(seg);
        const boardThick = 0.04;

        if (isKoncovy) {
          // Koncový holder: L-shaped bracket on one side of the post
          // Vertical plate behind the board
          const plateH = segPodhrabH * 0.85;
          const plateW = 0.06;
          const plateD = 0.004;
          const plateGeo = new THREE.BoxGeometry(plateD, plateH, plateW);
          const plate = new THREE.Mesh(plateGeo, mat);
          const offsetX = Math.sin(hAngle) * (boardThick / 2 + 0.005);
          const offsetZ = Math.cos(hAngle) * (boardThick / 2 + 0.005);
          plate.position.set(px + offsetX, py + segPodhrabH * 0.45, pz + offsetZ);
          plate.rotation.y = hAngle;
          view3D.fenceGroup.add(plate);

          // Small horizontal lip at bottom (holds board from below)
          const lipGeo = new THREE.BoxGeometry(0.02, 0.004, plateW);
          const lip = new THREE.Mesh(lipGeo, mat);
          lip.position.set(px + offsetX * 0.5, py + segPodhrabH * 0.02, pz + offsetZ * 0.5);
          lip.rotation.y = hAngle;
          view3D.fenceGroup.add(lip);
        } else {
          // Průběžný holder: U-channel that wraps around the post + board passes through
          // Two vertical arms on each side of the post
          const armH = segPodhrabH * 0.85;
          const armW = 0.05;
          const armD = 0.004;
          const armGeo = new THREE.BoxGeometry(armD, armH, armW);
          const armSpacing = segPR + 0.006; // post radius + small gap

          // Front arm
          const fArmX = px + Math.sin(hAngle) * armSpacing;
          const fArmZ = pz + Math.cos(hAngle) * armSpacing;
          const armF = new THREE.Mesh(armGeo, mat);
          armF.position.set(fArmX, py + segPodhrabH * 0.45, fArmZ);
          armF.rotation.y = hAngle;
          view3D.fenceGroup.add(armF);

          // Back arm
          const bArmX = px - Math.sin(hAngle) * armSpacing;
          const bArmZ = pz - Math.cos(hAngle) * armSpacing;
          const armB = new THREE.Mesh(armGeo, mat);
          armB.position.set(bArmX, py + segPodhrabH * 0.45, bArmZ);
          armB.rotation.y = hAngle;
          view3D.fenceGroup.add(armB);

          // Connecting bridge across the top (holds both arms together, wraps over post)
          const bridgeGeo = new THREE.BoxGeometry(armSpacing * 2, 0.004, armW);
          const bridge = new THREE.Mesh(bridgeGeo, mat);
          bridge.position.set(px, py + segPodhrabH * 0.87, pz);
          bridge.rotation.y = hAngle;
          view3D.fenceGroup.add(bridge);
        }
      }
    }
  }

  // ---- Stínicí tkanina (shade cloth) 3D ----
  for (const seg of segments) {
    const hasSegShade = !!state.shadeCloth[seg.from];
    const hasGateShade = seg.gate && seg.gate.shadeCloth;
    if (!hasSegShade && !hasGateShade) continue;

    const a3s = gridTo3D(seg.a.x, seg.a.y);
    const b3s = gridTo3D(seg.b.x, seg.b.y);
    const sdx = b3s.x - a3s.x;
    const sdz = b3s.z - a3s.z;
    const sLen = Math.sqrt(sdx * sdx + sdz * sdz);
    const sAngle = Math.atan2(-sdz, sdx);
    const segStyle = getSegStyle(seg);
    const shadeOff = segStyle.flipped ? -0.05 : 0.05;
    const offX = Math.sin(sAngle) * shadeOff;
    const offZ = Math.cos(sAngle) * shadeOff;
    const segPodhH = segStyle.noPodhrab ? 0 : podhrabH;
    const segFenceHM = getSegFenceH(seg) / 100;
    const sTotalH = segPodhH + segFenceHM;
    const gapM = 0.05;
    const clothH = Math.max(sTotalH - gapM * 2, 0.1);
    const baseY = ((a3s.y + b3s.y) / 2) + segPodhH + gapM + clothH / 2;
    const shadeColor = getShadeClothColor3D(seg.from);

    // Helper to add a shade cloth box between t0 and t1 (parametric along segment)
    function _addShadeBox(t0, t1, color, userData) {
      const x0 = a3s.x + sdx * t0;
      const z0 = a3s.z + sdz * t0;
      const x1 = a3s.x + sdx * t1;
      const z1 = a3s.z + sdz * t1;
      const w = sLen * (t1 - t0);
      if (w < 0.01) return;
      const mx = (x0 + x1) / 2 + offX;
      const mz = (z0 + z1) / 2 + offZ;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0 });
      const geo = new THREE.BoxGeometry(w, clothH, 0.01);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(mx, baseY, mz);
      mesh.rotation.y = sAngle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = userData;
      view3D.fenceGroup.add(mesh);
      return mesh;
    }

    if (hasSegShade && seg.gate) {
      // Segment has shade cloth AND a gate → split into left + right parts
      const tGS = seg.gateStartM / seg.lengthM;
      const tGE = seg.gateEndM / seg.lengthM;
      // Left part: 0 → tGateStart
      if (tGS > 0.01) {
        const m = _addShadeBox(0, tGS, shadeColor, { elementType: 'shadeCloth', segmentIndex: seg.from });
        if (m && state.selectedShadeCloth.has(seg.from)) {
          const oGeo = new THREE.BoxGeometry(sLen * tGS + 0.04, clothH + 0.04, 0.015);
          const oMat = new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
          const oMesh = new THREE.Mesh(oGeo, oMat);
          oMesh.position.copy(m.position);
          oMesh.rotation.y = sAngle;
          oMesh.userData = { _outline: true };
          view3D.fenceGroup.add(oMesh);
        }
      }
      // Right part: tGateEnd → 1
      if (tGE < 0.99) {
        const m = _addShadeBox(tGE, 1, shadeColor, { elementType: 'shadeCloth', segmentIndex: seg.from });
        if (m && state.selectedShadeCloth.has(seg.from)) {
          const oGeo = new THREE.BoxGeometry(sLen * (1 - tGE) + 0.04, clothH + 0.04, 0.015);
          const oMat = new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
          const oMesh = new THREE.Mesh(oGeo, oMat);
          oMesh.position.copy(m.position);
          oMesh.rotation.y = sAngle;
          oMesh.userData = { _outline: true };
          view3D.fenceGroup.add(oMesh);
        }
      }
    } else if (hasSegShade) {
      // No gate on segment → full width shade cloth
      const m = _addShadeBox(0, 1, shadeColor, { elementType: 'shadeCloth', segmentIndex: seg.from });
      if (m && state.selectedShadeCloth.has(seg.from)) {
        const oGeo = new THREE.BoxGeometry(sLen + 0.04, clothH + 0.04, 0.015);
        const oMat = new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        const oMesh = new THREE.Mesh(oGeo, oMat);
        oMesh.position.copy(m.position);
        oMesh.rotation.y = sAngle;
        oMesh.userData = { _outline: true };
        view3D.fenceGroup.add(oMesh);
      }
    }

    // Gate shade cloth: matches gate panel, inset from posts
    if (hasGateShade && seg.gate) {
      const tGS = seg.gateStartM / seg.lengthM;
      const tGE = seg.gateEndM / seg.lengthM;
      const gateH = (seg.gate.height || cfg.height) / 100;
      const gatePanelH = gateH - 0.05; // gate height minus 5cm bottom clearance gap
      const gateWidthM = seg.gate.width / 100;
      const postInset = 0.06;
      const clothW = Math.max(gateWidthM - postInset * 2, 0.05);
      const gateShadeColor = SHADE_COLORS_3D[seg.gate.shadeClothBarva] || SHADE_COLORS_3D.zelena;

      // Compute from gate post 3D positions (same as gate panel code)
      const gp1s = { x: seg.a.x + (seg.b.x - seg.a.x) * tGS, y: seg.a.y + (seg.b.y - seg.a.y) * tGS };
      const gp2s = { x: seg.a.x + (seg.b.x - seg.a.x) * tGE, y: seg.a.y + (seg.b.y - seg.a.y) * tGE };
      const gp1_3ds = gridTo3D(gp1s.x, gp1s.y);
      const gp2_3ds = gridTo3D(gp2s.x, gp2s.y);
      const gMidY = (gp1_3ds.y + gp2_3ds.y) / 2;
      const gatePanelY = gMidY + podhrabH + gatePanelH / 2 + 0.05;

      const gmx = (gp1_3ds.x + gp2_3ds.x) / 2 + offX;
      const gmz = (gp1_3ds.z + gp2_3ds.z) / 2 + offZ;

      const gMat = new THREE.MeshStandardMaterial({ color: gateShadeColor, roughness: 0.85, metalness: 0.0 });

      const isBrana = seg.gate.type === 'brana';
      if (isBrana) {
        // Two halves with 5cm gap in the middle
        const gapM = 0.05;
        const halfW = (clothW - gapM) / 2;
        if (halfW > 0.01) {
          const dirX = Math.cos(sAngle);
          const dirZ = -Math.sin(sAngle);
          const offsetDist = (halfW / 2 + gapM / 2);
          for (const sign of [-1, 1]) {
            const hGeo = new THREE.BoxGeometry(halfW, gatePanelH, 0.01);
            const hMesh = new THREE.Mesh(hGeo, gMat);
            hMesh.position.set(
              gmx + dirX * offsetDist * sign,
              gatePanelY,
              gmz + dirZ * offsetDist * sign
            );
            hMesh.rotation.y = sAngle;
            hMesh.castShadow = true;
            hMesh.receiveShadow = true;
            hMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
            view3D.fenceGroup.add(hMesh);
          }
        }
      } else {
        const gGeo = new THREE.BoxGeometry(clothW, gatePanelH, 0.01);
        const gMesh = new THREE.Mesh(gGeo, gMat);
        gMesh.position.set(gmx, gatePanelY, gmz);
        gMesh.rotation.y = sAngle;
        gMesh.castShadow = true;
        gMesh.receiveShadow = true;
        gMesh.userData = { elementType: 'gate', segmentIndex: seg.from };
        view3D.fenceGroup.add(gMesh);
      }
    }
  }

  // ---- Příchytky na napínací drát (3D) ----
  if (type.startsWith('ctyrhranne') || type === 'svarovane') {
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
    // Larger clip geometry: width along fence, height, depth outward from post
    const clipGeo = new THREE.BoxGeometry(0.06, 0.04, 0.05);

    for (const seg of segments) {
      const segStyle = getSegStyle(seg);
      const ft = segStyle.fenceType;
      if (!ft.startsWith('ctyrhranne') && ft !== 'svarovane') continue;

      const a3c = gridTo3D(seg.a.x, seg.a.y);
      const b3c = gridTo3D(seg.b.x, seg.b.y);
      const cdx = b3c.x - a3c.x;
      const cdz = b3c.z - a3c.z;
      const cLen = Math.sqrt(cdx * cdx + cdz * cdz);
      const cAngle = Math.atan2(-cdz, cdx);
      // Perpendicular offset direction (outward from fence face)
      const perpX = (cLen > 0) ? (-cdz / cLen) * 0.05 : 0;
      const perpZ = (cLen > 0) ? (cdx / cLen) * 0.05 : 0;

      // Per-segment wire positions for clips
      const segFenceHM = getSegFenceH(seg) / 100;
      const segPodH = getSegPodhrabH(seg) / 100;
      const segMeshGap = segPodH > 0 ? 0.04 : 0.05; // gap above podhrab or ground
      const wireTop3D = segPodH + segMeshGap + segFenceHM - 0.05;
      const wireBottom3D = segPodH + segMeshGap + 0.05;
      const wirePositions3D = [wireTop3D, wireBottom3D];
      if (getSegWireCount(seg) === 3) wirePositions3D.push((wireTop3D + wireBottom3D) / 2);

      // Collect post t-values with clip keys for this segment
      const fieldRanges = getFieldRanges(seg);
      const postTsWithKeys = [{ t: 0, clipKey: getClipKey('v', seg.from) }];
      for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
        postTsWithKeys.push({ t: fieldRanges[fi].t1, clipKey: getClipKey('i', seg.from, fi) });
      }
      postTsWithKeys.push({ t: 1, clipKey: getClipKey('v', seg.to) });

      for (const { t: pt, clipKey } of postTsWithKeys) {
        const ppx = a3c.x + cdx * pt;
        const ppz = a3c.z + cdz * pt;
        const ppyTerrain = a3c.y + (b3c.y - a3c.y) * pt;
        const clipColor3D = getClipColor3D(clipKey);
        const thisClipMat = (clipColor3D !== 0x444444)
          ? new THREE.MeshStandardMaterial({ color: clipColor3D, metalness: 0.7, roughness: 0.3 })
          : clipMat;
        for (const wy of wirePositions3D) {
          // Place clip on one side of the post
          const clip = new THREE.Mesh(clipGeo, thisClipMat);
          clip.position.set(ppx + perpX, ppyTerrain + wy, ppz + perpZ);
          clip.rotation.y = cAngle;
          clip.castShadow = true;
          view3D.fenceGroup.add(clip);
        }
      }
    }
  }

  // ---- Concrete foundations ----
  {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.7 });
    const normalR = 0.12; // radius for normal posts
    const gateR = 0.16;   // larger radius for gate posts
    const concreteH = 0.08; // height of disc

    // Gather gate post world positions
    const gatePostSet = new Set();
    for (const gate of state.gates) {
      const seg = findSegByFrom(segments, gate.segmentIndex);
      if (!seg) continue;
      const gateCenterT = getGateCenterT(gate, seg.lengthM);
      const gateWidthM = gate.width / 100;
      const halfGateT = (gateWidthM / 2) / seg.lengthM;
      const tStart = Math.max(0, gateCenterT - halfGateT);
      const tEnd = Math.min(1, gateCenterT + halfGateT);
      const gp1 = { x: seg.a.x + (seg.b.x - seg.a.x) * tStart, y: seg.a.y + (seg.b.y - seg.a.y) * tStart };
      const gp2 = { x: seg.a.x + (seg.b.x - seg.a.x) * tEnd, y: seg.a.y + (seg.b.y - seg.a.y) * tEnd };
      [gp1, gp2].forEach(gp => {
        const p3 = gridTo3D(gp.x, gp.y);
        const geo = new THREE.CylinderGeometry(gateR, gateR, concreteH, 16);
        const mesh = new THREE.Mesh(geo, concreteMat);
        mesh.position.set(p3.x, p3.y + concreteH / 2 - 0.02, p3.z);
        view3D.fenceGroup.add(mesh);
        gatePostSet.add(`${gp.x.toFixed(4)},${gp.y.toFixed(4)}`);
      });
    }

    const normalGeo = new THREE.CylinderGeometry(normalR, normalR, concreteH, 16);

    // Vertex posts
    for (let i = 0; i < state.vertices.length; i++) {
      const v = state.vertices[i];
      const key = `${v.x.toFixed(4)},${v.y.toFixed(4)}`;
      if (gatePostSet.has(key)) continue;
      const p3 = gridTo3D(v.x, v.y);
      const mesh = new THREE.Mesh(normalGeo, concreteMat);
      mesh.position.set(p3.x, p3.y + concreteH / 2 - 0.02, p3.z);
      view3D.fenceGroup.add(mesh);
    }

    // Intermediate posts
    for (const seg of segments) {
      const fieldRanges = getFieldRanges(seg);
      for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
        const t = fieldRanges[fi].t1;
        const px = seg.a.x + (seg.b.x - seg.a.x) * t;
        const py = seg.a.y + (seg.b.y - seg.a.y) * t;
        const key = `${px.toFixed(4)},${py.toFixed(4)}`;
        if (gatePostSet.has(key)) continue;
        const p3 = gridTo3D(px, py);
        const mesh = new THREE.Mesh(normalGeo, concreteMat);
        mesh.position.set(p3.x, p3.y + concreteH / 2 - 0.02, p3.z);
        view3D.fenceGroup.add(mesh);
      }
    }
  }

  // ---- Struts ----
  const hasStruts3D = (state.fenceType === 'ctyrhranne_bez_nd' || state.fenceType === 'ctyrhranne_s_nd' || state.fenceType === 'svarovane');
  if (hasStruts3D) {
    const struts = getStrutPositions(segments);
    for (let _si = 0; _si < struts.length; _si++) {
      const strut = struts[_si];
      const p3 = gridTo3D(strut.wx, strut.wy);

      // Determine per-strut podhrabH by finding the segment the strut points TOWARD
      // (not just nearest segment). This correctly handles corners where one arm has
      // podhrabové desky and the other doesn't.
      let strutPodhrabH = 0;
      {
        // Trace a short distance along the strut's 2D direction to find which segment it belongs to
        const probeLen = 0.5; // 0.5m probe along strut direction
        const probeTipX = strut.wx + Math.cos(strut.angle2D) * probeLen;
        const probeTipY = strut.wy + Math.sin(strut.angle2D) * probeLen;

        let bestSeg = null, bestDist = Infinity;
        for (const seg of segments) {
          // Point-to-segment distance from probe tip
          const ax = seg.a.x, ay = seg.a.y, bx = seg.b.x, by = seg.b.y;
          const abx = bx - ax, aby = by - ay;
          const apx = probeTipX - ax, apy = probeTipY - ay;
          const abLen2 = abx * abx + aby * aby;
          if (abLen2 < 0.0001) continue;
          const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
          const closestX = ax + abx * t, closestY = ay + aby * t;
          const d = Math.hypot(probeTipX - closestX, probeTipY - closestY);
          if (d < bestDist) { bestDist = d; bestSeg = seg; }
        }
        if (bestSeg) {
          const ss = getSegStyle(bestSeg);
          strutPodhrabH = ss.noPodhrab ? 0 : (ss.podhrabVyska / 100);
        }
      }

      // angle2D is pre-computed in getStrutPositions (Math.atan2(dy_grid, dx_grid))
      // Convert to 3D strutAngle = atan2(dx_3d, dz_3d) = atan2(cos(angle2D), sin(angle2D))
      const strutAngle = Math.atan2(Math.cos(strut.angle2D), Math.sin(strut.angle2D));

      const strutLen = totalFenceH * 1.2;
      const tiltAngle = Math.PI / 6; // 30° from vertical

      // Per-strut color
      const strutColor3D = getStrutColor3D(strut);
      const thisStrutMat = strutColor3D !== null
        ? new THREE.MeshStandardMaterial({ color: strutColor3D, metalness: 0.5, roughness: 0.4 })
        : strutMat;

      // Strut tube
      const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, strutLen, 6);
      const strutMesh = new THREE.Mesh(strutGeo, thisStrutMat);
      strutMesh.userData = { elementType: 'strut', strutIndex: _si };

      // Position: starts at post top, goes down at angle
      // When gravel board present, strut lands on top of it (not through it)
      const strutEndY = p3.y + (strutPodhrabH > 0 ? strutPodhrabH : 0);
      const effectiveStrutLen = strutPodhrabH > 0 ? (totalFenceH * 0.75 - strutPodhrabH) / Math.cos(tiltAngle) : strutLen;
      const endX = p3.x + Math.sin(strutAngle) * Math.sin(tiltAngle) * effectiveStrutLen;
      const endZ = p3.z + Math.cos(strutAngle) * Math.sin(tiltAngle) * effectiveStrutLen;
      const endY = strutEndY;
      const startY = p3.y + totalFenceH * 0.75;

      strutMesh.position.set(
        (p3.x + endX) / 2,
        (startY + endY) / 2,
        (p3.z + endZ) / 2
      );

      // Orient strut
      const dir = new THREE.Vector3(endX - p3.x, endY - startY, endZ - p3.z);
      const actualLen = dir.length();
      dir.normalize();
      strutMesh.scale.y = actualLen / strutLen;
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      strutMesh.setRotationFromQuaternion(quat);
      strutMesh.castShadow = true;
      view3D.fenceGroup.add(strutMesh);

      if (strutPodhrabH > 0) {
        // Bracket (držák) embracing gravel board from both sides - very light color
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, metalness: 0.5, roughness: 0.3 });
        const boardThickness = 0.04; // gravel board is 4cm thick
        const halfBoard = boardThickness / 2;

        // Horizontal top plate sitting on gravel board (spans full width + overhang)
        const bracketTopGeo = new THREE.BoxGeometry(0.08, 0.005, 0.10);
        const bracketTop = new THREE.Mesh(bracketTopGeo, bracketMat);
        bracketTop.position.set(endX, p3.y + strutPodhrabH + 0.0025, endZ);
        bracketTop.rotation.y = strutAngle;
        view3D.fenceGroup.add(bracketTop);

        // Front & back tabs wrapping down both sides of the gravel board
        const tabHeight = 0.06;
        const tabGeo = new THREE.BoxGeometry(0.004, tabHeight, 0.10);

        // Perpendicular offset to reach each face of the board
        const perpX = Math.sin(strutAngle) * (halfBoard + 0.002);
        const perpZ = Math.cos(strutAngle) * (halfBoard + 0.002);

        // Front tab (one side of board)
        const tabFront = new THREE.Mesh(tabGeo, bracketMat);
        tabFront.position.set(endX + perpX, p3.y + strutPodhrabH - tabHeight / 2, endZ + perpZ);
        tabFront.rotation.y = strutAngle;
        view3D.fenceGroup.add(tabFront);

        // Back tab (other side of board)
        const tabBack = new THREE.Mesh(tabGeo, bracketMat);
        tabBack.position.set(endX - perpX, p3.y + strutPodhrabH - tabHeight / 2, endZ - perpZ);
        tabBack.rotation.y = strutAngle;
        view3D.fenceGroup.add(tabBack);

        // Small bottom lip on each tab (hooks under the board edges)
        const lipGeo = new THREE.BoxGeometry(0.012, 0.004, 0.10);
        const lipFront = new THREE.Mesh(lipGeo, bracketMat);
        lipFront.position.set(
          endX + perpX - Math.sin(strutAngle) * 0.006,
          p3.y + strutPodhrabH - tabHeight - 0.002,
          endZ + perpZ - Math.cos(strutAngle) * 0.006
        );
        lipFront.rotation.y = strutAngle;
        view3D.fenceGroup.add(lipFront);

        const lipBack = new THREE.Mesh(lipGeo, bracketMat);
        lipBack.position.set(
          endX - perpX + Math.sin(strutAngle) * 0.006,
          p3.y + strutPodhrabH - tabHeight - 0.002,
          endZ - perpZ + Math.cos(strutAngle) * 0.006
        );
        lipBack.rotation.y = strutAngle;
        view3D.fenceGroup.add(lipBack);

        // Bolt through gravel board (horizontal, perpendicular to fence)
        const boltGeo = new THREE.CylinderGeometry(0.005, 0.005, boardThickness + 0.02, 6);
        const boltMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(endX, p3.y + strutPodhrabH - 0.025, endZ);
        bolt.rotation.z = Math.PI / 2;
        bolt.rotation.y = strutAngle;
        view3D.fenceGroup.add(bolt);
      } else {
        // Ground anchor (only when no gravel board)
        const anchorGeo = new THREE.SphereGeometry(0.05, 6, 6);
        const anchor = new THREE.Mesh(anchorGeo, thisStrutMat);
        anchor.userData = { elementType: 'strut', strutIndex: _si };
        anchor.position.set(endX, p3.y + 0.02, endZ);
        view3D.fenceGroup.add(anchor);
      }

      // Concrete foundation at strut foot (only when strut goes to ground)
      if (strutPodhrabH === 0) {
        const strutConcreteMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.7 });
        const strutConcreteGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12);
        const strutConcrete = new THREE.Mesh(strutConcreteGeo, strutConcreteMat);
        strutConcrete.position.set(endX, p3.y + 0.02, endZ);
        view3D.fenceGroup.add(strutConcrete);
      }
    }
  }

  // ---- Binding wires (vázací drát) per-field ----
  if (type.startsWith('ctyrhranne') || type === 'svarovane') {
    for (const seg of segments) {
      const a3 = gridTo3D(seg.a.x, seg.a.y);
      const b3 = gridTo3D(seg.b.x, seg.b.y);
      const dx = b3.x - a3.x;
      const dz = b3.z - a3.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(-dz, dx);

      const fieldRanges = getFieldRanges(seg);
      for (let fi = 0; fi < fieldRanges.length; fi++) {
        const { t0, t1 } = fieldRanges[fi];
        const f0x = a3.x + dx * t0;
        const f0z = a3.z + dz * t0;
        const f1x = a3.x + dx * t1;
        const f1z = a3.z + dz * t1;
        const fMidX = (f0x + f1x) / 2;
        const fMidZ = (f0z + f1z) / 2;
        const fieldLen = segLen * (t1 - t0);
        const wireKey = getFieldKey(seg.from, fi);

        // Wire color per field
        const wireHex = getWireColor3D(seg.from, fi);
        const wireMat = new THREE.MeshBasicMaterial({ color: wireHex });

        // Wire positions: per-segment height, 5cm from top/bottom of fence part (above podhrab + gap)
        const segPodHW = getSegPodhrabH(seg) / 100;
        const segFenceHW = getSegFenceH(seg) / 100;
        const segMeshGapW = segPodHW > 0 ? 0.04 : 0.05; // gap above podhrab or ground
        const wireTop = segPodHW + segMeshGapW + segFenceHW - 0.05;
        const wireBottom = segPodHW + segMeshGapW + 0.05;
        const wirePositions = [wireTop, wireBottom];

        // Add middle wires based on fence height
        const segH = getSegFenceH(seg);
        if (segH > 180) {
          // 4 wires: evenly spaced
          const span = wireTop - wireBottom;
          wirePositions.push(wireBottom + span / 3);
          wirePositions.push(wireBottom + 2 * span / 3);
        } else if (segH > 125) {
          wirePositions.push((wireTop + wireBottom) / 2);
        }

        for (const wy of wirePositions) {
          const wireGeo = new THREE.CylinderGeometry(0.01, 0.01, fieldLen, 4);
          wireGeo.rotateZ(Math.PI / 2);
          const wire = new THREE.Mesh(wireGeo, wireMat);
          const wireTY = a3.y + (b3.y - a3.y) * ((t0 + t1) / 2);
          wire.position.set(fMidX, wireTY + wy, fMidZ);
          wire.rotation.y = angle;
          wire.userData = { elementType: 'wire', segmentIndex: seg.from, fieldIndex: fi, wireKey };
          view3D.fenceGroup.add(wire);
        }
      }
    }
  }

  // ---- Ratchets (ráčny) on tensioning wires at strut positions ----
  if (!isPanels && (type.startsWith('ctyrhranne') || type === 'svarovane')) {
    const struts = getStrutPositions(segments);
    // Dynamic offset from post center based on post type
    const ratchetOffset = isRound
      ? (postRadius + 0.06)  // round post: radius + 6cm gap
      : (0.06 + 0.05);       // square post: half-width + 5cm gap

    // Group struts by post position (wx, wy) to know strut side
    const strutsByPost = {};
    for (const strut of struts) {
      const postKey = `${strut.wx.toFixed(3)},${strut.wy.toFixed(3)}`;
      if (!strutsByPost[postKey]) strutsByPost[postKey] = [];
      strutsByPost[postKey].push(strut);
    }

    for (const postKey of Object.keys(strutsByPost)) {
      const postStruts = strutsByPost[postKey];
      const strut0 = postStruts[0];
      const postP3 = gridTo3D(strut0.wx, strut0.wy);

      // Find which segment this post belongs to (for wire heights)
      let nearSeg = null, minD = Infinity;
      for (const seg of segments) {
        const d1 = Math.hypot(strut0.wx - seg.a.x, strut0.wy - seg.a.y);
        const d2 = Math.hypot(strut0.wx - seg.b.x, strut0.wy - seg.b.y);
        const d = Math.min(d1, d2);
        if (d < minD) { minD = d; nearSeg = seg; }
      }
      if (!nearSeg) continue;

      const segPodHR = getSegPodhrabH(nearSeg) / 100;
      const segFenceHR = getSegFenceH(nearSeg) / 100;
      const segMeshGapR = segPodHR > 0 ? 0.04 : 0.05; // gap above podhrab or ground
      const rWireTop = segPodHR + segMeshGapR + segFenceHR - 0.05;
      const rWireBottom = segPodHR + segMeshGapR + 0.05;
      const rWirePositions = [rWireTop, rWireBottom];
      const nearSegH = getSegFenceH(nearSeg);
      if (nearSegH > 180) {
        const span = rWireTop - rWireBottom;
        rWirePositions.push(rWireBottom + span / 3);
        rWirePositions.push(rWireBottom + 2 * span / 3);
      } else if (nearSegH > 125) {
        rWirePositions.push((rWireTop + rWireBottom) / 2);
      }

      // Ratchet color (same as clip colors - default green)
      const ratchetHex = getClipColor3D(`v:${strut0.vertexIndex >= 0 ? strut0.vertexIndex : postKey}`);
      const ratchetMat = new THREE.MeshStandardMaterial({ color: ratchetHex, metalness: 0.5, roughness: 0.35 });

      // For each strut at this post, place ratchets on its side
      for (const strut of postStruts) {
        const strutAngleR = Math.atan2(Math.cos(strut.angle2D), Math.sin(strut.angle2D));
        const rX = postP3.x + Math.sin(strutAngleR) * ratchetOffset;
        const rZ = postP3.z + Math.cos(strutAngleR) * ratchetOffset;

        for (const rwy of rWirePositions) {
          // Ratchet: visible oval-rectangular shape (~5cm x 3cm x 3cm)
          const ratchetGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
          const ratchet = new THREE.Mesh(ratchetGeo, ratchetMat);
          ratchet.position.set(rX, postP3.y + rwy, rZ);
          ratchet.rotation.y = strutAngleR;
          view3D.fenceGroup.add(ratchet);
        }
      }
    }
  }

  // ---- Center camera on fence only on first build ----
  if (!view3D.cameraInitialized) {
    autoFrame3D();
    view3D.cameraInitialized = true;
  }

  // ---- 3D Detailed dimensions ----
  if (state.showDimensions) {
    add3DDimensions(segments, cfg, type, totalFenceH, podhrabH);
  }

  // ---- 3D Walls ----
  build3DWalls();

  // ---- 3D Selection outlines ----
  add3DSelectionOutlines();
}

function build3DWalls() {
  if (!view3D.fenceGroup) return;
  const allWalls = [...state.walls];
  if (state.wallDrawing && state.wallDrawing.vertices.length >= 2) {
    allWalls.push({
      vertices: state.wallDrawing.vertices,
      thickness: state.wallConfig.thickness,
      height: state.wallConfig.height,
      barva: state.wallConfig.barva,
    });
  }
  for (const wall of allWalls) {
    if (wall.vertices.length < 2) continue;
    const heightM = wall.height / 100;
    const thickM = wall.thickness / 100;
    const color3d = WALL_COLORS_3D[wall.barva] || 0xbdc3c7;
    const mat = new THREE.MeshStandardMaterial({ color: color3d, roughness: 0.8, metalness: 0.1 });

    for (let i = 0; i < wall.vertices.length - 1; i++) {
      const a = wall.vertices[i];
      const b = wall.vertices[i + 1];
      const a3 = gridTo3D(a.x, a.y);
      const b3 = gridTo3D(b.x, b.y);
      const dx = b3.x - a3.x;
      const dz = b3.z - a3.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      if (segLen < 0.01) continue;

      const geo = new THREE.BoxGeometry(segLen, heightM, thickM);
      const mesh = new THREE.Mesh(geo, mat);
      const mx = (a3.x + b3.x) / 2;
      const mz = (a3.z + b3.z) / 2;
      const myTerrain = (a3.y + b3.y) / 2;
      mesh.position.set(mx, myTerrain + heightM / 2, mz);
      mesh.rotation.y = Math.atan2(-dz, dx);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      view3D.fenceGroup.add(mesh);
    }
  }
}

// ============================================================
// 3D HOUSES
// ============================================================
function _makeHousePlasterTexture(baseColor, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const cx = c.getContext('2d');
  // Base color
  cx.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  cx.fillRect(0, 0, size, size);
  // Perlin-like noise for plaster
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n1 = Math.sin(x * 0.15) * Math.cos(y * 0.13) * 0.5 + 0.5;
      const n2 = Math.sin(x * 0.37 + y * 0.29) * 0.5 + 0.5;
      const n3 = Math.sin(x * 0.73 + 1.5) * Math.cos(y * 0.61 + 2.3) * 0.5 + 0.5;
      const noise = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
      const brightness = Math.floor((noise - 0.5) * 30);
      cx.fillStyle = `rgba(${brightness > 0 ? 0 : 255}, ${brightness > 0 ? 0 : 255}, ${brightness > 0 ? 0 : 255}, ${Math.abs(brightness) / 255 * 0.35})`;
      cx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function build3DHouses() {
  if (!view3D.fenceGroup) return;
  for (const house of state.houses) {
    if (!house.vertices || house.vertices.length < 3) continue;
    const heightM = house.height / 100;

    // Compute bounding box & centroid
    const xs = house.vertices.map(v => v.x);
    const ys = house.vertices.map(v => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const widthM = (maxX - minX) * GRID_M;
    const depthM = (maxY - minY) * GRID_M;
    if (widthM < 0.3 && depthM < 0.3) continue;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const c3 = gridTo3D(cx, cy);
    const baseY = c3.y;

    // Wall & roof color
    const wallColor = HOUSE_COLORS_3D[house.barva] || 0xecf0f1;
    const roofColor = HOUSE_ROOF_COLORS_3D[house.roofBarva] || 0x8b4513;

    // Build THREE.Shape from polygon vertices (XZ plane mapped to XY for Shape)
    const shape = new THREE.Shape();
    // Convert house vertices to 3D-relative coordinates (centered on c3)
    const pts3D = house.vertices.map(v => {
      const p = gridTo3D(v.x, v.y);
      return { x: p.x - c3.x, z: p.z - c3.z };
    });
    shape.moveTo(pts3D[0].x, -pts3D[0].z);
    for (let i = 1; i < pts3D.length; i++) {
      shape.lineTo(pts3D[i].x, -pts3D[i].z);
    }
    shape.closePath();

    // ---- Walls (extruded polygon) ----
    const plasterTex = _makeHousePlasterTexture(wallColor, 128);
    plasterTex.repeat.set(Math.max(widthM, depthM) / 2, heightM / 2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: plasterTex, roughness: 0.85, metalness: 0.05,
    });
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
    // Extrude goes along Z by default, rotate to Y axis
    wallGeo.rotateX(-Math.PI / 2);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(c3.x, baseY, c3.z);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    view3D.fenceGroup.add(wallMesh);

    // ---- Roof (follows polygon shape) ----
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide,
    });
    const roofOverhang = 0.15;

    // Build overhang shape (polygon expanded outward)
    function _expandShape(ptsArr, amt) {
      // Compute centroid
      let ecx = 0, ecz = 0;
      for (const p of ptsArr) { ecx += p.x; ecz += p.z; }
      ecx /= ptsArr.length; ecz /= ptsArr.length;
      return ptsArr.map(p => {
        const dx = p.x - ecx, dz = p.z - ecz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        return { x: p.x + dx / len * amt, z: p.z + dz / len * amt };
      });
    }

    // Centroid of pts3D (relative coords, should be ~0,0)
    let centX3D = 0, centZ3D = 0;
    for (const p of pts3D) { centX3D += p.x; centZ3D += p.z; }
    centX3D /= pts3D.length; centZ3D /= pts3D.length;

    // Flat roof: polygon slab slightly larger than the house, correctly oriented
    {
      const flatShape = new THREE.Shape();
      const expandedPts = _expandShape(pts3D, roofOverhang);
      flatShape.moveTo(expandedPts[0].x, -expandedPts[0].z);
      for (let i = 1; i < expandedPts.length; i++) flatShape.lineTo(expandedPts[i].x, -expandedPts[i].z);
      flatShape.closePath();
      const flatGeo = new THREE.ExtrudeGeometry(flatShape, { depth: 0.08, bevelEnabled: false });
      flatGeo.rotateX(-Math.PI / 2);
      const flat = new THREE.Mesh(flatGeo, roofMat);
      flat.position.set(c3.x, baseY + heightM, c3.z);
      flat.castShadow = true;
      flat.receiveShadow = true;
      view3D.fenceGroup.add(flat);
    }

    // ---- Windows on actual polygon walls ----
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x2980b9, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.7,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 });
    const windowH = Math.min(heightM * 0.3, 1.2);
    const windowW = Math.min(0.9, 0.6);
    const windowY = baseY + heightM * 0.6;

    // Place windows on each polygon edge (wall)
    for (let ei = 0; ei < pts3D.length; ei++) {
      const a = pts3D[ei];
      const b = pts3D[(ei + 1) % pts3D.length];
      const edgeDx = b.x - a.x;
      const edgeDz = b.z - a.z;
      const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDz * edgeDz);
      if (edgeLen < 1.5) continue; // wall too short for a window

      const winCount = Math.max(1, Math.floor(edgeLen / 2.5));
      // Wall normal (outward) — perpendicular to edge, pointing away from centroid
      let nx = -edgeDz / edgeLen;
      let nz = edgeDx / edgeLen;
      // Make sure normal points outward (away from centroid)
      const midToC_x = centX3D - (a.x + b.x) / 2;
      const midToC_z = centZ3D - (a.z + b.z) / 2;
      if (nx * midToC_x + nz * midToC_z > 0) { nx = -nx; nz = -nz; }

      const wallAngle = Math.atan2(edgeDx, edgeDz);

      for (let wi = 0; wi < winCount; wi++) {
        const t = (wi + 1) / (winCount + 1);
        const wx = c3.x + a.x + edgeDx * t + nx * 0.005;
        const wz = c3.z + a.z + edgeDz * t + nz * 0.005;

        // Glass pane
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(windowW, windowH), windowMat);
        glass.position.set(wx, windowY, wz);
        glass.rotation.y = wallAngle + Math.PI / 2;
        view3D.fenceGroup.add(glass);

        // Frame (4 bars around window)
        const frameThick = 0.04;
        const frameDepth = 0.03;
        // Top & bottom bars
        for (const yOff of [windowH / 2 + 0.02, -windowH / 2 - 0.02]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(windowW + 0.06, frameThick, frameDepth), frameMat);
          bar.position.set(wx, windowY + yOff, wz);
          bar.rotation.y = wallAngle;
          view3D.fenceGroup.add(bar);
        }
        // Left & right bars
        for (const xOff of [-windowW / 2 - 0.02, windowW / 2 + 0.02]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, windowH + 0.06, frameDepth), frameMat);
          const offX = Math.sin(wallAngle) * xOff;
          const offZ = Math.cos(wallAngle) * xOff;
          bar.position.set(wx + offX, windowY, wz + offZ);
          bar.rotation.y = wallAngle + Math.PI / 2;
          view3D.fenceGroup.add(bar);
        }
        // Cross bar (vertical center)
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.02, windowH, frameDepth), frameMat);
        crossV.position.set(wx, windowY, wz);
        crossV.rotation.y = wallAngle + Math.PI / 2;
        view3D.fenceGroup.add(crossV);
      }
    }

    // ---- Foundation strip ----
    const foundShape = new THREE.Shape();
    foundShape.moveTo(pts3D[0].x, -pts3D[0].z);
    for (let i = 1; i < pts3D.length; i++) foundShape.lineTo(pts3D[i].x, -pts3D[i].z);
    foundShape.closePath();
    const foundGeo = new THREE.ExtrudeGeometry(foundShape, { depth: 0.12, bevelEnabled: false });
    foundGeo.rotateX(-Math.PI / 2);
    const foundMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.0 });
    const found = new THREE.Mesh(foundGeo, foundMat);
    found.position.set(c3.x, baseY, c3.z);
    found.receiveShadow = true;
    view3D.fenceGroup.add(found);
  }
}

function makeTextSprite(text, opts = {}) {
  const fontSize = opts.fontSize || 48;
  const bgColor = opts.bgColor || 'rgba(255,255,255,0.9)';
  const textColor = opts.textColor || '#e74c3c';
  const canvas = document.createElement('canvas');
  const ctx2 = canvas.getContext('2d');
  ctx2.font = `bold ${fontSize}px sans-serif`;
  const tm = ctx2.measureText(text);
  const pad = 12;
  canvas.width = tm.width + pad * 2;
  canvas.height = fontSize + pad * 2;
  ctx2.font = `bold ${fontSize}px sans-serif`;
  ctx2.fillStyle = bgColor;
  ctx2.fillRect(0, 0, canvas.width, canvas.height);
  ctx2.fillStyle = textColor;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  const scale = opts.scale || 0.5;
  sprite.scale.set(scale * aspect, scale, 1);
  return sprite;
}

function add3DDimensions(segments, cfg, type, totalFenceH, podhrabH) {
  const isBeton = type === 'betonovy';

  for (const seg of segments) {
    const a3 = gridTo3D(seg.a.x, seg.a.y);
    const b3 = gridTo3D(seg.b.x, seg.b.y);
    const dx = b3.x - a3.x;
    const dz = b3.z - a3.z;
    const segLen3D = Math.sqrt(dx * dx + dz * dz);
    const perpX = segLen3D > 0 ? (-dz / segLen3D) * 0.4 : 0;
    const perpZ = segLen3D > 0 ? (dx / segLen3D) * 0.4 : 0;

    const fieldRanges = getFieldRanges(seg);
    const segPodhrabCm = getSegPodhrabH(seg);

    // Per-field labels
    for (let fi = 0; fi < fieldRanges.length; fi++) {
      const { t0, t1 } = fieldRanges[fi];
      const fieldLenM = (t1 - t0) * seg.lengthM;
      const fieldHCm = isBeton ? cfg.betonDesky * 50 : getFieldFenceH(seg.from, fi, seg);

      const tMid = (t0 + t1) / 2;
      const mx = a3.x + dx * tMid + perpX;
      const mz = a3.z + dz * tMid + perpZ;

      const lenText = `${(fieldLenM * 100).toFixed(0)}×${fieldHCm}${segPodhrabCm > 0 ? '+' + segPodhrabCm + 'pd' : ''} cm`;
      const sprite = makeTextSprite(lenText, { scale: 0.35 });
      const dimY = a3.y + (b3.y - a3.y) * tMid;
      sprite.position.set(mx, dimY + totalFenceH + 0.3, mz);
      view3D.fenceGroup.add(sprite);
    }

    // Post height labels (vertex posts)
    for (let vi = 0; vi < 2; vi++) {
      const vertIdx = vi === 0 ? seg.from : seg.to;
      if (vi === 1 && seg.to < state.vertices.length - 1) continue;
      const v = vi === 0 ? seg.a : seg.b;
      const p3 = gridTo3D(v.x, v.y);
      const thisPostH = getVertexPostH(vertIdx);

      const sprite = makeTextSprite(`Sl: ${thisPostH} cm`, { scale: 0.3, textColor: '#c0392b' });
      sprite.position.set(p3.x, p3.y + totalFenceH + 0.55, p3.z);
      view3D.fenceGroup.add(sprite);
    }

    // Gate label
    if (seg.gate) {
      const gate = seg.gate;
      const gateCenterT = getGateCenterT(gate, seg.lengthM);
      const gateWidthM = gate.width / 100;
      const halfGateT = (gateWidthM / 2) / seg.lengthM;
      const tMid = gateCenterT;
      const gx = a3.x + dx * tMid + perpX * 2;
      const gz = a3.z + dz * tMid + perpZ * 2;
      const gateH = gate.height || cfg.height;
      const gateLabel = `${gate.type === 'branka' ? 'Branka' : 'Brána'}: ${gate.width}×${gateH} cm`;
      const sprite = makeTextSprite(gateLabel, { scale: 0.35, textColor: '#2980b9', bgColor: 'rgba(52,152,219,0.15)' });
      const gateTY = a3.y + (b3.y - a3.y) * tMid;
      sprite.position.set(gx, gateTY + totalFenceH + 0.3, gz);
      view3D.fenceGroup.add(sprite);
    }
  }

  // Intermediate post heights
  for (const seg of segments) {
    const a3 = gridTo3D(seg.a.x, seg.a.y);
    const b3 = gridTo3D(seg.b.x, seg.b.y);
    const dx = b3.x - a3.x;
    const dz = b3.z - a3.z;
    const fieldRanges = getFieldRanges(seg);
    for (let fi = 0; fi < fieldRanges.length - 1; fi++) {
      const t = fieldRanges[fi].t1;
      const px = a3.x + dx * t;
      const pz = a3.z + dz * t;
      const thisPostH = getIntPostH(seg.from, fi, seg);

      const sprite = makeTextSprite(`${thisPostH} cm`, { scale: 0.25, textColor: '#c0392b' });
      const ipTY = a3.y + (b3.y - a3.y) * t;
      sprite.position.set(px, ipTY + totalFenceH + 0.55, pz);
      view3D.fenceGroup.add(sprite);
    }
  }
}

function add3DSelectionOutlines() {
  if (!view3D.fenceGroup) return;
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x3498db,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.6,
  });

  const children = [...view3D.fenceGroup.children];
  for (const child of children) {
    if (!child.userData || !child.geometry) continue;
    const ud = child.userData;
    let isSelected = false;

    if (ud.elementType === 'post' && ud.vertexIndex >= 0 && state.selectedPosts.has(ud.vertexIndex)) {
      isSelected = true;
    } else if (ud.elementType === 'intPost' && ud.intKey && state.selectedIntPosts.has(ud.intKey)) {
      isSelected = true;
    } else if (ud.elementType === 'field' && ud.fieldKey && state.selectedFields.has(ud.fieldKey)) {
      isSelected = true;
    } else if (ud.elementType === 'segment' && state.selectedSegments.has(ud.segmentIndex)) {
      isSelected = true;
    } else if (ud.elementType === 'strut' && state.selectedStruts.has(ud.strutIndex)) {
      isSelected = true;
    } else if (ud.elementType === 'wire' && ud.wireKey && state.selectedWires.has(ud.wireKey)) {
      isSelected = true;
    }

    if (isSelected) {
      // Determine scale factor based on element type - bigger gap for posts, offset for panels
      const isPostLike = (ud.elementType === 'post' || ud.elementType === 'intPost' || ud.elementType === 'strut');
      const scaleFactor = isPostLike ? 1.6 : 1.0;

      const outline = new THREE.Mesh(child.geometry, outlineMat);
      outline.position.copy(child.position);
      outline.rotation.copy(child.rotation);
      outline.quaternion.copy(child.quaternion);
      outline.scale.copy(child.scale).multiplyScalar(scaleFactor);
      outline.userData = { _outline: true };
      view3D.fenceGroup.add(outline);

      // For panels/fields, add a second front-side outline with offset to create visible gap
      if (!isPostLike) {
        const frontOutlineMat = new THREE.MeshBasicMaterial({
          color: 0x3498db,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.35,
        });
        // Wider and taller outline panel behind the fence panel
        const outGeo = new THREE.PlaneGeometry(
          (child.geometry.parameters ? child.geometry.parameters.width || 1 : 1) + 0.15,
          (child.geometry.parameters ? child.geometry.parameters.height || 1 : 1) + 0.15
        );
        const outMesh = new THREE.Mesh(outGeo, frontOutlineMat);
        outMesh.position.copy(child.position);
        outMesh.rotation.copy(child.rotation);
        outMesh.quaternion.copy(child.quaternion);
        outMesh.userData = { _outline: true };
        view3D.fenceGroup.add(outMesh);
      }
    }
  }
}

function addFencePanel(cx, cz, width, totalH, podhrabH, angle, fenceMat, podhrabMat, isBeton, segFenceType, segFromIdx, fieldIdx, terrainY) {
  const ty = terrainY || 0;
  const fenceH = totalH - podhrabH;
  // Gap between ground/podhrab top and pletivo bottom (dle DOCX pravidel)
  // Bez podhr.: 5 cm mezera od země; S podhr.: 3-5 cm mezera nad deskou
  const meshGap = podhrabH > 0 ? 0.04 : 0.05;

  // Per-panel color override
  const panelColorOverride = (segFromIdx !== undefined && fieldIdx === undefined) ? getPanelColor3D(segFromIdx) : null;
  const fieldUserData = (fieldIdx !== undefined)
    ? { elementType: 'field', segmentIndex: segFromIdx, fieldIndex: fieldIdx, fieldKey: getFieldKey(segFromIdx, fieldIdx) }
    : (segFromIdx !== undefined ? { elementType: 'segment', segmentIndex: segFromIdx } : {});

  if (isBeton) {
    // Concrete fence: individual stacked boards (each 50cm = 0.50m)
    const boardCount = state.config.betonDesky || 3;
    const boardH = 0.50; // each board is 50cm
    const boardGap = 0.01; // 1cm gap between boards
    const matToUse = panelColorOverride
      ? new THREE.MeshStandardMaterial({ color: panelColorOverride, roughness: 0.9, metalness: 0.0 })
      : fenceMat;
    for (let bi = 0; bi < boardCount; bi++) {
      const slabGeo = new THREE.BoxGeometry(width, boardH, 0.04);
      const slab = new THREE.Mesh(slabGeo, matToUse);
      const yBase = ty + podhrabH + meshGap + bi * (boardH + boardGap) + boardH / 2;
      slab.position.set(cx, yBase, cz);
      slab.rotation.y = angle;
      slab.castShadow = true;
      slab.receiveShadow = true;
      slab.userData = fieldUserData;
      view3D.fenceGroup.add(slab);
    }
  } else {
    // Clone material so we can set per-panel texture repeat
    const mat = panelColorOverride
      ? (() => { const m = fenceMat.clone(); m.color = new THREE.Color(panelColorOverride); return m; })()
      : fenceMat.clone();
    const isChainLink = segFenceType && (segFenceType.startsWith('ctyrhranne') || segFenceType === 'svarovane');
    if (isChainLink && mat.alphaMap) {
      // 1 diamond cell = 0.06 m wide × 0.06 m tall
      const cellSize = 0.06;
      const alphaClone = mat.alphaMap.clone();
      alphaClone.needsUpdate = true;
      alphaClone.repeat.set(width / cellSize, fenceH / cellSize);
      mat.alphaMap = alphaClone;
    }
    const panelGeo = new THREE.PlaneGeometry(width, fenceH);
    const panel = new THREE.Mesh(panelGeo, mat);
    panel.position.set(cx, ty + podhrabH + meshGap + fenceH / 2, cz);
    panel.rotation.y = angle;
    panel.castShadow = true;
    panel.userData = fieldUserData;
    view3D.fenceGroup.add(panel);
  }

  // Podhrabová deska
  if (podhrabH > 0) {
    const pGeo = new THREE.BoxGeometry(width, podhrabH, 0.04);
    const pMesh = new THREE.Mesh(pGeo, podhrabMat);
    pMesh.position.set(cx, ty + podhrabH / 2, cz);
    pMesh.rotation.y = angle;
    pMesh.castShadow = true;
    view3D.fenceGroup.add(pMesh);

    // Kryty na podhrabové desky (silver caps on each end)
    const krytMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.35, metalness: 0.5, emissive: 0x333333 });
    const krytW = 0.08;  // 8cm wide
    const krytH = podhrabH + 0.02;  // slightly taller than board
    const krytD = 0.08;  // 8cm deep
    const krytGeo = new THREE.BoxGeometry(krytD, krytH, krytW);
    const halfW = width / 2;
    // Left cap
    const capL = new THREE.Mesh(krytGeo, krytMat);
    capL.position.set(
      cx + Math.cos(angle) * (-halfW + krytD / 2) + Math.sin(angle) * 0,
      ty + podhrabH / 2,
      cz - Math.sin(angle) * (-halfW + krytD / 2) + Math.cos(angle) * 0
    );
    capL.rotation.y = angle;
    capL.castShadow = true;
    view3D.fenceGroup.add(capL);
    // Right cap
    const capR = new THREE.Mesh(krytGeo, krytMat);
    capR.position.set(
      cx + Math.cos(angle) * (halfW - krytD / 2),
      ty + podhrabH / 2,
      cz - Math.sin(angle) * (halfW - krytD / 2)
    );
    capR.rotation.y = angle;
    capR.castShadow = true;
    view3D.fenceGroup.add(capR);
  }

  // Top rail for panels
  const ft = segFenceType || state.fenceType;
  if (ft === 'panely_2d' || ft === 'panely_3d') {
    const railGeo = new THREE.CylinderGeometry(0.02, 0.02, width, 6);
    railGeo.rotateZ(Math.PI / 2);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(cx, ty + podhrabH + meshGap + fenceH, cz);
    rail.rotation.y = angle;
    view3D.fenceGroup.add(rail);
  }
}

function autoFrame3D() {
  if (state.vertices.length === 0) return;

  const xs = state.vertices.map(v => v.x * GRID_M);
  const zs = state.vertices.map(v => v.y * GRID_M);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;
  const maxRange = Math.max(rangeX, rangeZ, 5);

  view3D.controls.target.set(cx, 1, cz);
  view3D.camera.position.set(cx + maxRange * 0.8, maxRange * 0.6 + 3, cz + maxRange * 0.8);
  view3D.controls.update();
}

// ---- View toggle ----
function switchTo3D() {
  view3D.active = true;
  document.getElementById('canvas').style.display = 'none';
  document.getElementById('three-container').style.display = 'block';
  document.getElementById('zoomControls').style.display = 'none';
  document.getElementById('scaleIndicator').style.display = 'none';

  document.getElementById('btn2D').classList.remove('active');
  document.getElementById('btn3D').classList.add('active');

  if (!view3D.scene) {
    init3D();
  }
  rebuildTerrainMesh3D();
  build3DFence();
  animate3D();
  resize3D();
}

function switchTo2D() {
  view3D.active = false;
  document.getElementById('canvas').style.display = 'block';
  document.getElementById('three-container').style.display = 'none';
  document.getElementById('zoomControls').style.display = 'flex';
  document.getElementById('scaleIndicator').style.display = 'flex';

  document.getElementById('btn3D').classList.remove('active');
  document.getElementById('btn2D').classList.add('active');

  if (view3D.animFrameId) {
    cancelAnimationFrame(view3D.animFrameId);
    view3D.animFrameId = null;
  }
  resizeCanvas();
}

document.getElementById('btn3D').addEventListener('click', switchTo3D);
document.getElementById('btn2D').addEventListener('click', switchTo2D);

document.getElementById('showDimensions').addEventListener('change', (e) => {
  state.showDimensions = e.target.checked;
  if (view3D.active) { rebuildTerrainMesh3D(); build3DFence(); }
  else render();
});

// Update 3D on theme change
const origThemeToggle = document.getElementById('themeToggle');
origThemeToggle.addEventListener('click', () => {
  if (view3D.active && view3D.scene) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    view3D.scene.background = new THREE.Color(isDark ? 0x1a1a2e : 0xe8f5e9);
  }
});

// Resize handler update
window.addEventListener('resize', () => {
  if (view3D.active) resize3D();
});
