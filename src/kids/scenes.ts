/**
 * Goldilocks and the Three Bears: one colouring page per scene. Each thing in a picture is a `part`
 * with a key (`bears`, `bowls`...); the story's words name the keys they ink in (see story.ts).
 */
import { bear, girl, girlHead } from './characters.ts';
import {
  at, capsule, circle, dot, ellipse, heartPath, line, page, part, rect, region, rotate, roundRect, scallop, starPath, type Svg,
} from './draw.ts';

// ── props ─────────────────────────────────────────────────────────────────

function tree(apples = true): Svg {
  const parts = [
    region('M-18 0 Q-10 -40 -13 -96 Q0 -102 13 -96 Q10 -40 18 0 Q0 6 -18 0 Z'),
    line('M-4 -40 Q2 -46 0 -54', 'thin'),
    region(scallop(0, -160, 86, 76, 11, 0.8)),
  ];
  if (apples) [[-40, -180], [30, -200], [44, -140], [-20, -128], [-56, -146]].forEach(([x, y]) => parts.push(circle(x, y, 9, 'thin')));
  return parts.join('');
}

const cloud = (): Svg => region(scallop(0, 0, 62, 24, 9, 0.95, -Math.PI / 2 + 0.2));

function sun(r: number): Svg {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.12;
    rays += line(`M${(Math.cos(a) * (r + 10)).toFixed(1)} ${(Math.sin(a) * (r + 10)).toFixed(1)} L${(Math.cos(a) * (r + 26)).toFixed(1)} ${(Math.sin(a) * (r + 26)).toFixed(1)}`);
  }
  return rays + circle(0, 0, r) + dot(-14, -6, 4.5) + dot(14, -6, 4.5) + line('M-12 10 Q0 22 12 10') + ellipse(-24, 8, 7, 4, 'thin blush') + ellipse(24, 8, 7, 4, 'thin blush');
}

function flower(petals = 5): Svg {
  let out = line('M0 0 Q-2 -26 0 -48') + region('M-1 -18 Q18 -34 28 -22 Q14 -10 -1 -18 Z', 'thin');
  for (let i = 0; i < petals; i++) {
    const a = (i * 2 * Math.PI) / petals - Math.PI / 2;
    out += circle(Math.cos(a) * 12, -58 + Math.sin(a) * 12, 10, 'thin');
  }
  return out + circle(0, -58, 8, 'thin');
}

const mushroom = (): Svg =>
  region('M-12 0 Q-15 -20 -10 -30 L10 -30 Q15 -20 12 0 Q0 4 -12 0 Z') +
  region('M-34 -26 Q-32 -66 0 -68 Q32 -66 34 -26 Q0 -18 -34 -26 Z') +
  circle(-14, -46, 6, 'thin') + circle(10, -54, 5, 'thin') + circle(18, -36, 4.5, 'thin');

const grass = (): Svg => line('M-10 0 Q-8 -9 -13 -16 M0 0 Q0 -12 2 -20 M10 0 Q10 -9 14 -15', 'thin');

/** A steaming bowl of porridge, its foot at (0, 0), 100 across. */
function bowl(steam = false): Svg {
  return (
    (steam ? line('M-14 -44 Q-22 -58 -14 -70 Q-6 -82 -14 -94 M10 -44 Q2 -58 10 -70 Q18 -82 10 -94', 'thin') : '') +
    region('M-50 -34 Q-48 -2 -14 -2 L-18 0 L18 0 L14 -2 Q48 -2 50 -34 Z') +
    ellipse(0, -34, 50, 11) + region('M-40 -34 Q0 -48 40 -34 Q0 -26 -40 -34 Z', 'thin') +
    region(heartPath(0, -18, 12), 'thin')
  );
}

