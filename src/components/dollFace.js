/*
 * The face, drawn flat.
 *
 * Everything here is unlit, hard-edged, solid colour — no gradients, no gloss,
 * nothing that reads as a surface. That is the whole point of it.
 *
 * The eyes were geometry before: a ball in a socket with an iris on a pivot and
 * a lid turning over it. All of that worked and all of it was wrong, because a
 * physically shaded eyeball bulging out of a physically shaded face is the
 * uncanny valley by construction, and the harder each part tried to be a real
 * eye the worse the whole thing got. The references are 3D objects with 2D
 * faces painted on — a real head, real hair, and then flat black shapes for
 * features. A flat shape cannot be uncanny; it can only be a drawing.
 *
 * So the head and the hair stay solid, and this is a sticker over them.
 *
 * Coordinates are head units, the same ones the shape file works in, converted
 * on the way out. In pixels every position would have to be re-derived against
 * the canvas resolution.
 */

/* The plane spans two head units across, centred on the face. */
const SPAN = 2;

/*
 * Near-black, and only just.
 *
 * It was warmed to #2b1a16 on the reasoning that pure black on skin reads as a
 * hole punched through it. That reasoning holds for a thin line and not at all
 * for a shape this size: at eye scale the warmth stopped being a nudge away
 * from black and simply became brown. Enough is kept to kill the flatness of
 * 000 and no more.
 */
const INK = "#15101a";


