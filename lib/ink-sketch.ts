// Deterministic "ballpoint" geometry. Every shape is derived from a seed, so
// the server and the client draw the exact same wobble (no hydration drift),
// and the same box keeps its personality across renders and resizes.

type Pt = readonly [number, number];
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(input: string | number): number {
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const n1 = (v: number) => Math.round(v * 10) / 10;
const pt = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
const spread = (r: Rng, amount: number) => (r() - 0.5) * 2 * amount;

/** One hand-pulled stroke from a to b: jittered ends, a gentle bow, optional overshoot. */
function strokeSegment(
  r: Rng,
  a: Pt,
  b: Pt,
  { bow = 1, jitter = 0.8, overshoot = 0 }: { bow?: number; jitter?: number; overshoot?: number } = {},
) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const o1 = overshoot * (0.3 + r() * 0.7);
  const o2 = overshoot * (0.3 + r() * 0.7);
  const s: Pt = [a[0] - ux * o1 + spread(r, jitter), a[1] - uy * o1 + spread(r, jitter)];
  const e: Pt = [b[0] + ux * o2 + spread(r, jitter), b[1] + uy * o2 + spread(r, jitter)];
  const amp = Math.min(len * 0.018, 2.4) * bow;
  const bias = spread(r, amp);
  const c1: Pt = [s[0] + dx * 0.32 + nx * (bias + spread(r, amp * 0.5)), s[1] + dy * 0.32 + ny * (bias + spread(r, amp * 0.5))];
  const c2: Pt = [s[0] + dx * 0.68 + nx * (bias + spread(r, amp * 0.5)), s[1] + dy * 0.68 + ny * (bias + spread(r, amp * 0.5))];
  return { s, c1, c2, e };
}

/** A single straight-ish pen line. */
export function lineStroke(seed: number, a: Pt, b: Pt, opts?: { bow?: number; jitter?: number; overshoot?: number }) {
  const { s, c1, c2, e } = strokeSegment(createRng(seed), a, b, opts);
  return `M${pt(s)}C${pt(c1)} ${pt(c2)} ${pt(e)}`;
}

/**
 * A box drawn in one continuous motion: each side runs a little past its
 * corner and the pen ticks back into the next side, so the corners cross the
 * way quick ballpoint boxes do.
 */
export function boxStroke(seed: number, w: number, h: number, { overshoot = 2.4, bow = 1, jitter = 0.7 } = {}) {
  const r = createRng(seed);
  const corners: Pt[] = [
    [spread(r, jitter), spread(r, jitter)],
    [w + spread(r, jitter), spread(r, jitter)],
    [w + spread(r, jitter), h + spread(r, jitter)],
    [spread(r, jitter), h + spread(r, jitter)],
  ];
  let d = "";
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const seg = strokeSegment(r, a, b, { bow, jitter: jitter * 0.5, overshoot });
    d += i === 0 ? `M${pt(seg.s)}` : `L${pt(seg.s)}`;
    d += `C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
  }
  return d;
}

/** Catmull-Rom through points, emitted as cubic Béziers. */
function smooth(points: Pt[]) {
  if (points.length < 2) return "";
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

/**
 * A pen line through the given points, each nudged by up to `jitter`, as
 * one smooth curve. `closed` runs it back round to the start (and a little
 * past, the way a pen closes a shape).
 */
export function handCurve(seed: number, points: readonly Pt[], { jitter = 0.15, closed = false } = {}) {
  const r = createRng(seed);
  const pts = points.map((p): Pt => [p[0] + spread(r, jitter), p[1] + spread(r, jitter)]);
  if (!closed) return smooth(pts);
  const past: Pt = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
  return smooth([...pts, pts[0], past]);
}

/** A loose loop around a box — the "circle it with a pen" gesture. */
export function loopStroke(seed: number, w: number, h: number, { turns = 1.12, pad = 4 } = {}) {
  const r = createRng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 + pad;
  const ry = h / 2 + pad;
  const start = -Math.PI * (0.62 + r() * 0.2);
  const steps = 16;
  const phase = r() * Math.PI * 2;
  const points: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + t * turns * Math.PI * 2;
    const k = 1 + 0.055 * Math.sin(a * 2 + phase) - t * 0.07 + spread(r, 0.018);
    points.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(points);
}

/**
 * Heading underline, the way a hand underlines with emphasis: one pull
 * rising to the right, a sharp snap back under itself, then on past the end
 * of the word, gone over a second time, with a stray dash where the pen
 * lifted. Starts a little left of the word, the way the pen lands early.
 */
export function underlineStroke(seed: number, w: number, { hook = true } = {}) {
  const r = createRng(seed);
  const start: Pt = [-9 - r() * 4, 5.5 + spread(r, 0.8)];
  const turn: Pt = [w * (0.5 + r() * 0.12), 1.6 + spread(r, 0.6)];
  const first = strokeSegment(r, start, turn, { bow: 0.5, jitter: 0.3 });
  let d = `M${pt(first.s)}C${pt(first.c1)} ${pt(first.c2)} ${pt(first.e)}`;
  if (!hook) return d;
  // Snap back: short, sharp, a touch lower.
  const back: Pt = [turn[0] - w * (0.13 + r() * 0.06), 5 + spread(r, 0.6)];
  d += `L${pt(back)}`;
  const end: Pt = [w * (1.05 + r() * 0.05), 0.6 + spread(r, 0.5)];
  const second = strokeSegment(r, back, end, { bow: 0.5, jitter: 0.3 });
  d += `C${pt(second.c1)} ${pt(second.c2)} ${pt(second.e)}`;
  // A lighter second pass over the first run, and the stray dash.
  const again = strokeSegment(r, [w * 0.04, 4.4 + spread(r, 0.5)], [turn[0] - w * 0.06, 2.4], { bow: 0.4, jitter: 0.4 });
  d += `M${pt(again.s)}C${pt(again.c1)} ${pt(again.c2)} ${pt(again.e)}`;
  const dashX = end[0] + 3 + r() * 3;
  d += `M${pt([dashX, end[1] + 0.4])}L${pt([dashX + 5 + r() * 4, end[1] + 0.1])}`;
  return d;
}

/** Link underline: one relaxed stroke with a slight lift at the end. */
export function linkStroke(seed: number, w: number) {
  const r = createRng(seed);
  const y = 2 + spread(r, 0.4);
  const seg = strokeSegment(r, [-1, y], [w + 1.5, y - 0.8 - r() * 0.8], { bow: 1.2, jitter: 0.3 });
  return `M${pt(seg.s)}C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
}

