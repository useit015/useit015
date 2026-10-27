// Draws every sheet the README shows, once per GitHub theme, into assets/.
// Live numbers come from the GitHub API when a token is around (GITHUB_TOKEN
// in Actions, `gh auth token` locally); otherwise the last fetch in
// data/github.json is reused, so the build never needs the network.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { themes, type Theme } from "../lib/color.ts";
import {
  arrowStroke,
  asteriskPulls,
  crossStroke,
  dotStroke,
  hashSeed,
  inkPulls,
  loopPulls,
  loopStroke,
  ringPulls,
  roundedBoxStroke,
  scribbleFill,
  spiralPulls,
  starPulls,
  underlineInk,
  underlineShape,
  wavePulls,
  hatchStrokes,
  lineStroke,
} from "../lib/ink-sketch.ts";
import { writeRun } from "../lib/marks.ts";
import { fonts, measure, Sheet } from "../lib/sheet.ts";
import { ballpointSheet, glyphSheet, meowtalSheet, whichmodelSheet, whoisonlineSheet } from "./showcase.ts";
import { hero, links, login } from "./content.ts";

const root = new URL("..", import.meta.url);
const file = (p: string) => new URL(p, root);

// ─── Data ──────────────────────────────────────────────────────────────

type Day = { date: string; count: number; level: number };
type GitHub = { fetched: string; total: number; weeks: Day[][]; recent: { name: string; pushedAt: string }[] };
type Signature = { login: string; at: string };

const levels: Record<string, number> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

