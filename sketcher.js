/* ======================================================================
   SKETCHER.JS v2 – A4 portrait, improved UI, better dimension tool
   ====================================================================== */
(function () {
  'use strict';

  // -------- constants ----------
  const A4_W_MM = 210, A4_H_MM = 297;            // PORTRAIT
  const MM_PX   = 3.7795;
  const A4_W    = Math.round(A4_W_MM * MM_PX);    // ~794
  const A4_H    = Math.round(A4_H_MM * MM_PX);    // ~1123
  const TOOL_NAMES = { hand:'Ruka', select:'Výběr', pencil:'Tužka', line:'Čára', rect:'Obdélník',
    ellipse:'Elipsa', pen:'Pero', text:'Text', dimension:'Kóta', fence:'Plot', eraser:'Guma' };

  // -------- state ----------
  const canvas = document.getElementById('sketchCanvas');
  const ctx    = canvas.getContext('2d');

  let W, H;
  let cam = { x: 0, y: 0, zoom: 1 };

  let shapes    = [];
  let undoStack = [];
  let redoStack = [];

  let currentTool = 'hand';
  let drawing     = false;
  let tmpShape    = null;
  let penPoints   = [];
  let selectedIdx = -1;
  let dragStart   = null;
  let isPanning   = false;
  let dragHandle  = null;   // 'move' | 'p1' | 'p2' etc for resize handles

  const $ = id => document.getElementById(id);

  function getStroke()    { return $('strokeColor').value; }
  function getFill()      { return $('fillEnabled').checked ? $('fillColor').value : null; }
  function getLineWidth() { return parseInt($('lineWidth').value); }
  function getGridSize()  { return parseInt($('gridSize').value); }
  function isSnap()       { return $('snapGrid').checked; }
  function showGridOn()   { return $('showGrid').checked; }

  function snap(v) { if (!isSnap()) return v; const g = getGridSize(); return Math.round(v / g) * g; }
  function snapPt(x, y) { return { x: snap(x), y: snap(y) }; }

  function s2w(sx, sy) { return { x: (sx - W/2) / cam.zoom + cam.x, y: (sy - H/2) / cam.zoom + cam.y }; }
  function w2s(wx, wy) { return { x: (wx - cam.x) * cam.zoom + W/2, y: (wy - cam.y) * cam.zoom + H/2 }; }

  // -------- resize ----------
  function resize() {
    const brand = document.getElementById('brandBar');
    const tb = document.getElementById('toolbar');
    const topH = (brand ? brand.offsetHeight : 0) + (tb.offsetHeight || 42);
    canvas.style.top = topH + 'px';
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight - topH - 24;
    render();
  }
  window.addEventListener('resize', resize);

  // ==================== RENDER ====================
  function render() {
    ctx.clearRect(0, 0, W, H);

    // bg
    ctx.fillStyle = '#d0d4da';
    ctx.fillRect(0, 0, W, H);

    // A4 paper shadow
    const pa = w2s(0, 0);
    const pb = w2s(A4_W, A4_H);
    const pw = pb.x - pa.x, ph = pb.y - pa.y;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(pa.x + 4, pa.y + 4, pw, ph);
    ctx.fillStyle = '#fff';
    ctx.fillRect(pa.x, pa.y, pw, ph);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(pa.x, pa.y, pw, ph);

    // grid
    if (showGridOn()) drawGrid();

    // shapes
    for (let i = 0; i < shapes.length; i++) {
      drawShape(shapes[i], i === selectedIdx);
    }

    // tmp
    if (tmpShape) drawShape(tmpShape, false);

    // pen preview
    if (currentTool === 'pen' && penPoints.length > 0) drawPenPreview();

    // selection handles
    if (selectedIdx >= 0 && selectedIdx < shapes.length) drawSelectionHandles(shapes[selectedIdx]);

    $('statusZoom').textContent = Math.round(cam.zoom * 100) + '%';
  }

  // -------- grid ----------
  function drawGrid() {
    const g = getGridSize();
    ctx.save();
    ctx.strokeStyle = 'rgba(170,180,200,0.3)';
    ctx.lineWidth = 0.5;
    const tl = s2w(0, 0), br = s2w(W, H);
    const x0 = Math.floor(tl.x / g) * g, y0 = Math.floor(tl.y / g) * g;
    for (let wx = x0; wx <= br.x; wx += g) { const s = w2s(wx, 0); ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, H); ctx.stroke(); }
    for (let wy = y0; wy <= br.y; wy += g) { const s = w2s(0, wy); ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(W, s.y); ctx.stroke(); }
    ctx.restore();
  }

  // ==================== DRAW SHAPE ====================
  function drawShape(sh, selected) {
    ctx.save();
    ctx.strokeStyle = sh.stroke || '#000';
    ctx.lineWidth   = (sh.lineWidth || 2) * cam.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (sh.type) {
      case 'pencil': _drawPencil(sh); break;
      case 'line':   _drawLine(sh); break;
      case 'rect':   _drawRect(sh); break;
      case 'fence':  _drawFence(sh); break;
      case 'ellipse':_drawEllipse(sh); break;
      case 'pen':    _drawPen(sh); break;
      case 'text':   _drawText(sh); break;
      case 'dimension': _drawDimension(sh); break;
      case 'image':  _drawImage(sh); break;
    }
    ctx.restore();
  }

  function _drawPencil(sh) {
    if (sh.pts.length < 2) return;
    ctx.beginPath();
    const p0 = w2s(sh.pts[0].x, sh.pts[0].y); ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < sh.pts.length; i++) { const p = w2s(sh.pts[i].x, sh.pts[i].y); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }

  function _drawLine(sh) {
    const a = w2s(sh.x1, sh.y1), b = w2s(sh.x2, sh.y2);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  function _drawRect(sh) {
    const a = w2s(sh.x, sh.y), b = w2s(sh.x + sh.w, sh.y + sh.h);
    if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fillRect(a.x, a.y, b.x-a.x, b.y-a.y); }
    ctx.strokeRect(a.x, a.y, b.x-a.x, b.y-a.y);
  }

  // ---- Fence pattern (chain-link mesh rectangles) ----
  function _drawFence(sh) {
    _drawFenceOnCtx(ctx, sh, cam.zoom, true);
  }

  function _drawFenceOnCtx(c, sh, zoom, useW2S) {
    const toS = useW2S ? (x,y) => w2s(x,y) : (x,y) => ({x,y});
    const a = toS(sh.x, sh.y);
    const b = toS(sh.x + sh.w, sh.y + sh.h);
    const sx = Math.min(a.x, b.x), sy = Math.min(a.y, b.y);
    const sw = Math.abs(b.x - a.x), sht = Math.abs(b.y - a.y);
    if (sw < 2 || sht < 2) return;

    const wire = Math.max(0.8, 1 * zoom);
    const color = sh.stroke || '#555';

    c.save();
    c.beginPath();
    c.rect(sx, sy, sw, sht);
    c.clip();
    c.strokeStyle = color;
    c.lineWidth = wire;

    if (sh.pattern === 'grid') {
      // Rectangular grid: tall narrow cells
      const cellW = 8 * zoom, cellH = 14 * zoom;
      c.lineJoin = 'miter';
      const cols = Math.ceil(sw / cellW) + 1;
      const rows = Math.ceil(sht / cellH) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          c.strokeRect(sx + col * cellW, sy + row * cellH, cellW, cellH);
        }
      }
    } else {
      // Diamond pattern (chain-link): diagonal lines forming diamonds
      const cellW = 10 * zoom, cellH = 16 * zoom;
      const halfW = cellW / 2, halfH = cellH / 2;
      c.lineJoin = 'miter';
      c.beginPath();
      // Draw diagonal lines in both directions
      const startCol = -1, endCol = Math.ceil(sw / halfW) + 2;
      const startRow = -1, endRow = Math.ceil(sht / halfH) + 2;
      // \ diagonals
      for (let r = startRow; r < endRow; r++) {
        for (let col = startCol; col < endCol; col += 2) {
          const x0 = sx + (col + (r % 2)) * halfW;
          const y0 = sy + r * halfH;
          c.moveTo(x0, y0);
          c.lineTo(x0 + halfW, y0 + halfH);
        }
      }
      // / diagonals
      for (let r = startRow; r < endRow; r++) {
        for (let col = startCol; col < endCol; col += 2) {
          const x0 = sx + (col + (r % 2)) * halfW + halfW;
          const y0 = sy + r * halfH;
          c.moveTo(x0, y0);
          c.lineTo(x0 - halfW, y0 + halfH);
        }
      }
      c.stroke();
    }
    c.restore();
  }

  function _drawEllipse(sh) {
    const c = w2s(sh.cx, sh.cy);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, Math.abs(sh.rx)*cam.zoom, Math.abs(sh.ry)*cam.zoom, 0, 0, Math.PI*2);
    if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fill(); }
    ctx.stroke();
  }

  function _drawPen(sh) {
    if (sh.pts.length < 2) return;
    ctx.beginPath();
    const p0 = w2s(sh.pts[0].x, sh.pts[0].y); ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < sh.pts.length; i++) {
      const prev = sh.pts[i-1], cur = sh.pts[i];
      if (prev.cx2 != null && cur.cx1 != null) {
        const c1 = w2s(prev.cx2, prev.cy2), c2 = w2s(cur.cx1, cur.cy1), p = w2s(cur.x, cur.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y);
      } else { const p = w2s(cur.x, cur.y); ctx.lineTo(p.x, p.y); }
    }
    if (sh.closed) ctx.closePath();
    if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fill(); }
    ctx.stroke();
  }

  function _drawText(sh) {
    const p = w2s(sh.x, sh.y);
    const fSize = (sh.fontSize || 16) * cam.zoom;
    ctx.font = `${fSize}px sans-serif`;
    ctx.fillStyle = sh.stroke || '#000';
    ctx.textBaseline = 'top';
    const lines = (sh.text || '').split('\n');
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], p.x, p.y + i * fSize * 1.25);
  }

  // ==================== IMAGE (imported fence snapshot) ====================
  const _imgCache = {};
  function _getImg(src) {
    if (_imgCache[src]) return _imgCache[src];
    const img = new Image();
    img.onload = () => { _imgCache[src] = img; render(); };
    img.src = src;
    _imgCache[src] = null; // loading
    return null;
  }

  function _drawImage(sh) {
    const img = _getImg(sh.src);
    if (!img) return;
    const a = w2s(sh.x, sh.y);
    const bx = w2s(sh.x + sh.w, sh.y + sh.h);
    const sw = bx.x - a.x, sh2 = bx.y - a.y;
    ctx.drawImage(img, a.x, a.y, sw, sh2);
  }

  // ==================== DIMENSION (improved) ====================
  function _drawDimension(sh) {
    _drawDimOnCtx(ctx, sh, cam.zoom, true);
  }

  function _drawDimOnCtx(c, sh, zoom, useW2S) {
    const toS = useW2S ? (x,y) => w2s(x,y) : (x,y) => ({x,y});
    const a = toS(sh.x1, sh.y1), b = toS(sh.x2, sh.y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 4) return;

    const nx = dx/len, ny = dy/len;   // along dimension
    const px = -ny, py = nx;           // perpendicular
    const ext = 14 * zoom;
    const arr = 10 * zoom;
    const lw = 1.5 * zoom;

    c.save();
    c.strokeStyle = sh.stroke || '#c00';
    c.fillStyle   = sh.stroke || '#c00';
    c.lineWidth   = lw;
    c.lineCap = 'round';

    // extension lines (perpendicular)
    c.beginPath();
    c.moveTo(a.x + px * ext, a.y + py * ext);
    c.lineTo(a.x - px * ext, a.y - py * ext);
    c.moveTo(b.x + px * ext, b.y + py * ext);
    c.lineTo(b.x - px * ext, b.y - py * ext);
    c.stroke();

    // label text measurement
    const label = sh.label || '';
    const fSize = Math.max(11, 13 * zoom);
    c.font = `bold ${fSize}px sans-serif`;
    const tw = label ? c.measureText(label).width + 8 * zoom : 0;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    // dimension line with gap for text
    if (tw > 0 && tw < len - arr * 2) {
      const halfGap = tw / 2;
      // left part
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(mx - nx * halfGap, my - ny * halfGap);
      c.stroke();
      // right part
      c.beginPath();
      c.moveTo(mx + nx * halfGap, my + ny * halfGap);
      c.lineTo(b.x, b.y);
      c.stroke();
    } else {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }

    // arrowheads (filled triangles)
    _drawArrowHead(c, a.x, a.y, nx, ny, arr);
    _drawArrowHead(c, b.x, b.y, -nx, -ny, arr);

    // label rotated along dimension direction
    if (label) {
      c.save();
      c.translate(mx, my);
      let angle = Math.atan2(dy, dx);
      // keep text readable (not upside down)
      if (angle > Math.PI/2) angle -= Math.PI;
      if (angle < -Math.PI/2) angle += Math.PI;
      c.rotate(angle);
      c.font = `bold ${fSize}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      // white background behind text
      const bgW = tw, bgH = fSize + 4 * zoom;
      c.fillStyle = '#fff';
      c.fillRect(-bgW/2, -bgH/2, bgW, bgH);
      c.fillStyle = sh.stroke || '#c00';
      c.fillText(label, 0, 0);
      c.restore();
    }
    c.restore();
  }

  function _drawArrowHead(c, x, y, nx, ny, size) {
    const px = -ny, py = nx;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - nx*size + px*size*0.3, y - ny*size + py*size*0.3);
    c.lineTo(x - nx*size*0.7, y - ny*size*0.7);
    c.lineTo(x - nx*size - px*size*0.3, y - ny*size - py*size*0.3);
    c.closePath();
    c.fill();
  }

  // -------- pen preview ----------
  function drawPenPreview() {
    ctx.save();
    ctx.strokeStyle = '#39f'; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
    ctx.beginPath();
    const p0 = w2s(penPoints[0].x, penPoints[0].y); ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < penPoints.length; i++) {
      const prev = penPoints[i-1], cur = penPoints[i];
      if (prev.cx2 != null && cur.cx1 != null) {
        const c1 = w2s(prev.cx2, prev.cy2), c2 = w2s(cur.cx1, cur.cy1), p = w2s(cur.x, cur.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y);
      } else { const p = w2s(cur.x, cur.y); ctx.lineTo(p.x, p.y); }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const pt of penPoints) { const s = w2s(pt.x, pt.y); ctx.fillStyle='#39f'; ctx.beginPath(); ctx.arc(s.x,s.y,4,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  // -------- selection handles ----------
  function drawSelectionHandles(sh) {
    const handles = getHandles(sh);
    if (!handles.length) return;
    ctx.save();
    for (const h of handles) {
      const s = w2s(h.x, h.y);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#39f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
    // bounding dashed rect
    const bb = shapeBBox(sh);
    if (bb) {
      const sa = w2s(bb.x, bb.y), sb = w2s(bb.x+bb.w, bb.y+bb.h);
      ctx.strokeStyle = 'rgba(57,153,255,0.5)'; ctx.lineWidth = 1;
      ctx.setLineDash([4,3]);
      ctx.strokeRect(sa.x-6, sa.y-6, sb.x-sa.x+12, sb.y-sa.y+12);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function getHandles(sh) {
    switch (sh.type) {
      case 'line':
      case 'dimension':
        return [{ id:'p1', x:sh.x1, y:sh.y1 }, { id:'p2', x:sh.x2, y:sh.y2 }];
      case 'rect': case 'fence':
        return [
          { id:'tl', x:sh.x, y:sh.y }, { id:'tr', x:sh.x+sh.w, y:sh.y },
          { id:'bl', x:sh.x, y:sh.y+sh.h }, { id:'br', x:sh.x+sh.w, y:sh.y+sh.h }
        ];
      case 'ellipse':
        return [
          { id:'l', x:sh.cx-sh.rx, y:sh.cy }, { id:'r', x:sh.cx+sh.rx, y:sh.cy },
          { id:'t', x:sh.cx, y:sh.cy-sh.ry }, { id:'b', x:sh.cx, y:sh.cy+sh.ry },
        ];
      case 'text':
        return [{ id:'p1', x:sh.x, y:sh.y }];
      case 'image':
        return [
          { id:'tl', x:sh.x, y:sh.y }, { id:'tr', x:sh.x+sh.w, y:sh.y },
          { id:'bl', x:sh.x, y:sh.y+sh.h }, { id:'br', x:sh.x+sh.w, y:sh.y+sh.h }
        ];
      default: return [];
    }
  }

  function hitHandle(sh, wx, wy) {
    const thr = 8 / cam.zoom;
    for (const h of getHandles(sh)) {
      if (Math.abs(wx - h.x) < thr && Math.abs(wy - h.y) < thr) return h.id;
    }
    return null;
  }

  // -------- bounding box ----------
  function shapeBBox(sh) {
    switch (sh.type) {
      case 'pencil': case 'pen': {
        if (!sh.pts || !sh.pts.length) return null;
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        for (const p of sh.pts) { x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); }
        return { x:x0, y:y0, w:x1-x0, h:y1-y0 };
      }
      case 'line': case 'dimension':
        return { x:Math.min(sh.x1,sh.x2), y:Math.min(sh.y1,sh.y2), w:Math.abs(sh.x2-sh.x1)||1, h:Math.abs(sh.y2-sh.y1)||1 };
      case 'rect': case 'fence': case 'image':
        return { x:Math.min(sh.x,sh.x+sh.w), y:Math.min(sh.y,sh.y+sh.h), w:Math.abs(sh.w)||1, h:Math.abs(sh.h)||1 };
      case 'ellipse':
        return { x:sh.cx-Math.abs(sh.rx), y:sh.cy-Math.abs(sh.ry), w:Math.abs(sh.rx)*2||1, h:Math.abs(sh.ry)*2||1 };
      case 'text':
        return { x:sh.x, y:sh.y, w:200, h:(sh.fontSize||16)*((sh.text||'').split('\n').length)*1.25 };
      default: return null;
    }
  }

  // -------- hit test ----------
  function hitTest(wx, wy) {
    const m = 10 / cam.zoom;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const sh = shapes[i];
      // For lines/dimensions use distance to segment
      if (sh.type === 'line' || sh.type === 'dimension') {
        if (distToSeg(wx, wy, sh.x1, sh.y1, sh.x2, sh.y2) < m) return i;
        continue;
      }
      const bb = shapeBBox(sh);
      if (!bb) continue;
      if (wx >= bb.x - m && wx <= bb.x + bb.w + m && wy >= bb.y - m && wy <= bb.y + bb.h + m) return i;
    }
    return -1;
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2-x1, dy = y2-y1, lenSq = dx*dx+dy*dy;
    if (lenSq === 0) return Math.sqrt((px-x1)**2+(py-y1)**2);
    let t = ((px-x1)*dx+(py-y1)*dy)/lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1+t*dx, cy = y1+t*dy;
    return Math.sqrt((px-cx)**2+(py-cy)**2);
  }

  // -------- undo / redo ----------
  function pushUndo() {
    undoStack.push(JSON.parse(JSON.stringify(shapes)));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }
  function undo() { if (!undoStack.length) return; redoStack.push(JSON.parse(JSON.stringify(shapes))); shapes = undoStack.pop(); selectedIdx = -1; render(); autoSave(); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.parse(JSON.stringify(shapes))); shapes = redoStack.pop(); selectedIdx = -1; render(); autoSave(); }

  // ==================== AUTO-SAVE / RESTORE ====================
  const SAVE_KEY = 'plotySketcher_shapes';
  let _saveTimer = null;
  function autoSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(shapes));
      } catch(e) {}
    }, 300);
  }
  function autoRestore() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded) && loaded.length > 0) {
        shapes = loaded;
        render();
      }
    } catch(e) {}
  }

  // ==================== TOOL SWITCH ====================
  function setTool(tool) {
    if (currentTool === 'pen' && penPoints.length > 1) finishPen(false);
    currentTool = tool;
    penPoints = []; tmpShape = null; drawing = false;
    document.querySelectorAll('.tool-select .tb-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    $('statusTool').textContent = TOOL_NAMES[tool] || tool;
    $('fencePattern').style.display = tool === 'fence' ? '' : 'none';
    updateCursor();
    render();
  }

  function updateCursor() {
    const c = { hand:'grab', select:'default', pencil:'crosshair', line:'crosshair', rect:'crosshair',
      ellipse:'crosshair', pen:'crosshair', text:'text', dimension:'crosshair', eraser:'not-allowed' };
    canvas.style.cursor = c[currentTool] || 'default';
  }

  document.querySelectorAll('.tool-select .tb-btn').forEach(b => {
    b.addEventListener('click', () => setTool(b.dataset.tool));
  });

  // ==================== MOUSE ====================
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function getWorldPos(e) {
    const rect = canvas.getBoundingClientRect();
    const w = s2w(e.clientX - rect.left, e.clientY - rect.top);
    return snapPt(w.x, w.y);
  }

  function onMouseDown(e) {
    // Middle button always pans
    if (e.button === 1) { startPan(e); return; }
    if (e.button !== 0) return;

    const wp = getWorldPos(e);

    // HAND tool
    if (currentTool === 'hand') { startPan(e); return; }

    // ALT + left = pan from any tool
    if (e.altKey) { startPan(e); return; }

    switch (currentTool) {
      case 'select': onSelectDown(e, wp); break;
      case 'pencil': onPencilDown(wp); break;
      case 'line':   onLineDown(wp); break;
      case 'rect':   onRectDown(wp); break;
      case 'fence':  onFenceDown(wp); break;
      case 'ellipse':onEllipseDown(e, wp); break;
      case 'pen':    onPenDown(wp); break;
      case 'text':   showTextPopup(e.clientX, e.clientY, wp); break;
      case 'dimension': onDimDown(wp); break;
      case 'eraser': onEraserDown(wp); break;
    }
  }

  function startPan(e) {
    isPanning = true;
    dragStart = { mx: e.clientX, my: e.clientY, cx: cam.x, cy: cam.y };
    canvas.style.cursor = 'grabbing';
  }

  function onSelectDown(e, wp) {
    // check if clicking a handle of already selected shape
    if (selectedIdx >= 0 && selectedIdx < shapes.length) {
      const hid = hitHandle(shapes[selectedIdx], wp.x, wp.y);
      if (hid) {
        dragHandle = hid;
        dragStart = { mx: e.clientX, my: e.clientY, shape: JSON.parse(JSON.stringify(shapes[selectedIdx])), wx: wp.x, wy: wp.y };
        return;
      }
    }
    const idx = hitTest(wp.x, wp.y);
    selectedIdx = idx;
    dragHandle = null;
    if (idx >= 0) {
      dragHandle = 'move';
      dragStart = { mx: e.clientX, my: e.clientY, shape: JSON.parse(JSON.stringify(shapes[idx])), wx: wp.x, wy: wp.y };
    }
    render();
  }

  function onPencilDown(wp) {
    drawing = true; pushUndo();
    tmpShape = { type:'pencil', pts:[{x:wp.x,y:wp.y}], stroke:getStroke(), lineWidth:getLineWidth() };
  }
  function onLineDown(wp) {
    drawing = true;
    tmpShape = { type:'line', x1:wp.x, y1:wp.y, x2:wp.x, y2:wp.y, stroke:getStroke(), lineWidth:getLineWidth() };
  }
  function onRectDown(wp) {
    drawing = true;
    tmpShape = { type:'rect', x:wp.x, y:wp.y, w:0, h:0, stroke:getStroke(), fill:getFill(), lineWidth:getLineWidth() };
  }
  function onFenceDown(wp) {
    drawing = true;
    tmpShape = { type:'fence', x:wp.x, y:wp.y, w:0, h:0, stroke:getStroke(), lineWidth:1, pattern: $('fencePattern').value };
  }
  function onEllipseDown(e, wp) {
    drawing = true;
    tmpShape = { type:'ellipse', cx:wp.x, cy:wp.y, rx:0, ry:0, stroke:getStroke(), fill:getFill(), lineWidth:getLineWidth() };
    dragStart = { wx: wp.x, wy: wp.y };
  }
  function onDimDown(wp) {
    drawing = true;
    tmpShape = { type:'dimension', x1:wp.x, y1:wp.y, x2:wp.x, y2:wp.y, stroke:'#c00', lineWidth:2, label:'' };
  }
  function onPenDown(wp) {
    const pt = { x:wp.x, y:wp.y, cx1:null, cy1:null, cx2:null, cy2:null };
    if (penPoints.length > 0) {
      const prev = penPoints[penPoints.length-1];
      prev.cx2 = prev.cx2 || prev.x; prev.cy2 = prev.cy2 || prev.y;
      pt.cx1 = pt.x; pt.cy1 = pt.y;
    }
    penPoints.push(pt);
    render();
  }
  function onEraserDown(wp) {
    const idx = hitTest(wp.x, wp.y);
    if (idx >= 0) { pushUndo(); shapes.splice(idx, 1); if (selectedIdx === idx) selectedIdx = -1; else if (selectedIdx > idx) selectedIdx--; render(); autoSave(); }
  }

  function onMouseMove(e) {
    const wp = getWorldPos(e);
    $('statusCoords').textContent = `${Math.round(wp.x)}, ${Math.round(wp.y)}`;

    if (isPanning && dragStart) {
      cam.x = dragStart.cx - (e.clientX - dragStart.mx) / cam.zoom;
      cam.y = dragStart.cy - (e.clientY - dragStart.my) / cam.zoom;
      render(); return;
    }

    // select drag (move or handle)
    if (currentTool === 'select' && dragStart && selectedIdx >= 0) {
      const dwx = wp.x - dragStart.wx;
      const dwy = wp.y - dragStart.wy;
      if (dragHandle === 'move') {
        moveShape(selectedIdx, dragStart.shape, dwx, dwy);
      } else if (dragHandle) {
        shapes[selectedIdx]._shiftResize = e.shiftKey;
        resizeShape(selectedIdx, dragStart.shape, dragHandle, wp);
        delete shapes[selectedIdx]._shiftResize;
      }
      render(); return;
    }

    // hover cursor in select mode
    if (currentTool === 'select' && !dragStart) {
      const hit = hitTest(wp.x, wp.y);
      canvas.style.cursor = hit >= 0 ? 'move' : 'default';
      if (selectedIdx >= 0 && selectedIdx < shapes.length) {
        const hid = hitHandle(shapes[selectedIdx], wp.x, wp.y);
        if (hid) canvas.style.cursor = 'grab';
      }
    }

    if (!drawing || !tmpShape) return;
    switch (tmpShape.type) {
      case 'pencil': tmpShape.pts.push({x:wp.x,y:wp.y}); break;
      case 'line': tmpShape.x2=wp.x; tmpShape.y2=wp.y; break;
      case 'rect': case 'fence': tmpShape.w=wp.x-tmpShape.x; tmpShape.h=wp.y-tmpShape.y; break;
      case 'ellipse':
        tmpShape.rx = Math.abs(wp.x - dragStart.wx) / 2;
        tmpShape.ry = Math.abs(wp.y - dragStart.wy) / 2;
        tmpShape.cx = (dragStart.wx + wp.x) / 2;
        tmpShape.cy = (dragStart.wy + wp.y) / 2;
        break;
      case 'dimension': tmpShape.x2=wp.x; tmpShape.y2=wp.y; break;
    }
    render();
  }

  function onMouseUp(e) {
    if (isPanning) { isPanning = false; dragStart = null; updateCursor(); return; }

    if (currentTool === 'select' && dragStart && selectedIdx >= 0) {
      const wp = getWorldPos(e);
      if (wp.x !== dragStart.wx || wp.y !== dragStart.wy) pushUndo();
      dragStart = null; dragHandle = null; render(); autoSave(); return;
    }

    if (!drawing || !tmpShape) return;
    drawing = false;

    if (tmpShape.type === 'dimension') { showDimPopup(e.clientX, e.clientY, tmpShape); return; }
    if (tmpShape.type !== 'pencil') pushUndo();
    shapes.push(tmpShape); tmpShape = null; render(); autoSave();
  }

  // -------- move / resize ----------
  function moveShape(idx, orig, dx, dy) {
    const sh = shapes[idx];
    switch (sh.type) {
      case 'pencil': case 'pen':
        for (let i = 0; i < sh.pts.length; i++) {
          sh.pts[i].x = orig.pts[i].x + dx; sh.pts[i].y = orig.pts[i].y + dy;
          if (sh.pts[i].cx1!=null) { sh.pts[i].cx1=orig.pts[i].cx1+dx; sh.pts[i].cy1=orig.pts[i].cy1+dy; }
          if (sh.pts[i].cx2!=null) { sh.pts[i].cx2=orig.pts[i].cx2+dx; sh.pts[i].cy2=orig.pts[i].cy2+dy; }
        } break;
      case 'line': case 'dimension':
        sh.x1=orig.x1+dx; sh.y1=orig.y1+dy; sh.x2=orig.x2+dx; sh.y2=orig.y2+dy; break;
      case 'rect': case 'fence': case 'image': sh.x=orig.x+dx; sh.y=orig.y+dy; break;
      case 'ellipse': sh.cx=orig.cx+dx; sh.cy=orig.cy+dy; break;
      case 'text': sh.x=orig.x+dx; sh.y=orig.y+dy; break;
    }
  }

  function resizeShape(idx, orig, hid, wp) {
    const sh = shapes[idx];
    const sx = snap(wp.x), sy = snap(wp.y);
    switch (sh.type) {
      case 'line': case 'dimension':
        if (hid==='p1') { sh.x1=sx; sh.y1=sy; } else { sh.x2=sx; sh.y2=sy; }
        break;
      case 'rect': case 'fence': case 'image': {
        const o = orig;
        if (hid==='tl') { sh.x=sx; sh.y=sy; sh.w=o.x+o.w-sx; sh.h=o.y+o.h-sy; }
        if (hid==='tr') { sh.y=sy; sh.w=sx-o.x; sh.h=o.y+o.h-sy; }
        if (hid==='bl') { sh.x=sx; sh.w=o.x+o.w-sx; sh.h=sy-o.y; }
        if (hid==='br') { sh.w=sx-o.x; sh.h=sy-o.y; }
        // Shift = constrain proportions
        if (sh._shiftResize && o.w && o.h) {
          const aspect = Math.abs(o.w / o.h);
          if (hid==='tl'||hid==='br') {
            const newH = sh.w / aspect;
            if (hid==='tl') sh.y = o.y + o.h - newH;
            sh.h = newH;
          } else {
            const newH = sh.w / aspect;
            if (hid==='bl') sh.y = o.y + o.h - newH;
            sh.h = newH;
          }
        }
        break;
      }
      case 'ellipse': {
        if (hid==='l'||hid==='r') sh.rx = Math.abs(sx - sh.cx);
        if (hid==='t'||hid==='b') sh.ry = Math.abs(sy - sh.cy);
        break;
      }
      case 'text':
        if (hid==='p1') { sh.x=sx; sh.y=sy; }
        break;
    }
  }

  // -------- pen ----------
  function finishPen(closed) {
    if (penPoints.length < 2) { penPoints = []; render(); return; }
    pushUndo();
    shapes.push({ type:'pen', pts:JSON.parse(JSON.stringify(penPoints)), closed, stroke:getStroke(), fill:getFill(), lineWidth:getLineWidth() });
    penPoints = []; render();
  }

  // pen: drag to create handles
  let penDragging = false, penDragIdx = -1;
  canvas.addEventListener('mousedown', e => {
    if (currentTool !== 'pen' || e.button !== 0 || penPoints.length === 0) return;
    penDragging = true; penDragIdx = penPoints.length - 1;
  }, true);
  canvas.addEventListener('mousemove', e => {
    if (!penDragging || penDragIdx < 0) return;
    const wp = getWorldPos(e);
    const pt = penPoints[penDragIdx];
    pt.cx2 = wp.x; pt.cy2 = wp.y;
    pt.cx1 = pt.x*2 - wp.x; pt.cy1 = pt.y*2 - wp.y;
    render();
  }, true);
  canvas.addEventListener('mouseup', () => { penDragging = false; penDragIdx = -1; }, true);

  function onDblClick(e) {
    if (currentTool === 'pen' && penPoints.length > 1) { finishPen(true); return; }
    // double-click text to edit
    if (currentTool === 'select' && selectedIdx >= 0) {
      const sh = shapes[selectedIdx];
      if (sh.type === 'text') {
        const popup = $('textPopup');
        const input = $('textInput');
        popup.style.display = 'flex';
        popup.style.left = e.clientX + 'px'; popup.style.top = e.clientY + 'px';
        input.value = sh.text || '';
        input.focus(); input.select();
        const idx = selectedIdx;
        const confirm = () => {
          pushUndo();
          shapes[idx].text = input.value.trim() || shapes[idx].text;
          popup.style.display = 'none'; render(); autoSave();
        };
        $('textConfirm').onclick = confirm;
        $('textCancel').onclick = () => { popup.style.display = 'none'; };
        input.onkeydown = e2 => { if (e2.key==='Enter'&&!e2.shiftKey) { e2.preventDefault(); confirm(); } if (e2.key==='Escape') popup.style.display='none'; };
        return;
      }
      // double-click dimension to edit label
      if (sh.type === 'dimension') {
        showDimPopup(e.clientX, e.clientY, sh, true);
        return;
      }
    }
  }

  // -------- zoom ----------
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
    const newZoom = Math.max(0.08, Math.min(12, cam.zoom * factor));
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const wx = (sx - W/2) / cam.zoom + cam.x;
    const wy = (sy - H/2) / cam.zoom + cam.y;
    cam.zoom = newZoom;
    cam.x = wx - (sx - W/2) / cam.zoom;
    cam.y = wy - (sy - H/2) / cam.zoom;
    render();
  }

  // ==================== POPUPS ====================
  function showDimPopup(mx, my, shape, editExisting) {
    const popup = $('dimPopup');
    const input = $('dimInput');
    popup.style.display = 'flex';
    popup.style.left = Math.min(mx, window.innerWidth - 250) + 'px';
    popup.style.top  = Math.min(my, window.innerHeight - 60) + 'px';
    input.value = editExisting ? (shape.label || '') : '';
    input.focus(); if (editExisting) input.select();

    const confirm = () => {
      const val = input.value.trim();
      if (editExisting) {
        pushUndo(); shape.label = val;
      } else {
        shape.label = val;
        pushUndo(); shapes.push(shape);
      }
      tmpShape = null; popup.style.display = 'none'; render(); autoSave();
    };
    const cancel = () => { popup.style.display = 'none'; if (!editExisting) tmpShape = null; render(); };

    $('dimConfirm').onclick = confirm;
    $('dimCancel').onclick = cancel;
    input.onkeydown = e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') cancel(); };
  }

  function showTextPopup(mx, my, wp) {
    const popup = $('textPopup');
    const input = $('textInput');
    popup.style.display = 'flex';
    popup.style.left = Math.min(mx, window.innerWidth - 230) + 'px';
    popup.style.top  = Math.min(my, window.innerHeight - 120) + 'px';
    input.value = ''; input.focus();

    const confirm = () => {
      const txt = input.value.trim();
      if (txt) { pushUndo(); shapes.push({ type:'text', x:wp.x, y:wp.y, text:txt, stroke:getStroke(), fontSize:16, lineWidth:1 }); }
      popup.style.display = 'none'; render(); autoSave();
    };
    const cancel = () => { popup.style.display = 'none'; };

    $('textConfirm').onclick = confirm;
    $('textCancel').onclick = cancel;
    input.onkeydown = e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); confirm(); } if (e.key==='Escape') cancel(); };
  }

  // ==================== TOOLBAR BUTTONS ====================
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnClear').addEventListener('click', () => {
    if (!shapes.length || !confirm('Smazat celý náčrt? (Reset)')) return;
    pushUndo(); shapes = []; selectedIdx = -1; render();
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  });
  $('btnZoomFit').addEventListener('click', zoomFit);
  $('showGrid').addEventListener('change', render);
  $('gridSize').addEventListener('change', render);

  // Quick color swatches
  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      $('strokeColor').value = btn.dataset.color;
      $('strokeColorPicker').value = btn.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  $('strokeColorPicker').addEventListener('input', () => {
    $('strokeColor').value = $('strokeColorPicker').value;
    document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
  });
  $('strokeColor').addEventListener('input', () => {
    let v = $('strokeColor').value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      $('strokeColorPicker').value = v;
      $('strokeColor').value = v;
    }
    document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
  });

  function zoomFit() {
    cam.x = A4_W / 2; cam.y = A4_H / 2;
    cam.zoom = Math.min(W / (A4_W + 80), H / (A4_H + 80));
    render();
  }

  // ==================== KEYBOARD ====================
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'Delete' && selectedIdx >= 0) { pushUndo(); shapes.splice(selectedIdx,1); selectedIdx=-1; render(); autoSave(); return; }
    if (e.key === 'Escape') {
      if (currentTool === 'pen' && penPoints.length > 1) finishPen(false);
      else { selectedIdx=-1; tmpShape=null; penPoints=[]; render(); }
      return;
    }
    // Space = hand (hold)
    if (e.key === ' ' && !e.repeat) { e.preventDefault(); setTool('hand'); return; }
    const sc = { v:'select', h:'hand', p:'pencil', l:'line', r:'rect', e:'ellipse', b:'pen', t:'text', d:'dimension', f:'fence', x:'eraser' };
    if (sc[e.key.toLowerCase()] && !e.ctrlKey) setTool(sc[e.key.toLowerCase()]);
  });

  // ==================== PDF ====================
  $('btnPDF').addEventListener('click', showPDFPreview);

  function renderPDFCanvas(pdfScale) {
    pdfScale = pdfScale || 1;
    const off = document.createElement('canvas');
    off.width = A4_W * pdfScale; off.height = A4_H * pdfScale;
    const oc = off.getContext('2d');
    oc.scale(pdfScale, pdfScale);
    oc.fillStyle = '#fff'; oc.fillRect(0, 0, A4_W, A4_H);

    if (showGridOn()) {
      const g = getGridSize();
      oc.strokeStyle = 'rgba(180,190,210,0.2)'; oc.lineWidth = 0.5;
      for (let x = 0; x <= A4_W; x += g) { oc.beginPath(); oc.moveTo(x,0); oc.lineTo(x,A4_H); oc.stroke(); }
      for (let y = 0; y <= A4_H; y += g) { oc.beginPath(); oc.moveTo(0,y); oc.lineTo(A4_W,y); oc.stroke(); }
    }

    for (const sh of shapes) {
      oc.save();
      oc.strokeStyle = sh.stroke || '#000';
      oc.lineWidth = sh.lineWidth || 2;
      oc.lineCap = 'round'; oc.lineJoin = 'round';
      switch (sh.type) {
        case 'pencil': {
          if (sh.pts.length<2) break;
          oc.beginPath(); oc.moveTo(sh.pts[0].x, sh.pts[0].y);
          for (let i=1;i<sh.pts.length;i++) oc.lineTo(sh.pts[i].x, sh.pts[i].y);
          oc.stroke(); break;
        }
        case 'line': { oc.beginPath(); oc.moveTo(sh.x1,sh.y1); oc.lineTo(sh.x2,sh.y2); oc.stroke(); break; }
        case 'rect': {
          if (sh.fill) { oc.fillStyle=sh.fill; oc.fillRect(sh.x,sh.y,sh.w,sh.h); }
          oc.strokeRect(sh.x,sh.y,sh.w,sh.h); break;
        }
        case 'fence': {
          _drawFenceOnCtx(oc, sh, 1, false); break;
        }
        case 'ellipse': {
          oc.beginPath(); oc.ellipse(sh.cx,sh.cy,Math.abs(sh.rx),Math.abs(sh.ry),0,0,Math.PI*2);
          if (sh.fill) { oc.fillStyle=sh.fill; oc.fill(); }
          oc.stroke(); break;
        }
        case 'pen': {
          if (sh.pts.length<2) break;
          oc.beginPath(); oc.moveTo(sh.pts[0].x, sh.pts[0].y);
          for (let i=1;i<sh.pts.length;i++) {
            const prev=sh.pts[i-1], cur=sh.pts[i];
            if (prev.cx2!=null&&cur.cx1!=null) oc.bezierCurveTo(prev.cx2,prev.cy2,cur.cx1,cur.cy1,cur.x,cur.y);
            else oc.lineTo(cur.x,cur.y);
          }
          if (sh.closed) oc.closePath();
          if (sh.fill) { oc.fillStyle=sh.fill; oc.fill(); }
          oc.stroke(); break;
        }
        case 'text': {
          const fs=sh.fontSize||16;
          oc.font=`${fs}px sans-serif`; oc.fillStyle=sh.stroke||'#000'; oc.textBaseline='top';
          (sh.text||'').split('\n').forEach((l,i) => oc.fillText(l, sh.x, sh.y+i*fs*1.25));
          break;
        }
        case 'dimension': {
          _drawDimOnCtx(oc, sh, 1, false);
          break;
        }
        case 'image': {
          const img = _imgCache[sh.src];
          if (img) oc.drawImage(img, sh.x, sh.y, sh.w, sh.h);
          break;
        }
      }
      oc.restore();
    }
    return off;
  }

  let _pdfCanvas = null;
  function showPDFPreview() {
    _pdfCanvas = renderPDFCanvas(1);
    const preview = document.getElementById('pdfPreviewCanvas');
    // Scale to fit dialog
    const scale = Math.min(560 / A4_W, 1);
    preview.width = A4_W * scale;
    preview.height = A4_H * scale;
    const pc = preview.getContext('2d');
    pc.drawImage(_pdfCanvas, 0, 0, preview.width, preview.height);
    document.getElementById('pdfOverlay').style.display = 'flex';
  }

  function downloadPDF(quality) {
    const pdfScale = quality === 'hq' ? 3 : 1;
    const pdfCanvas = renderPDFCanvas(pdfScale);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgFormat = quality === 'hq' ? 'PNG' : 'JPEG';
    const imgData = quality === 'hq'
      ? pdfCanvas.toDataURL('image/png')
      : pdfCanvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imgData, imgFormat, 0, 0, A4_W_MM, A4_H_MM);
    pdf.save('nacrt-zamereni.pdf');
    document.getElementById('pdfOverlay').style.display = 'none';
  }

  $('pdfClose').addEventListener('click', () => {
    document.getElementById('pdfOverlay').style.display = 'none';
  });
  $('pdfDownloadLow').addEventListener('click', () => downloadPDF('low'));
  $('pdfDownloadHQ').addEventListener('click', () => downloadPDF('hq'));

  // ==================== INIT ====================
  resize();
  autoRestore();
  zoomFit();

  // ==================== IMPORT FENCE IMAGE FROM CALCULATOR ====================
  (function checkImport() {
    const raw = localStorage.getItem('plotyNacrtImage');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch(e) { return; }
    if (!data.withDims && !data.noDims) return;
    // Only show if data is less than 1 hour old
    if (Date.now() - (data.timestamp || 0) > 3600000) { localStorage.removeItem('plotyNacrtImage'); return; }

    // Show preview of the image
    const withDimsChk = document.getElementById('importWithDims');
    const previewCanvas = document.getElementById('importPreviewCanvas');
    const previewCtx = previewCanvas.getContext('2d');

    function updatePreview() {
      const src = withDimsChk.checked ? data.withDims : data.noDims;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(380 / img.width, 180 / img.height);
        previewCanvas.width = img.width * scale;
        previewCanvas.height = img.height * scale;
        previewCtx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
      };
      img.src = src;
    }
    updatePreview();
    withDimsChk.addEventListener('change', updatePreview);

    document.getElementById('importOverlay').style.display = 'flex';

    document.getElementById('importConfirm').addEventListener('click', () => {
      document.getElementById('importOverlay').style.display = 'none';
      const useDims = withDimsChk.checked;
      const imgSrc = useDims ? data.withDims : data.noDims;
      doImportImage(imgSrc, data.width, data.height);
      localStorage.removeItem('plotyNacrtImage');
    });
    document.getElementById('importSkip').addEventListener('click', () => {
      document.getElementById('importOverlay').style.display = 'none';
      localStorage.removeItem('plotyNacrtImage');
    });
  })();

  function doImportImage(src, origW, origH) {
    pushUndo();

    // Fit the image on the A4 paper with margins
    const marginMM = 15;
    const marginPx = marginMM * MM_PX;
    const paperW = A4_W - marginPx * 2;
    const paperH = A4_H - marginPx * 2;
    const aspect = origW / origH;

    let imgW, imgH;
    if (paperW / paperH > aspect) {
      imgH = paperH;
      imgW = imgH * aspect;
    } else {
      imgW = paperW;
      imgH = imgW / aspect;
    }

    const x = marginPx + (paperW - imgW) / 2;
    const y = marginPx + (paperH - imgH) / 2;

    shapes.push({
      type: 'image',
      src: src,
      x: x, y: y,
      w: imgW, h: imgH,
      stroke: '#000', lineWidth: 0, fill: null
    });

    // Pre-load the image
    _getImg(src);

    selectedIdx = shapes.length - 1;
    render();
    zoomFit();
    autoSave();
  }

})();