/** A gently wandering horizontal rule. */
export function ruleStroke(seed: number, w: number) {
  const r = createRng(seed);
  const n = Math.max(3, Math.round(w / 140));
  const points: Pt[] = [];
  for (let i = 0; i <= n; i++) points.push([(w * i) / n + (i === 0 || i === n ? 0 : spread(r, 8)), 1.5 + spread(r, 0.9)]);
  return smooth(points);
}

/** A near-vertical divider stroke. */
export function verticalStroke(seed: number, h: number) {
  return lineStroke(seed, [1.5, 0], [1.5, h], { bow: 0.6, jitter: 0.5, overshoot: 1 });
}

/**
 * Back-and-forth colouring-in strokes filling a w×h box, overrunning the
 * edges a touch, like shading a button solid with a pen.
 */
export function scribbleFill(seed: number, w: number, h: number, { gap = 3.4, slant = 0.45, overrun = 1.6 } = {}) {
  const r = createRng(seed);
  const run = h * slant;
  let x = -run - 2;
  let top = true;
  let d = `M${pt([x + run, -overrun])}`;
  while (x < w + 2) {
    x += gap * (0.8 + r() * 0.4);
    const p: Pt = top ? [x, h + overrun + spread(r, 0.8)] : [x + run, -overrun + spread(r, 0.8)];
    d += `L${pt(p)}`;
    top = !top;
  }
  return d;
}

/** Parallel hatch strokes across a w×h box, returned one path per stroke. */
export function hatchStrokes(seed: number, w: number, h: number, { gap = 5, angle = -48, jitter = 0.8, inset = 0 } = {}) {
  const r = createRng(seed);
  const t = Math.tan((angle * Math.PI) / 180);
  const lines: string[] = [];
  const span = Math.abs(t) * h;
  for (let c = -span; c < w + span; c += gap * (0.85 + r() * 0.3)) {
    // Line: x = c + y * t (t negative leans right-to-left going down).
    const pts: Pt[] = [];
    for (const y of [inset, h - inset]) {
      const x = c + (y - inset) * t;
      pts.push([x, y]);
    }
    let [a, b] = pts;
    const clip = (p: Pt, q: Pt): Pt => {
      let [x, y] = p;
      if (x < inset) {
        y = p[1] + ((inset - p[0]) * (q[1] - p[1])) / (q[0] - p[0]);
        x = inset;
      } else if (x > w - inset) {
        y = p[1] + ((w - inset - p[0]) * (q[1] - p[1])) / (q[0] - p[0]);
        x = w - inset;
      }
      return [x, y];
    };
    a = clip(a, b);
    b = clip(b, a);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3) continue;
    const seg = strokeSegment(r, a, b, { bow: 0.5, jitter });
    lines.push(`M${pt(seg.s)}C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`);
  }
  return lines;
}

/**
 * A long line pulled freehand along x, from 0 to w at height y. A hand's
 * long line is never level: it drifts up or down over the run, bows a
 * little, and wanders either side of that every finger's width or so.
 * `sway` scales all three. `points` are where it passes, left to right, so
 * things set on the line can sit on it.
 */
export function wanderStroke(seed: number, w: number, y = 0, { sway = 1 } = {}) {
  return wander(createRng(seed), w, y, sway);
}

function wander(r: Rng, w: number, y: number, sway: number) {
  const n = Math.max(3, Math.round(w / 90));
  const drift = spread(r, 3 * sway);
  const arch = spread(r, 3 * sway);
  const points: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const end = i === 0 || i === n;
    const x = i === n ? w : w * t + spread(r, end ? 0.6 : w / n / 6);
    points.push([n1(x), n1(y + drift * (t * 2 - 1) + arch * Math.sin(t * Math.PI) + spread(r, (end ? 0.4 : 2.6) * sway))]);
  }
  return { d: smooth(points), points };
}

/** A long timeline stroke, pulled freehand, ending in a two-flick arrowhead. */
export function arrowStroke(seed: number, w: number, y = 6) {
  const r = createRng(seed);
  const { d, points } = wander(r, w, y, 1);
  // The head is flicked in along the line's last run.
  const tip = points[points.length - 1];
  const before = points[points.length - 2];
  const angle = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const at = (dx: number, dy: number): Pt => [tip[0] + dx * cos - dy * sin, tip[1] + dx * sin + dy * cos];
  const head = `M${pt(at(-9 + spread(r, 1), -5.5 + spread(r, 0.8)))}Q${pt(at(-3, -1.5))} ${pt(at(1, 0))}Q${pt(at(-3, 1.8))} ${pt(at(-8.5 + spread(r, 1), 5 + spread(r, 0.8)))}`;
  return { shaft: d, head, points };
}

/** A small filled ink dot: a tight scribbled spiral. */
export function dotStroke(seed: number, radius = 3) {
  const r = createRng(seed);
  const points: Pt[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 4.2 + r() * 0.3;
    const k = radius * (1 - t * 0.75) + spread(r, 0.25);
    points.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  return smooth(points);
}

/** An irregular ink blot with a few droplets, in a 0–100 box, for masks. */
export function blotPath(seed: number) {
  const r = createRng(seed);
  const points: Pt[] = [];
  const steps = 22;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k = 38 + spread(r, 5) + (r() > 0.8 ? 4 + r() * 5 : 0);
    points.push([50 + Math.cos(a) * k, 50 + Math.sin(a) * k]);
  }
  points.push(points[0], points[1], points[2]);
  let d = smooth(points.slice(1)) + "Z";
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const dist = 44 + r() * 5;
    const rad = 0.8 + r() * 2.2;
    const cx = 50 + Math.cos(a) * dist;
    const cy = 50 + Math.sin(a) * dist;
    d += `M${n1(cx - rad)} ${n1(cy)}a${n1(rad)} ${n1(rad)} 0 1 0 ${n1(rad * 2)} 0a${n1(rad)} ${n1(rad)} 0 1 0 ${n1(-rad * 2)} 0Z`;
  }
  return d;
}

