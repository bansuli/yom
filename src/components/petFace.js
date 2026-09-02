/*
 * The pet's face, drawn rather than modelled.
 *
 * Two spheres and a cone can hold one expression. A mouth that has to bend from
 * a smile to a frown, eyes that have to close into happy arcs and brows that
 * have to tilt against each other are all changes of shape, and changing shape
 * is what geometry is worst at and a canvas is best at. So the face is a
 * texture, redrawn whenever it moves, mapped onto a plane bulged to sit on the
 * front of the body.
 *
 * Every expression is the same set of numbers with different values, so any two
 * of them can be crossfaded simply by easing each number toward the next. There
 * are no poses in between to author and nothing to sequence: a pet halfway from
 * confused to happy is a real face, not a blend of two pictures.
 *
 * Distances are fractions of the canvas, so the resolution can change without
 * any of this moving.
 */

export const FACE = {
  /* Eyes. eyeArc turns them from filled ovals into upturned crescents. */
  eyeOpen: 1,
  eyeArc: 0,
  eyeY: 0,
  pupilX: 0,
  pupilY: 0,

  /* Brows. Off entirely at rest — a face with permanent brows always looks
     like it is reacting to something. Tilt is the inner end going up. */
  browOn: 0,
  browLY: 0,
  browRY: 0,
  browLTilt: 0,
  browRTilt: 0,

  /* Mouth. Curve runs -1 (down) to 1 (up); open lifts it off a line. */
  mouthCurve: 0.1,
  mouthOpen: 0.05,
  mouthW: 0.45,
  mouthX: 0,

  /* How far the head cocks, in radians. */
  tilt: 0,
};

const from = (over) => ({ ...FACE, ...over });

export const EXPRESSIONS = {
  /*
   * What the pet does when nothing is happening, and the one that matters
   * most — it is the face it wears almost all of the time.
   *
   * Pleased rather than delighted. The eyes stay open ovals instead of going
   * to crescents, and the mouth is a soft closed curve: the crescent eyes and
   * the open grin are the reaction, and spending them here would leave nothing
   * to escalate to. A resting face that is already at full happiness cannot
   * cheer up.
   */
  resting: from({
    mouthCurve: 0.52,
    mouthOpen: 0.07,
    mouthW: 0.42,
  }),

  /* Deliberately flat. Kept as something to fall to, not to sit at. */
  neutral: from({}),

  happy: from({
    eyeArc: 1,
    mouthCurve: 1,
    mouthOpen: 0.3,
    mouthW: 0.6,
  }),

  /* Lids low, inner brow ends lifted, mouth turned down and narrowed. The
     raised inner ends are what separates sad from cross; dropped, the same
     face is angry. */
  disappointed: from({
    eyeOpen: 0.48,
    eyeY: 0.016,
    pupilY: 0.012,
    browOn: 1,
    browLTilt: -0.44,
    browRTilt: 0.44,
    mouthCurve: -0.85,
    mouthOpen: 0.03,
    mouthW: 0.4,
  }),

  /* Asymmetry is the whole thing. One brow up, one down, a small off-centre
     mouth and a head cocked to the side. */
  confused: from({
    browOn: 1,
    browLY: -0.04,
    browRY: 0.022,
    browLTilt: 0.12,
    browRTilt: -0.3,
    mouthCurve: -0.2,
    mouthOpen: 0.08,
    mouthW: 0.3,
    mouthX: 0.055,
    tilt: 0.15,
  }),

  /* Looking away and up. Nobody thinks while staring straight at you. */
  thinking: from({
    eyeOpen: 0.88,
    pupilX: 0.055,
    pupilY: -0.05,
    browOn: 1,
    browLY: -0.032,
    browRY: 0.004,
    browLTilt: 0.1,
    mouthCurve: -0.06,
    mouthOpen: 0.04,
    mouthW: 0.24,
    mouthX: 0.06,
    tilt: -0.08,
  }),

  surprised: from({
    eyeOpen: 1.55,
    browOn: 1,
    browLY: -0.055,
    browRY: -0.055,
    mouthCurve: 0.15,
    mouthOpen: 0.95,
    mouthW: 0.3,
  }),
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

/** Every key eased the same amount toward the target. */
export function easeFace(current, target, k) {
  for (const key in current) {
    current[key] += (target[key] - current[key]) * k;
  }
}

/**
 * Draws the face. `blink` multiplies how open the eyes are, so a blink can ride
 * on top of any expression without the expression knowing about it.
 */
export function drawFace(ctx, size, p, blink = 1) {
  const S = size;
  ctx.clearRect(0, 0, S, S);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#120309";
  ctx.fillStyle = "#120309";

  const cx = S / 2;
  const eyeY = S * 0.44 + p.eyeY * S;
  const gap = S * 0.158;
  const open = Math.max(0, p.eyeOpen) * blink;

  // ── Eyes ──
  for (const side of [-1, 1]) {
    const x = cx + side * gap;

    // A crescent, once the expression has mostly arrived there. Crossfading
    // between a filled oval and a stroked arc would show both at once, so the
    // swap happens at the midpoint and the arc's thickness carries the rest.
    if (p.eyeArc > 0.5) {
      const t = (p.eyeArc - 0.5) * 2;
      ctx.lineWidth = S * 0.05 * t;
      ctx.beginPath();
      ctx.arc(x, eyeY + S * 0.038, S * 0.072, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
      continue;
    }

    /*
     * Big and nearly round. They were tall and narrow before, and a narrow eye
     * is a squint however friendly the mouth under it is — that is where the
     * unsettling look was coming from, not the expressions. Widening them until
     * they are only a little taller than they are wide is the whole difference
     * between wary and cute.
     */
    const rx = S * 0.058;
    const ry = Math.max(S * 0.005, S * 0.076 * open);
    ctx.beginPath();
    ctx.ellipse(x + p.pupilX * S, eyeY + p.pupilY * S, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Brows ──
  if (p.browOn > 0.02) {
    ctx.lineWidth = S * 0.026;
    ctx.globalAlpha = Math.min(1, p.browOn);
    const len = S * 0.085;
    for (const side of [-1, 1]) {
      const x = cx + side * gap;
      const y = eyeY - S * 0.105 + (side < 0 ? p.browLY : p.browRY) * S;
      // Tilt is written as "inner end up", so the sign flips with the side.
      const tilt = (side < 0 ? p.browLTilt : p.browRTilt) * side;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── Mouth ──
  const mx = cx + p.mouthX * S;
  const my = S * 0.63;
  const half = (p.mouthW * S) / 2;
  // Positive curve pulls the middle down on screen, which reads as a smile,
  // because a quadratic's control point is on the far side of the curve.
  const bend = p.mouthCurve * S * 0.13;
  const drop = p.mouthOpen * S * 0.13;

  ctx.beginPath();
  ctx.moveTo(mx - half, my);
  if (drop > S * 0.012) {
    // Open: an outline down to the control point and back along the top, so it
    // fills as a shape rather than a stroked line.
    ctx.quadraticCurveTo(mx, my + bend + drop * 2, mx + half, my);
    ctx.quadraticCurveTo(mx, my + bend * 0.35 - drop * 0.15, mx - half, my);
    ctx.fill();
  } else {
    ctx.lineWidth = S * 0.028;
    ctx.quadraticCurveTo(mx, my + bend * 2, mx + half, my);
    ctx.stroke();
  }
}
