// A sheet of Ballpoint paper as one self-contained SVG. Text is turned into
// Gaegu outlines (GitHub's image proxy loads no fonts) and every mark is
// scheduled on one clock, so a sheet writes itself in the order a hand would.
// All motion is CSS, and every element's resting state is its finished state,
// so with reduced motion, or a renderer that skips animation, the page reads.

import { readFileSync } from "node:fs";
import opentype from "opentype.js";
import type { Theme } from "./color.ts";
import { createRng, hashSeed, type InkStroke } from "./ink-sketch.ts";

const load = (file: string) => {
  const b = readFileSync(new URL(`../fonts/${file}`, import.meta.url));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
export const fonts = { regular: load("Gaegu-Regular.ttf"), bold: load("Gaegu-Bold.ttf") };
export type Font = typeof fonts.regular;

const n1 = (v: number) => Math.round(v * 10) / 10;
const s2 = (v: number) => `${Math.round(v * 100) / 100}s`;
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Width of `text` set at `size`, kerning included. */
export function measure(text: string, size: number, font: Font = fonts.regular) {
  return font.getAdvanceWidth(text, size, { kerning: true });
}

/** Greedy word wrap to `max` px. */
export function wrap(text: string, size: number, max: number, font: Font = fonts.regular) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size, font) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

type WriteOpts = {
  x: number;
  y: number;
  size: number;
  font?: Font;
  color?: string;
  at?: number;
  /** Seconds per letter. */
  pace?: number;
  anchor?: "start" | "middle" | "end";
  /** How much each letter leaves the line: tilt, lift and size. */
  wobble?: number;
  pen?: boolean;
  seed?: string | number;
};

type PenStop = { t: number; x: number; y: number };

export class Sheet {
  readonly w: number;
  readonly h: number;
  readonly t: Theme;
  private defs: string[] = [];
  private body: string[] = [];
  private stops: PenStop[] = [];
  private uid = 0;
  private prefix: string;
  /** The latest moment anything is still being drawn. */
  end = 0;

  constructor(w: number, h: number, theme: Theme, id: string) {
    this.w = w;
    this.h = h;
    this.t = theme;
    this.prefix = id.replace(/[^a-z0-9]/gi, "");
  }

  id(kind: string) {
    return `${this.prefix}-${kind}${this.uid++}`;
  }

  private bump(t: number) {
    this.end = Math.max(this.end, t);
  }

  add(svg: string) {
    this.body.push(svg);
  }

  addDef(svg: string) {
    this.defs.push(svg);
  }

  /**
   * Writes `text` letter by letter: each letter's outline is traced and then
   * fills with ink, a little off the line the way handwriting sits. Returns
   * where the line ended, in space and time.
   */
  write(text: string, o: WriteOpts) {
    const font = o.font ?? fonts.regular;
    const color = o.color ?? this.t.ink;
    const pace = o.pace ?? 0.06;
    const wobble = o.wobble ?? 1;
    const r = createRng(hashSeed(o.seed ?? text));
    const width = measure(text, o.size, font);
    let x = o.x - (o.anchor === "middle" ? width / 2 : o.anchor === "end" ? width : 0);
    const left = x;
    let t = o.at ?? 0;
    const scale = o.size / font.unitsPerEm;
    const glyphs = font.stringToGlyphs(text);
    const out: string[] = [];
    glyphs.forEach((g, i) => {
      const adv = (g.advanceWidth ?? 0) * scale;
      const kern = i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * scale : 0;
      const tilt = (r() - 0.5) * 5 * wobble;
      const lift = (r() - 0.5) * o.size * 0.045 * wobble;
      const grow = 1 + (r() - 0.5) * 0.06 * wobble;
      const d = g.getPath(0, 0, o.size * grow).toPathData(1);
      if (d) {
        const cx = adv / 2;
        out.push(
          `<path class="w" pathLength="1" transform="translate(${n1(x)} ${n1(o.y + lift)}) rotate(${n1(tilt)} ${n1(cx)} ${n1(-o.size * 0.3)})" d="${d}" style="animation-delay:${s2(t)}"/>`,
        );
        if (o.pen !== false) this.stops.push({ t, x: x + adv * 0.15, y: o.y - o.size * 0.3 }, { t: t + pace * 0.9, x: x + adv * 0.85, y: o.y - o.size * 0.12 });
        t += pace;
      } else t += pace * 0.5;
      x += adv + kern;
    });
    this.add(`<g fill="${color}" stroke="${color}" stroke-width="${n1(Math.max(0.5, o.size / 70))}" stroke-linejoin="round">${out.join("")}</g>`);
    this.bump(t + 0.4);
    return { left, right: x, width, end: t };
  }