/**
 * A box drawn as four separate pulls, the pen lifted between sides: each
 * line runs well past its corners, so corners cross like a quick sketch.
 * `shift` nudges the whole pass, for re-traced outlines that don't line up.
 */
export function crossedBoxStroke(
  seed: number,
  w: number,
  h: number,
  { overshoot = 5, jitter = 1.2, bow = 1.1, shift = [0, 0] as Pt } = {},
) {
  const r = createRng(seed);
  const [sx, sy] = shift;
  const c: Pt[] = [
    [sx + spread(r, jitter), sy + spread(r, jitter)],
    [w + sx + spread(r, jitter), sy + spread(r, jitter)],
    [w + sx + spread(r, jitter), h + sy + spread(r, jitter)],
    [sx + spread(r, jitter), h + sy + spread(r, jitter)],
  ];
  let d = "";
  // Top, right, bottom, left — in the order a hand tends to go.
  for (const [a, b] of [[0, 1], [1, 2], [3, 2], [0, 3]] as const) {
    const seg = strokeSegment(r, c[a], c[b], { bow, jitter: jitter * 0.4, overshoot });
    d += `M${pt(seg.s)}C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
  }
  return d;
}

/**
 * Shading a box solid with a ballpoint: long shallow strokes swept back and
 * forth without lifting the pen, at uneven spacing so streaks of paper show.
 */
export function shadeFill(seed: number, w: number, h: number, { gap = 2.6, angle = -16, overrun = 3 } = {}) {
  const r = createRng(seed);
  const t = Math.tan((angle * Math.PI) / 180);
  // Strokes are near-horizontal lines y = c + x·t, stepped down the box.
  const span = Math.abs(t) * w;
  let c = -overrun - (t < 0 ? 0 : span);
  const end = h + overrun + (t < 0 ? span : 0);
  let forward = true;
  let d = "";
  while (c < end) {
    const x0 = -overrun - r() * 2;
    const x1 = w + overrun + r() * 2;
    const a: Pt = [x0, c + x0 * t + spread(r, 0.6)];
    const b: Pt = [x1, c + x1 * t + spread(r, 0.6)];
    const [p, q] = forward ? [a, b] : [b, a];
    const seg = strokeSegment(r, p, q, { bow: 0.6, jitter: 0.4 });
    d += d ? `L${pt(seg.s)}` : `M${pt(seg.s)}`;
    d += `C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
    forward = !forward;
    c += gap * (0.6 + r() * 0.9);
  }
  return d;
}

/** A few short shadow ticks across one corner of a box (bottom-right). */
export function cornerTicks(seed: number, w: number, h: number, { count = 5, len = 7 } = {}) {
  const r = createRng(seed);
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = w - 6 - i * (4.2 + r() * 1.4);
    const y = h + 1 + spread(r, 0.8);
    const seg = strokeSegment(r, [x - len * 0.45, y + len * 0.5], [x + len * 0.45, y - len * 0.5], { bow: 0.3, jitter: 0.4 });
    d += `M${pt(seg.s)}C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
  }
  return d;
}

// ─── Marks for controls ───────────────────────────────────────────────
// Small shapes drawn inside a box of side `s` (or w×h): ticks, crosses,
// chevrons, rings and tracks. Each is one path the pen draws in order, so
// it can draw itself in.

/** A tick: a short drop into the corner, then a long pull up and out past the box. */
export function tickStroke(seed: number, s: number) {
  const r = createRng(seed);
  const a: Pt = [s * (0.1 + spread(r, 0.03)), s * (0.5 + spread(r, 0.04))];
  const b: Pt = [s * (0.4 + spread(r, 0.03)), s * (0.84 + spread(r, 0.03))];
  const c: Pt = [s * (1 + r() * 0.1), s * (-0.06 + spread(r, 0.05))];
  const down = strokeSegment(r, a, b, { bow: 0.3, jitter: 0 });
  const up = strokeSegment(r, b, c, { bow: 0.9, jitter: 0 });
  return `M${pt(a)}C${pt(down.c1)} ${pt(down.c2)} ${pt(b)}C${pt(up.c1)} ${pt(up.c2)} ${pt(c)}`;
}

/** A cross: two pulls, the second a touch shorter, crossing a little off centre. */
export function crossStroke(seed: number, s: number, { inset = 0.16 } = {}) {
  const r = createRng(seed);
  const i = s * inset;
  const one = strokeSegment(r, [i, i], [s - i, s - i], { bow: 0.6, jitter: s * 0.03 });
  const two = strokeSegment(r, [s - i * 1.1, i * 1.2], [i * 1.2, s - i * 1.05], { bow: 0.6, jitter: s * 0.03 });
  return `M${pt(one.s)}C${pt(one.c1)} ${pt(one.c2)} ${pt(one.e)}M${pt(two.s)}C${pt(two.c1)} ${pt(two.c2)} ${pt(two.e)}`;
}

/** A short level dash across a box of width w (minus, indeterminate). */
export function dashStroke(seed: number, w: number, y = 0) {
  const r = createRng(seed);
  const seg = strokeSegment(r, [w * 0.12, y + spread(r, 0.4)], [w * 0.88, y + spread(r, 0.4)], { bow: 0.5, jitter: 0.2 });
  return `M${pt(seg.s)}C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
}

/** A plus: a dash across, then one down through it. Fits 0…s. */
export function plusStroke(seed: number, s: number) {
  const r = createRng(seed);
  const across = strokeSegment(r, [s * 0.1, s * 0.5], [s * 0.9, s * 0.5], { bow: 0.5, jitter: s * 0.03 });
  const down = strokeSegment(r, [s * 0.5, s * 0.1], [s * 0.5, s * 0.9], { bow: 0.5, jitter: s * 0.03 });
  return `M${pt(across.s)}C${pt(across.c1)} ${pt(across.c2)} ${pt(across.e)}M${pt(down.s)}C${pt(down.c1)} ${pt(down.c2)} ${pt(down.e)}`;
}

export type Direction = "down" | "up" | "left" | "right";

