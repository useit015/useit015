// The project pages. Each one shows the thing itself rather than describing
// it: a photo of the live site, the game's own fighter, the CLI's real
// output, the counter's whole idea, and Glyph Studio's trick done on the cat.

import { readFileSync } from "node:fs";
import type { Theme } from "../lib/color.ts";
import {
  arrowStroke,
  asteriskPulls,
  hashSeed,
  inkPulls,
  lineStroke,
  ringPulls,
  roundedBoxStroke,
  spiralPulls,
  starPulls,
  underlineShape,
  wanderStroke,
  wavePulls,
} from "../lib/ink-sketch.ts";
import { cornerLink, media, photo, writeRun } from "../lib/marks.ts";
import { fonts, Sheet, wrap } from "../lib/sheet.ts";
import { projects, type Project } from "./content.ts";

const project = (slug: string) => projects.find((p) => p.slug === slug) as Project;
const doodles = { asterisk: asteriskPulls, spiral: spiralPulls, star: starPulls, wave: wavePulls, ring: ringPulls, loop: spiralPulls };

/** The half-width card every project but the lead one sits on: title, doodle, red link, red rule. */
function card(t: Theme, p: Project, i: number) {
  const s = new Sheet(600, 600, t, `card${p.slug}`);
  s.paper({ redRule: 100, inset: 8, radius: 10 });
  const seed = hashSeed(p.slug);
  const at = 0.1 + i * 0.25;
  s.line(roundedBoxStroke(seed, 578, 578, 12), { at, dur: 1, color: t.ink, width: 1.5, opacity: 0.5, transform: "translate(11 11)" });
  const title = s.write(p.title, { x: 40, y: 78, size: 52, font: fonts.bold, at: at + 0.2, pace: 0.06, pen: false });
  s.ink(inkPulls(seed, doodles[p.doodle](seed, 28, 28), { weight: 1.5, dur: 150, gap: 60 }), { x: title.right + 14, y: 30, at: title.end });
  const end = cornerLink(s, p.go, 560, 74, title.end + 0.1);
  return { s, seed, at: end };
}

/** Blurb lines at the foot of a card. */
function blurb(s: Sheet, text: string, o: { x: number; y: number; max: number; at: number; size?: number; lines?: number }) {
  let at = o.at;
  const size = o.size ?? 27;
  wrap(text, size, o.max).slice(0, o.lines ?? 3).forEach((l, k) => {
    at = s.write(l, { x: o.x, y: o.y + k * size * 1.25, size, color: s.t.ink3, at, pace: 0.012, wobble: 0.6, pen: false }).end;
  });
  return at;
}

export function ballpointSheet(t: Theme) {
  const p = project("ballpoint");
  const s = new Sheet(1200, 540, t, "feature");
  s.paper({ margin: 720, rules: { top: 136, gap: 40 } });
  const seed = hashSeed(p.slug);

  photo(s, media("ballpoint.jpg"), { x: 58, y: 70, w: 610, h: 296, rotate: -2.2, at: 0.1 });

  const title = s.write(p.title, { x: 760, y: 106, size: 76, font: fonts.bold, at: 0.4, pace: 0.09 });
  s.ink(underlineShape(seed, title.width / 1.3, "swoosh"), { x: 766, y: 112, scale: 1.3, at: title.end, pen: true });
  let at = title.end + 0.6;
  wrap("shadcn-style React components drawn in blue ballpoint, on Base UI. Copy them in with the shadcn CLI.", 28, 400).slice(0, 4).forEach((l, k) => {
    at = s.write(l, { x: 760, y: 176 + k * 40, size: 28, color: t.ink3, at, pace: 0.016, wobble: 0.6 }).end;
  });

  // The install line, on a slip of its own.
  const slip = "npx shadcn add @ballpoint/button";
  s.line(roundedBoxStroke(seed + 3, 404, 54, 8), { at, dur: 0.6, color: t.ink, width: 1.4, opacity: 0.6, transform: "translate(752 316)" });
  at = s.write(slip, { x: 770, y: 352, size: 26, at: at + 0.3, pace: 0.02 }).end;

  // Red pen on the photo: what to notice.
  const note = s.write("every line on that page is a seeded pen stroke", { x: 84, y: 456, size: 30, color: t.red, at: at + 0.3, pace: 0.022 });
  const arrow = arrowStroke(seed, 70, 0);
  s.line(arrow.shaft, { at: note.end, dur: 0.35, color: t.red, width: 2.2, transform: `translate(140 426) rotate(-62)` });
  s.line(arrow.head, { at: note.end + 0.3, dur: 0.15, color: t.red, width: 2.2, transform: `translate(140 426) rotate(-62)` });
  const note2 = s.write("same wobble on the server and the client", { x: 84, y: 496, size: 26, color: t.red, at: note.end + 0.5, pace: 0.02 });

  writeRun(s, p.tags, { x: 760, y: 416, size: 26, color: t.ink4, at: note2.end, pace: 0.02 });
  cornerLink(s, "ballpoint.st9wd.com", 1160, 456, note2.end + 0.4, 30);
  s.pen({ x: 900, y: 522 }, { restLean: 78 });
  return s.render(`Ballpoint: ${p.blurb}`);
}