  /** Ballpoint ribbons (from ink-sketch) revealed along their centrelines. */
  ink(strokes: InkStroke[], o: { x: number; y: number; at?: number; color?: string; scale?: number; rotate?: number; speed?: number; pen?: boolean }) {
    const color = o.color ?? this.t.ink;
    const at = o.at ?? 0;
    const speed = o.speed ?? 1;
    const k = o.scale ?? 1;
    const parts = strokes.map((s) => {
      const id = this.id("m");
      const start = at + s.at / 1000 / speed;
      const dur = Math.max(0.08, s.dur / 1000 / speed);
      this.bump(start + dur);
      this.defs.push(
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="8000" height="8000"><path class="g" pathLength="1" d="${s.guide}" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" style="animation-delay:${s2(start)};animation-duration:${s2(dur)}"/></mask>`,
      );
      return `<path d="${s.ink}" fill="${color}" fill-opacity="${s.opacity}" mask="url(#${id})"/>`;
    });
    const tf = `translate(${n1(o.x)} ${n1(o.y)})${o.rotate ? ` rotate(${n1(o.rotate)})` : ""}${k !== 1 ? ` scale(${k})` : ""}`;
    this.add(`<g transform="${tf}">${parts.join("")}</g>`);
    // Each mask lives in the group's own space, so it lines up at any scale.
    if (o.pen && strokes.length) {
      const first = strokes[0];
      const box = guideBounds(first.guide);
      const s = at + first.at / 1000 / speed;
      this.stops.push({ t: s, x: o.x + box.x0 * k, y: o.y + box.y0 * k }, { t: s + first.dur / 1000 / speed, x: o.x + box.x1 * k, y: o.y + box.y1 * k });
    }
  }

  /** A plain pen line (any path) traced from its start to its end. */
  line(d: string, o: { at?: number; dur?: number; color?: string; width?: number; opacity?: number; transform?: string; fill?: string }) {
    const at = o.at ?? 0;
    const dur = o.dur ?? 0.5;
    this.bump(at + dur);
    this.add(
      `<path class="d" pathLength="1" d="${d}" fill="${o.fill ?? "none"}" stroke="${o.color ?? this.t.ink}" stroke-width="${o.width ?? 1.6}" stroke-linecap="round" stroke-linejoin="round"${o.opacity != null ? ` opacity="${o.opacity}"` : ""}${o.transform ? ` transform="${o.transform}"` : ""} style="animation-delay:${s2(at)};animation-duration:${s2(dur)}"/>`,
    );
  }

  /** Anything that should just appear, faded in at `at`. */
  fade(svg: string, at: number, dur = 0.6) {
    this.bump(at + dur);
    this.add(`<g class="f" style="animation-delay:${s2(at)};animation-duration:${s2(dur)}">${svg}</g>`);
  }

  /**
   * The paper: a sheet with a lifted shadow, a fine tooth, and optional
   * ruling, margin and punched holes (cut through, so the page shows).
   */
  paper(o: { rules?: { top: number; gap: number }; margin?: number; holes?: number[]; inset?: number; radius?: number; redRule?: number } = {}) {
    const t = this.t;
    const i = o.inset ?? 10;
    const rad = o.radius ?? 14;
    const w = this.w - i * 2;
    const h = this.h - i * 2;
    const clip = this.id("c");
    const shadow = this.id("s");
    const grain = this.id("n");
    const holes = this.id("h");
    this.defs.push(
      `<clipPath id="${clip}"><rect x="${i}" y="${i}" width="${w}" height="${h}" rx="${rad}"/></clipPath>`,
      `<filter id="${shadow}" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="${t.shadow}" flood-opacity="${t.name === "light" ? 0.16 : 0.5}"/></filter>`,
      `<filter id="${grain}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 0 0 0 -0.35"/><feComposite in2="SourceGraphic" operator="in"/></filter>`,
      `<mask id="${holes}"><rect width="${this.w}" height="${this.h}" fill="#fff"/>${(o.holes ?? []).map((y) => `<circle cx="${i + 30}" cy="${y}" r="11" fill="#000"/>`).join("")}</mask>`,
    );
    const marks: string[] = [];
    if (o.rules) for (let y = o.rules.top; y < this.h - i; y += o.rules.gap) marks.push(`<path d="M${i} ${y}H${this.w - i}" stroke="${t.rule}" stroke-width="1.2"/>`);
    if (o.redRule != null) marks.push(`<path d="M${i} ${o.redRule}H${this.w - i}" stroke="${t.margin}" stroke-width="1.4"/>`);
    if (o.margin != null)
      marks.push(`<path d="M${o.margin} ${i}V${this.h - i}M${o.margin + 4} ${i}V${this.h - i}" stroke="${t.margin}" stroke-width="1.2"/>`);
    const holeRims = (o.holes ?? []).map((y) => `<circle cx="${i + 30}" cy="${y}" r="11.6" fill="none" stroke="${t.ink5}" stroke-width="1.2"/>`).join("");
    this.body.unshift(
      `<g mask="url(#${holes})"><rect x="${i}" y="${i}" width="${w}" height="${h}" rx="${rad}" fill="${t.paper}" filter="url(#${shadow})"/><g clip-path="url(#${clip})">${marks.join("")}<rect x="${i}" y="${i}" width="${w}" height="${h}" fill="${t.shadow}" opacity="${t.grain}" filter="url(#${grain})"/></g></g>${holeRims}`,
    );
  }