/** A window with a cross, `w` by `h` from its top left corner, round at the top. */
function window_(x: number, y: number, w: number, h: number, curtains = true): Svg {
  const r = w / 2;
  const glass = `M${x} ${y + h} V${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h} Z`;
  let out = region(glass) + line(`M${x + w / 2} ${y} V${y + h} M${x} ${y + r + (h - r) * 0.35} H${x + w}`, 'thin');
  out += region(roundRect(x - 12, y + h - 2, w + 24, 16, 6));
  if (curtains) {
    out += region(`M${x - 6} ${y + r - 18} Q${x + w * 0.22} ${y + r} ${x + w * 0.16} ${y + h - 6} Q${x + 4} ${y + h - 30} ${x - 6} ${y + h - 6} Z`);
    out += region(`M${x + w + 6} ${y + r - 18} Q${x + w * 0.78} ${y + r} ${x + w * 0.84} ${y + h - 6} Q${x + w - 4} ${y + h - 30} ${x + w + 6} ${y + h - 6} Z`);
  }
  return out;
}

// ── 1. Three bears in the woods ──────────────────────────────────────────

function cottage(): Svg {
  return (
    region('M44 -200 V-250 Q60 -258 76 -250 V-170 Z') +
    rect(-100, -128, 200, 128, 4) +
    region('M-126 -116 L0 -226 L126 -116 Q0 -100 -126 -116 Z') +
    circle(0, -170, 18, 'thin') + region(heartPath(0, -170, 16), 'thin') +
    region('M-26 0 V-58 A26 26 0 0 1 26 -58 V0 Z') + dot(14, -34, 4) +
    circle(-62, -72, 24) + line('M-62 -96 V-48 M-86 -72 H-38', 'thin')
  );
}

function porridgeWindow(): Svg {
  // The right-hand window, with the porridge cooling on its sill.
  return rect(38, -96, 48, 48, 6) + line('M62 -96 V-48', 'thin') + rect(32, -50, 60, 10, 4, 'thin') + at(62, -50, 0.36, bowl(true));
}

const scene1 = (): Svg =>
  page(
    'p1',
    part('hot', at(472, 118, 1, sun(44))),
    part('', at(150, 112, 1, cloud()), at(318, 196, 0.66, cloud())),
    part('', region('M0 430 C90 350 200 352 300 420 C380 360 500 340 600 410 V760 H0 Z')),
    part('woods', at(474, 470, 1.12, tree()), at(52, 462, 0.86, tree(false)), at(330, 452, 0.6, region(scallop(0, -34, 54, 36, 8, 0.8)))),
    part('', region('M0 472 C160 446 440 452 600 474 V760 H0 Z')),
    part('walk', region('M168 470 C166 540 300 560 318 626 C330 676 296 724 290 760 L560 760 C540 700 514 640 448 600 C372 556 230 540 218 470 Z'), ellipse(210, 506, 16, 7, 'thin'), ellipse(262, 548, 18, 7, 'thin')),
    part('', at(190, 472, 0.95, cottage()), at(46, 470, 0.5, region(scallop(0, -30, 50, 32, 8, 0.8)))),
    part('porridge', at(190, 472, 0.95, porridgeWindow())),
    part('', at(76, 640, 1, flower()), at(130, 700, 0.9, flower(6)), at(50, 724, 0.8, flower()), at(150, 600, 0.9, mushroom()), at(220, 690, 1, grass()), at(560, 560, 1, grass()), at(420, 520, 1, grass())),
    part('bears', at(300, 712, 1.02, bear({ who: 'papa' })), at(418, 716, 0.86, bear({ who: 'mama' })), at(516, 722, 0.62, bear({ who: 'baby', arms: 'wave' }))),
  );

// ── 2. A knock at the door ───────────────────────────────────────────────

function bricks(): Svg {
  const spots: [number, number][] = [[96, 300], [150, 480], [460, 296], [470, 540], [110, 610], [486, 640], [200, 300], [400, 300]];
  return spots.map(([x, y]) => region(roundRect(x, y, 40, 18, 7), 'thin')).join('');
}

