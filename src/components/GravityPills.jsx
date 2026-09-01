import { useEffect, useRef } from "react";
import { ARTWORK } from "./heroArtwork.js";
import "./GravityPills.css";

/*
 * Plastic pills that fall in and pile up on the rule above the wordmark.
 *
 * Two libraries, one job each. Three draws them: MeshPhysicalMaterial under an
 * environment probe is what makes the plastic read as plastic — a clearcoat
 * over a rough body, catching a room's worth of reflections rather than a
 * couple of lights. Matter runs them: a pile is resting contacts stacked on
 * resting contacts, and an engine that has solved that is worth more than one
 * written here would be.
 *
 * They meet in pixels. Matter simulates in the container's own coordinates and
 * every frame the result is mapped into world units for the camera, so the
 * floor of the simulation is exactly the rule on the page rather than
 * something positioned to look like it.
 *
 * Both libraries are loaded on demand. They are far larger than the rest of
 * this page put together, and none of it should wait on them.
 */

/*
 * What falls, in the order it falls.
 *
 * The pills are off the page, not out of the file. Everything that draws them
 * — pillShape, the glass material, the hull the collision comes from — is
 * untouched, because they are a kind here rather than the only thing this
 * knows how to make. Putting them back is putting their rows back in this
 * array, and docs/HERO_OBJECTS.md has them written out.
 *
 * Every pill is placed by hand: where across the width it enters, the angle it
 * enters at, and how fast it is turning. Nothing here is random, and the
 * simulation is fed a fixed step, so the same page gives the same pile every
 * time — the same pills in the same places at the same angles. That matters
 * beyond looking consistent: these are going to become the links to About,
 * How it works and the rest, and a link should not be somewhere different on
 * every load.
 */
const PILLS = [
  { art: "leopardBag", size: 1.05, at: 0.12, tilt: -0.14, spin: 0.012 },
  { art: "darkJeans", size: 1.15, at: 0.3, tilt: 0.1, spin: -0.014 },
  { art: "sunglasses", size: 0.95, at: 0.48, tilt: 0.24, spin: -0.02 },
  { art: "eyeSkirt", size: 0.9, at: 0.62, tilt: -0.18, spin: 0.016 },
  { art: "loafer", size: 0.8, at: 0.78, tilt: 0.3, spin: -0.02 },
  { art: "blackBag", size: 1.1, at: 0.92, tilt: 0.12, spin: -0.01 },
];

/*
 * The room the pills are lit in reflects a lot of white, and ACES lifts the
 * mid-tones on top of that, so a colour handed over straight comes back as a
 * pastel of itself. The base is pushed the other way to compensate — the same
 * trick the reference component uses.
 */
const SATURATION = 1.45;

function saturate(THREE, hex) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * SATURATION), hsl.l * 0.94);
  return c;
}

const DROP_INTERVAL = 230; // ms between one pill being released and the next
const ENTRY_SPEED = 6; // px per tick, downward, at the moment a pill enters
const PAPER = "#f9d9d1"; // the page behind the canvas, for the glass to refract

/*
 * A long lens, far back, rather than a wide one up close.
 *
 * These two together frame the same amount of scene — 2·tan(fov/2)·z is about
 * the same either way — but they do it with very different perspective. At 45°
 * from 25 units the pills, which are large enough for one to span the height of
 * the view, are each seen from a noticeably different angle depending on where
 * they sit, and a pill to the left leans right while its neighbour leans left.
 * Their front faces then cross, and the pile reads as pills passing through one
 * another rather than resting on each other. Physics never allowed the overlap;
 * the projection invented it.
 *
 * At 12° from 100 units the view is nearly orthographic. Every pill is seen
 * face on, so where two of them touch in the simulation is where they touch on
 * screen.
 */
const CAMERA_Z = 100;
const FOV = 12;

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Andrew's monotone chain. Ported from the reference component, which builds
 * every collision shape this way rather than declaring it separately.
 */