/** A chevron: two legs meeting in a point, the second pulled a touch longer. Fits 0…w × 0…h. */
export function chevronStroke(seed: number, w: number, h: number, dir: Direction = "down") {
  const r = createRng(seed);
  // Drawn pointing down in a unit square, then turned to face `dir`.
  const unit: Pt[] = [
    [0.04 + spread(r, 0.03), 0.22 + spread(r, 0.04)],
    [0.5 + spread(r, 0.03), 0.8 + spread(r, 0.03)],
    [0.98 + spread(r, 0.03), 0.16 + spread(r, 0.04)],
  ];
  const turn = ([x, y]: Pt): Pt =>
    dir === "down" ? [x * w, y * h] : dir === "up" ? [x * w, (1 - y) * h] : dir === "right" ? [y * w, x * h] : [(1 - y) * w, x * h];
  const [a, tip, b] = unit.map(turn);
  const one = strokeSegment(r, a, tip, { bow: 0.4, jitter: 0 });
  const two = strokeSegment(r, tip, b, { bow: 0.4, jitter: 0 });
  return `M${pt(a)}C${pt(one.c1)} ${pt(one.c2)} ${pt(tip)}C${pt(two.c1)} ${pt(two.c2)} ${pt(b)}`;
}

/** A ring drawn in one go, closing a little past where it started. Fits 0…d. */
export function ringStroke(seed: number, d: number, { turns = 1.1 } = {}) {
  return loopStroke(seed, d, d, { turns, pad: 0 });
}

/**
 * A rounded box pulled in one motion, the way a hand draws one: starting a
 * little before the top-left corner, round the outline, and running on past
 * where it began. `r` is clamped to the box (r = h/2 gives a pill); `shift`
 * nudges the whole pass, for re-traced outlines that don't line up.
 * Fits 0…w × 0…h.
 */
export function roundedBoxStroke(
  seed: number,
  w: number,
  h: number,
  r: number,
  { overrun = 0.08, jitter = 0.45, shift = [0, 0] as Pt } = {},
) {
  const rand = createRng(seed);
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  const runX = Math.max(0, w - 2 * rad);
  const runY = Math.max(0, h - 2 * rad);
  const arc = (Math.PI / 2) * rad;
  const total = 2 * runX + 2 * runY + 4 * arc;
  if (!total) return "";
  // Sides and corners in drawing order, clockwise from the top-left.
  const parts: { len: number; at: (t: number) => Pt }[] = [
    { len: runX, at: (t) => [rad + t * runX, 0] },
    { len: arc, at: (t) => corner(w - rad, rad, -Math.PI / 2 + (t * Math.PI) / 2) },
    { len: runY, at: (t) => [w, rad + t * runY] },
    { len: arc, at: (t) => corner(w - rad, h - rad, (t * Math.PI) / 2) },
    { len: runX, at: (t) => [w - rad - t * runX, h] },
    { len: arc, at: (t) => corner(rad, h - rad, Math.PI / 2 + (t * Math.PI) / 2) },
    { len: runY, at: (t) => [0, h - rad - t * runY] },
    { len: arc, at: (t) => corner(rad, rad, Math.PI + (t * Math.PI) / 2) },
  ];
  function corner(cx: number, cy: number, a: number): Pt {
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  }
  const pointAt = (l: number): Pt => {
    l = ((l % total) + total) % total;
    for (const part of parts) {
      if (l <= part.len && part.len > 0) return part.at(l / part.len);
      l -= part.len;
    }
    return parts[0].at(0);
  };
  // Dense enough to hold the corners' curve, sparse along the runs so the
  // jitter reads as a hand, not as noise.
  const step = Math.max(2.5, Math.min(9, rad * 0.6 || 9));
  const start = -total * (0.015 + rand() * 0.03);
  const end = total * (1 + overrun);
  const points: Pt[] = [];
  for (let l = start; l <= end + 0.01; l += step) {
    const [x, y] = pointAt(l);
    points.push([x + shift[0] + spread(rand, jitter), y + shift[1] + spread(rand, jitter)]);
  }
  return smooth(points);
}

// Where each re-traced outline lands relative to the first.
const passShifts: readonly Pt[] = [
  [0, 0],
  [1.8, -1.6],
  [-1.4, 2.2],
];

/**
 * A box outline the way the pen settings describe it, gone over `passes`
 * times: sides pulled separately past each other ("crossed"), one joined
 * motion ("joined"), or rounded when `radius` > 0. `roughness` scales every
 * wobble (0 is ruler-neat); small boxes get shorter overshoots. Fits 0…w × 0…h.
 */
export function penBoxStrokes(
  seed: number,
  w: number,
  h: number,
  { roughness = 1, passes = 2, corners = "crossed" as "crossed" | "joined", radius = 0 } = {},
): string[] {
  const q = roughness;
  const k = Math.min(1, Math.min(w, h) / 40);
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return Array.from({ length: Math.max(1, Math.min(3, passes)) }, (_, i) => {
    const shift: Pt = [passShifts[i][0] * k * q, passShifts[i][1] * k * q];
    if (r > 0) return roundedBoxStroke(seed + i, w, h, r, { jitter: 0.25 * q, overrun: 0.03 + 0.05 * q, shift });
    if (corners === "joined") return boxStroke(seed + i, w, h, { overshoot: [2.4, 2.6, 2.2][i] * k * q, jitter: [0.7, 1.5, 1.8][i] * q, bow: q });
    return crossedBoxStroke(seed + i, w, h, { overshoot: [4, 7, 5][i] * k * q, jitter: [1.2, 1.6, 1.8][i] * q, bow: 1.1 * q, shift });
  });
}

/** The exact outline of a rounded box, closed: for fills, masks and clips. */
export function roundedRectPath(w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!rad) return `M0 0H${n1(w)}V${n1(h)}H0Z`;
  const a = `A${n1(rad)} ${n1(rad)} 0 0 1`;
  return `M${n1(rad)} 0H${n1(w - rad)}${a} ${n1(w)} ${n1(rad)}V${n1(h - rad)}${a} ${n1(w - rad)} ${n1(h)}H${n1(rad)}${a} 0 ${n1(h - rad)}V${n1(rad)}${a} ${n1(rad)} 0Z`;
}

/** A capsule (a switch track): a pill pulled in one motion. Fits 0…w × 0…h. */
export function capsuleStroke(seed: number, w: number, h: number, { overrun = 0.1, jitter = 0.45 } = {}) {
  return roundedBoxStroke(seed, w, h, h / 2, { overrun, jitter });
}

