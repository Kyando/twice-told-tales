/**
 * The story's characters, drawn once and posed per page. Each is drawn around (0, 0) at the middle
 * of its feet, about 200 units tall, and placed with `at(x, y, scale, ...)`.
 */
import { capsule, circle, dot, ellipse, heartPath, line, region, scallop, type Svg } from './draw.ts';

export type Face = 'happy' | 'oh' | 'sleep' | 'sorry';

function eyes(x: number, y: number, face: Face, r: number): Svg {
  if (face === 'sleep') return line(`M${-x - r * 1.4} ${y} Q${-x} ${y + r * 1.6} ${-x + r * 1.4} ${y}`) + line(`M${x - r * 1.4} ${y} Q${x} ${y + r * 1.6} ${x + r * 1.4} ${y}`);
  // Worried brows: their inner ends lifted.
  if (face === 'sorry') return line(`M${-x - r * 1.4} ${y - r * 1.5} L${-x + r * 1.1} ${y - r * 2.5}`, 'thin') + line(`M${x + r * 1.4} ${y - r * 1.5} L${x - r * 1.1} ${y - r * 2.5}`, 'thin') + dot(-x, y, r) + dot(x, y, r);
  const shine = (cx: number) => `<circle class="shine" cx="${cx + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}"/>`;
  return dot(-x, y, r) + dot(x, y, r) + shine(-x) + shine(x);
}

// ── the bears ─────────────────────────────────────────────────────────────

export interface BearOpts {
  face?: Face;
  /** Papa's bow tie, Mama's flower and apron, Baby's bib. */
  who: 'papa' | 'mama' | 'baby';
  arms?: 'down' | 'wave' | 'up';
}

export function bear({ who, face = 'happy', arms = 'down' }: BearOpts): Svg {
  const parts: Svg[] = [];
  // Ears behind the head, the body behind the arms and the head.
  parts.push(circle(-40, -170, 19), circle(40, -170, 19), circle(-40, -170, 9, 'thin'), circle(40, -170, 9, 'thin'));
  parts.push(region('M-42 -100 C-70 -86 -72 -18 -50 -6 Q0 6 50 -6 C72 -18 70 -86 42 -100 Q0 -112 -42 -100 Z'));
  parts.push(ellipse(0, -50, 28, 33, 'thin'));
  if (who === 'mama') {
    // An apron with a heart pocket.
    parts.push(region('M-30 -84 Q0 -92 30 -84 L36 -24 Q0 -12 -36 -24 Z'));
    parts.push(region(heartPath(0, -50, 22), 'thin'));
  }
  const arm = (side: 1 | -1) => {
    const kind = arms === 'wave' && side === 1 ? 'up' : arms;
    if (kind === 'up') return region(capsule(side * 46, -84, side * 74, -128, 26));
    return region(capsule(side * 46, -84, side * 58, -42, 26));
  };
  parts.push(arm(-1), arm(1));
  // Feet, with pads.
  parts.push(ellipse(-26, -6, 24, 13), ellipse(26, -6, 24, 13));
  parts.push(ellipse(-26, -8, 9, 6, 'thin'), ellipse(26, -8, 9, 6, 'thin'));
  // Head.
  parts.push(circle(0, -142, 48));
  parts.push(ellipse(0, -124, 22, 16, 'thin'));
  parts.push(`<ellipse class="k" cx="0" cy="-131" rx="8.5" ry="6"/>`);
  if (face === 'oh') parts.push(ellipse(0, -115, 5, 6, 'thin dark'));
  else if (face === 'sleep') parts.push(line('M-7 -119 Q0 -114 7 -119'));
  else parts.push(line('M0 -125 V-120 M-9 -119 Q-4.5 -113 0 -120 Q4.5 -113 9 -119'));
  parts.push(eyes(18, -150, face === 'sorry' ? 'happy' : face, 5.2));
  parts.push(ellipse(-32, -128, 8, 5, 'thin blush'), ellipse(32, -128, 8, 5, 'thin blush'));
  if (who === 'papa') {
    // A bow tie.
    parts.push(region('M0 -96 L-22 -106 Q-26 -96 -22 -84 Z', 'thin'), region('M0 -96 L22 -106 Q26 -96 22 -84 Z', 'thin'), circle(0, -95, 6, 'thin'));
  } else if (who === 'mama') {
    // A flower by her ear.
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      parts.push(circle(30 + Math.cos(a) * 9, -184 + Math.sin(a) * 9, 7, 'thin'));
    }
    parts.push(circle(30, -184, 6, 'thin'));
  } else {
    // A bib with a star... a round one, with a little heart.
    parts.push(region('M-24 -96 Q0 -90 24 -96 Q26 -70 0 -66 Q-26 -70 -24 -96 Z', 'thin'));
    parts.push(region(heartPath(0, -81, 12), 'thin'));
  }
  return parts.join('');
}