function convexHull(points) {
  if (points.length <= 3) return points;
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * The colliding outline, taken from the drawn mesh rather than declared next
 * to it.
 *
 * This is the whole reason the pills were passing through one another. A
 * bevelled ExtrudeGeometry is not the size of the shape it was built from — the
 * bevel pushes the silhouette outward by bevelSize on every side — so a body
 * built to the shape's own dimensions was 22px narrower than the pill drawn
 * over it, and two pills touching exactly in the simulation overlapped by 22px
 * on screen. The physics was never wrong; it was solving a smaller pill.
 *
 * Derived from the geometry, the two cannot disagree, whatever the bevel does.
 */
/*
 * A concave body's outline, taken from the shape it was drawn from rather than
 * from the mesh.
 *
 * The convex-hull route the pills use cannot work here: a hull spans the notch
 * under each sleeve, so the shirt would collide with a silhouette it does not
 * have. The points come from the shape and are pushed outward from the centre
 * to stand in for the bevel, the same approximation the reference component
 * makes for its logos.
 */
function outlineFromShape(shape, unitsToPx, marginPx, segments = 26) {
  return shape.getPoints(segments).map((p) => {
    const x = p.x * unitsToPx;
    const y = -p.y * unitsToPx;
    const mag = Math.hypot(x, y) || 1;
    return { x: x + (x / mag) * marginPx, y: y + (y / mag) * marginPx };
  });
}

function outlineFromGeometry(geometry, unitsToPx, marginPx) {
  const pos = geometry.attributes.position.array;
  const pts = [];
  for (let i = 0; i < pos.length; i += 3) {
    pts.push({ x: pos[i] * unitsToPx, y: -pos[i + 1] * unitsToPx });
  }
  const hull = convexHull(pts);
  if (!marginPx) return hull;
  // Nudged outward so the pills come to rest a hair apart rather than exactly
  // touching, which is what keeps the seam between two of them legible.
  return hull.map((p) => {
    const mag = Math.hypot(p.x, p.y) || 1;
    return { x: p.x + (p.x / mag) * marginPx, y: p.y + (p.y / mag) * marginPx };
  });
}

/*
 * A real bag, traced from the SVG rather than drawn.
 *
 * The file was a vectorised photograph — 1492 gradient-filled paths and no
 * single outline to take — so the silhouette was rasterised and its boundary
 * walked, then simplified to these points.
 *
 * The hole is not a detail. Traced as an outer silhouette alone the bag comes
 * out as a plain dome: it is the gap under the handle that makes it read as a
 * bag at all. Normalised so the taller side spans 1.
 */
/*
 * The area centroid of a polygon.
 *
 * This is where Matter puts a body's origin, and it is not where three puts a
 * mesh's — geometry.center() uses the bounding box. For anything symmetrical
 * the two agree; for a bag they do not, because the mass is in the body while
 * the handle is thin and tall. Centre the mesh on the box and it is drawn
 * offset from the shape it collides with: the bag rests correctly on the floor
 * and renders through it.
 */
function polygonCentroid(pts) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a *= 0.5;
  return a === 0 ? [0, 0] : [cx / (6 * a), cy / (6 * a)];
}

