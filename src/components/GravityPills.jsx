import { useEffect, useRef } from "react";
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
 * Long, short, fat, thin — a pile of one pill repeated reads as a pattern.
 *
 * Kept chunky. Slimming them buys pile height cheaply, but a thin pill reads
 * as a smaller pill however long it is, so the height is bought from the
 * overall size instead, where it is at least visible what it costs.
 */
const PILLS = [
  { color: "#FF6B4A", length: 1.22, girth: 0.34 },
  { color: "#FFC53D", length: 0.85, girth: 0.42 },
  { color: "#7C4AD6", length: 1.1, girth: 0.3 },
  { color: "#2BC8CE", length: 0.7, girth: 0.38 },
  // Capped at 1.25. A longer pill is fine lying down, but stood on end by an
  // unlucky bounce it is nearly as tall as the whole yard on its own.
  { color: "#C8F060", length: 1.25, girth: 0.3 },
  { color: "#4A7BE8", length: 1.0, girth: 0.36 },
  { color: "#F2A086", length: 0.8, girth: 0.44 },
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
    ])
      .then(([THREE, { RoomEnvironment }, matter]) => {
        if (disposed) return;
        stop = run(mount, THREE, RoomEnvironment, matter.default ?? matter);
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
  const { Engine, Composite, Bodies, Body, Sleeping, Mouse, MouseConstraint, Events } = Matter;

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

  // Catches the key light's shadow behind the pile. Without a receiver the
  // shadows fall on nothing and the pile floats.
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
   * short one, but the room above the rule is not — it is whatever the page
   * has left over — so the pile that just fits a tall window buries a short
   * one. The height term is what stops that: 0.225 of the width is the largest
   * that reliably clears the top at a typical desktop shape, and 0.69 of the
   * yard is the same pile expressed against the room it has to fit in.
   */
  const unit = Math.max(48, Math.min(width * 0.225, height * 0.64, 350));

  // ── Physics ──
  // Far more solver passes than the default. These bodies are large and heavy,
  // and a pile of them under a lid loads the contacts hard enough that the
  // default six leave interpenetration deep enough to see. Nine bodies is
  // little enough that the extra passes cost nothing worth measuring.
  const engine = Engine.create({
    enableSleeping: true,
    positionIterations: 20,
    velocityIterations: 10,
    constraintIterations: 4,
  });
  engine.gravity.y = 1;
  engine.timing.timeScale = 0.9;

  const WALL = 400;
  let floor = null;
  let leftWall = null;
  let rightWall = null;
  let ceiling = null;
  let ceilingIn = false;

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

    // Rebuilt with the rest, but only re-admitted if it was already in play.
    if (ceiling) Composite.remove(engine.world, ceiling);
    ceiling = Bodies.rectangle(width / 2, -WALL / 2, width * 3, WALL, {
      isStatic: true,
      friction: 0.4,
    });
    if (ceilingIn) Composite.add(engine.world, ceiling);
  };
  buildBounds();

  /*
   * A lid, closed behind them.
   *
   * The pile clears the top of the yard on almost every drop, but not on all
   * of them: now and then one pill comes to rest propped high on the others and
   * pokes out. Sizing the pills down until that never happens would cost real
   * size on every ordinary load to buy off a rare one. A lid costs nothing —
   * on the ordinary drop the pile never reaches it, and on the rare one it is
   * the difference between a pill sticking out of frame and a pill nudged back
   * into it.
   *
   * It cannot be there from the start, or the pills would land on it instead of
   * falling past. It goes in the moment the last of them is fully inside, which
   * is well before the pile is tall enough to touch it.
   */
  const closeLidWhenAllInside = () => {
    if (ceilingIn || dropped < items.length) return;
    // Centre inside, not the whole pill. Waiting for every pill to be entirely
    // below the top never comes true on some drops — one is still entering
    // while the pile is already building — and the lid then never closes on
    // exactly the runs that needed it. A pill whose centre is inside can only
    // be pushed down by the lid, never shut out above it, so that is the test.
    for (const item of items) {
      if (item.body.position.y < 0) return;
    }
    Composite.add(engine.world, ceiling);
    ceilingIn = true;
  };

  const materials = [];
  const geometries = [];
  const items = [];

  PILLS.forEach((spec, i) => {
    const lengthPx = unit * spec.length;
    const girthPx = unit * spec.girth;
    const lw = lengthPx * scale;
    const gw = girthPx * scale;

    const geometry = new THREE.ExtrudeGeometry(pillShape(THREE, lw, gw), {
      depth: gw * 0.42,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: gw * 0.12,
      bevelThickness: gw * 0.12,
      curveSegments: 24,
    });
    geometry.center();
    geometries.push(geometry);

    // Plastic, not metal. A high metalness tints every reflection with the
    // body colour, which turns these into chrome sweets — the colour stops
    // being the colour and becomes a stain over the room. Dielectric with a
    // clearcoat is what a moulded pill actually is: a coloured body under a
    // clear gloss shell.
    const material = new THREE.MeshPhysicalMaterial({
      color: saturate(THREE, spec.color),
      metalness: 0.05,
      roughness: 0.3,
      ior: 1.5,
      thickness: 2,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0.35,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffffff),
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

    // Spread across the width and dropped from just above the top edge. They
    // do not need stacking up there as well — the release is already staggered
    // in time — and at this size stacking them would start the last one a
    // couple of thousand pixels up, falling for an age before it arrived.
    const x =
      ((i + 0.5) / PILLS.length) * width * 0.92 +
      width * 0.04 +
      (Math.random() - 0.5) * unit * 0.3;
    const y = -girthPx * 1.4;

    const body = Bodies.fromVertices(
      x,
      y,
      [outlineFromGeometry(geometry, 1 / scale, girthPx * 0.02)],
      {
        restitution: 0.18,
        friction: 0.45,
        frictionAir: 0.012,
        density: 0.0016,
      },
    );
    // Dropped at a real angle and already turning. A narrow spread of angles
    // and no spin is why they were landing in a tidy flat row: nothing was
    // ever going to tip one onto its neighbour.
    Body.setAngle(body, (Math.random() - 0.5) * 1.5);
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.16);
    // Held out of the world until its turn.
    items.push({ body, mesh, girthPx, released: false, spawnX: x, spawnY: y });
  });

  // ── Dragging ──
  let mouseConstraint = null;
  if (!still) {
    /*
     * Bound to the container, not the canvas.
     *
     * Matter divides a pointer position by element.width / element.clientWidth
     * to get simulation coordinates. On a canvas those are the drawing buffer
     * and the CSS box, and the buffer is drawn at device resolution — so on a
     * 2x screen every grab landed at twice the position it was aimed at, far
     * enough away to catch a different pill or none. A div has no width
     * attribute, so the ratio is 1 and the coordinates are the CSS pixels the
     * simulation already runs in.
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

  // One tick of simulation, independent of what is driving it. Drawing is
  // optional so the pile can be settled without every intermediate state
  // being painted.
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
      Composite.add(engine.world, item.body);
      dropped += 1;
    }
    closeLidWhenAllInside();
    Engine.update(engine, dt);
    if (draw) {
      sync();
      renderer.render(scene, camera);
    }
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 1000 / 30) : 1000 / 60;
    last = now;
    // Deliberately no document.hidden check. requestAnimationFrame already
    // stops in a backgrounded tab, and dt is clamped above, so the catch-up
    // frame it would guard against cannot happen — while the check itself
    // stops the scene ever being drawn in a context that reports hidden but
    // still paints.
    if (!visible) return;
    step(dt);
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
        lidClosed: ceilingIn,
        yardHeightPx: Math.round(height),
        clippedAtTop: top < 0,
      };
    };

    // Re-runs the whole drop from scratch and reports where the pile topped
    // out. The tumble is random, so the only honest way to choose a pill size
    // is to sample the spread rather than trust one settle.
    window.__pillTrial = (steps = 800) => {
      for (const it of items) {
        if (it.released) Composite.remove(engine.world, it.body);
        it.released = false;
        it.mesh.visible = false;
        Body.setPosition(it.body, { x: it.spawnX, y: it.spawnY });
        Body.setAngle(it.body, (Math.random() - 0.5) * 1.5);
        Body.setVelocity(it.body, { x: 0, y: 0 });
        Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.16);
        // Sleeping bodies ignore being moved. Without this they sit at the
        // spawn point for the whole trial and the pile never happens.
        Sleeping.set(it.body, false);
      }
      if (ceilingIn) Composite.remove(engine.world, ceiling);
      ceilingIn = false;
      elapsed = 0;
      dropped = 0;
      for (let i = 0; i < steps; i++) step(1000 / 60, false);
      sync();
      renderer.render(scene, camera);
      return window.__pillAudit().pileTopPx;
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
    catcher.geometry.dispose();
    catcher.material.dispose();
    envRT.texture.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) {
      mount.removeChild(renderer.domElement);
    }
  };
}