// ── Goldilocks ────────────────────────────────────────────────────────────

export interface GirlOpts {
  face?: Face;
  arms?: 'down' | 'up' | 'knock' | 'spoon' | 'basket';
  /** Standing, or sitting on the floor with her legs out in front. */
  pose?: 'stand' | 'sit' | 'jump';
}

/** Her head alone, around (0, 0) at the middle of the face: for the pillow, and behind the table. */
export function girlHead(face: Face = 'happy', withBack = true): Svg {
  const parts: Svg[] = [];
  if (withBack) parts.push(region(scallop(0, 6, 52, 54, 12, 0.75, -Math.PI / 2 + 0.26)));
  parts.push(circle(0, 0, 35));
  // Fringe of curls over the forehead.
  parts.push(region('M-36 -2 C-40 -30 -20 -42 0 -42 C20 -42 40 -30 36 -2 C30 -14 24 -18 18 -12 C14 -22 6 -24 0 -16 C-6 -24 -14 -22 -18 -12 C-24 -18 -30 -14 -36 -2 Z'));
  // A bow on one side.
  parts.push(region('M30 -34 L50 -48 Q56 -34 48 -22 Z', 'thin'), region('M30 -34 L22 -56 Q36 -60 42 -48 Z', 'thin'), circle(32, -36, 6, 'thin'));
  parts.push(eyes(13, 6, face, 4.4));
  if (face === 'oh' || face === 'sorry') parts.push(ellipse(0, 22, 5, 6.5, 'thin dark'));
  else if (face === 'sleep') parts.push(line('M-5 21 Q0 24 5 21'));
  else parts.push(line('M-8 18 Q0 26 8 18'));
  parts.push(ellipse(-22, 15, 7, 4.5, 'thin blush'), ellipse(22, 15, 7, 4.5, 'thin blush'));
  return parts.join('');
}

export function girl({ face = 'happy', arms = 'down', pose = 'stand' }: GirlOpts = {}): Svg {
  const parts: Svg[] = [];
  const headY = pose === 'sit' ? -112 : -136;
  const dy = pose === 'sit' ? 24 : 0;
  // Curls behind everything.
  parts.push(region(scallop(0, headY + 8, 52, 56, 12, 0.75, -Math.PI / 2 + 0.26)));
  if (pose === 'sit') {
    // Legs out in front, shoes up.
    parts.push(region(capsule(-14, -26, -40, -10, 16)), region(capsule(14, -26, 40, -10, 16)));
    parts.push(ellipse(-48, -12, 10, 14, '', -20), ellipse(48, -12, 10, 14, '', 20));
  } else {
    const lift = pose === 'jump' ? -10 : 0;
    parts.push(region(capsule(-12, -46, -14 + lift, -10, 15)), region(capsule(12, -46, 14 - lift, -10, 15)));
    parts.push(ellipse(-16 + lift, -6, 15, 8), ellipse(16 - lift, -6, 15, 8));
  }
  // Arms, behind the dress's sleeves.
  const armTo: Record<NonNullable<GirlOpts['arms']>, [number, number, number, number]> = {
    down: [-38, -58, 38, -58],
    up: [-50, -146, 50, -146],
    knock: [-38, -58, 46, -138],
    spoon: [-34, -64, 40, -110],
    basket: [-40, -66, 38, -58],
  };
  const [lx, ly, rx, ry] = armTo[arms];
  parts.push(region(capsule(-20, -90 + dy, lx, ly + dy, 13)), region(capsule(20, -90 + dy, rx, ry + dy, 13)));
  parts.push(circle(lx, ly + dy, 8), circle(rx, ry + dy, 8));
  // The dress, with a scalloped hem and a heart pocket.
  parts.push(region(`M-20 ${-100 + dy} Q0 ${-106 + dy} 20 ${-100 + dy} L44 ${-38 + dy} Q0 ${-26 + dy} -44 ${-38 + dy} Z`));
  parts.push(region(`M-38 ${-48 + dy} Q0 ${-38 + dy} 38 ${-48 + dy} L44 ${-38 + dy} Q0 ${-26 + dy} -44 ${-38 + dy} Z`, 'thin'));
  parts.push(region(heartPath(18, -64 + dy, 14), 'thin'));
  parts.push(circle(-22, -94 + dy, 11, 'thin'), circle(22, -94 + dy, 11, 'thin'));
  parts.push(region(`M-12 ${-102 + dy} Q0 ${-90 + dy} 12 ${-102 + dy} Q0 ${-108 + dy} -12 ${-102 + dy} Z`, 'thin'));
  parts.push(`<g transform="translate(0 ${headY})">${girlHead(face, false)}</g>`);
  return parts.join('');
}
