// M25K Garden — flowers grow with streaks, wilt when streaks break
// Growth: seed → sprout → bud → bloom over 3 days
// Wilt:   bloom → drooping → dead over 3 days (triggers after 3 days no workout)
// Recovery: completing a workout cancels any wilt and resumes growth

const Garden = (() => {
  const STORE_KEY     = 'm25k_garden';
  const GROWTH_DAYS   = 3;   // days from planted to full bloom
  const IDLE_DAYS     = 3;   // days of no workout before wilting begins
  const WILT_DAYS     = 3;   // days from wilt-start to fully dead
  const MAX_FLOWERS   = 12;  // max flowers shown at once

  const FLOWER_COLORS = [
    '#FFD700', // gold   — weeks 1-2
    '#FF6B9D', // pink   — weeks 3-4
    '#FF8C42', // orange — weeks 5-6
    '#A78BFA', // purple — weeks 7-8
  ];

  // ── Persistence ────────────────────────────────────────────────────────

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function save(flowers) {
    localStorage.setItem(STORE_KEY, JSON.stringify(flowers));
  }

  // ── Public: plant a flower when workout completes ──────────────────────

  function plantFlower(weekIndex) {
    const flowers = load();
    flowers.push({
      id:          Date.now(),
      plantedAt:   new Date().toISOString(),
      wiltStartAt: null,
      color:       FLOWER_COLORS[Math.min(Math.floor(weekIndex / 2), 3)],
      dead:        false,
    });
    // Keep only the most recent MAX_FLOWERS
    if (flowers.length > MAX_FLOWERS) flowers.splice(0, flowers.length - MAX_FLOWERS);
    save(flowers);
  }

  // ── Public: call when user completes a workout — cancels any wilt ──────

  function onWorkoutComplete(weekIndex) {
    const flowers = load().map(f => ({
      ...f,
      wiltStartAt: null, // stop wilting on all living flowers
      dead: false,
    }));
    save(flowers);
    plantFlower(weekIndex);
  }

  // ── Compute live progress values for each flower ───────────────────────

  function computeStates() {
    const now     = Date.now();
    const flowers = load();
    const history = Storage.getHistory();

    // Find date of most recent workout
    const lastWorkoutMs = history.length
      ? Math.max(...history.map(r => new Date(r.date).getTime()))
      : null;

    const daysSinceWorkout = lastWorkoutMs
      ? (now - lastWorkoutMs) / 86400000
      : Infinity;

    // Determine wilt trigger date (3 idle days after last workout)
    const wiltTriggerMs = lastWorkoutMs
      ? lastWorkoutMs + IDLE_DAYS * 86400000
      : null;

    const updated = flowers.map(f => {
      const plantedMs   = new Date(f.plantedAt).getTime();
      const daysSincePlanted = (now - plantedMs) / 86400000;

      // Growth (0 → 1 over GROWTH_DAYS)
      let growthProgress = Math.min(1, daysSincePlanted / GROWTH_DAYS);

      // Should this flower be wilting?
      let wiltProgress = 0;
      let dead = false;

      if (wiltTriggerMs && now > wiltTriggerMs && plantedMs < wiltTriggerMs) {
        const daysSinceWilt = (now - wiltTriggerMs) / 86400000;
        wiltProgress = Math.min(1, daysSinceWilt / WILT_DAYS);
        dead = wiltProgress >= 1;
      }

      return { ...f, growthProgress, wiltProgress, dead };
    });

    return updated.filter(f => !f.dead);
  }

  // ── SVG rendering ──────────────────────────────────────────────────────

  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const W = container.clientWidth  || 360;
    const H = container.clientHeight || 320;
    const flowers = computeStates();

    const svg = createSVG(W, H, flowers);
    container.innerHTML = '';
    container.appendChild(svg);
  }

  // ── Time-of-day sky themes ───────────────────────────────────────────────
  function getSkyTheme() {
    const h = new Date().getHours(); // 0–23
    if (h >= 6 && h < 12) {
      // Morning — bright blue sky, soft golden sun
      return {
        name: 'morning',
        skyTop: '#87CEEB', skyBot: '#B0E0FF',
        grassTop: '#3a7a20', grassBot: '#234d10',
        grassBlade: '#4a9028',
        stars: false, moon: false,
        sun: { x: 0.25, y: 0.18, r: 22, color: '#FFD54F', glow: '#FFE082' },
        clouds: true,
      };
    } else if (h >= 12 && h < 17) {
      // Afternoon — deep blue sky, bright white sun high up
      return {
        name: 'afternoon',
        skyTop: '#4A90D9', skyBot: '#87CEEB',
        grassTop: '#3d8022', grassBot: '#254d12',
        grassBlade: '#52a030',
        stars: false, moon: false,
        sun: { x: 0.55, y: 0.10, r: 26, color: '#FFF176', glow: '#FFEE58' },
        clouds: true,
      };
    } else if (h >= 17 && h < 21) {
      // Evening — warm sunset oranges and purples
      return {
        name: 'evening',
        skyTop: '#1a0533', skyBot: '#FF6F3C',
        grassTop: '#2d5a1b', grassBot: '#1a3a0e',
        grassBlade: '#3a7024',
        stars: false, moon: false,
        sun: { x: 0.82, y: 0.72, r: 28, color: '#FF8F00', glow: '#FFCC02' },
        clouds: false,
        horizon: { color1: '#FF6F3C', color2: '#FF9800', color3: '#FFC107' },
      };
    } else {
      // Night — dark sky, moon, stars
      return {
        name: 'night',
        skyTop: '#0a0e1a', skyBot: '#1a1a2e',
        grassTop: '#1e3d12', grassBot: '#111f09',
        grassBlade: '#2a5018',
        stars: true, moon: true,
        sun: null,
        clouds: false,
      };
    }
  }

  function createSVG(W, H, flowers) {
    const ns    = 'http://www.w3.org/2000/svg';
    const svg   = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('xmlns', ns);
    svg.style.width  = '100%';
    svg.style.height = '100%';

    const soilY = H * 0.78;
    const skyH  = soilY;
    const theme = getSkyTheme();

    // ── Sky gradient ─────────────────────────────────────────────────────
    const skyGrad = makeDef(svg, 'linearGradient', { id: 'skyGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
    addStop(skyGrad, '0%',   theme.skyTop);
    addStop(skyGrad, '100%', theme.skyBot);
    rect(svg, 0, 0, W, skyH, 'url(#skyGrad)');

    // ── Evening horizon glow ─────────────────────────────────────────────
    if (theme.horizon) {
      const hg = makeDef(svg, 'linearGradient', { id: 'horizGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
      addStop(hg, '0%',   'transparent');
      addStop(hg, '60%',  theme.horizon.color2 + '99');
      addStop(hg, '100%', theme.horizon.color1);
      rect(svg, 0, skyH * 0.4, W, skyH * 0.6, 'url(#horizGrad)');
    }

    // ── Stars (night only) ───────────────────────────────────────────────
    if (theme.stars) {
      const starSeeds = [13, 37, 71, 97, 131, 157, 191, 223, 251, 277, 307, 331];
      starSeeds.forEach((s, i) => {
        const sx = ((s * 73 + i * 41) % W);
        const sy = ((s * 17 + i * 53) % (skyH * 0.75));
        const r  = (s % 3 === 0) ? 1.5 : 1;
        circle(svg, sx, sy, r, `rgba(255,255,255,${0.4 + (s % 5) * 0.1})`);
      });
    }

    // ── Moon (night only) ────────────────────────────────────────────────
    if (theme.moon) {
      circle(svg, W - 44, 36, 18, '#fffde0', { filter: 'drop-shadow(0 0 6px #fffde0)' });
      circle(svg, W - 36, 30, 14, theme.skyTop); // crescent mask
    }

    // ── Sun ──────────────────────────────────────────────────────────────
    if (theme.sun) {
      const sx = theme.sun.x * W;
      const sy = theme.sun.y * skyH;
      // Glow halo
      const glowGrad = makeDef(svg, 'radialGradient', { id: 'sunGlow', cx: '50%', cy: '50%', r: '50%' });
      addStop(glowGrad, '0%',   theme.sun.glow + 'CC');
      addStop(glowGrad, '60%',  theme.sun.glow + '44');
      addStop(glowGrad, '100%', 'transparent');
      const glowSize = theme.sun.r * 3.5;
      rect(svg, sx - glowSize, sy - glowSize, glowSize * 2, glowSize * 2, 'url(#sunGlow)');
      circle(svg, sx, sy, theme.sun.r, theme.sun.color);
    }

    // ── Clouds (morning / afternoon) ─────────────────────────────────────
    if (theme.clouds) {
      drawCloud(svg, W * 0.18, skyH * 0.22, 0.9, ns);
      drawCloud(svg, W * 0.65, skyH * 0.14, 0.65, ns);
      drawCloud(svg, W * 0.45, skyH * 0.38, 0.5, ns);
    }

    // ── Grass strip ──────────────────────────────────────────────────────
    const grassGrad = makeDef(svg, 'linearGradient', { id: 'grassGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
    addStop(grassGrad, '0%',   theme.grassTop);
    addStop(grassGrad, '100%', theme.grassBot);
    rect(svg, 0, soilY - 10, W, 22, 'url(#grassGrad)');

    // Grass blades
    for (let i = 0; i < W; i += 8) {
      const bh = 6 + (i * 7 % 10);
      const bx = i + (i % 3);
      line(svg, bx, soilY - 10, bx - 2, soilY - 10 - bh, theme.grassBlade, 1.5);
    }

    // ── Soil ─────────────────────────────────────────────────────────────
    const soilGrad = makeDef(svg, 'linearGradient', { id: 'soilGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
    addStop(soilGrad, '0%',   '#4a2e0e');
    addStop(soilGrad, '100%', '#2d1a06');
    rect(svg, 0, soilY + 12, W, H - soilY - 12, 'url(#soilGrad)');

    // ── Flowers ──────────────────────────────────────────────────────────
    if (flowers.length === 0) {
      // Empty state hint
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', W / 2);
      t.setAttribute('y', soilY - 20);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', 'rgba(255,255,255,0.25)');
      t.setAttribute('font-size', '13');
      t.setAttribute('font-family', 'Helvetica Neue, Arial, sans-serif');
      t.textContent = 'Complete your first workout to plant a flower';
      svg.appendChild(t);
    } else {
      const count   = flowers.length;
      const padding = W * 0.1;
      const spacing = (W - padding * 2) / Math.max(count - 1, 1);

      flowers.forEach((f, i) => {
        const x = count === 1 ? W / 2 : padding + i * spacing;
        drawFlower(svg, x, soilY, f.growthProgress, f.wiltProgress, f.color, W, ns);
      });
    }

    return svg;
  }

  function drawFlower(svg, x, groundY, growth, wilt, color, W, ns) {
    if (!ns) ns = 'http://www.w3.org/2000/svg';

    // Scale: flowers vary slightly based on position for depth
    const scale       = 0.75 + (x / W) * 0.4;
    const maxStemH    = 70 * scale;
    const stemH       = maxStemH * growth;
    const stemBaseY   = groundY + 2;
    const stemTopY    = stemBaseY - stemH;

    // Wilt causes the stem to lean and droop
    const lean        = wilt * 30;  // degrees lean
    const g           = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `rotate(${lean}, ${x}, ${stemBaseY})`);
    g.style.opacity   = String(1 - wilt * 0.3);

    // Stem color shifts green → brown as it wilts
    const stemColor   = lerpColor('#4CAF50', '#7B5E3A', wilt);
    const leafColor   = lerpColor('#66BB6A', '#5D4E37', wilt);

    if (growth > 0.05) {
      // Stem
      const stemEl = document.createElementNS(ns, 'line');
      stemEl.setAttribute('x1', x);
      stemEl.setAttribute('y1', stemBaseY);
      stemEl.setAttribute('x2', x);
      stemEl.setAttribute('y2', stemTopY);
      stemEl.setAttribute('stroke', stemColor);
      stemEl.setAttribute('stroke-width', 2.5 * scale);
      stemEl.setAttribute('stroke-linecap', 'round');
      g.appendChild(stemEl);

      // Leaves (appear at growth > 0.4)
      if (growth > 0.4) {
        const leafOpacity = Math.min(1, (growth - 0.4) / 0.3);
        const leafY = stemBaseY - stemH * 0.45;
        const leafSize = 10 * scale * leafOpacity;
        drawLeaf(g, x, leafY, leafSize, -25, leafColor, ns);
        drawLeaf(g, x, leafY + 6 * scale, leafSize, 25, leafColor, ns);
      }
    }

    // Flower head (appears at growth > 0.6)
    if (growth > 0.6) {
      const headProgress = (growth - 0.6) / 0.4; // 0→1
      const petalSize    = 8 * scale * headProgress * (1 - wilt * 0.5);
      const centerR      = 4 * scale * headProgress;
      const headColor    = lerpColor(color, '#8B6914', wilt * 0.7);
      const centerColor  = lerpColor('#FFF9C4', '#5D3A00', wilt * 0.8);

      // Drooping: petals close as wilt increases
      const petalSpread = 1 - wilt * 0.6;

      // 6 petals
      for (let p = 0; p < 6; p++) {
        const angle  = (p / 6) * Math.PI * 2;
        const dist   = petalSize * 1.1 * petalSpread;
        const px     = x + Math.cos(angle) * dist;
        const py     = stemTopY + Math.sin(angle) * dist;
        const petal  = document.createElementNS(ns, 'ellipse');
        petal.setAttribute('cx', px);
        petal.setAttribute('cy', py);
        petal.setAttribute('rx', petalSize * 0.75);
        petal.setAttribute('ry', petalSize * 1.1);
        petal.setAttribute('fill', headColor);
        petal.setAttribute('opacity', 0.9);
        petal.setAttribute('transform', `rotate(${p * 60}, ${px}, ${py})`);
        g.appendChild(petal);
      }

      // Center
      const cEl = document.createElementNS(ns, 'circle');
      cEl.setAttribute('cx', x);
      cEl.setAttribute('cy', stemTopY);
      cEl.setAttribute('r',  centerR);
      cEl.setAttribute('fill', centerColor);
      g.appendChild(cEl);
    } else if (growth > 0.3) {
      // Bud
      const budH = 10 * scale * ((growth - 0.3) / 0.3);
      const budColor = lerpColor(color, '#2e7d32', 0.5);
      const bud = document.createElementNS(ns, 'ellipse');
      bud.setAttribute('cx', x);
      bud.setAttribute('cy', stemTopY);
      bud.setAttribute('rx', 4 * scale);
      bud.setAttribute('ry', budH);
      bud.setAttribute('fill', budColor);
      g.appendChild(bud);
    }

    svg.appendChild(g);
  }

  function drawLeaf(parent, x, y, size, angle, color, ns) {
    const leaf = document.createElementNS(ns, 'ellipse');
    leaf.setAttribute('cx', x + (angle > 0 ? size : -size) * 0.4);
    leaf.setAttribute('cy', y);
    leaf.setAttribute('rx', size * 0.7);
    leaf.setAttribute('ry', size * 0.35);
    leaf.setAttribute('fill', color);
    leaf.setAttribute('transform', `rotate(${angle}, ${x}, ${y})`);
    parent.appendChild(leaf);
  }

  // ── SVG helpers ────────────────────────────────────────────────────────

  function makeDef(svg, tag, attrs) {
    const ns  = 'http://www.w3.org/2000/svg';
    let defs  = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.appendChild(defs); }
    const el  = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    defs.appendChild(el);
    return el;
  }

  function addStop(grad, offset, color) {
    const ns   = 'http://www.w3.org/2000/svg';
    const stop = document.createElementNS(ns, 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    grad.appendChild(stop);
  }

  function rect(svg, x, y, w, h, fill) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('fill', fill);
    svg.appendChild(el);
    return el;
  }

  function circle(svg, cx, cy, r, fill, style) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'circle');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
    el.setAttribute('fill', fill);
    if (style) Object.entries(style).forEach(([k, v]) => el.style[k] = v);
    svg.appendChild(el);
    return el;
  }

  function line(svg, x1, y1, x2, y2, stroke, width) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', width);
    svg.appendChild(el);
  }

  // Lerp between two hex colors
  function lerpColor(a, b, t) {
    const parse = hex => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bv})`;
  }

  // ── Cloud helper ──────────────────────────────────────────────────────
  function drawCloud(svg, cx, cy, scale, ns) {
    const color = 'rgba(255,255,255,0.82)';
    const bubbles = [
      { dx: 0,    dy: 0,  r: 16 * scale },
      { dx: -18 * scale, dy: 6 * scale, r: 12 * scale },
      { dx:  18 * scale, dy: 6 * scale, r: 12 * scale },
      { dx: -10 * scale, dy: 10 * scale, r: 14 * scale },
      { dx:  10 * scale, dy: 10 * scale, r: 14 * scale },
      { dx:   0,   dy: 12 * scale, r: 16 * scale },
    ];
    bubbles.forEach(b => circle(svg, cx + b.dx, cy + b.dy, b.r, color));
  }

  // ── Garden status text ─────────────────────────────────────────────────

  function getStatusText() {
    const history = Storage.getHistory();
    if (!history.length) return { headline: 'Your garden awaits', sub: 'Complete a workout to plant your first flower.' };

    const now = Date.now();
    const lastMs = Math.max(...history.map(r => new Date(r.date).getTime()));
    const daysSince = (now - lastMs) / 86400000;
    const streak = Storage.getStreak();

    if (daysSince < 1)   return { headline: `🌸 Blooming`, sub: `${streak} day streak — your garden is thriving!` };
    if (daysSince < 2)   return { headline: `🌼 Growing`, sub: `Get back out there to keep your garden healthy.` };
    if (daysSince < IDLE_DAYS) return { headline: `🥀 Getting thirsty`, sub: `Your flowers need a workout soon.` };
    if (daysSince < IDLE_DAYS + WILT_DAYS) return { headline: `🥀 Wilting`, sub: `Your flowers are drooping — rescue them with a run!` };
    return { headline: `💀 Garden needs help`, sub: `Start a new streak to bring your garden back to life.` };
  }

  return { onWorkoutComplete, render, getStatusText, computeStates };
})();
