/* Small, reversible rectangle physics. No clones, global DOM takeover or disk writes. */
export function stepBodies(bodies, width, height, gx, gy, dt) {
  const bounds = b => {
    if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * .45; }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * .45; }
    if (b.x + b.w > width) { b.x = Math.max(0, width - b.w); b.vx = -Math.abs(b.vx) * .45; }
    if (b.y + b.h > height) { b.y = Math.max(0, height - b.h); b.vy = -Math.abs(b.vy) * .45; }
  };
  for (const b of bodies) {
    if (!b.dragging) {
      b.vx = Math.max(-600, Math.min(600, (b.vx + gx * dt) * .998));
      b.vy = Math.max(-600, Math.min(600, (b.vy + gy * dt) * .998));
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    bounds(b);
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x + b.w / 2 - a.x - a.w / 2;
      const dy = b.y + b.h / 2 - a.y - a.h / 2;
      const ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      const nx = ox < oy ? Math.sign(dx) || 1 : 0, ny = ox < oy ? 0 : Math.sign(dy) || 1;
      const ia = a.dragging ? 0 : 1 / Math.max(100, a.w * a.h);
      const ib = b.dragging ? 0 : 1 / Math.max(100, b.w * b.h);
      if (!(ia + ib)) continue;
      const penetration = Math.min(ox, oy) + .01;
      a.x -= nx * penetration * ia / (ia + ib); a.y -= ny * penetration * ia / (ia + ib);
      b.x += nx * penetration * ib / (ia + ib); b.y += ny * penetration * ib / (ia + ib);
      const velocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (velocity < 0) {
        const impulse = -1.45 * velocity / (ia + ib);
        a.vx -= impulse * ia * nx; a.vy -= impulse * ia * ny;
        b.vx += impulse * ib * nx; b.vy += impulse * ib * ny;
      }
    }
    for (const b of bodies) bounds(b);
  }
}

export function createWindowPhysics(win) {
  const body = win.body;
  const container = body.querySelector('.app-grid') || body.querySelector('.app-content');
  if (!container) throw Error('This window has no items to bounce.');
  const elements = [...container.children].filter(el => !el.matches('script,style,hr,[hidden]'));
  if (elements.length > 64) throw Error('Physics supports up to 64 items. Try a smaller folder.');
  const oldBodyStyle = body.getAttribute('style'), oldContainerStyle = container.getAttribute('style');
  const scroll = [body.scrollLeft, body.scrollTop];
  const restoreStyle = (el, style) => style === null ? el.removeAttribute('style') : el.setAttribute('style', style);
  const originalRotation = win.element.style.rotate, originalScale = win.element.style.scale;
  win.element.style.rotate = '0deg'; win.element.style.scale = '1';
  body.scrollTop = body.scrollLeft = 0;
  const base = container.getBoundingClientRect(), outer = body.getBoundingClientRect();
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(60, body.clientHeight - (base.top - outer.top) - 4);
  const records = elements.map(el => ({ el, style: el.getAttribute('style'), rect: el.getBoundingClientRect() })).filter(r => r.rect.width >= 8 && r.rect.height >= 8);
  win.element.style.rotate = originalRotation; win.element.style.scale = originalScale;
  const area = records.reduce((sum, r) => sum + r.rect.width * r.rect.height, 0);
  const scale = Math.min(1, Math.sqrt(width * height * .55 / Math.max(1, area)));
  const bodies = records.map((r, i) => {
    const size = Math.min(scale, width / r.rect.width, height / r.rect.height);
    const b = { ...r, scale: size, w: r.rect.width * size, h: r.rect.height * size, x: Math.min(width - r.rect.width * size, Math.max(0, r.rect.left - base.left)), y: Math.min(height - r.rect.height * size, Math.max(0, r.rect.top - base.top)), vx: (i % 2 ? 1 : -1) * (35 + i * 3), vy: -30, dragging: false };
    Object.assign(r.el.style, { position: 'absolute', left: '0px', top: '0px', margin: '0', width: `${r.rect.width}px`, height: `${r.rect.height}px`, transformOrigin: '0 0', overflow: 'auto', flex: 'none' });
    r.el.classList.add('physics-item');
    return b;
  });
  Object.assign(container.style, { position: 'relative', height: `${height}px`, minHeight: '0', overflow: 'hidden' });
  body.style.overflow = 'hidden'; container.classList.add('physics-container');
  let frame = 0, previous = 0, accumulator = 0, stopped = false, held = null, suppressClick = false;
  const draw = () => { for (const b of bodies) b.el.style.transform = `translate(${b.x}px, ${b.y}px) scale(${b.scale})`; };
  const tick = time => {
    frame = 0;
    if (stopped || win.element.hidden || document.hidden || getComputedStyle(win.element).visibility === 'hidden') { previous = 0; return; }
    accumulator += previous ? Math.min(.04, (time - previous) / 1000) : 1 / 120; previous = time;
    const radians = (win.rotation || 0) * Math.PI / 180;
    while (accumulator >= 1 / 120) { stepBodies(bodies, width, height, Math.sin(radians) * 800, Math.cos(radians) * 800, 1 / 120); accumulator -= 1 / 120; }
    draw(); frame = requestAnimationFrame(tick);
  };
  const localDelta = (dx, dy) => { const a = (win.rotation || 0) * Math.PI / 180; const scale = win.effectScale || 1; return [(Math.cos(a) * dx + Math.sin(a) * dy) / scale, (-Math.sin(a) * dx + Math.cos(a) * dy) / scale]; };
  const down = event => {
    if (held || event.button !== 0 || (event.target.closest('input,textarea,select,label,a,button') && !event.target.closest('.app-file'))) return;
    const b = bodies.find(b => b.el === event.target || b.el.contains(event.target)); if (!b) return;
    held = { b, px: event.clientX, py: event.clientY, x: b.x, y: b.y, time: performance.now(), moved: false };
    b.dragging = true; b.el.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!held) return;
    const [dx, dy] = localDelta(event.clientX - held.px, event.clientY - held.py);
    if (Math.hypot(dx, dy) > 3) held.moved = true;
    held.b.x = Math.max(0, Math.min(width - held.b.w, held.x + dx));
    held.b.y = Math.max(0, Math.min(height - held.b.h, held.y + dy));
  };
  const up = () => {
    if (!held) return;
    const seconds = Math.max(.03, (performance.now() - held.time) / 1000);
    held.b.vx = (held.b.x - held.x) / seconds; held.b.vy = (held.b.y - held.y) / seconds;
    held.b.dragging = false; suppressClick = held.moved; held = null;
    setTimeout(() => { suppressClick = false; }, 0);
  };
  const click = event => { if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); } };
  container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', up); container.addEventListener('pointercancel', up); container.addEventListener('lostpointercapture', up);
  container.addEventListener('click', click, true);
  draw(); frame = requestAnimationFrame(tick);
  return {
    pause() { cancelAnimationFrame(frame); frame = 0; previous = 0; },
    resume() { if (!stopped && !frame) frame = requestAnimationFrame(tick); },
    stop() {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(frame);
      container.removeEventListener('pointerdown', down); container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerup', up); container.removeEventListener('pointercancel', up); container.removeEventListener('lostpointercapture', up); container.removeEventListener('click', click, true);
      for (const b of bodies) { restoreStyle(b.el, b.style); b.el.classList.remove('physics-item'); }
      restoreStyle(container, oldContainerStyle); restoreStyle(body, oldBodyStyle); container.classList.remove('physics-container');
      body.scrollLeft = scroll[0]; body.scrollTop = scroll[1];
    }
  };
}