async function fetchGitHub(): Promise<GitHub | null> {
  const auth = token();
  if (!auth) return null;
  const query = `query($login:String!){user(login:$login){
    contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}
    repositories(first:10,privacy:PUBLIC,isFork:false,ownerAffiliations:OWNER,orderBy:{field:PUSHED_AT,direction:DESC}){nodes{name pushedAt}}
  }}`;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${auth}`, "content-type": "application/json", "user-agent": login },
      body: JSON.stringify({ query, variables: { login } }),
    });
    const json = await res.json();
    const user = json?.data?.user;
    if (!user) throw new Error(JSON.stringify(json?.errors ?? json));
    const cal = user.contributionsCollection.contributionCalendar;
    return {
      fetched: new Date().toISOString(),
      total: cal.totalContributions,
      weeks: cal.weeks.map((w: any) =>
        w.contributionDays.map((d: any) => ({ date: d.date, count: d.contributionCount, level: levels[d.contributionLevel] ?? 0 })),
      ),
      recent: user.repositories.nodes.filter((r: any) => r.name !== login),
    };
  } catch (err) {
    console.warn(`GitHub fetch failed, using the cached data: ${(err as Error).message}`);
    return null;
  }
}

const readJson = <T>(p: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(file(p), "utf8"));
  } catch {
    return fallback;
  }
};

const fresh = await fetchGitHub();
if (fresh) writeFileSync(file("data/github.json"), JSON.stringify(fresh, null, 1) + "\n");
const gh: GitHub = fresh ?? readJson("data/github.json", { fetched: "", total: 0, weeks: [], recent: [] });
const guestbook: Signature[] = readJson("data/guestbook.json", []);

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
};

// ─── Shared marks ─────────────────────────────────────────────────────

// ─── Sheets ───────────────────────────────────────────────────────────

function heroSheet(t: Theme) {
  const s = new Sheet(1200, 420, t, "hero");
  s.paper({ rules: { top: 70, gap: 40 }, margin: 96, holes: [110, 230, 350] });

  s.write(hero.place, { x: 1160, y: 62, size: 26, color: t.ink3, anchor: "end", at: 0.2, pace: 0.025, pen: false });

  const name = s.write(hero.name, { x: 130, y: 188, size: 118, font: fonts.bold, at: 0.5, pace: 0.13, wobble: 0.8 });
  s.ink(underlineShape(hashSeed(hero.name), name.width / 1.5, "swoosh"), { x: 136, y: 190, scale: 1.5, at: name.end - 0.05, pen: true });

  let at = name.end + 0.8;
  const [a, b, c] = hero.lines;
  at = s.write(a, { x: 130, y: 268, size: 40, at, pace: 0.028 }).end + 0.15;
  at = s.write(b, { x: 130, y: 308, size: 34, color: t.ink3, at, pace: 0.022 }).end + 0.1;
  at = s.write(c, { x: 130, y: 348, size: 32, color: t.ink3, at, pace: 0.022 }).end + 0.25;

  // The red pen comes out last, for the one thing worth circling.
  const [note, sub] = hero.note;
  const cx = 1010;
  const nw = measure(note, 40, fonts.bold);
  const n = s.write(note, { x: cx, y: 142, size: 40, font: fonts.bold, color: t.red, anchor: "middle", at, pace: 0.05 });
  s.line(loopStroke(hashSeed(note), nw + 24, 50, { turns: 1.15, pad: 6 }), {
    at: n.end,
    dur: 0.7,
    color: t.red,
    width: 2.2,
    transform: `translate(${cx - nw / 2 - 12} ${142 - 40})`,
  });
  s.write(sub, { x: cx, y: 186, size: 24, color: t.red, anchor: "middle", at: n.end + 0.6, pace: 0.03 });

  s.pen({ x: 950, y: 398 }, { restLean: 78 });
  return s.render(`${hero.name}. ${hero.lines.join(" ")} ${hero.note.join(", ")}.`);
}

function buttonSheet(t: Theme, label: string, i: number) {
  const s = new Sheet(300, 84, t, `btn${label}`);
  s.paper({ inset: 6, radius: 10 });
  const seed = hashSeed(label);
  const at = 0.2 + i * 0.2;
  s.line(roundedBoxStroke(seed, 282, 66, 10), { at, dur: 0.7, color: t.ink, width: 1.6, opacity: 0.7, transform: "translate(9 9)" });
  const size = Math.min(36, (196 / measure(label, 36, fonts.bold)) * 36);
  const w = s.write(label, { x: 132, y: 54, size, font: fonts.bold, anchor: "middle", at: at + 0.3, pace: 0.05, pen: false });
  const arrow = arrowStroke(seed, 28, 0);
  s.line(arrow.shaft, { at: w.end, dur: 0.2, color: t.red, width: 2, transform: `translate(${w.right + 14} 44)` });
  s.line(arrow.head, { at: w.end + 0.18, dur: 0.12, color: t.red, width: 2, transform: `translate(${w.right + 14} 44)` });
  return s.render(label);
}

/** A mark for each day, heavier the more got done: nothing, a slash, a cross, hatching, scribbled solid. */
function dayMark(s: Sheet, d: Day, x: number, y: number, at: number) {
  const t = s.t;
  const seed = hashSeed(d.date);
  const c = 15;
  const tf = `translate(${x} ${y})`;
  if (d.level === 0) return s.line(dotStroke(seed, 0.9), { at, dur: 0.1, color: t.ink5, width: 1.4, transform: `translate(${x + c / 2} ${y + c / 2})` });
  if (d.level === 1) return s.line(lineStroke(seed, [2, c - 2], [c - 2, 2], { jitter: 0.6 }), { at, dur: 0.15, color: t.ink4, width: 1.5, transform: tf });
  if (d.level === 2) return s.line(crossStroke(seed, c), { at, dur: 0.2, color: t.ink3, width: 1.5, transform: tf });
  if (d.level === 3) return s.line(hatchStrokes(seed, c, c, { gap: 3.4, angle: -45, jitter: 0.4 }).join(""), { at, dur: 0.25, color: t.ink, width: 1.3, transform: tf });
  s.line(scribbleFill(seed, c, c, { gap: 2, slant: 0.4, overrun: 0.6 }), { at, dur: 0.3, color: t.ink, width: 1.5, transform: tf });
}

function calendarSheet(t: Theme) {
  const s = new Sheet(1200, 340, t, "ink");
  s.paper();
  const step = 21;
  const x0 = 44;
  const y0 = 128;
  const weeks = gh.weeks.slice(-53);
  // Levels from quartiles of the active days only, so a handful of huge days
  // don't press every other day down to a single slash.
  const active = weeks.flat().map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
  const q = [0.25, 0.5, 0.75].map((f) => active[Math.floor(f * (active.length - 1))] ?? 0);
  const level = (c: number) => (c === 0 ? 0 : c <= q[0] ? 1 : c <= q[1] ? 2 : c <= q[2] ? 3 : 4);

  // Graph paper under the days.
  let grid = "";
  for (let i = 0; i <= weeks.length; i++) grid += `M${x0 - 3 + i * step} ${y0 - 3}v${7 * step}`;
  for (let j = 0; j <= 7; j++) grid += `M${x0 - 3} ${y0 - 3 + j * step}h${weeks.length * step}`;
  s.add(`<path d="${grid}" stroke="${t.rule}" stroke-width="1" fill="none"/>`);

  const title = s.write("Ink spent, the last 12 months", { x: 44, y: 70, size: 46, font: fonts.bold, at: 0.2, pace: 0.045, pen: false });
  s.ink(underlineShape(hashSeed("ink"), title.width, "double"), { x: 48, y: 76, at: title.end });
  const total = `${gh.total.toLocaleString("en-US")} contributions`;
  s.write(total, { x: 1156, y: 70, size: 40, font: fonts.bold, color: t.red, anchor: "end", at: title.end + 0.3, pace: 0.04, pen: false });

  let lastMonth = -1;
  const start = title.end + 0.5;
  weeks.forEach((week, i) => {
    const m = new Date(week[0].date).getUTCMonth();
    if (m !== lastMonth && new Date(week[0].date).getUTCDate() <= 7) {
      s.fade(`<g fill="${t.ink4}">${pathText(months[m], x0 + i * step, y0 - 12, 20)}</g>`, start + i * 0.04, 0.4);
      lastMonth = m;
    }
    for (const d of week) dayMark(s, { ...d, level: level(d.count) }, x0 + i * step, y0 + new Date(d.date).getUTCDay() * step, start + i * 0.04 + (hashSeed(d.date) % 50) / 1000);
  });

  // The figures under it, worked out from the same days.
  const days = weeks.flat();
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0] ?? { date: "", count: 0, level: 0 });
  const recent = gh.recent[0];
  const parts = [`longest streak ${longest} days`, best?.count ? `best day ${short(best.date)}, ${best.count}` : "", recent ? `last ink: ${recent.name}, ${short(recent.pushedAt)}` : ""].filter(Boolean);
  writeRun(s, parts, { x: 44, y: 306, size: 28, color: t.ink3, at: start + weeks.length * 0.04 + 0.2, pace: 0.018 });
  return s.render(`${total} in the last year. ${parts.join(". ")}.`);
}

function guestbookSheet(t: Theme) {
  const shown = guestbook.slice(-12).reverse();
  const rows = Math.max(1, Math.ceil(shown.length / 4));
  const s = new Sheet(1200, 178 + rows * 80, t, "guest");
  s.paper({ margin: 96, rules: { top: 136, gap: 40 } });

  const title = s.write("Signed in the margin", { x: 130, y: 70, size: 46, font: fonts.bold, at: 0.2, pace: 0.05, pen: false });
  s.ink(underlineShape(hashSeed("guest"), title.width, "wave"), { x: 134, y: 76, at: title.end });
  const count = guestbook.length;
  if (count) s.write(count === 1 ? "1 signature" : `${count} signatures`, { x: 1156, y: 70, size: 36, font: fonts.bold, color: t.red, anchor: "end", at: title.end + 0.2, pace: 0.04, pen: false });
  s.write("Open an issue titled sign, and the notebook writes your handle in.", { x: 130, y: 128, size: 28, color: t.ink3, at: title.end + 0.4, pace: 0.012, pen: false });

  if (!shown.length) {
    s.write("Nobody yet. The first line is yours.", { x: 130, y: 210, size: 38, color: t.red, at: title.end + 1.4, pace: 0.04 });
    s.pen({ x: 1090, y: 230 });
    return s.render("Guestbook: nobody has signed yet. Open an issue titled sign to be the first.");
  }

  let at = title.end + 1.3;
  shown.forEach((sig, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 130 + col * 262;
    const y = 212 + row * 80;
    const tilt = ((hashSeed(sig.login) % 9) - 4) * 0.9;
    s.add(`<g transform="rotate(${tilt} ${x} ${y})">`);
    const w = s.write(`@${sig.login}`, { x, y, size: Math.min(38, (240 / Math.max(1, measure(`@${sig.login}`, 38))) * 38), at, pace: 0.035, seed: sig.login, pen: false });
    s.ink(underlineInk(hashSeed(sig.login), Math.max(40, w.width * 0.8), { weight: 1.6 }), { x: x + 6, y: y + 2, at: w.end, speed: 1.6 });
    s.add(`</g>`);
    at = w.end + 0.2;
  });
  return s.render(`Guestbook, ${count} signed: ${shown.map((g) => "@" + g.login).join(", ")}.`);
}

/** Static outlined text (no write-in), for small labels. */
function pathText(text: string, x: number, y: number, size: number) {
  return `<path d="${fonts.regular.getPath(text, x, y, size, { kerning: true }).toPathData(1)}"/>`;
}

// ─── Write it all out ─────────────────────────────────────────────────

for (const t of themes) {
  const dir = `assets/${t.name}`;
  mkdirSync(file(dir), { recursive: true });
  const out = (name: string, svg: string) => writeFileSync(file(`${dir}/${name}.svg`), svg);
  out("hero", heroSheet(t));
  out("card-ballpoint", ballpointSheet(t));
  out("card-meowtal", meowtalSheet(t, 0));
  out("card-whichmodel", whichmodelSheet(t, 1));
  out("card-whoisonline", whoisonlineSheet(t, 0));
  out("card-glyph-studio", glyphSheet(t, 1));
  [...links.map((l) => l.label), "Sign the margin"].forEach((label, i) => out(`btn-${i}`, buttonSheet(t, label, i)));
  if (gh.weeks.length) out("ink", calendarSheet(t));
  out("guestbook", guestbookSheet(t));
}
console.log(`Drew ${themes.length} themes. Contributions: ${gh.total}. Signatures: ${guestbook.length}.`);
