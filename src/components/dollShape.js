/*
 * The doll's shape, as arithmetic.
 *
 * Kept apart from three, and importing nothing, so it can be run and printed on
 * its own. The last attempt at a hairline went in blind and came out flat — the
 * numbers said the part opened to the crown and the render disagreed, and there
 * was no way to ask which was lying without a browser in the loop. A field this
 * fiddly wants to be checkable in a terminal.
 *
 * Everything works on a unit sphere and comes back in head units, where the
 * head is about 0.9 wide, 1.08 tall and 0.86 deep.
 */

/** Hermite ramp, 0 below a and 1 above b. Every threshold here is one. */
export function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/*
 * A unit sphere pushed into a head.
 *
 * Not a primitive, on purpose. A sphere reads as a ball and a rounded box reads
 * as a brick, and the old pet was a brick with a face printed on it — which is
 * the exact construction a Lego minifig uses, and why it read as one. The
 * silhouette has to be something you could not have got by calling a
 * constructor.
 *
 * Three things make it a face rather than an egg: a tall cranium, because the
 * whole doll look is features crammed into the lower part of a big head; a
 * taper to a narrow chin, which is what stops it reading as a balloon; and a
 * slight widening at the cheekbones, which is where the taper would otherwise
 * make it gaunt.
 */
export function egg(x, y, z) {
  /* 0 above the cheekbones, 1 at the chin. Raised to a power so the narrowing
     happens late — spread evenly it takes the cheeks with it. */
  /*
   * Baby proportion: wider than it is tall, widest a long way down, and
   * almost no chin.
   *
   * This is the whole difference between cute and uncanny, and it took three
   * goes to get to. The face was tapering from the cheekbones down to a point,
   * which is villain shorthand; then it was a sphere, which is a balloon. What
   * the references actually have is cheeks that swell out below the eyes and a
   * jaw that stops almost immediately under them — the widest part of the head
   * is at the mouth, not at the eyes.
   *
   * So the bulge is centred well below the middle and is large, and the taper
   * is held off until the last stretch, where it comes in hard. Height is taken
   * in rather than width added, so the head gets wider without getting bigger.
   */
  const cheek = 1 + 0.09 * Math.exp(-(((y + 0.3) / 0.5) ** 2));
  const down = Math.pow(Math.max(0, (-0.52 - y) / 0.48), 1.8);
  const taper = 1 - 0.2 * down;

  /*
   * Close to a ball, with only enough taken off the jaw to keep it from being
   * a literal sphere. It had swung the other way — a heavy cheek bulge and a
   * hard late taper made a shape with corners in it, which is not what round
   * means. Width and height come back together too.
   */
  return [x * 0.96 * taper * cheek, y * 0.94, z * 0.96 * taper];
}

/* Where the eyes sit on that head, in head units. Everything else — the
   sockets, the lids, the hairline — is placed against these, so the face moves
   as one if they ever change. */
/* Where the drawn eyes sit, so the hairline can be checked against them. */
export const EYE = { x: 0.4, y: -0.16, r: 0.31 };

/*
 * How much of the face window a hair vertex is in.
 *
 * The window is not cut. Displacement cannot make a hole, so vertices inside it
 * are pushed back into the head, which is opaque and swallows them; what stays
 * visible is the curve where the two surfaces cross, and that curve is the
 * hairline. It costs nothing to move because it is a threshold rather than a
 * shape.
 *
 * The part comes from the same threshold. The hairline is a height that peaks
 * hard in the middle and falls away fast, so the hair opens to the crown at the
 * centre and hangs at the temples. A gentle rise does not read at all — it
 * comes out as a straight bar across the brow.
 */
export function hairWindow(x, y, z, style) {
  /*
   * The base is where the fringe hangs at the temples, and it has to clear the
   * top of the eye — at 0.24 the map showed it cutting 0.05 into them, which is
   * a fringe worn over the lashes rather than above them. The peak stops just
   * under the crown for the same kind of reason: taken any higher the part
   * opens right over the top of the head and shaves a bald stripe through it.
   */
  const part = Math.exp(-((x / 0.16) ** 2));
  /*
   * Scalloped, so the fringe ends in points instead of a clean arc. One smooth
   * curve across the brow is what made the hair read as a bonnet — real hair
   * hangs in clumps and the hem is where you see it. The power flattens the
   * tops and sharpens the dips, so these are points rather than a wave, and the
   * sine is zero at the centre so the part is not chewed by it.
   */
  /*
   * A shallow notch over a low fringe, which is the opposite of what was here.
   *
   * The peak reached 1.02 with the head only 1.0 tall, so at the centre the
   * window opened clean past the crown and took every hair with it — the part
   * was not a part, it was a bald stripe. And the base had been lifted to clear
   * eyes that have since moved down the face, so the fringe sat halfway up the
   * forehead and left it bare.
   *
   * Now it hangs to just above the lashes and the part is a dip in it.
   */
  /* Barely there. The reference fringe is one clean sweep with a slight lift
     at the centre — the locks are in the hair's own shape, not notched out of
     its edge, and anything more here only serrates it. */
  const notch = 0.014 * Math.pow(Math.abs(Math.sin(x * 5)), 0.9);
  /* A dip, not a parting. At 0.26 the peak drove a sharp spike up the middle
     of the fringe that read as a tear in it rather than as hair falling either
     side. The references barely part at all — the fringe is a sweep with a
     little lift in the centre. */
  const line = style.fringe + style.part * part - notch;

  return (
    /* On the front. */
    smooth(0.05, 0.32, z) *
    /* Inboard of the locks. */
    /* Out past the cheek, so the hair frames the face instead of closing over
       it. Wrapped in this far it left the visible skin as a narrow oval, and
       the head read as long no matter how round it actually was. */
    (1 - smooth(style.side[0], style.side[1], Math.abs(x))) *
    /* Below the hairline. */
    /* A wide crossing, so the hairline lands as a curve across several rows of
       the mesh rather than resolving on one. */
    (1 - smooth(line - 0.16, line + 0.16, y))
  );
}

/* How far the outer, lower part of the shell is drawn down past the jaw. This
   is what makes a bob rather than a cap — at the head's own height it is a
   helmet however the front is cut. */
export function hairDrop(x, y, z, style) {
  /* The same scallop as the fringe, run around the head instead of across it,
     so the locks end in points too. */
  const az = Math.atan2(z, x);
  /* More of them and shallower. Four deep ones made two lobes hanging beside
     the face that read as ears. */
  const clump = 1 + style.clumpDepth * Math.pow(Math.abs(Math.cos(az * style.clumps)), 0.6);
  return smooth(0.34, 0.86, Math.abs(x)) * smooth(0.42, -0.5, y) * clump;
}