const scene2 = (): Svg =>
  page(
    'p2',
    part('', at(470, 96, 0.8, cloud()), at(110, 80, 0.6, cloud())),
    part('house', rect(66, 258, 468, 460, 6), bricks(), region('M36 282 L300 92 L564 282 Q300 304 36 282 Z'), circle(300, 206, 36), region(heartPath(300, 206, 30), 'thin'),
      line('M120 250 Q160 236 200 250 M220 250 Q260 236 300 250 M320 250 Q360 236 400 250 M420 250 Q460 236 500 250 M190 190 Q220 176 250 190 M350 190 Q380 176 410 190', 'thin')),
    part('inside', window_(96, 336, 104, 120), at(148, 442, 0.5, region('M-30 0 L-20 -60 L20 -60 L30 0 Z') + capsule(0, -60, 0, -90, 8)), window_(400, 336, 104, 120),
      at(452, 442, 0.42, bowl(true))),
    part('house', region(roundRect(388, 474, 128, 32, 8)), at(412, 478, 0.42, flower()), at(452, 478, 0.46, flower(6)), at(492, 478, 0.42, flower())),
    part('door', region('M236 718 V506 A64 64 0 0 1 364 506 V718 Z'), line('M278 450 V718 M322 450 V718', 'thin'), region(heartPath(300, 500, 28), 'thin'), dot(346, 610, 6)),
    part('knock', `<circle class="l" cx="300" cy="560" r="14"/>`, circle(300, 544, 6, 'thin'), line('M224 522 Q214 534 224 546 M208 512 Q194 534 208 556', 'thin')),
    part('', region('M0 716 H600 V760 H0 Z'), ellipse(300, 726, 84, 14), at(560, 740, 1, region(scallop(0, -30, 50, 36, 8, 0.8))), at(40, 744, 1, region(scallop(0, -28, 46, 34, 8, 0.8)))),
    part('', at(160, 728, 1.3, girl({ arms: 'knock' })),
      at(108, 668, 1.1, region('M-26 -16 A26 26 0 0 1 26 -16', 'thin') + region('M-30 -16 H30 L22 12 H-22 Z') + line('M-26 -2 H26', 'thin')),
      at(98, 652, 0.46, flower()), at(120, 648, 0.44, flower(6))),
  );

// ── 3. Just right ────────────────────────────────────────────────────────

function tiles(top: number): Svg {
  let out = region(`M0 ${top} H600 V760 H0 Z`);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      if ((row + col) % 2) continue;
      out += region(`M${col * 50} ${top + row * 44} h50 v44 h-50 Z`, 'thin');
    }
  }
  return out;
}

/** A tablecloth's hem, scalloped from x1 to x2 along y. */
function hem(x1: number, x2: number, top: number, y: number, r: number): string {
  let d = `M${x1} ${top} H${x2} V${y}`;
  for (let x = x2; x > x1 + 1; x -= 2 * r) d += ` A${r} ${r} 0 0 1 ${Math.max(x1, x - 2 * r)} ${y}`;
  return `${d} Z`;
}

const sparkle = (s: number): Svg => region(`M0 ${-s} L${s * 0.25} ${-s * 0.25} L${s} 0 L${s * 0.25} ${s * 0.25} L0 ${s} L${-s * 0.25} ${s * 0.25} L${-s} 0 L${-s * 0.25} ${-s * 0.25} Z`, 'thin');

