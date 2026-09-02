import { useEffect, useRef } from "react";
import { EXPRESSIONS, drawFace, easeFace } from "./petFace.js";
import { VARIANTS } from "./petVariants.js";
import "./Pet.css";

/*
 * A pet: a soft body inside a glass one.
 *
 * Two shells. The outer is a sphere whose vertices are pushed in and out every
 * frame, in the same transmissive glass the clothes are made of, so it reads as
 * a bubble with weight rather than a transparent ball. The inner is a rounded
 * cube with a face on it, floating loose inside — it lags behind the shell when
 * the shell moves, which is most of what sells the two as separate things.
 *
 * It watches the pointer, leans toward it, squashes when it is poked, and
 * blinks on its own. None of that is scripted to a timeline: each is a value
 * easing toward a target every frame, so interruptions blend instead of
 * snapping.
 *
 * Three is loaded on demand. It is far larger than the page around it.
 */

/* How far the shell's surface strays from a sphere, at rest and when poked. */
const IDLE_WOBBLE = 0.05;
const POKE_WOBBLE = 0.15;

/* Seconds between blinks, and how long one takes. */
const BLINK_EVERY = [2.6, 6.5];
const BLINK_FOR = 0.13;

export default function Pet({ className = "", expression = "resting", variant = "square" }) {
  const mountRef = useRef(null);
  /*
   * Through a ref rather than as a dependency: changing the expression must
   * not tear down and rebuild the scene, and the frame loop reads the latest
   * value anyway. The easing between one and the next happens there.
   */
  const wanted = useRef(expression);
  wanted.current = expression;
  /* Same arrangement for the variant. Switching one rebuilds a mesh, not the
     renderer, so it must not go through the effect either. */
  const kind = useRef(variant);
  kind.current = variant;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let stop = () => {};

    Promise.all([
      import("three"),
      import("three/examples/jsm/environments/RoomEnvironment.js"),
      import("three/examples/jsm/geometries/RoundedBoxGeometry.js"),
      import("three/examples/jsm/utils/BufferGeometryUtils.js"),
    ])
      .then(([THREE, { RoomEnvironment }, { RoundedBoxGeometry }, utils]) => {
        if (disposed) return;
        stop = run(mount, THREE, RoomEnvironment, RoundedBoxGeometry, utils, wanted, kind);
      })
      .catch(() => {
        // A pet is not worth breaking a page over.
      });

    return () => {
      disposed = true;
      stop();
    };
  }, []);

  return (
    <div
      className={`pet ${className}`.trim()}
      ref={mountRef}
      role="img"
      aria-label="A small creature in a glass bubble that follows your cursor"
    />
  );
}

/*
 * Three sine pairs crossed against each other, which is enough to look organic
 * without a noise library. Each axis is driven by a different frequency and a
 * different rate, so the pattern never repeats on a beat you can see.
 *
 * Returns roughly -1..1.
 */
function surface(x, y, z, t) {
  return (
    (Math.sin(x * 1.8 + t * 1.1) * Math.cos(y * 2.1 - t * 0.9) +
      Math.sin(y * 1.5 - t * 0.8) * Math.cos(z * 1.9 + t * 1.2) +
      Math.sin(z * 1.7 + t) * Math.cos(x * 2.3 - t * 0.7)) /
    3
  );
}

