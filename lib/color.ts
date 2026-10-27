// The Ballpoint paper and pens (registry/ballpoint/styles/base.css), turned
// into hex so every renderer GitHub's image proxy might hand them to agrees.
// Lighter pressure is the same ink mixed toward the paper in oklab, as there.

type Lab = [number, number, number];

const oklch = (l: number, c: number, h: number): Lab => {
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
};

function hexLab(hex: string): Lab {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((v) => {
        const c = Math.min(1, Math.max(0, v));
        const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(g * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

const mix = (a: Lab, b: Lab, t: number): Lab => [a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t), a[2] * t + b[2] * (1 - t)];

export type Theme = {
  name: "light" | "dark";
  paper: string;
  ink: string;
  ink3: string;
  ink4: string;
  ink5: string;
  red: string;
  rule: string;
  margin: string;
  shadow: string;
  grain: number;
};

function theme(name: Theme["name"], paper: Lab, ink: Lab, red: Lab, grain: number, shadow: string): Theme {
  return {
    name,
    paper: labHex(paper),
    ink: labHex(ink),
    ink3: labHex(mix(ink, paper, 0.77)),
    ink4: labHex(mix(ink, paper, 0.4)),
    ink5: labHex(mix(ink, paper, 0.16)),
    red: labHex(red),
    rule: labHex(mix(ink, paper, name === "light" ? 0.13 : 0.11)),
    margin: labHex(mix(red, paper, 0.42)),
    shadow,
    grain,
  };
}

export const themes: Theme[] = [
  theme("light", hexLab("#ede8df"), oklch(0.4, 0.185, 267), oklch(0.5, 0.19, 27), 0.07, "#1f1a10"),
  theme("dark", oklch(0.215, 0.038, 266), oklch(0.9, 0.045, 258), oklch(0.74, 0.14, 25), 0.05, "#000000"),
];
