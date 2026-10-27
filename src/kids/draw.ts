/**
 * A tiny kit for drawing colouring pages as SVG: thick, round outlines (the cosy colouring-book
 * look), every closed shape a region a child can fill with a tap, lines and dots on top.
 *
 *   region  a closed shape, white until coloured in (class "r")
 *   line    an outline that closes nothing: a smile, a crease, a stalk (class "l")
 *   dot     solid ink: eyes, noses (class "k")
 *
 * Shapes are drawn in order, later ones on top, so a region only needs its own outline: whatever it
 * covers stays covered. Parts are tagged with a key (`part`): finding the word that names that
 * thing in the story inks it in.
 */

export type Svg = string;

const f = (n: number) => Math.round(n * 10) / 10;

export const region = (d: string, cls = ''): Svg => `<path class="r${cls ? ` ${cls}` : ''}" d="${d}"/>`;
export const line = (d: string, cls = ''): Svg => `<path class="l${cls ? ` ${cls}` : ''}" d="${d}"/>`;
export const dot = (x: number, y: number, r: number): Svg => `<circle class="k" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
export const inkPath = (d: string): Svg => `<path class="k" d="${d}"/>`;

export const circle = (x: number, y: number, r: number, cls = ''): Svg =>
  `<circle class="r${cls ? ` ${cls}` : ''}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
export const ellipse = (x: number, y: number, rx: number, ry: number, cls = '', rotate = 0): Svg =>
  `<ellipse class="r${cls ? ` ${cls}` : ''}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rotate ? ` transform="rotate(${rotate} ${f(x)} ${f(y)})"` : ''}/>`;
export const rect = (x: number, y: number, w: number, h: number, rx = 0, cls = ''): Svg =>
  `<rect class="r${cls ? ` ${cls}` : ''}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}"/>`;

/** Shapes moved and scaled together (outlines keep their width: see kids.css). */
export const at = (x: number, y: number, s: number, ...parts: Svg[]): Svg =>
  `<g transform="translate(${f(x)} ${f(y)})${s !== 1 ? ` scale(${s})` : ''}">${parts.join('')}</g>`;
export const flipX = (...parts: Svg[]): Svg => `<g transform="scale(-1 1)">${parts.join('')}</g>`;
export const rotate = (deg: number, x: number, y: number, ...parts: Svg[]): Svg =>
  `<g transform="rotate(${deg} ${f(x)} ${f(y)})">${parts.join('')}</g>`;

/** A thing in the story, inked in when its word is found. An empty key: the setting, inked last. */
export const part = (key: string, ...parts: Svg[]): Svg => `<g class="part" data-k="${key}">${parts.join('')}</g>`;

/**
 * A bumpy outline around an ellipse: clouds, tree tops, curls, smoke. `n` bumps, each bulging out
 * by `bulge` of its width; `from` turns where the first bump starts.
 */
export function scallop(cx: number, cy: number, rx: number, ry: number, n: number, bulge = 0.55, from = -Math.PI / 2): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = from + (i * 2 * Math.PI) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    const chord = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const r = chord / (2 * Math.min(0.99, bulge + 0.01));
    d += ` A${f(r)} ${f(r)} 0 0 1 ${f(q[0])} ${f(q[1])}`;
  });
  return `${d} Z`;
}

/** A rounded bar from one point to another, `w` wide: arms, legs, branches, chair legs. */
export function capsule(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  const r = f(w / 2);
  return `M${f(x1 + nx)} ${f(y1 + ny)} L${f(x2 + nx)} ${f(y2 + ny)} A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)} L${f(x1 - nx)} ${f(y1 - ny)} A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)} Z`;
}

/** A rectangle with rounded corners, as a path (so it can be one region among many). */
export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${f(x + r)} ${f(y)} H${f(x + w - r)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} V${f(y + h - r)} Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} H${f(x + r)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} V${f(y + r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
}

/** A heart, `s` across, its point at the bottom. */
export function heartPath(x: number, y: number, s: number): string {
  const k = s / 2;
  return `M${f(x)} ${f(y + k * 0.9)} C${f(x - k * 1.6)} ${f(y - k * 0.1)} ${f(x - k * 0.7)} ${f(y - k * 1.25)} ${f(x)} ${f(y - k * 0.45)} C${f(x + k * 0.7)} ${f(y - k * 1.25)} ${f(x + k * 1.6)} ${f(y - k * 0.1)} ${f(x)} ${f(y + k * 0.9)} Z`;
}

/** A five-pointed star. */
export function starPath(x: number, y: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    return `${f(x + rr * Math.cos(a))} ${f(y + rr * Math.sin(a))}`;
  });
  return `M${pts.join(' L')} Z`;
}

/** The page: a rounded frame whose inside is the first region (sky, or wall), everything clipped to it. */
export const FRAME = { x: 24, y: 24, w: 552, h: 712, r: 38 };
export const PAGE_W = 600;
export const PAGE_H = 760;

export function page(id: string, ...parts: Svg[]): Svg {
  const { x, y, w, h, r } = FRAME;
  const clip = `clip-${id}`;
  return (
    `<svg class="colouring" viewBox="0 0 ${PAGE_W} ${PAGE_H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><clipPath id="${clip}"><path d="${roundRect(x, y, w, h, r)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clip})">${region(roundRect(x, y, w, h, r))}${parts.join('')}</g>` +
    `<path class="l frame" d="${roundRect(x, y, w, h, r)}"/>` +
    `</svg>`
  );
}