const scene3 = (): Svg =>
  page(
    'p3',
    part('', ...[[262, 80], [290, 250], [56, 330], [560, 290], [180, 300]].map(([x, y]) => region(heartPath(x, y, 24), 'thin'))),
    part('', window_(50, 70, 160, 190)),
    part('', region(roundRect(330, 150, 226, 16, 6)), at(366, 150, 1, region(roundRect(-18, -54, 36, 54, 8)) + rect(-14, -64, 28, 12, 4, 'thin')),
      at(420, 150, 1, region(roundRect(-22, -40, 44, 40, 10)) + rect(-18, -50, 36, 12, 4, 'thin')), at(500, 150, 0.6, bowl())),
    part('', region('M0 560 H600 V640 H0 Z'), line('M0 576 H600', 'thin')),
    tiles(640),
    part('girl', at(400, 520, 1.6, girl({ arms: 'spoon' }))),
    part('spoon', at(466, 338, 1, rotate(-24, 0, 0, region(capsule(0, 0, 0, 60, 10)) + ellipse(0, -12, 13, 17)))),
    part('', region(capsule(96, 500, 96, 700, 22)), region(capsule(504, 500, 504, 700, 22)),
      region(hem(44, 556, 478, 540, 12)), ...[96, 176, 256, 336, 416, 496].map((x) => circle(x, 512, 7, 'thin')),
      region(roundRect(30, 452, 540, 28, 13))),
    part('bowls', at(124, 456, 1.25, bowl(true)), at(254, 456, 0.95, bowl()), at(400, 456, 0.76, bowl())),
    part('cold', at(254, 372, 1, line('M0 -22 V22 M-19 -11 L19 11 M-19 11 L19 -11', 'thin') + circle(0, 0, 6, 'thin'))),
    part('right', at(331, 402, 1, region(heartPath(0, 0, 28))), at(548, 392, 1, sparkle(15))),
    part('up', at(250, 170, 1, sparkle(13)), at(540, 236, 1, sparkle(11))),
  );

// ── 4. Three chairs ──────────────────────────────────────────────────────

function hardChair(): Svg {
  // A tall wooden chair, slats in its back.
  return (
    region(capsule(-56, -96, -56, 0, 14)) + region(capsule(56, -96, 56, 0, 14)) +
    region(roundRect(-66, -300, 132, 200, 18)) + rect(-44, -270, 88, 140, 10) + line('M-15 -270 V-130 M15 -270 V-130', 'thin') +
    region(roundRect(-76, -112, 152, 26, 10))
  );
}

function softChair(): Svg {
  // A deep, padded armchair, its back buttoned.
  return (
    region(capsule(-66, -30, -70, 0, 14)) + region(capsule(66, -30, 70, 0, 14)) +
    region(roundRect(-80, -230, 160, 170, 48)) +
    circle(-34, -180, 5, 'thin') + circle(34, -180, 5, 'thin') + circle(0, -150, 5, 'thin') + circle(-34, -120, 5, 'thin') + circle(34, -120, 5, 'thin') +
    region(roundRect(-104, -140, 48, 112, 24)) + region(roundRect(56, -140, 48, 112, 24)) +
    region(roundRect(-64, -100, 128, 52, 20)) +
    region(roundRect(-86, -54, 172, 32, 12))
  );
}

/** Baby Bear's chair, in pieces. */
function brokenBits(): Svg {
  return (
    at(162, 690, 1, rotate(-24, 0, 0, region('M-40 30 V-20 A40 40 0 0 1 40 -20 V30 Z') + region(heartPath(0, -6, 26), 'thin'))) +
    at(440, 702, 1, rotate(16, 0, 0, region(roundRect(-46, -16, 92, 32, 10)))) +
    at(530, 690, 1, rotate(-36, 0, 0, region(capsule(-28, 0, 28, 0, 13)))) +
    at(88, 626, 1, rotate(64, 0, 0, region(capsule(-24, 0, 24, 0, 13)))) +
    at(300, 728, 1, region(capsule(-20, 0, 20, 0, 12)))
  );
}