export function meowtalSheet(t: Theme, i: number) {
  const p = project("meowtal");
  const { s, at } = card(t, p, i);
  photo(s, media("meowtal.jpg"), { x: 46, y: 126, w: 508, h: 300, rotate: 1.6, at });

  const end = blurb(s, "A platform fighter on Moroccan rooftops. WebGL2, replays, touch. Play it in the browser.", { x: 40, y: 486, max: 330, at: at + 0.4, size: 26 });

  // The tabby, from the game's own sprite atlas, sparring on the roof edge.
  const sheet = JSON.parse(readFileSync(new URL("../media/tabby.json", import.meta.url), "utf8"));
  const dur = (sheet.frames * 0.09).toFixed(2);
  s.addDef(`<style>.cat{animation:cat ${dur}s steps(${sheet.frames}) infinite}@keyframes cat{to{transform:translateX(-${sheet.w * sheet.frames}px)}}</style>`);
  s.line(wanderStroke(hashSeed("roof"), 190, 0, { sway: 0.4 }).d, { at: end, dur: 0.5, color: t.ink, width: 2, transform: "translate(384 566)" });
  s.line(Array.from({ length: 9 }, (_, k) => lineStroke(k + 9, [k * 21 + 4, 0], [k * 21 - 4, 10], { jitter: 0.6 })).join(""), { at: end + 0.3, dur: 0.4, color: t.ink4, width: 1.3, transform: "translate(392 570)" });
  s.fade(
    `<svg x="${404}" y="${566 - sheet.h + 6}" width="${sheet.w}" height="${sheet.h}" viewBox="0 0 ${sheet.w} ${sheet.h}" overflow="hidden"><image class="cat" href="${media("tabby.webp")}" width="${sheet.w * sheet.frames}" height="${sheet.h}"/></svg>`,
    end + 0.4,
    0.4,
  );
  return s.render(`Meowtal Kombat: ${p.blurb} The tabby fighter, animated from the game's sprites.`);
}

export function whichmodelSheet(t: Theme, i: number) {
  const p = project("whichmodel");
  const { s, seed, at } = card(t, p, i);

  // A terminal, drawn: the documented example run, typed in.
  s.line(roundedBoxStroke(seed + 1, 520, 350, 14), { at, dur: 0.8, color: t.ink, width: 1.8, transform: "translate(40 124)" });
  s.line(lineStroke(seed + 2, [0, 0], [520, 0], { jitter: 0.5 }), { at: at + 0.6, dur: 0.4, color: t.ink, width: 1.4, transform: "translate(40 162)" });
  [0, 1, 2].forEach((k) =>
    s.ink(inkPulls(seed + k, ringPulls(seed + k, 12, 12), { weight: 1.2, dur: 120 }), { x: 58 + k * 22, y: 137, at: at + 0.7 + k * 0.1 }),
  );
  let tAt = at + 1;
  s.write("$", { x: 60, y: 202, size: 26, color: t.red, at: tAt, pace: 0.05, pen: false });
  tAt = s.write('npx whichmodel "summarize legal contracts"', { x: 80, y: 202, size: 23, at: tAt + 0.1, pace: 0.03, pen: false }).end + 0.5;
  const rows = [
    ["cheapest", "liquid/lfm2-8b-a1b", "$0.01"],
    ["balanced", "deepseek/deepseek-v3.2", "$0.26"],
    ["best", "anthropic/claude-opus-4.6", "$5"],
  ];
  rows.forEach(([label, model, price], k) => {
    const y = 262 + k * 46;
    s.write(label, { x: 60, y, size: 25, font: fonts.bold, color: t.red, at: tAt, pace: 0.02, pen: false });
    s.write(model, { x: 170, y, size: 24, at: tAt + 0.1, pace: 0.015, pen: false });
    tAt = s.write(price, { x: 540, y, size: 24, color: t.ink4, anchor: "end", at: tAt + 0.4, pace: 0.03, pen: false }).end + 0.1;
  });
  s.write("per 1M prompt tokens, from live catalogs", { x: 540, y: 400, size: 20, color: t.ink4, anchor: "end", at: tAt, pace: 0.01, pen: false });
  s.write("$", { x: 60, y: 446, size: 26, color: t.red, at: tAt + 0.4, pace: 0.05, pen: false });
  s.addDef(`<style>.caret{animation:caret 1.1s steps(1) infinite}@keyframes caret{50%{opacity:0}}</style>`);
  s.fade(`<rect class="caret" x="80" y="428" width="12" height="22" rx="2" fill="${t.ink}"/>`, tAt + 0.5, 0.1);

  blurb(s, "Tell it what you're building. It picks the cheapest, balanced and best model for the job.", { x: 40, y: 526, max: 520, at: tAt + 0.6, size: 26, lines: 2 });
  return s.render(`whichmodel: ${p.blurb} Example: npx whichmodel "summarize legal contracts".`);
}

