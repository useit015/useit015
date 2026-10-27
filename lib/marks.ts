// Marks the sheets share: dotted runs of text, red corner links, and photos
// taped onto the page.

import { readFileSync } from "node:fs";
import { arrowStroke, createRng, dotStroke, hashSeed } from "./ink-sketch.ts";
import { measure, Sheet } from "./sheet.ts";

const n1 = (v: number) => Math.round(v * 10) / 10;

/** A file from media/ as a data URI; GitHub's proxy fetches nothing an SVG points at. */
export function media(name: string) {
  const type = name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".webp") ? "image/webp" : "image/png";
  return `data:${type};base64,${readFileSync(new URL(`../media/${name}`, import.meta.url)).toString("base64")}`;
}

/** Writes parts on one line with a small ink dot between each. */
export function writeRun(s: Sheet, parts: string[], o: { x: number; y: number; size: number; color?: string; at: number; pace?: number; anchor?: "start" | "end" }) {
  const gap = o.size * 0.9;
  const total = parts.reduce((w, p) => w + measure(p, o.size), 0) + gap * (parts.length - 1);
  let x = o.anchor === "end" ? o.x - total : o.x;
  let at = o.at;
  parts.forEach((p, i) => {
    const r = s.write(p, { x, y: o.y, size: o.size, color: o.color, at, pace: o.pace ?? 0.03, seed: p + i, pen: false });
    at = r.end;
    x = r.right;
    if (i < parts.length - 1) {
      s.line(dotStroke(hashSeed(p), 1.6), { at, dur: 0.15, color: o.color ?? s.t.ink, width: 1.8, transform: `translate(${n1(x + gap / 2)} ${n1(o.y - o.size * 0.28)})` });
      x += gap;
      at += 0.08;
    }
  });
  return { end: at, right: x };
}

/** A red label with a pen arrow after it, ending at x. */
export function cornerLink(s: Sheet, label: string, x: number, y: number, at: number, size = 30) {
  const go = s.write(label, { x: x - 44, y, size, color: s.t.red, anchor: "end", at, pace: 0.05, pen: false });
  const arrow = arrowStroke(hashSeed(label + x), 30, 0);
  const tf = `translate(${n1(x - 36)} ${n1(y - size * 0.33)})`;
  s.line(arrow.shaft, { at: go.end, dur: 0.25, color: s.t.red, width: 2, transform: tf });
  s.line(arrow.head, { at: go.end + 0.22, dur: 0.15, color: s.t.red, width: 2, transform: tf });
  return go.end + 0.4;
}

/** A strip of masking tape, w long, centred on (x, y), with torn ends. */
export function tape(s: Sheet, x: number, y: number, w: number, rotate: number, seed: number) {
  const r = createRng(seed);
  const h = 24;
  const tear = (side: number) =>
    Array.from({ length: 5 }, (_, i) => `${n1(side + (r() - 0.5) * 4)} ${n1(-h / 2 + (h * (i + 0.5)) / 5)}`);
  const left = tear(-w / 2);
  const right = tear(w / 2).reverse();
  const d = `M${-w / 2} ${-h / 2}L${w / 2} ${-h / 2}L${right.join("L")}L${w / 2} ${h / 2}L${-w / 2} ${h / 2}L${left.reverse().join("L")}Z`;
  const fill = s.t.name === "light" ? "#e8dcbf" : "#a99d84";
  const op = s.t.name === "light" ? 0.78 : 0.42;
  return `<path transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(rotate)})" d="${d}" fill="${fill}" fill-opacity="${op}"/>`;
}

/**
 * A photo taped onto the page: a printed border, a soft shadow, and a strip
 * of tape over each top corner. Fades in at `at`.
 */
export function photo(s: Sheet, src: string, o: { x: number; y: number; w: number; h: number; rotate?: number; at: number; border?: number }) {
  const t = s.t;
  const b = o.border ?? 9;
  const rot = o.rotate ?? 0;
  const seed = hashSeed(src.slice(-64));
  const shadow = s.id("ps");
  s.addDef(
    `<filter id="${shadow}" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="1" dy="4" stdDeviation="5" flood-color="${t.shadow}" flood-opacity="${t.name === "light" ? 0.22 : 0.55}"/></filter>`,
  );
  const frame = t.name === "light" ? "#fbf9f3" : "#e9e4d8";
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const svg =
    `<g transform="rotate(${n1(rot)} ${n1(cx)} ${n1(cy)})">` +
    `<rect x="${o.x - b}" y="${o.y - b}" width="${o.w + b * 2}" height="${o.h + b * 2}" rx="2" fill="${frame}" filter="url(#${shadow})"/>` +
    `<image href="${src}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid slice"/>` +
    `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="none" stroke="#000" stroke-opacity="0.12"/>` +
    tape(s, o.x + 18, o.y - b + 2, 92, -32 + (seed % 9), seed) +
    tape(s, o.x + o.w - 18, o.y - b + 2, 92, 30 - (seed % 7), seed + 1) +
    `</g>`;
  s.fade(svg, o.at, 0.5);
}
