// What the notebook says. Edit here, then `npm run build`.

export const login = "useit015";

export const hero = {
  name: "Oussama Nahiz",
  place: "Mohammedia, Morocco",
  lines: [
    "Senior full-stack engineer. React, Node.js, TypeScript, AI.",
    "10+ years shipping production software. 42 graduate.",
    "Lately: a UI kit drawn in ballpoint, and a counter that tracks no one.",
  ],
  note: ["open to work", "freelance or full-time"],
};

export type Project = {
  slug: string;
  title: string;
  blurb: string;
  tags: string[];
  href: string;
  /** What the card's corner link says. */
  go: string;
  doodle: "asterisk" | "spiral" | "star" | "wave" | "ring" | "loop";
};

export const projects: Project[] = [
  {
    slug: "ballpoint",
    title: "Ballpoint",
    blurb: "shadcn-style React components drawn in blue ballpoint, on Base UI. Seeded strokes draw the same on server and client.",
    tags: ["React", "Base UI", "MIT"],
    href: "https://ballpoint.st9wd.com",
    go: "live",
    doodle: "star",
  },
  {
    slug: "whichmodel",
    title: "whichmodel",
    blurb: "A CLI that picks the cheapest, balanced and best AI model for a task from live provider catalogs.",
    tags: ["TypeScript", "CLI", "npx whichmodel"],
    href: "https://github.com/useit015/whichmodel",
    go: "repo",
    doodle: "asterisk",
  },
  {
    slug: "whoisonline",
    title: "whoisonline",
    blurb: "Self-hosted online counter and page-view stats. No cookies, no IPs, no request logs.",
    tags: ["Go", "SQLite", "privacy"],
    href: "https://github.com/useit015/whoisonline",
    go: "repo",
    doodle: "ring",
  },
  {
    slug: "meowtal",
    title: "Meowtal Kombat",
    blurb: "A platform fighter on Moroccan rooftops. WebGL2, deterministic simulation and replays, keyboard and touch.",
    tags: ["TypeScript", "WebGL2", "game"],
    href: "https://meowtal.st9wd.com",
    go: "play",
    doodle: "spiral",
  },
  {
    slug: "glyph-studio",
    title: "Glyph Studio",
    blurb: "Turns images and video into ASCII art, with quality presets, motion and GIF export.",
    tags: ["React", "Canvas", "ASCII"],
    href: "https://github.com/useit015/aart",
    go: "repo",
    doodle: "wave",
  },
];

export const links = [
  { slug: "site", label: "st9wd.com", href: "https://st9wd.com" },
  { slug: "linkedin", label: "LinkedIn", href: "https://linkedin.com/in/useit015" },
  { slug: "email", label: "Email me", href: "mailto:useit015@gmail.com" },
];