const scene4 = (): Svg =>
  page(
    'p4',
    part('', ...[[300, 60], [90, 100], [520, 100], [190, 300], [420, 300]].map(([x, y]) => region(heartPath(x, y, 22), 'thin'))),
    part('', window_(230, 96, 140, 160)),
    part('', region(roundRect(70, 160, 104, 90, 10)), region(roundRect(84, 174, 76, 62, 6)), at(122, 220, 0.8, region('M-26 10 L-6 -18 L6 -2 L14 -12 L28 10 Z', 'thin'))),
    part('', region('M0 540 H600 V760 H0 Z'), line('M0 556 H600', 'thin')),
    part('', ellipse(300, 654, 262, 72), ellipse(300, 654, 206, 54, 'thin'), ellipse(300, 654, 148, 36, 'thin')),
    part('hard', at(120, 604, 1, hardChair())),
    part('soft', at(474, 604, 0.98, softChair())),
    part('pieces', brokenBits()),
    part('girl', at(300, 700, 1.38, girl({ pose: 'sit', face: 'oh', arms: 'up' })),
      line('M252 452 L238 428 M300 440 V414 M348 452 L362 428')),
  );

// ── 5. Fast asleep ───────────────────────────────────────────────────────

/** A bed seen from its foot, `w` wide and `head` tall at its headboard, standing on (0, 0). */
function bed(w: number, head: number, sleeper = false): Svg {
  const hw = w / 2;
  const arch = hw * 0.5;
  let out =
    region(capsule(-hw + 10, -40, -hw + 10, 0, 16)) + region(capsule(hw - 10, -40, hw - 10, 0, 16)) +
    region(`M${-hw} -100 V${-head + arch} A${hw} ${arch} 0 0 1 ${hw} ${-head + arch} V-100 Z`) +
    region(heartPath(0, -head + arch + 4, Math.min(30, w * 0.18)), 'thin') +
    region(roundRect(-hw * 0.72, -152, hw * 1.44, 48, 20));
  if (sleeper) out += at(0, -146, w / 190, girlHead('sleep'));
  // The quilt, in patches.
  out += region(roundRect(-hw - 6, -122, w + 12, 98, 16));
  const cols = 3;
  const pw = (w + 12) / cols;
  for (let i = 0; i < cols; i++) {
    const cx = -hw - 6 + i * pw + pw / 2;
    if (i % 2 === 0) out += region(roundRect(cx - pw / 2 + 6, -112, pw - 12, 34, 8), 'thin');
    else out += region(heartPath(cx, -94, Math.min(24, pw * 0.5)), 'thin');
    if (i % 2 === 1) out += region(roundRect(cx - pw / 2 + 6, -70, pw - 12, 34, 8), 'thin');
    else out += circle(cx, -53, Math.min(10, pw * 0.18), 'thin');
  }
  out += region(roundRect(-hw - 8, -36, w + 16, 22, 10));
  return out;
}

function stairs(): Svg {
  // The top of the stairs, going down at the left behind a banister.
  let out = '';
  for (let i = 0; i < 5; i++) out += region(`M0 ${270 + i * 40} H${170 - i * 32} V${310 + i * 40} H0 Z`, 'thin');
  out += region(capsule(-20, 452, 176, 262, 16));
  for (let i = 0; i < 4; i++) out += line(`M${24 + i * 38} ${426 - i * 37} V470`, 'thin');
  out += region(capsule(176, 262, 176, 470, 18)) + circle(176, 252, 14);
  return out;
}

const scene5 = (): Svg =>
  page(
    'p5',
    part('sleepy', window_(340, 66, 150, 180, false), region('M392 150 A30 30 0 1 0 428 112 A24 24 0 1 1 392 150 Z'), region(starPath(456, 160, 13), 'thin'), region(starPath(374, 116, 9), 'thin'), region(starPath(446, 210, 8), 'thin')),
    part('', region('M314 66 Q364 136 354 256 L314 256 Z'), region('M516 66 Q466 136 476 256 L516 256 Z')),
    part('', region('M0 600 H600 V760 H0 Z')),
    part('upstairs', stairs()),
    part('beds', at(132, 700, 1, bed(190, 250)), at(322, 700, 1, bed(160, 214))),
    part('asleep', at(482, 700, 1, bed(132, 180, true))),
    part('asleep', line('M500 450 H520 L500 474 H520 M528 410 H544 L528 430 H544 M552 378 H564 L552 394 H564')),
    part('', at(300, 722, 1, ellipse(-24, 0, 22, 10) + ellipse(24, 0, 22, 10))),
    part('', ...[[240, 120], [250, 330], [560, 330], [380, 400], [130, 170]].map(([x, y]) => region(heartPath(x, y, 22), 'thin'))),
  );