function run(mount, THREE, RoomEnvironment, RoundedBoxGeometry, utils, wanted, kind) {
  let width = mount.clientWidth || 1;
  let height = mount.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  /*
   * The room is the light. Transmissive glass has nothing to show without an
   * environment to refract — lit by lamps alone it comes out as a grey ball.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 6);
  scene.add(key);

  /* Everything hangs off this so the whole pet can lean as one. */
  const pet = new THREE.Group();
  scene.add(pet);

  /*
   * ── The glass ──
   *
   * Welded, and that is not an optimisation.
   *
   * IcosahedronGeometry comes back with every triangle holding its own three
   * vertices, so computeVertexNormals — which has to run every frame, because
   * the surface moves — gives each face one flat normal and the bubble renders
   * as a faceted rock with the facets catching light as white shards. Merging
   * the duplicates makes the geometry indexed, so a vertex shared by six
   * triangles averages their normals and the surface reads as curved.
   *
   * An icosphere rather than a UV sphere because its vertices are spread
   * evenly. A UV sphere crowds them at the poles, and a wobble driven off
   * position would ripple far faster there than round the middle.
   */
  const shellGeo = utils.mergeVertices(new THREE.IcosahedronGeometry(1.45, 5));
  const base = shellGeo.attributes.position.array.slice();
  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.03,
      transmission: 1,
      ior: 1.35,
      thickness: 0.9,
      // Barely there. The bubble is meant to be near-colourless, so this only
      // warms what passes through rather than tinting it.
      attenuationColor: new THREE.Color(0xffe9f0),
      attenuationDistance: 4.2,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 0.32,
      iridescenceIOR: 1.28,
      iridescenceThicknessRange: [120, 500],
      transparent: true,
    }),
  );
  pet.add(shell);

  // ── What lives in it ──
  const core = new THREE.Group();
  pet.add(core);

  let body = null;

  /*
   * The face is a texture on a plane bulged forward, so it sits on the body
   * rather than floating in front of it. Everything but the features is
   * transparent, so the plane itself is never seen — only what is drawn on it.
   */
  const FACE_PX = 512;
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = FACE_PX;
  faceCanvas.height = FACE_PX;
  const fctx = faceCanvas.getContext("2d");
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const faceGeo = new THREE.PlaneGeometry(1.05, 1.05, 16, 16);
  {
    // Pushed forward toward the middle so the plane takes the curve of the
    // body. Flat, the features slid off the edge of the face as it turned.
    const fp = faceGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i);
      const y = fp.getY(i);
      fp.setZ(i, 0.14 * Math.max(0, 1 - (x * x + y * y) / 0.34));
    }
    faceGeo.computeVertexNormals();
  }

  const face = new THREE.Mesh(
    faceGeo,
    /*
     * Cut out, not blended, and this is the whole reason the face was invisible
     * at first.
     *
     * The shell is a transmissive material, which works by rendering the scene
     * behind it into its own target and refracting that — and three leaves
     * transparent objects out of that pass. A face marked `transparent` was
     * therefore drawn perfectly, uploaded correctly, and then simply not
     * present in the only view of the pet anyone ever sees, because the bubble
     * covers all of it.
     *
     * alphaTest gets the same result without blending: the material counts as
     * opaque, joins the transmission pass, and the texture's empty area is
     * discarded per pixel instead. A face of flat black shapes is exactly the
     * kind of artwork that cuts out cleanly.
     */
    new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: false,
      alphaTest: 0.42,
      toneMapped: false,
    }),
  );
  face.position.z = 0.34;
  core.add(face);

  /*
   * Swapping a variant replaces one mesh. It would be far simpler to tear the
   * whole thing down and build it again, but that throws away a WebGL context
   * every time and browsers only hand out about sixteen — click through the
   * four of them a few times and the pet stops rendering for good.
   */
  let shownKind = null;

  function buildBody(name) {
    const v = VARIANTS[name] || VARIANTS.square;

    if (body) {
      core.remove(body);
      body.geometry.dispose();
      body.material.dispose();
    }

    let geo;
    if (v.form === "round") {
      geo = new THREE.SphereGeometry(0.64, 48, 32);
    } else if (v.form === "tall") {
      geo = new RoundedBoxGeometry(0.82, 1.36, 0.78, 9, 0.36);
    } else if (v.form === "tri") {
      /*
       * A rounded triangle, rounded in the outline rather than by the bevel.
       *
       * The bevel only softens the edge where the front face meets the side —
       * seen head on, the silhouette it leaves is still the sharp triangle it
       * was given, which is why the corners stayed pointed however much bevel
       * went on. The rounding has to be in the 2D shape.
       *
       * Each corner is a quadratic with the vertex itself as the control
       * point, running between two points 47% of the way down the adjoining
       * edges. At 50% the arcs would meet and there would be no straight edge
       * left at all — three percent is enough to keep it reading as a triangle
       * rather than a three-lobed blob, and no more.
       */
      // Bigger than the circumradius of a sharp triangle would need to be:
       // rounding the corners this hard pulls the silhouette a long way inside
       // the circle the vertices sit on, so at 0.58 it measured 0.91 across
       // against the square's 1.18 and read as a much smaller creature.
      const R = 0.78;
      const corner = [0, 1, 2].map((i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
        return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R);
      });
      const K = 0.47;
      const along = (a, b) => new THREE.Vector2().lerpVectors(a, b, K);

      const tri = new THREE.Shape();
      const first = along(corner[0], corner[1]);
      tri.moveTo(first.x, first.y);
      for (let i = 0; i < 3; i++) {
        const here = corner[i];
        const next = corner[(i + 1) % 3];
        const after = corner[(i + 2) % 3];
        const stop = along(next, here);
        tri.lineTo(stop.x, stop.y);
        const go = along(next, after);
        tri.quadraticCurveTo(next.x, next.y, go.x, go.y);
      }
      tri.closePath();

      geo = new THREE.ExtrudeGeometry(tri, {
        depth: 0.46,
        bevelEnabled: true,
        // Smaller than before. The outline does the rounding now, so a heavy
        // bevel on top only inflates the whole shape.
        bevelSize: 0.11,
        bevelThickness: 0.13,
        bevelSegments: 10,
        curveSegments: 24,
        steps: 1,
      });
      geo.center();
    } else {
      geo = new RoundedBoxGeometry(1.18, 1.12, 0.86, 9, 0.34);
    }

    body = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        color: v.color,
        roughness: 0.62,
        clearcoat: 0.35,
        clearcoatRoughness: 0.5,
        sheen: 0.7,
        // Taken from the body rather than fixed. It was a pink sheen on every
        // variant, which over an orange body came back as pale peach and over
        // a blue one as lilac — the highlight was arguing with the colour
        // underneath it on three of the four.
        sheenColor: new THREE.Color(v.color).lerp(new THREE.Color(0xffffff), 0.55),
        // A dim version of the body's own colour rather than one fixed tint,
        // so the glow under a blue pet is blue.
        emissive: new THREE.Color(v.color).multiplyScalar(0.16),
        emissiveIntensity: 0.22,
      }),
    );
    core.add(body);

    face.position.set(0, v.faceY, v.faceZ);
    face.scale.setScalar(v.faceScale);
    shownKind = name;
  }

  buildBody(kind.current);

  if (import.meta.env?.DEV) {
    // So the drawn face can be inspected on its own when it does not show up
    // on the model.
    window.__petFace = { canvas: faceCanvas, mesh: face, core, pose: null };
  }

  /* The face as it currently stands. Started at rest rather than at the flat
     base, so the pet is not caught easing out of a blank stare on load.
     Named for the pose rather than the moment, because `now` is the frame
     timestamp a few lines down and the inner one silently shadowed this. */
  const pose = { ...EXPRESSIONS.resting };
  let drawnAt = -1;

  // ── State that eases rather than jumps ──
  const pointer = { x: 0, y: 0 };      // -1..1, where the cursor is
  const look = { x: 0, y: 0 };         // where the pet has got to
  const coreLag = { x: 0, y: 0 };      // the body trailing the shell
  let poke = 0;                        // 1 the instant it is prodded, decays
  let blinkIn = rangeAt(0.4);
  let blinking = 0;
  let seed = 0;

  function rangeAt(k) {
    return BLINK_EVERY[0] + (BLINK_EVERY[1] - BLINK_EVERY[0]) * k;
  }

  function onPointerMove(e) {
    const r = mount.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  function onLeave() {
    pointer.x = 0;
    pointer.y = 0;
  }

  function onPoke() {
    poke = 1;
  }

  mount.addEventListener("pointermove", onPointerMove);
  mount.addEventListener("pointerleave", onLeave);
  mount.addEventListener("pointerdown", onPoke);

  function onResize() {
    width = mount.clientWidth || 1;
    height = mount.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const reduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const pos = shellGeo.attributes.position;
  let raf = 0;
  let last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(last ? (now - last) / 1000 : 0.016, 0.05);
    last = now;

    if (mount.clientWidth !== width || mount.clientHeight !== height) onResize();
    if (kind.current !== shownKind) buildBody(kind.current);

    // Reduced motion keeps the pet, drops the performance: it still looks at
    // you, it just does not breathe, wobble or blink.
    seed += reduced ? 0 : dt;

    poke = Math.max(0, poke - dt * 2.6);
    // A squash that overshoots on the way back, so it bounces rather than
    // deflating. Sampled from the decay, not from a separate clock.
    const squash = Math.sin(poke * Math.PI) * (0.5 + poke * 0.5);

    // ── The shell's surface ──
    const amp = IDLE_WOBBLE + (POKE_WOBBLE - IDLE_WOBBLE) * poke;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3;
      const x = base[j];
      const y = base[j + 1];
      const z = base[j + 2];
      const d = 1 + amp * surface(x, y, z, seed);
      pos.array[j] = x * d;
      pos.array[j + 1] = y * d;
      pos.array[j + 2] = z * d;
    }
    pos.needsUpdate = true;
    shellGeo.computeVertexNormals();

    // ── Looking ──
    look.x += (pointer.x - look.x) * Math.min(1, dt * 4.5);
    look.y += (pointer.y - look.y) * Math.min(1, dt * 4.5);

    pet.rotation.y = look.x * 0.42;
    pet.rotation.x = -look.y * 0.3;
    pet.position.y = reduced ? 0 : Math.sin(seed * 1.25) * 0.06;

    /*
     * The body is not fixed to the shell. It chases the shell's lean a beat
     * behind and a little further, so when the pet turns you see the creature
     * slide inside the bubble rather than the whole thing rotating as one
     * solid object. This is the difference between two shells and one.
     */
    coreLag.x += (look.x - coreLag.x) * Math.min(1, dt * 2.2);
    coreLag.y += (look.y - coreLag.y) * Math.min(1, dt * 2.2);
    core.position.x = coreLag.x * 0.2;
    core.position.y = coreLag.y * 0.16;
    core.position.z = 0.05;
    core.rotation.y = coreLag.x * 0.3;
    core.rotation.x = -coreLag.y * 0.24;

    // ── Squash ──
    shell.scale.set(1 + squash * 0.13, 1 - squash * 0.19, 1 + squash * 0.13);
    core.scale.set(1 + squash * 0.09, 1 - squash * 0.13, 1 + squash * 0.09);

    // ── Blinking ──
    if (!reduced) {
      blinkIn -= dt;
      if (blinkIn <= 0 && blinking <= 0) {
        blinking = BLINK_FOR;
        // Varied off the clock rather than Math.random, so two pets on a page
        // do not blink in unison but neither needs a random source.
        blinkIn = rangeAt((Math.sin(seed * 12.9898) * 0.5 + 0.5) % 1);
      }
      if (blinking > 0) blinking -= dt;
    }
    const lid = blinking > 0 ? Math.max(0.04, 1 - blinking / (BLINK_FOR / 2)) : 1;

    /*
     * The expression eases toward whatever has been asked for, then the face is
     * redrawn — but only when something has actually moved. Uploading a 512px
     * texture every frame to draw the same face is the one genuinely wasteful
     * thing this component could do, and once an expression has settled the
     * numbers stop changing entirely.
     */
    const target = EXPRESSIONS[wanted.current] || EXPRESSIONS.resting;
    easeFace(pose, target, Math.min(1, dt * 6));
    const settled =
      pose.eyeOpen * lid + pose.mouthCurve + pose.mouthOpen + pose.browOn +
      pose.pupilX + pose.pupilY + pose.eyeArc + pose.tilt + pose.mouthX + pose.mouthW;
    if (Math.abs(settled - drawnAt) > 0.0004) {
      drawFace(fctx, FACE_PX, pose, lid);
      faceTex.needsUpdate = true;
      drawnAt = settled;
      if (import.meta.env?.DEV && window.__petFace) window.__petFace.pose = pose;
    }
    core.rotation.z = pose.tilt;

    renderer.render(scene, camera);
  }

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    mount.removeEventListener("pointermove", onPointerMove);
    mount.removeEventListener("pointerleave", onLeave);
    mount.removeEventListener("pointerdown", onPoke);
    shellGeo.dispose();
    shell.material.dispose();
    if (body) {
      body.geometry.dispose();
      body.material.dispose();
    }
    faceGeo.dispose();
    face.material.dispose();
    faceTex.dispose();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) {
      mount.removeChild(renderer.domElement);
    }
  };
}