export function drawDecal(ctx, S, p, blink, lip, blush) {
  const px = (hx) => (hx / SPAN + 0.5) * S;
  const py = (hy) => (0.5 - hy / SPAN) * S;
  const u = (n) => (n / SPAN) * S;

  ctx.clearRect(0, 0, S, S);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /*
   * Low on the head, and very large. Cute proportion is a big cranium with the
   * features gathered into the bottom half — eyes on the midline with a long
   * face under them is the alien arrangement, and it was most of what was
   * wrong with the proportions before.
   */
  const eyeY = -0.13;
  const eyeX = 0.38;
  /*
   * Round, near enough — but there is a limit. At 0.31 they met in the middle
   * and ran off the sides of the face, and an eye with nothing around it stops
   * reading as an eye. The references leave a clear gap at the bridge and a
   * good margin at the temples; the eyes are large relative to the face, not
   * larger than it.
   */
  const rx = 0.23;
  const ry = 0.272;

  // ── Blush ──
  /* Under the eyes rather than down on the jaw, and soft enough to read as
     colour in the skin rather than as a drawn shape. */
  for (const side of [-1, 1]) {
    const cx = px(side * 0.56);
    const cy = py(eyeY - 0.32);
    /* Warmer and stronger the deeper the skin under it. One pink flush works
       on the two lightest tones and is simply not there on the darkest. */
    const [r, gr, b] = blush.rgb;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, u(0.3));
    g.addColorStop(0, `rgba(${r},${gr},${b},${blush.a})`);
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, u(0.3), u(0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Eyes ──
  /*
   * Two things: a solid shape and one highlight.
   *
   * This had grown to seven — a gradient, a white oval, a star, a blue drop, a
   * lash arc, five separate spikes, and a brow over the top — and every one of
   * them was taken from a reference, which is exactly how it went wrong. The
   * references do not stack their details; each uses two or three and lets the
   * shape carry the rest. Seven marks in the space of an eye stop reading as an
   * eye and start reading as a diagram of one.
   */
  const open = Math.max(0, p.eyeOpen) * blink;

  for (const side of [-1, 1]) {
    ctx.save();
    /* Drawn in its own frame, tilted out at the top — upright, the pair reads
       as a stare, and the splay is what gives the face somewhere to look. */
    /*
     * pupilX and pupilY move the whole eye rather than anything inside it.
     *
     * With the iris gone there is nothing in there to turn, and a highlight
     * that slid about read as something wrong with the eye. Moving the shape
     * itself is what a flat face does to look somewhere — and expressions drive
     * it now rather than the pointer, so it happens deliberately or not at all.
     */
    ctx.translate(px(side * eyeX + p.pupilX * 1.1), py(eyeY - p.pupilY * 1.1));
    ctx.rotate(side * 0.15);
    ctx.scale(side, 1);

    const RX = u(rx);
    const RY = u(ry * Math.max(0.02, open));

    /*
     * Shut, or delighted, the eye stops being a shape and becomes a line. The
     * crossfade would show a filled oval and a stroked arc at once, so the swap
     * happens at the midpoint and the arc's weight carries the rest.
     */
    if (p.eyeArc > 0.5) {
      const t = (p.eyeArc - 0.5) * 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = u(0.07 * t);
      ctx.beginPath();
      ctx.arc(0, u(0.05), RX * 0.85, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
    ctx.fill();

    /* One highlight, high and outward, and generous — it is the only mark in
       there, so it has to be big enough to be the eye's whole character. */
    if (open > 0.35) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      /*
       * A crescent along the outer rim, not a blob in the middle.
       *
       * Cut rather than drawn: fill the eye white, then put the eye back over
       * it shifted inward, and what survives is a fingernail of white hugging
       * the outer edge and running to a point at the top and the bottom. A
       * plain oval sitting in the middle of the pupil is a dot of light on a
       * surface — this is the shape the references actually use, and it is what
       * makes the eye look like it has a direction.
       *
       * Fixed in place, and it stays fixed. It used to slide with the pointer,
       * on the reasoning that with no iris to turn it was the only thing left
       * to carry a glance; what it carried instead was the impression that
       * something was wrong with the eye.
       */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-RX * 1.2, -RY * 1.2, RX * 2.4, RY * 2.4);

      /*
       * The punch is exactly the eye's own size, only shifted.
       *
       * That is what makes it taper. Two identical ellipses offset sideways
       * cross at precisely two points, so the sliver between them runs to a
       * sharp tip at the top and the bottom — a fingernail. Made even slightly
       * smaller, as it was, it stops reaching the rim and white leaks along the
       * top and bottom as well, which turns the crescent into an even band
       * around the outside and the eye into a ring.
       */
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(-RX * 0.28, RY * 0.05, RX, RY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Brows ──
  /*
   * Small, high and thin — barely more than a mark. The references use almost
   * nothing here, because anything substantial above an eye this large turns
   * into a scowl.
   */
  ctx.strokeStyle = INK;
  ctx.lineWidth = u(0.028);
  for (const side of [-1, 1]) {
    const bx = side * (eyeX - 0.02);
    /* Just under the fringe. Any higher and the hair swallows them, which is
       what the references actually do — but then the brows stop being able to
       carry an expression, and they are the only thing besides the eyes that
       can. */
    const by = eyeY + ry + 0.085 + (side < 0 ? p.browLY : p.browRY);
    // Tilt is written as "inner end up", so the sign flips with the side.
    const tilt = (side < 0 ? p.browLTilt : p.browRTilt) * side;

    ctx.save();
    ctx.translate(px(bx), py(by));
    ctx.rotate(-tilt * side);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(u(-0.1), u(0.012));
    ctx.quadraticCurveTo(u(0), u(-0.035), u(0.1), u(0.004));
    ctx.stroke();
    ctx.restore();
  }

  // ── Mouth ──
  /*
   * Tiny, and low. It is the quietest thing on the face by a long way — the
   * eyes are the whole expression and a mouth that competes with them is what
   * turns a doll into a mannequin.
   *
   * Open, it fills; shut, it is a stroked curve. No lips: a drawn face gets a
   * shape, not a mouth with volume.
   */
  const mx = px(p.mouthX);
  const my = py(-0.62);
  const half = u(Math.max(0.03, p.mouthW * 0.16));
  const bend = u(p.mouthCurve * 0.055);
  const drop = u(p.mouthOpen * 0.13);

  if (drop > u(0.022)) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(mx, my + drop * 0.3, half * 0.85, drop * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    /* The tongue, which both references have and which is doing a surprising
       amount of the charm. */
    ctx.fillStyle = lip;
    ctx.beginPath();
    ctx.ellipse(mx, my + drop * 1.1, half * 0.5, drop * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = u(0.032);
    ctx.beginPath();
    ctx.moveTo(mx - half, my);
    ctx.quadraticCurveTo(mx, my + bend * 2, mx + half, my);
    ctx.stroke();
  }
}