/**
 * Margin scrawls as pen pulls (feed to inkPulls). The kinds of marks a page
 * collects while someone gets a ballpoint going.
 */

/** Fast back-and-forth with sharp turns, drifting as the hand moves on. */
export function zigzagPulls(seed: number, w: number, h: number, { passes = 6, vertical = true } = {}): Pt[][] {
  const r = createRng(seed);
  const pts: Pt[] = [];
  const length = vertical ? h : w;
  const breadth = vertical ? w : h;
  let along = 0;
  for (let i = 0; i <= passes; i++) {
    // Uneven reach on both sides, and the hand runs ahead on the out-stroke.
    const swing = i % 2 ? breadth * (0.5 + r() * 0.5) : breadth * r() * 0.3;
    pts.push(vertical ? [swing, along] : [along, swing]);
    along = Math.min(length, along + (length / passes) * (i % 2 ? 0.3 + r() * 0.5 : 0.9 + r() * 0.9));
  }
  return [pts];
}

/** A corner worked over: long leaning pulls, a fan of flicks, a jagged cross. */
export function cornerPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const out: Pt[][] = [];
  for (let i = 0; i < 4; i++) {
    const x = w * (0.16 + i * 0.07 + r() * 0.06);
    out.push([
      [x + w * 0.05, h * r() * 0.06],
      [x - w * 0.06 + spread(r, 2), h * (0.95 - i * 0.15 - r() * 0.1)],
    ]);
  }
  const ox = w * 0.08;
  const oy = h * 0.22;
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.24 + spread(r, 0.08);
    const len = w * (0.8 + r() * 0.3);
    out.push([
      [ox + spread(r, 3), oy + spread(r, 3)],
      [ox + Math.cos(a) * len, oy + Math.sin(a) * len],
    ]);
  }
  out.push(...zigzagPulls(seed + 1, w * 0.9, h * 0.14, { passes: 7, vertical: false }));
  return out;
}

/** A star scratched in a hurry: four or five pulls through roughly one point. */
export function starPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const n = 4 + Math.round(r());
  const out: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI + spread(r, 0.25);
    const rx = (w / 2) * (0.7 + r() * 0.3);
    const ry = (h / 2) * (0.7 + r() * 0.3);
    const ox = w / 2 + spread(r, w * 0.07);
    const oy = h / 2 + spread(r, h * 0.07);
    out.push([
      [ox - Math.cos(a) * rx, oy - Math.sin(a) * ry],
      [ox + Math.cos(a) * rx, oy + Math.sin(a) * ry],
    ]);
  }
  return out;
}

/** A patch of parallel slashes, like shading struck into a corner. */
export function slashPulls(seed: number, w: number, h: number, { count = 7 } = {}): Pt[][] {
  const r = createRng(seed);
  const out: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const x = (w / count) * i + spread(r, 1.5);
    const len = h * (0.55 + r() * 0.45);
    const top = (h - len) * r();
    out.push([
      [x + h * 0.35, top],
      [x, top + len],
    ]);
  }
  return out;
}

/** A spiral, the way a pen is got going: three turns out from a point, a little uneven. */
export function spiralPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const turns = 2.6 + r() * 0.5;
  const steps = 54;
  const phase = r() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * Math.PI * 2;
    const k = 0.08 + t * 0.92;
    pts.push([w / 2 + Math.cos(a) * (w / 2) * k * (1 + spread(r, 0.05)), h / 2 + Math.sin(a) * (h / 2) * k * (1 + spread(r, 0.05))]);
  }
  return [pts];
}

/** A row of looping cursive: the line that tests whether a pen writes. */
export function loopPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const loops = 5 + Math.round(r() * 2);
  const steps = loops * 9;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * loops * Math.PI * 2;
    // A cycloid with its loops tipped forward: the pen moves on as it circles.
    pts.push([(w - h * 0.5) * t + h * 0.25 - Math.sin(a) * h * 0.34 + spread(r, 0.5), h / 2 - Math.cos(a) * h * 0.4 + spread(r, 0.5)]);
  }
  return [pts];
}

/** A long wave, pulled across and then back a little lower, the second pass looser. */
export function wavePulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const crests = 3 + Math.round(r());
  const wave = (y: number, amp: number, from: number, to: number, phase: number): Pt[] =>
    Array.from({ length: crests * 10 + 1 }, (_, i) => {
      const t = i / (crests * 10);
      return [from + (to - from) * t, y + Math.sin(t * crests * Math.PI * 2 + phase) * amp * (1 + spread(r, 0.12))] as Pt;
    });
  return [wave(h * 0.35, h * 0.28, 0, w, 0), wave(h * 0.66, h * 0.24, w * 0.03, w * 0.96, 0.8 + r())];
}

/** A cross struck through something: two long pulls, the second a hurried afterthought. */
export function crossPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  return [
    [[w * (0.08 + r() * 0.06), h * (0.1 + r() * 0.08)], [w * (0.9 + r() * 0.06), h * (0.9 + r() * 0.06)]],
    [[w * (0.9 + r() * 0.06), h * (0.08 + r() * 0.08)], [w * (0.08 + r() * 0.06), h * (0.92 + r() * 0.05)]],
    [[w * 0.2, h * 0.5 + spread(r, 2)], [w * 0.8, h * 0.52 + spread(r, 2)]],
  ];
}

/** An asterisk: six spokes through one point, drawn round in turn. */
export function asteriskPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const out: Pt[][] = [];
  const turn = r() * 0.4;
  for (let i = 0; i < 3; i++) {
    const a = turn + (i / 3) * Math.PI + spread(r, 0.1);
    const [rx, ry] = [(w / 2) * (0.85 + r() * 0.15), (h / 2) * (0.85 + r() * 0.15)];
    out.push([[w / 2 - Math.cos(a) * rx, h / 2 - Math.sin(a) * ry], [w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry]]);
  }
  return out;
}

