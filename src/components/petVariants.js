/*
 * The four of them.
 *
 * A variant is a colour and a body, not a skin — the shape is half of what
 * makes each one its own creature, and swapping only the colour would give four
 * identical pets in different paint. Everything else is shared: the same glass,
 * the same face, the same expressions.
 *
 * Named for what they are. They are a shape and a colour, and calling them
 * anything else would be inventing a personality the pet does not have yet.
 *
 * The colours are set far deeper than they look on screen. Everything between
 * the body and the eye lightens it: the glass tints what passes through, the
 * room reflects a lot of white into it, and ACES lifts the mid-tones on top of
 * both. A colour picked to look right in isolation arrives as a pastel of
 * itself, which is how the orange one first came out as pale peach.
 *
 * faceZ / faceScale / faceY place the face on each body, and all three are
 * per-variant. faceZ has to clear the body at the point the eyes sit rather
 * than at the point a nose would: the circle is the one that catches this out,
 * because it falls away fastest from its pole and faceScale shrinks the face
 * plane's forward bulge along with the plane.
 */
export const VARIANTS = {
  square: {
    label: "pink square",
    color: 0xe85a86,
    form: "box",
    faceZ: 0.34,
    faceScale: 1,
    faceY: 0,
  },
  oval: {
    label: "orange oval",
    color: 0xb04a08,
    form: "tall",
    faceZ: 0.3,
    faceScale: 0.8,
    faceY: 0.2,
  },
  triangle: {
    label: "green triangle",
    color: 0x6faa10,
    form: "tri",
    faceZ: 0.34,
    // Smaller and lower than the others' faces. A triangle's room is all in the
    // bottom half, so a face centred on the body sits where the shape is
    // running out of width.
    faceScale: 0.72,
    faceY: -0.05,
  },
  circle: {
    label: "blue circle",
    color: 0x2585c4,
    form: "round",
    faceZ: 0.55,
    faceScale: 0.78,
    faceY: 0,
  },
};

export const VARIANT_NAMES = Object.keys(VARIANTS);