/** Builds the outline, and its hole, at a given size. */
function artShape(THREE, art, s) {
  const shape = new THREE.Shape();
  art.outer.forEach(([x, y], i) =>
    i ? shape.lineTo(x * s, y * s) : shape.moveTo(x * s, y * s),
  );
  shape.closePath();
  if (art.hole.length > 2) {
    const hole = new THREE.Path();
    art.hole.forEach(([x, y], i) =>
      i ? hole.lineTo(x * s, y * s) : hole.moveTo(x * s, y * s),
    );
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

/**
 * Traces a polygon with its corners rounded off.
 *
 * Every corner becomes a quadratic curve pulled back from the vertex by r, so
 * the outline has no hard points. That matters more here than it looks: the
 * glass rim is a bevel following the silhouette, and a sharp corner gives it a
 * pinch of light that reads as a chip rather than a fold.
 */
function roundedPolygon(shape, pts, r) {
  const n = pts.length;
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const back = (i) => {
    const cur = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const d = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    return lerp(cur, prev, Math.min(r, d / 2) / d);
  };
  const fwd = (i) => {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const d = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    return lerp(cur, next, Math.min(r, d / 2) / d);
  };
  const start = fwd(0);
  shape.moveTo(start.x, start.y);
  for (let i = 1; i <= n; i++) {
    const k = i % n;
    const b = back(k);
    const f = fwd(k);
    shape.lineTo(b.x, b.y);
    shape.quadraticCurveTo(pts[k].x, pts[k].y, f.x, f.y);
  }
  shape.closePath();
  return shape;
}

/**
 * A t-shirt, in the same units as the pills: length is its width across the
 * sleeves, girth its height. Concave, which is the whole point of the test —
 * the notch under each sleeve is what a convex hull cannot represent.
 */
function shirtOutline(length, girth) {
  const w = length / 2;
  const h = girth / 2;
  const body = w * 0.48;
  const cuff = h * 0.1;
  const armpit = -h * 0.18;
  const shoulder = h * 0.58;
  const neck = w * 0.17;
  return [
    { x: -neck, y: h },
    { x: neck, y: h },
    { x: w, y: shoulder },
    { x: w, y: cuff },
    { x: body, y: armpit },
    { x: body, y: -h },
    { x: -body, y: -h },
    { x: -body, y: armpit },
    { x: -w, y: cuff },
    { x: -w, y: shoulder },
  ];
}

function shirtShape(THREE, length, girth) {
  return roundedPolygon(new THREE.Shape(), shirtOutline(length, girth), girth * 0.035);
}

/** A stadium: a rectangle with its ends turned into half circles. */
function pillShape(THREE, length, girth) {
  const r = girth / 2;
  const straight = Math.max(length - girth, 0.001) / 2;
  const s = new THREE.Shape();
  s.absarc(straight, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-straight, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  s.closePath();
  return s;
}

export default function GravityPills() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let stop = () => {};

    Promise.all([
      import("three"),
      import("three/examples/jsm/environments/RoomEnvironment.js"),
      import("matter-js"),
      import("poly-decomp"),
    ])
      .then(([THREE, { RoomEnvironment }, matter, decomp]) => {
        if (disposed) return;
        const M = matter.default ?? matter;
        // Without this Matter refuses concave outlines and silently falls back
        // to their convex hull — which is the thing this is here to avoid.
        M.Common.setDecomp(decomp.default ?? decomp);
        stop = run(mount, THREE, RoomEnvironment, M);
      })
      .catch(() => {
        // A decorative layer is not worth breaking the page over.
      });

    return () => {
      disposed = true;
      stop();
    };
  }, []);

  return <div className="pill-yard" ref={mountRef} aria-hidden="true" />;
}