// ── 6. Here she is! ──────────────────────────────────────────────────────

const scene6 = (): Svg =>
  page(
    'p6',
    part('', ...[[300, 60], [530, 80], [270, 200]].map(([x, y]) => region(starPath(x, y, 14), 'thin'))),
    part('ran', rect(360, 220, 180, 390, 8), region('M360 610 V228 L292 254 V634 Z'), dot(306, 440, 6),
      region(roundRect(392, 256, 116, 140, 10), 'thin'), region(roundRect(392, 420, 116, 150, 10), 'thin')),
    part('', region('M0 600 H600 V760 H0 Z'), ellipse(160, 712, 140, 26)),
    part('jump', at(150, 694, 1, bed(170, 200))),
    part('home', at(458, 636, 1.0, bear({ who: 'papa', face: 'oh' })), at(352, 700, 0.84, bear({ who: 'mama', face: 'oh' })), at(520, 726, 0.56, bear({ who: 'baby', face: 'oh', arms: 'wave' }))),
    part('woke', at(150, 474, 1.06, girl({ pose: 'jump', face: 'sorry', arms: 'up' })), line('M70 270 L58 250 M48 300 L26 294 M230 270 L242 250 M252 300 L274 294')),
    part('jump', line('M110 486 Q100 496 110 506 Q120 516 110 526 M190 486 Q180 496 190 506 Q200 516 190 526', 'thin')),
    part('sorry', region('M40 112 Q40 72 80 72 H200 Q240 72 240 112 V150 Q240 190 200 190 H156 L128 222 L132 190 H80 Q40 190 40 150 Z'), region(heartPath(140, 134, 50))),
  );

export const SCENES: Record<string, () => Svg> = {
  'the-three-bears': scene1,
  'a-knock-at-the-door': scene2,
  'just-right': scene3,
  'three-chairs': scene4,
  'fast-asleep': scene5,
  'here-she-is': scene6,
};

/** The book's first colouring page: everyone in the story, side by side. */
export const cast = (): Svg =>
  page(
    'cast',
    part('', at(470, 118, 1, sun(44)), at(140, 110, 1, cloud()), at(320, 190, 0.6, cloud())),
    part('', region('M0 540 C160 510 440 516 600 540 V760 H0 Z')),
    part('', at(60, 720, 0.9, flower()), at(560, 600, 0.8, flower(6)), at(330, 590, 1, grass()), at(200, 570, 1, grass())),
    part('', at(132, 690, 1.12, bear({ who: 'papa' })), at(272, 698, 0.98, bear({ who: 'mama' })), at(382, 712, 0.7, bear({ who: 'baby', arms: 'wave' })),
      at(492, 712, 1.14, girl({ arms: 'up' }))),
  );

/** A page of shapes to try pens and crayons on before the pictures. */
export const swatches = (): Svg => {
  const shapes = [
    (x: number, y: number) => circle(x, y, 52),
    (x: number, y: number) => region(heartPath(x, y + 8, 112)),
    (x: number, y: number) => region(starPath(x, y + 6, 64)),
    (x: number, y: number) => region(roundRect(x - 50, y - 50, 100, 100, 22)),
  ];
  const out: Svg[] = [];
  [140, 300, 460].forEach((x, col) => [130, 296, 462, 628].forEach((y, row) => out.push(shapes[(row + col) % shapes.length](x, y))));
  return page('swatches', part('', ...out));
};