/** A ring pulled round twice, and not quite closed either time. */
export function ringPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  const round = (grow: number, turns: number, from: number): Pt[] =>
    Array.from({ length: 26 }, (_, i) => {
      const t = i / 25;
      const a = from + t * turns * Math.PI * 2;
      const k = 1 - 0.06 * t + grow;
      return [w / 2 + Math.cos(a) * (w / 2 - 2) * (k + spread(r, 0.025)) + spread(r, 1.1), h / 2 + Math.sin(a) * (h / 2 - 2) * (k + spread(r, 0.04)) + spread(r, 1.1)] as Pt;
    });
  const start = -Math.PI * (0.5 + r() * 0.3);
  return [round(0, 1.06, start), round(0.04, 0.95, start + 0.5)];
}

/** A tick, put quickly: a short down-stroke and a long flick up. */
export function tickPulls(seed: number, w: number, h: number): Pt[][] {
  const r = createRng(seed);
  return [[[w * (0.06 + r() * 0.04), h * (0.55 + r() * 0.06)], [w * (0.32 + r() * 0.04), h * (0.9 + r() * 0.05)], [w * (0.94 + r() * 0.04), h * (0.06 + r() * 0.06)]]];
}

/** Three quick emphasis dashes fanning out, like the marks beside a signature. */
export function flickPulls(seed: number): Pt[][] {
  const r = createRng(seed);
  return [
    [[3 + spread(r, 1), 14], [10 + spread(r, 1), 2]],
    [[10, 19 + spread(r, 1)], [22, 12 + spread(r, 1)]],
    [[13, 25 + spread(r, 0.8)], [25, 24 + spread(r, 0.8)]],
  ];
}

/** Two or three tiny scratches, the pen touched down and lifted. */
export function speckPulls(seed: number): Pt[][] {
  const r = createRng(seed);
  const out: Pt[][] = [];
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * (7 + r() * 6);
    const y = 4 + spread(r, 2.5);
    const a = r() * Math.PI;
    const l = 1.5 + r() * 2.5;
    out.push([
      [x - Math.cos(a) * l, y - Math.sin(a) * l],
      [x + Math.cos(a) * l, y + Math.sin(a) * l],
    ]);
  }
  return out;
}

/**
 * The footer's signature rule: a long, gently wandering line pulled twice,
 * the second pass starting late and drifting off the first, running out into
 * a worried knot at the right end. Fits 0…w by roughly -34…16.
 */
export function signaturePulls(seed: number, w: number): { rule: Pt[][]; knot: Pt[][] } {
  const r = createRng(seed);
  const pass = (y: number, from: number, to: number) => {
    const n = Math.max(4, Math.round((to - from) / 90));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) pts.push([from + ((to - from) * i) / n + (i && i < n ? spread(r, 10) : 0), y + spread(r, 0.9)]);
    return pts;
  };
  const rule = [pass(5, 0, w - 30), pass(5.8, w * (0.3 + r() * 0.15), w - 8)];
  // The knot: fast slanted back-and-forth climbing up and right, worried
  // over twice, with flat pulls through its foot where the rule ran in.
  const kx = w - 96;
  const zig = (offset: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const cx = kx + 10 + t * 70 + offset;
      const cy = 4 - t * 22;
      const reach = 6 + Math.sin(t * Math.PI) * 13 + r() * 5;
      const side = i % 2 ? 1 : -1;
      pts.push([cx + side * reach * 0.55 + spread(r, 3), cy + side * reach + spread(r, 2)]);
    }
    return pts;
  };
  const flat: Pt[][] = [0, 1, 2].map((i) => [
    [kx - 40 - r() * 40, 5 + spread(r, 1.5)],
    [w - 4 + r() * 4, 2 - i * 2.5 + spread(r, 1.5)],
  ]);
  return { rule, knot: [zig(0), ...flat, zig(5)] };
}

// ─── Ballpoint ink ──────────────────────────────────────────────────────
// A uniform SVG stroke reads as a vector line. A pen doesn't draw like that:
// it lands light, presses through the stroke, and lifts off thin; it pools a
// little where it turns. These helpers build strokes as filled ribbons whose
// width follows that pressure, plus the centreline used to draw them on.

type Seg = { s: Pt; c1: Pt; c2: Pt; e: Pt };
type InkPt = { x: number; y: number; w: number };

const cubicAt = ({ s, c1, c2, e }: Seg, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * s[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
    u * u * u * s[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1],
  ];
};

const segPath = ({ s, c1, c2, e }: Seg) => `M${pt(s)}C${pt(c1)} ${pt(c2)} ${pt(e)}`;

/**
 * Sample a stroke with a pressure profile: `land` and `lift` are how much of
 * the stroke the pen takes to reach full pressure and to leave the paper
 * (0 keeps it full at that end, for strokes that join another).
 */
function pressured(r: Rng, seg: Seg, weight: number, { land = 0.12, lift = 0.25, from = 0.35, to = 0.12 } = {}): InkPt[] {
  const len = Math.hypot(seg.e[0] - seg.s[0], seg.e[1] - seg.s[1]);
  const n = Math.max(10, Math.round(len / 3));
  const phase = r() * Math.PI * 2;
  const freq = 2 + r() * 3;
  const out: InkPt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = cubicAt(seg, t);
    let p = 1;
    if (land > 0 && t < land) p = from + (1 - from) * Math.sin(((t / land) * Math.PI) / 2);
    if (lift > 0 && t > 1 - lift) p = Math.min(p, to + (1 - to) * Math.cos((((t - (1 - lift)) / lift) * Math.PI) / 2));
    // The hand's pressure wanders a little along the stroke.
    const wobble = 1 + 0.16 * Math.sin(t * freq * Math.PI + phase);
    out.push({ x, y, w: weight * p * wobble });
  }
  return out;
}

/** Outline a pressured centreline as one filled shape, with rounded ends. */
function ribbon(pts: InkPt[]) {
  const n = pts.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const dirs: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, n - 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    const h = pts[i].w / 2;
    dirs.push([tx, ty]);
    left.push([pts[i].x - ty * h, pts[i].y + tx * h]);
    right.push([pts[i].x + ty * h, pts[i].y - tx * h]);
  }
  const tip = (i: number, sign: number): Pt => [pts[i].x + dirs[i][0] * sign * pts[i].w * 0.7, pts[i].y + dirs[i][1] * sign * pts[i].w * 0.7];
  let d = `M${pt(left[0])}`;
  for (let i = 1; i < n; i++) d += `L${pt(left[i])}`;
  d += `Q${pt(tip(n - 1, 1))} ${pt(right[n - 1])}`;
  for (let i = n - 2; i >= 0; i--) d += `L${pt(right[i])}`;
  d += `Q${pt(tip(0, -1))} ${pt(left[0])}Z`;
  return d;
}

