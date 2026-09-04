/*
 * What she can be wearing.
 *
 * Three separate wardrobes — a cut, a colour for it, and a skin — because they
 * are genuinely independent and bundling them into one list of "characters"
 * would mean writing out every combination by hand and re-writing them all any
 * time one shade changed.
 *
 * A style is a set of numbers the hair shell is displaced by, not a mesh. The
 * shell is one surface with a window pushed into its front and its outer lower
 * part drawn down into locks, so a haircut here is: where the fringe hangs, how
 * far it parts, how far round the face it comes, how long the locks are and how
 * many of them there are. That is a narrow vocabulary and it will not describe
 * every haircut, but it covers the range between a pixie and hair past the jaw.
 */

export const HAIRSTYLES = {
  bob: {
    label: "bob",
    /* Where the fringe hangs at the temples, and how far it lifts at the
       centre. The eyes reach 0.15, so anything below about 0.2 is a fringe worn
       over the lashes. */
    fringe: 0.24,
    part: 0.11,
    /* How far round the face the hair comes before the window opens. Pulled in
       and it closes over the cheeks and the head reads as long. */
    side: [0.9, 1.1],
    drop: 0.4,
    clumps: 7,
    clumpDepth: 0.28,
    volume: [1.09, 1.05, 1.13],
    buns: null,
  },

  long: {
    label: "long",
    fringe: 0.22,
    part: 0.09,
    side: [0.86, 1.06],
    /* Well past the jaw. The head ends at -0.94, so this hangs clear of it. */
    drop: 1.05,
    clumps: 5,
    clumpDepth: 0.34,
    volume: [1.1, 1.06, 1.14],
    buns: null,
  },

  pixie: {
    label: "pixie",
    /* Higher and parted harder — a short cut shows forehead, and without that
       it is only a small bob. */
    fringe: 0.32,
    part: 0.22,
    side: [0.95, 1.13],
    drop: 0.1,
    clumps: 9,
    clumpDepth: 0.2,
    volume: [1.07, 1.04, 1.1],
    buns: null,
  },

  buns: {
    label: "buns",
    fringe: 0.26,
    part: 0.14,
    side: [0.96, 1.14],
    drop: 0.08,
    clumps: 8,
    clumpDepth: 0.18,
    volume: [1.07, 1.03, 1.1],
    /* The only style that adds geometry rather than moving the shell. Set well
       back, so they read as sitting behind the crown rather than balanced on
       top of the fringe. */
    buns: { x: 0.6, y: 0.84, z: -0.12, r: 0.36 },
  },
};

export const HAIRSTYLE_NAMES = Object.keys(HAIRSTYLES);

/*
 * Hair reads much lighter on the model than in the swatch — it is a matt
 * surface under a bright key with a white sheen over it, and all three of those
 * lift it. These are set a little deeper than they look here.
 */
export const HAIR_COLORS = {
  pink: { label: "pink", hex: 0xe07fa4 },
  black: { label: "black", hex: 0x241d28 },
  blonde: { label: "blonde", hex: 0xe0bf7a },
  auburn: { label: "auburn", hex: 0xa8542f },
  lilac: { label: "lilac", hex: 0xb094dc },
  ice: { label: "ice", hex: 0x9cc4dc },
};

export const HAIR_COLOR_NAMES = Object.keys(HAIR_COLORS);

/*
 * Each tone carries its own blush, and that is the whole reason this is a list
 * of objects rather than a list of colours. One pink flush works on the two
 * lightest and disappears entirely on the deepest — a blush has to be warmer
 * and stronger the deeper the skin under it, or it simply is not there.
 */
export const SKIN_TONES = {
  porcelain: { label: "porcelain", hex: 0xf7dccb, blush: [232, 130, 140], blushA: 0.4 },
  sand: { label: "sand", hex: 0xf0c49c, blush: [226, 112, 120], blushA: 0.42 },
  honey: { label: "honey", hex: 0xd9a173, blush: [206, 92, 94], blushA: 0.46 },
  bronze: { label: "bronze", hex: 0xb2764a, blush: [166, 68, 66], blushA: 0.5 },
  cocoa: { label: "cocoa", hex: 0x86502f, blush: [128, 46, 46], blushA: 0.55 },
};

export const SKIN_TONE_NAMES = Object.keys(SKIN_TONES);