function run(mount, THREE, RoomEnvironment, Matter) {
  const { Engine, Composite, Bodies, Body, Mouse, MouseConstraint, Events } = Matter;

  let width = mount.clientWidth;
  let height = mount.clientHeight;
  if (width < 2 || height < 2) return () => {};

  const still = reducedMotion();

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  // Transmission renders the scene a second time into a buffer for the glass
  // to sample. At half resolution that pass costs a quarter as much, and what
  // it feeds is a refraction — already smeared, so the detail is not missed.
  renderer.transmissionResolutionScale = 0.5;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);
  camera.position.z = CAMERA_Z;

  // Pixels to world units. Everything below is authored in pixels and passed
  // through this, so the simulation and the page agree on where things are.
  let scale = (2 * Math.tan((FOV * Math.PI) / 360) * CAMERA_Z) / height;
  const toWorldX = (px) => (px - width / 2) * scale;
  const toWorldY = (py) => (height / 2 - py) * scale;

  // ── Light ──
  // The environment probe does most of the work: a clearcoat needs something
  // with shape to reflect, and a handful of point lights only gives it dots.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;

  // Low: ambient light lands evenly on every face and flattens the shading
  // that makes these read as solid objects.
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(5, 16, 18);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  key.shadow.bias = -1e-4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  scene.add(key);

  const rim1 = new THREE.PointLight(0xeeddff, 180, 100);
  rim1.position.set(-15, -12, 12);
  scene.add(rim1);

  const rim2 = new THREE.PointLight(0xffddee, 180, 100);
  rim2.position.set(15, 14, 10);
  scene.add(rim2);

  /*
   * A backdrop, and a shadow catcher in front of it.
   *
   * Transmission refracts the scene, and until now the scene behind the pills
   * was nothing at all — a transparent canvas over the page. Glass with
   * nothing behind it refracts nothing and reads as a hole. The backdrop is
   * the page's own colour, unlit so it matches exactly, and sits far enough
   * back to be well outside the pile.
   *
   * It has to be a second plane rather than one doing both jobs: a shadow
   * needs a lit material to fall on and an unlit one is what matches the page,
   * so the shadows are caught on their own transparent plane in front.
   */
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PAPER) }),
  );
  backdrop.position.z = -6;
  scene.add(backdrop);

  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: 0.12 }),
  );
  catcher.position.z = -1.5;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // ── Sizes ──
  // Pills are a share of the container's width, so the pile keeps its
  // proportions rather than being a fixed size on every screen.
  /*
   * Bounded by the height of the yard as well as its width.
   *
   * Sized off the width alone the pills are the same on a tall window and a
   * short one, but the room above the rule is not — it is whatever the page has
   * left over — so a pile that just fits a tall window buries a short one. The
   * flat cap does the same job at the other end, where a wide monitor gives a
   * yard tall enough that nothing else stops the pills growing.
   */
  const unit = Math.max(60, Math.min(width * 0.21, height * 0.7, 315));

  // ── Physics ──
  // More solver passes than the default. These bodies are large and heavy, and
  // a pile of them loads the contacts at the bottom hard enough that six
  // position passes leave visible interpenetration to settle out.
  const engine = Engine.create({
    enableSleeping: true,
    positionIterations: 12,
    velocityIterations: 8,
    constraintIterations: 4,
  });
  engine.gravity.y = 1;
  engine.timing.timeScale = 0.9;

  const WALL = 400;
  let floor = null;
  let leftWall = null;
  let rightWall = null;

  const buildBounds = () => {
    [floor, leftWall, rightWall].forEach((b) => b && Composite.remove(engine.world, b));
    // The floor's top edge is the container's bottom edge, which is the rule.
    floor = Bodies.rectangle(width / 2, height + WALL / 2, width * 3, WALL, {
      isStatic: true,
      friction: 0.6,
    });
    leftWall = Bodies.rectangle(-WALL / 2, height / 2, WALL, height * 4, {
      isStatic: true,
      friction: 0.2,
    });
    rightWall = Bodies.rectangle(width + WALL / 2, height / 2, WALL, height * 4, {
      isStatic: true,
      friction: 0.2,
    });
    Composite.add(engine.world, [floor, leftWall, rightWall]);
  };
  buildBounds();

  const materials = [];
  const geometries = [];
  const items = [];

  // The bag's own artwork, if anything on the page is a bag. Loaded once and
  // shared; the loader returns the texture straight away and fills it in when
  // the file arrives.
  const textures = {};
  const loader = new THREE.TextureLoader();
  for (const name of new Set(PILLS.map((p) => p.art).filter(Boolean))) {
    const t = loader.load(ARTWORK[name].src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures[name] = t;
  }

  PILLS.forEach((spec, i) => {
    /*
     * A traced object is one number: its outline is already normalised, so a
     * single scale keeps the proportions the photograph had. A pill is two,
     * because length and girth are independent of each other.
     */
    const art = spec.art ? ARTWORK[spec.art] : null;
    const isShirt = spec.kind === "shirt";
    const flat = Boolean(art) || isShirt;

    const lengthPx = art ? unit * spec.size : unit * spec.length;
    const girthPx = art ? unit * spec.size : unit * spec.girth;
    const lw = lengthPx * scale;
    const gw = girthPx * scale;

    const profile = art
      ? artShape(THREE, art, gw)
      : isShirt
        ? shirtShape(THREE, lw, gw)
        : pillShape(THREE, lw, gw);

    /*
     * Thickness is taken from the pill unit, not from the shape's own height.
     * A capsule's girth is its thickness, so scaling depth and bevel off it
     * works; a shirt's girth is how tall it is, and the same fractions gave a
     * bevel three times larger than the pills' — enough to swallow the notch
     * under each sleeve and render the whole thing as a blob.
     */
    const solid = flat ? gw * 0.15 : gw * 0.52;
    const rim = flat ? gw * 0.045 : gw * 0.2;

    /*
     * The bag is flat, because it is a photograph.
     *
     * Extruding it would give the artwork a bevelled rim of stretched pixels
     * and a side wall of nothing, which is worse than no thickness at all. A
     * ShapeGeometry is the silhouette and its hole, and the picture is mapped
     * onto it.
     */
    const geometry = art
      ? new THREE.ShapeGeometry(profile, 24)
      : new THREE.ExtrudeGeometry(profile, {
          depth: solid,
          bevelEnabled: true,
          bevelSegments: 10,
          steps: 1,
          bevelSize: rim,
          bevelThickness: rim,
          curveSegments: 24,
        });
    if (art) {
      // Aligned to where Matter will put the body, not to the bounding box.
      const [ccx, ccy] = polygonCentroid(art.outer);
      geometry.translate(-ccx * gw, -ccy * gw, 0);
    } else if (isShirt) {
      const [ccx, ccy] = polygonCentroid(shirtOutline(lw, gw));
      geometry.translate(-ccx, -ccy, 0);
    } else {
      // A pill is symmetrical and its outline is taken from the centred
      // geometry, so box and centroid are the same point.
      geometry.center();
    }

    if (art) {
      // ShapeGeometry hands back UVs in shape units, so they are remapped onto
      // the patch of the file the bag actually occupies.
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      const spanX = bb.max.x - bb.min.x || 1;
      const spanY = bb.max.y - bb.min.y || 1;
      const pos = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      for (let v = 0; v < pos.count; v++) {
        const fx = (pos.getX(v) - bb.min.x) / spanX;
        const fy = (pos.getY(v) - bb.min.y) / spanY;
        uv.setXY(
          v,
          art.uv.u0 + fx * (art.uv.u1 - art.uv.u0),
          art.uv.v0 + fy * (art.uv.v1 - art.uv.v0),
        );
      }
      uv.needsUpdate = true;
    }

    geometries.push(geometry);

    /*
     * Glass, not painted plastic.
     *
     * The colour stops being a surface and becomes the body: transmission lets
     * light through, and attenuation stains it on the way. That is why the
     * colour is set on attenuationColor rather than on color, and why the
     * distance is tied to the pill's own girth — a fat pill has more glass to
     * travel through, so it comes out deeper, the way real coloured glass
     * does. A flat colour on a transparent body would just look like tinted
     * cellophane.
     *
     * Thickness is the volume the refraction is computed through, so it is
     * the pill's girth rather than an arbitrary number; and the clearcoat
     * stays, because a glass pill still has a hard polished skin.
     */
    const material = art
      ? // Unlit and untone-mapped, so the artwork arrives with its own colours
        // rather than the scene's. Lighting it would be lighting a photograph
        // that already has its light in it.
        new THREE.MeshBasicMaterial({
          map: textures[spec.art],
          transparent: true,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      : new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.025,
      transmission: 1,
      ior: 1.46,
      thickness: gw * 1.0,
      // Raw, not saturated. Attenuation deepens the colour on its own as the
      // light crosses the body, so feeding it a boosted one stacks two effects
      // and the glass comes out looking like solid candy.
      attenuationColor: new THREE.Color(spec.color),
      // Just over two girths. Under one and almost nothing makes it through,
      // which is opacity rather than glass; at five the colour washes out
      // entirely and they come back white.
      attenuationDistance: gw * 2.2,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      specularIntensity: 1,
      envMapIntensity: 1.0,
      // A trace of spectral sheen where the light grazes the curve. Any more
      // and it reads as an oil slick rather than glass.
      iridescence: 0.18,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 420],
    });
    materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Hidden until its body joins the world. A mesh is at the origin until
    // something moves it, and the origin is the middle of the view — so every
    // pill still waiting its turn was being drawn in a heap at dead centre.
    mesh.visible = false;
    scene.add(mesh);

    /*
     * Where it enters, and how far above.
     *
     * The height is staggered per pill and that is not cosmetic. Entering at a
     * common height, pills whose spawn points are 118px apart but which are up
     * to 404px long are inserted straight through one another, and the solver
     * answers by shoving them apart — 72px in a single tick, against a falling
     * speed of 3. That lurch, and the near-motionless creep before it while the
     * pill accelerates from rest, is the whole of what looked glitchy about the
     * first few falling.
     */
    const x = width * (0.06 + spec.at * 0.88);
    const y = -girthPx * 1.3 - i * unit * 0.55;

    // The bag's colliding outline is its outer boundary only — the handle hole
    // is a hole in the glass, not somewhere another pill should fall through.
    // A traced object's colliding outline is its outer boundary only — a
    // handle's gap is a hole in the picture, not a way through the object.
    const outline = art
      ? art.outer.map(([px, py]) => ({
          x: px * girthPx * 1.02,
          y: -py * girthPx * 1.02,
        }))
      : isShirt
        ? outlineFromShape(profile, 1 / scale, girthPx * 0.02)
        : outlineFromGeometry(geometry, 1 / scale, girthPx * 0.02);

    const body = Bodies.fromVertices(x, y, [outline], {
      restitution: 0.18,
      friction: 0.45,
      frictionAir: 0.012,
      density: 0.0016,
    });
    Body.setAngle(body, spec.tilt);
    Body.setAngularVelocity(body, spec.spin);
    // Entering with speed rather than from a standstill. From rest a pill
    // covers a fifth of a pixel in its first tick and is still under one after
    // five, which reads as hanging in the air rather than falling.
    Body.setVelocity(body, { x: 0, y: ENTRY_SPEED });
    // Held out of the world until its turn.
    items.push({ body, mesh, girthPx, released: false });
  });

  // ── Dragging ──
  let mouseConstraint = null;
  if (!still) {
    /*
     * Bound to the container, not the canvas.
     *
     * Matter turns a pointer position into simulation coordinates by dividing
     * by element.width / element.clientWidth. On a canvas those are the drawing
     * buffer and the CSS box, and the buffer is drawn at device resolution — so
     * on a 2x screen every grab landed at twice the position it was aimed at,
     * far enough away to catch a different pill or none at all. A div has no
     * width attribute, so the ratio is 1 and the coordinates are the CSS pixels
     * the simulation already runs in.
     */
    const mouse = Mouse.create(mount);
    mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.16, render: { visible: false } },
    });
    Composite.add(engine.world, mouseConstraint);
    // Matter binds wheel handlers that swallow scrolling over the canvas.
    mouse.element.removeEventListener("wheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);
    Events.on(mouseConstraint, "startdrag", () => {
      mount.classList.add("is-dragging");
    });
    Events.on(mouseConstraint, "enddrag", () => {
      mount.classList.remove("is-dragging");
    });
  }

  // ── Resize ──
  // The pile is already stacked by the time most resizes happen, so the bodies
  // are left where they are and only the frame around them is rebuilt.
  const onResize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w < 2 || h < 2 || (w === width && h === height)) return;
    width = w;
    height = h;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    scale = (2 * Math.tan((FOV * Math.PI) / 360) * CAMERA_Z) / height;
    buildBounds();
    sync();
    renderer.render(scene, camera);
  };

  // ── Loop ──
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let dropped = 0;
  let visible = true;

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  observer.observe(mount);

  const sync = () => {
    for (const item of items) {
      if (!item.released) continue;
      item.mesh.position.set(
        toWorldX(item.body.position.x),
        toWorldY(item.body.position.y),
        0,
      );
      item.mesh.rotation.z = -item.body.angle;
    }
  };

  /*
   * One tick of simulation, at a fixed size, independent of what is driving it.
   *
   * Matter integrates and solves assuming the step it is handed is the step it
   * was handed last time. Feed it whatever the frame clock happened to measure
   * and contacts resolve by a different amount each tick, which reads as pills
   * twitching and skating rather than settling. It is worst in the first
   * second, which is exactly when the pills are falling: the browser is still
   * compiling shaders and building the environment map, so the frames are both
   * long and wildly uneven.
   */
  const step = (dt, draw = true) => {
    // Checked every tick rather than only when something announces a resize.
    // Both announcements — ResizeObserver and the window event — are delivered
    // with the rendering lifecycle, so anywhere that is throttled they never
    // arrive and the scene goes on drawing at the wrong shape. Two property
    // reads a frame is a cheaper guarantee than either of them.
    if (mount.clientWidth !== width || mount.clientHeight !== height) onResize();
    elapsed += dt;
    while (dropped < items.length && elapsed > dropped * DROP_INTERVAL) {
      const item = items[dropped];
      item.released = true;
      item.mesh.visible = true;
      if (import.meta.env?.DEV) {
        for (const other of items) {
          if (other === item || !other.released) continue;
          const c = Matter.Collision.collides(item.body, other.body);
          if (c && c.collided) {
            window.__pillSpawnClashes = (window.__pillSpawnClashes || 0) + 1;
          }
        }
      }
      Composite.add(engine.world, item.body);
      dropped += 1;
    }
    Engine.update(engine, dt);
    if (draw) {
      sync();
      renderer.render(scene, camera);
    }
  };

  /*
   * Real time in, fixed steps out.
   *
   * However long the frame took, the simulation only ever advances in whole
   * FIXED-sized ticks, and the remainder is carried to the next frame. A long
   * frame becomes two or three identical ticks instead of one enormous one.
   *
   * MAX_STEPS is the safety valve. Without it, a frame that took a second —
   * a tab restored, a slow first paint — would try to catch up all at once and
   * lock the page up. Past that the simulation simply runs slow for a moment,
   * which nobody notices, where the alternative is a freeze.
   */
  const FIXED = 1000 / 60;
  const MAX_STEPS = 4;
  let carry = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const elapsedReal = last ? now - last : FIXED;
    last = now;
    // Deliberately no document.hidden check. requestAnimationFrame already
    // stops in a backgrounded tab, and the accumulator is capped below, so the
    // catch-up frame it would guard against cannot happen — while the check
    // itself stops the scene ever being drawn in a context that reports hidden
    // but still paints.
    if (!visible) return;

    carry = Math.min(carry + elapsedReal, FIXED * MAX_STEPS);
    let ticks = 0;
    while (carry >= FIXED) {
      step(FIXED, false);
      carry -= FIXED;
      ticks += 1;
    }
    // Drawn once per frame rather than once per tick.
    if (ticks > 0) {
      sync();
      renderer.render(scene, camera);
    }
  };

  if (import.meta.env?.DEV) {
    // Reports where the drawn silhouette and the colliding one disagree.
    window.__pillAudit = () => {
      const rows = items.map((it, i) => {
        it.mesh.geometry.computeBoundingBox();
        const bb = it.mesh.geometry.boundingBox;
        return {
          i,
          meshLenPx: +(((bb.max.x - bb.min.x) / scale)).toFixed(1),
          meshGirthPx: +(((bb.max.y - bb.min.y) / scale)).toFixed(1),
          bodyLenPx: +(it.body.bounds.max.x - it.body.bounds.min.x).toFixed(1),
          bodyGirthPx: +(it.body.bounds.max.y - it.body.bounds.min.y).toFixed(1),
          x: Math.round(it.body.position.x),
          y: Math.round(it.body.position.y),
          vy: +it.body.velocity.y.toFixed(2),
          sleeping: it.body.isSleeping,
          released: it.released,
        };
      });
      let overlaps = 0;
      let worst = 0;
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const c = Matter.Collision.collides(items[a].body, items[b].body);
          if (c && c.collided && c.depth > 0.5) {
            overlaps++;
            worst = Math.max(worst, c.depth);
          }
        }
      }
      const top = Math.min(...items.filter((it) => it.released).map((it) => it.body.bounds.min.y));
      return {
        rows,
        overlaps,
        worstDepthPx: +worst.toFixed(1),
        pileTopPx: Math.round(top),
        dropped,
        elapsed: Math.round(elapsed),
        yardHeightPx: Math.round(height),
        clippedAtTop: top < 0,
      };
    };

    // Lets the pile be driven without a frame clock, which is the only way to
    // see it settle where rAF is throttled.
    window.__pillStep = (times = 1, dt = 1000 / 60) => {
      for (let i = 0; i < times; i++) step(dt);
      return items.filter((it) => it.released).length;
    };
  }

  if (still) {
    // Motion is turned down, so the pile is settled without being watched: the
    // whole drop is run through with nothing drawn, and the result painted
    // once. The pills are there, stacked, having never appeared to move.
    for (let i = 0; i < 900; i++) step(1000 / 60, false);
    sync();
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }

  /*
   * These are for the settled case, where there is no loop running to do the
   * checking. ResizeObserver also catches the container changing for reasons
   * the window did not — a layout shift above it, say.
   */
  const ro = new ResizeObserver(onResize);
  ro.observe(mount);
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    ro.disconnect();
    window.removeEventListener("resize", onResize);
    if (mouseConstraint) Composite.remove(engine.world, mouseConstraint);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    Object.values(textures).forEach((t) => t.dispose());
    catcher.geometry.dispose();
    catcher.material.dispose();
    backdrop.geometry.dispose();
    backdrop.material.dispose();
    envRT.texture.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) {
      mount.removeChild(renderer.domElement);
    }
  };
}