/**
 * A recorded pen line (a signature, a doodle) as one filled ribbon: `w` is
 * the line's width at each point. A single point, a tap, is a dot.
 */
export function inkRibbon(points: readonly { x: number; y: number; w: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return blob([points[0].x, points[0].y], points[0].w * 0.6);
  return ribbon(points as InkPt[]);
}

const blob = (p: Pt, rad: number) =>
  `M${n1(p[0] - rad)} ${n1(p[1])}a${n1(rad)} ${n1(rad)} 0 1 0 ${n1(rad * 2)} 0a${n1(rad)} ${n1(rad)} 0 1 0 ${n1(-rad * 2)} 0Z`;

export type InkStroke = {
  /** Filled ribbons (several subpaths), and how dark this pass is. */
  ink: string;
  opacity: number;
  /** Centreline the draw-on mask follows, and when it runs. */
  guide: string;
  at: number;
  dur: number;
};

/**
 * Heading underline, the way a hand underlines with emphasis: the pen lands
 * a little left of the word and below it, pulls right and up, snaps back
 * under itself, then runs on past the end and lifts off thin. A lighter
 * second pass goes over the first run, and a stray dash follows the lift.
 * Fits roughly -18…w+18 by -2…16.
 */
export function underlineInk(seed: number, w: number, { weight = 2.5, lead = 0 } = {}): InkStroke[] {
  const r = createRng(seed);
  // `lead` moves the landing right, for a heading that must not reach into its neighbours.
  const start: Pt = [lead - 12 - r() * 4, 12.5 + spread(r, 0.8)];
  const turn: Pt = [w * (0.5 + r() * 0.12), 3.6 + spread(r, 0.6)];
  // The snap is short and steep — a flick, not a second line.
  const back: Pt = [turn[0] - Math.min(38, Math.max(15, w * (0.07 + r() * 0.04))), 10.2 + spread(r, 0.6)];
  const end: Pt = [w * (1.03 + r() * 0.04) + 4, -0.6 + spread(r, 0.6)];

  const run = strokeSegment(r, start, turn, { bow: 0.7, jitter: 0.25 });
  const snap = strokeSegment(r, turn, back, { bow: 0.15, jitter: 0.15 });
  const out = strokeSegment(r, back, end, { bow: 0.6, jitter: 0.25 });
  // The second pass lands later and lifts sooner, a pen width under the first.
  const again = strokeSegment(r, [-6 + r() * 6, 14 + spread(r, 0.5)], [turn[0] - w * 0.08, 6.4 + spread(r, 0.5)], {
    bow: 0.6,
    jitter: 0.3,
  });
  const dx = end[0] + 5 + r() * 4;
  const dash = strokeSegment(r, [dx, end[1] + 0.6], [dx + 7 + r() * 5, end[1] + 0.1], { bow: 0.2, jitter: 0.2 });

  const main =
    ribbon(pressured(r, run, weight, { land: 0.1, lift: 0, from: 0.3 })) +
    ribbon(pressured(r, snap, weight * 0.85, { land: 0, lift: 0 })) +
    ribbon(pressured(r, out, weight, { land: 0, lift: 0.3, to: 0.1 })) +
    // Ink pools where the pen turns.
    blob(turn, weight * 0.62) +
    blob(back, weight * 0.55);

  return [
    { ink: main, opacity: 0.95, guide: segPath(run) + `L${pt(snap.e)}` + `C${pt(out.c1)} ${pt(out.c2)} ${pt(out.e)}`, at: 0, dur: 620 },
    { ink: ribbon(pressured(r, again, weight * 0.7, { land: 0.15, lift: 0.3 })), opacity: 0.7, guide: segPath(again), at: 520, dur: 260 },
    { ink: ribbon(pressured(r, dash, weight * 0.7, { land: 0.3, lift: 0.5, from: 0.2 })), opacity: 0.85, guide: segPath(dash), at: 640, dur: 90 },
  ];
}

/**
 * Any set of pen pulls in ballpoint ink. Each pull is a polyline the pen
 * follows without lifting: each leg is a slightly bowed stroke, the pen
 * lands light on the first and lifts thin off the last, and ink pools at
 * sharp turns. Pulls are drawn one after another, `gap` ms apart.
 */
export function inkPulls(
  seed: number,
  pulls: Pt[][],
  { weight = 1.3, opacity = 0.9, dur = 160, gap = 70, bow = 0.6, retrace = 0, wander = 1.6 } = {},
): InkStroke[] {
  const r = createRng(seed);
  // Scrawls get gone over: some pulls are traced again straight after, a
  // little off the first line, lighter, and not quite to either end.
  const all: { pts: Pt[]; again: boolean }[] = [];
  for (const pts of pulls) {
    all.push({ pts, again: false });
    if (r() < retrace) {
      const again = pts.map((p) => [p[0] + spread(r, wander), p[1] + spread(r, wander)] as Pt);
      const trim = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      again[0] = trim(again[0], again[1], r() * 0.25);
      const n = again.length - 1;
      again[n] = trim(again[n], again[n - 1], r() * 0.2);
      all.push({ pts: again, again: true });
    }
  }
  let at = 0;
  return all.map(({ pts, again }) => {
    const pw = again ? weight * 0.75 : weight;
    let ink = "";
    let guide = `M${pt(pts[0])}`;
    let length = 0;
    const legs = pts.length - 1;
    for (let i = 0; i < legs; i++) {
      const seg = strokeSegment(r, pts[i], pts[i + 1], { bow, jitter: 0.2 });
      seg.s = pts[i];
      if (i < legs - 1) seg.e = pts[i + 1];
      ink += ribbon(
        pressured(r, seg, pw, {
          land: i === 0 ? 0.25 : 0,
          lift: i === legs - 1 ? 0.35 : 0,
          from: 0.3,
          to: 0.08,
        }),
      );
      guide += `C${pt(seg.c1)} ${pt(seg.c2)} ${pt(seg.e)}`;
      length += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (i > 0) {
        const a = pts[i - 1];
        const b = pts[i];
        const c = pts[i + 1];
        const cos =
          ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) /
          ((Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])) || 1);
        if (cos < 0.3) ink += blob(b, pw * 0.55);
      }
    }
    const pass = {
      ink,
      opacity: opacity * (again ? 0.6 : 0.85 + r() * 0.15),
      guide,
      at,
      dur: Math.round(dur * Math.min(2.4, Math.max(0.6, length / 60)) * (again ? 0.7 : 1)),
    };
    at += pass.dur * (again ? 0.9 : 0.6) + gap;
    return pass;
  });
}