  /**
   * A ballpoint pen that follows the writing, then rests where it is told.
   * Drawn pointing down with its tip at the origin, leaning right.
   */
  pen(rest: { x: number; y: number }, { lean = 26, restLean = lean } = {}) {
    const t = this.t;
    const stops = [...this.stops].sort((a, b) => a.t - b.t);
    if (!stops.length) return;
    const last = stops[stops.length - 1];
    const total = last.t + 0.9;
    const pct = (v: number) => `${Math.round((v / total) * 10000) / 100}%`;
    const frames = [
      `0%{transform:translate(${n1(stops[0].x + 60)}px,${n1(stops[0].y - 60)}px);opacity:0}`,
      `${pct(Math.max(0.01, stops[0].t - 0.25))}{opacity:1}`,
      ...stops.map((s) => `${pct(s.t)}{transform:translate(${n1(s.x)}px,${n1(s.y)}px)}`),
      `100%{transform:translate(${rest.x}px,${rest.y}px);opacity:1}`,
    ];
    const body =
      `<path d="M0 0L-4.2 -15L4.2 -15Z" fill="${t.ink4}" stroke="${t.ink}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<circle cx="0" cy="-1" r="1.3" fill="${t.ink}"/>` +
      `<path d="M-4.2 -15L-5.6 -44L5.6 -44L4.2 -15Z" fill="${t.ink5}" stroke="${t.ink}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M-3.4 -20V-40M-1.1 -20V-40M1.2 -20V-40M3.5 -20V-40" stroke="${t.ink4}" stroke-width="0.9"/>` +
      `<rect x="-6.4" y="-150" width="12.8" height="106" rx="2.5" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.4"/>` +
      `<path d="M-2 -138V-60" stroke="${t.ink4}" stroke-width="1"/>` +
      `<rect x="-7" y="-168" width="14" height="22" rx="5" fill="${t.ink}"/>` +
      `<path d="M6.6 -160C11 -160 11 -150 11 -140V-104" fill="none" stroke="${t.ink}" stroke-width="3" stroke-linecap="round"/>`;
    // Set down at the end: it tips over to `restLean` as it travels to rest.
    const tilt = `0%,${pct(last.t)}{transform:rotate(${lean}deg)}100%{transform:rotate(${restLean}deg)}`;
    this.defs.push(`<style>@keyframes ${this.prefix}pen{${frames.join("")}}@keyframes ${this.prefix}tilt{${tilt}}</style>`);
    this.add(
      `<g style="transform:translate(${rest.x}px,${rest.y}px);animation:${this.prefix}pen ${s2(total)} linear both"><g style="transform:rotate(${restLean}deg);animation:${this.prefix}tilt ${s2(total)} ease-in-out both">${body}</g></g>`,
    );
  }

  render(title: string) {
    const css =
      `.w{stroke-dasharray:1 1;animation:write .42s cubic-bezier(.5,0,.3,1) both}` +
      `@keyframes write{0%{stroke-dashoffset:1;fill-opacity:0}50%{fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1}}` +
      `.d,.g{stroke-dasharray:1 1;animation:draw .5s cubic-bezier(.55,.05,.3,1) both}` +
      `@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}` +
      `.f{animation:fade .6s ease both}@keyframes fade{from{opacity:0}}` +
      `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${esc(title)}">` +
      `<title>${esc(title)}</title><style>${css}</style><defs>${this.defs.join("")}</defs>${this.body.join("")}</svg>\n`
    );
  }
}

function guideBounds(d: string) {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const first = { x: nums[0] ?? 0, y: nums[1] ?? 0 };
  const lastX = nums[nums.length - 2] ?? 0;
  const lastY = nums[nums.length - 1] ?? 0;
  return { x0: first.x, y0: first.y, x1: lastX, y1: lastY };
}