export function whoisonlineSheet(t: Theme, i: number) {
  const p = project("whoisonline");
  const { s, seed, at } = card(t, p, i);

  // The widget, sketched: a count, a live dot, today's views.
  s.line(roundedBoxStroke(seed + 1, 250, 190, 14), { at, dur: 0.7, color: t.ink, width: 1.7, transform: "translate(40 134)" });
  s.addDef(
    `<style>.live{animation:live 1.6s ease-out infinite;transform-origin:72px 176px}@keyframes live{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.6);opacity:0}}</style>`,
  );
  s.fade(`<circle class="live" cx="72" cy="176" r="7" fill="${t.red}"/><circle cx="72" cy="176" r="7" fill="${t.red}"/>`, at + 0.4, 0.3);
  s.write("online now", { x: 92, y: 184, size: 26, color: t.ink3, at: at + 0.5, pace: 0.03, pen: false });
  const n = s.write("12", { x: 66, y: 276, size: 92, font: fonts.bold, at: at + 0.9, pace: 0.12, pen: false });
  const spark = [26, 18, 22, 10, 16, 6, 12, 2].map((y, k): [number, number] => [k * 13, y]);
  s.line(spark.map(([x, y], k) => `${k ? "L" : "M"}${x} ${y}`).join(""), { at: n.end, dur: 0.7, color: t.ink, width: 1.8, transform: "translate(170 240)" });
  s.write("views today", { x: 168, y: 300, size: 20, color: t.ink4, at: n.end + 0.3, pace: 0.02, pen: false });
  s.write("(a sketch of the widget)", { x: 40, y: 356, size: 20, color: t.ink4, at: n.end + 0.4, pace: 0.01, pen: false });

  // What it doesn't keep, struck out in red. Then what it does.
  let lAt = at + 0.6;
  s.write("it never keeps:", { x: 330, y: 168, size: 26, font: fonts.bold, at: lAt, pace: 0.03, pen: false });
  ["cookies", "IP addresses", "request logs", "a profile of you"].forEach((w, k) => {
    const y = 214 + k * 40;
    const r = s.write(w, { x: 340, y, size: 28, color: t.ink3, at: lAt + 0.3, pace: 0.03, pen: false });
    s.line(lineStroke(seed + k, [-4, 0], [r.width + 6, -3], { jitter: 0.8, overshoot: 2 }), { at: r.end, dur: 0.25, color: t.red, width: 2.4, transform: `translate(${r.left} ${y - 9})` });
    lAt = r.end + 0.1;
  });
  s.write("it keeps a count.", { x: 330, y: 386, size: 30, font: fonts.bold, color: t.red, at: lAt + 0.3, pace: 0.04, pen: false });

  blurb(s, "Self-hosted online counter and page-view stats, in Go and SQLite. One script tag, one binary.", { x: 40, y: 486, max: 520, at: lAt + 0.8, size: 26 });
  return s.render(`whoisonline: ${p.blurb}`);
}

export function glyphSheet(t: Theme, i: number) {
  const p = project("glyph-studio");
  const { s, seed, at } = card(t, p, i);

  photo(s, media("tabby-win.webp"), { x: 52, y: 150, w: 150, h: 162, rotate: -4, at, border: 10 });

  const arrow = arrowStroke(seed, 50, 0);
  s.line(arrow.shaft, { at: at + 0.5, dur: 0.3, color: t.red, width: 2.2, transform: "translate(214 240)" });
  s.line(arrow.head, { at: at + 0.75, dur: 0.15, color: t.red, width: 2.2, transform: "translate(214 240)" });

  // The cat, set in type: each row appears as if the render pass reached it.
  const rows = readFileSync(new URL("../media/tabby-ascii.txt", import.meta.url), "utf8").trimEnd().split("\n");
  const lh = 8.6;
  const x0 = 284;
  const y0 = 126;
  const text = rows
    .map((r, k) => `<text class="f" x="${x0}" y="${(y0 + k * lh).toFixed(1)}" style="animation-delay:${(at + 0.9 + k * 0.035).toFixed(2)}s;animation-duration:.2s">${r.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/ /g, " ")}</text>`)
    .join("");
  s.add(`<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" font-size="9.2" fill="${t.ink}" xml:space="preserve">${text}</g>`);
  // A scan line keeps sweeping the render, the way the studio's preview does.
  s.addDef(`<style>.scan{animation:scan 3.2s linear infinite}@keyframes scan{from{transform:translateY(0)}to{transform:translateY(${(rows.length * lh).toFixed(0)}px)}}</style>`);
  s.fade(`<rect class="scan" x="${x0 - 6}" y="${y0 - 8}" width="290" height="2" fill="${t.red}" opacity="0.5"/>`, at + 2.4, 0.3);

  blurb(s, "Turns images and video into ASCII art, with quality presets, motion and GIF export.", { x: 40, y: 500, max: 520, at: at + 2.6, size: 26, lines: 2 });
  return s.render(`Glyph Studio: ${p.blurb} Shown: a Meowtal fighter turned into ASCII.`);
}