/**
 * A highlighter swipe across a w×h row: a filled band whose long edges
 * wander a little and whose ends are left ragged, the way a marker starts
 * and stops. Closed, for fills and masks.
 */
export function swipePath(seed: number, w: number, h: number, { inset = 1.5 } = {}) {
  const r = createRng(seed);
  const along = (x: number) => (x / Math.max(w, 1)) * Math.PI * (1 + r() * 0.6);
  const top = (x: number) => inset + spread(r, 0.9) + Math.sin(along(x)) * 0.6;
  const bottom = (x: number) => h - inset + spread(r, 0.9) - Math.sin(along(x)) * 0.6;
  const steps = 6;
  const xs = Array.from({ length: steps + 1 }, (_, i) => (w * i) / steps);
  const upper = xs.map((x, i): Pt => [i === 0 ? 2 + r() * 2 : i === steps ? w - 2 - r() * 2 : x, top(x)]);
  const lower = xs.map((x, i): Pt => [i === 0 ? 1 + r() * 3 : i === steps ? w - 1 - r() * 3 : x, bottom(x)]).reverse();
  // Ragged ends: the marker bites in a little before lifting.
  const end: Pt = [w + spread(r, 1.2), h / 2 + spread(r, 2)];
  const start: Pt = [spread(r, 1.2), h / 2 + spread(r, 2)];
  return `${smooth([start, ...upper, end])}${smooth([end, ...lower, start]).replace(/^M/, "L")}Z`;
}

// ─── Underline shapes ───────────────────────────────────────────────────
// A heading's underline is whatever the hand felt like: one of these, picked
// by the heading's seed, so each title keeps its own and no two in a row are
// likely to match. All of them stay inside -4…w and 1…19, so a title never
// strikes through, or into, the thing beside it.

export const underlineShapes = ["swoosh", "double", "wave", "zigzag", "loop", "flick"] as const;
export type UnderlineShape = (typeof underlineShapes)[number];

/** The shape a seed picks. */
export const underlineShapeFor = (seed: number): UnderlineShape => underlineShapes[seed % underlineShapes.length];

/** An underline for a title `w` wide, in one of `underlineShapes`; inside -4…w by 1…19. */
export function underlineShape(seed: number, w: number, shape: UnderlineShape = underlineShapeFor(seed)): InkStroke[] {
  const r = createRng(seed);
  const weight = { weight: 2.4 };
  switch (shape) {
    case "swoosh":
      // The dash after the lift reaches ~30px past the end, so the run is shortened to fit.
      return underlineInk(seed, Math.max(40, (w - 30) / 1.07), { ...weight, lead: 12 });
    case "double": {
      // Two pulls, the second shorter and a little under the first, gone over twice.
      const y = 7 + r() * 2;
      const a: Pt[] = [[0, y + 2], [w * 0.5, y - 0.4], [w - 4, y - 1.4]];
      const b: Pt[] = [[w * (0.1 + r() * 0.1), y + 7.5], [w * 0.55, y + 5.8], [w * (0.8 + r() * 0.1), y + 5]];
      return inkPulls(seed, [a, b], { ...weight, dur: 330, retrace: 0.5, wander: 1.1, gap: 90 });
    }
    case "wave": {
      // A tilde stretched under the title: two or three swells, dipping from a level line.
      const swells = Math.max(2, Math.round(w / 70));
      const y = 9 + r() * 2;
      const amp = 3.2 + r() * 1.6;
      const steps = swells * 4;
      const pts: Pt[] = Array.from({ length: steps + 1 }, (_, i) => [1 + ((w - 5) * i) / steps, y + Math.sin((i / 4) * Math.PI * 2) * amp + (i ? spread(r, 0.5) : 0)]);
      return inkPulls(seed, [pts], { ...weight, weight: 2.2, dur: 380, bow: 0.3 });
    }
    case "zigzag": {
      // Quick sharp zigs, the way a pen is tried out, with a plain pull to finish.
      const step = 6 + r() * 3;
      const pts: Pt[] = [];
      for (let x = 0, up = true; x < w - 8; x += step, up = !up) pts.push([x + 2 + spread(r, 0.6), (up ? 5 : 13) + spread(r, 1.1)]);
      return inkPulls(seed, [pts, [[w * 0.1, 16.5], [w - 4, 15 + spread(r, 1)]]], { ...weight, weight: 1.9, dur: 150, gap: 120, bow: 0.25 });
    }
    case "loop": {
      // A long pull that ends in a loop, the pen still going as it lifts.
      const y = 11 + spread(r, 1);
      const end = w - 14;
      const rad = 4.2 + r() * 1.2;
      const loop: Pt[] = Array.from({ length: 11 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        return [end + Math.cos(a) * rad + i * 0.5, y - 1.6 + Math.sin(a) * rad] as Pt;
      });
      return inkPulls(seed, [[[0, y + 3], [w * 0.4, y + 0.2], [end - 4, y - 0.4], ...loop, [w - 3, y - 0.6]]], { ...weight, dur: 600, bow: 0.5 });
    }
    case "flick": {
      // A level pull, then three short ticks flicked off its tail.
      const y = 11 + r() * 3;
      const tail = Math.max(24, w * 0.3);
      const ticks: Pt[][] = [0, 1, 2].map((i) => {
        const x = w - tail * (0.9 - i * 0.28) - 2;
        return [[x, y + 6.5 + spread(r, 0.6)], [x + 5 + spread(r, 1), y - 0.8 + spread(r, 0.6)]];
      });
      return inkPulls(seed, [[[0, y + 1.5], [w * 0.5, y - 0.6], [w - 4, y + 0.4]], ...ticks], { ...weight, dur: 260, gap: 70, retrace: 0.3 });
    }
  }
}
