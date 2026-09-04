import { useEffect, useRef } from "react";
import { drawDecal } from "./dollFace.js";
import { EYE, egg, hairDrop, hairWindow, smooth } from "./dollShape.js";
import { EXPRESSIONS, easeFace } from "./petFace.js";
import { HAIRSTYLES, HAIR_COLORS, SKIN_TONES } from "./dollLooks.js";
import "./Doll.css";

/*
 * An experiment: the pet as a doll rather than as a shape with a face on it.
 *
 * The old one was a rounded box with the features printed on a plane in front
 * of it, which is the construction a Lego minifig uses and read as one. Three
 * things are different here, and they are the three that were doing it:
 *
 *   the head is not a primitive — it is a sphere pushed into a face with a
 *   cranium, a taper and cheekbones, so the silhouette is not something a
 *   constructor handed over;
 *
 *   the colour is in the hair, not the skin. A saturated body is most of what
 *   made the last one read as moulded plastic. The four variants become one
 *   character styled four ways, which is a much richer difference than paint;
 *
 *   the face is flat. Everything except a small nose bump is drawn, unlit, with
 *   hard edges and no shading at all.
 *
 * That last one replaced a whole rig — an eyeball in a socket, an iris on a
 * pivot, a lid turning over it, lashes at its edge — and every piece of it
 * worked. It was still wrong. A physically shaded eye bulging out of a
 * physically shaded face is the uncanny valley by construction, and the closer
 * each part got to being a real eye the worse the whole thing looked. The
 * references are 3D objects with 2D faces painted on: a real head, real hair,
 * and flat black shapes for features. A flat shape cannot be uncanny.
 *
 * There is no bubble. Everything here would have had to be opaque to survive
 * the transmission pass, and the refraction threw highlights across exactly the
 * part of the face the detail lives in.
 *
 * The expressions are the pet's, unchanged — the crossfading pose numbers were
 * good and are worth keeping. They are back to driving what they were written
 * for, which is a drawing.
 */

/* Where the strand ridges are at full strength: the crown, fading out by the
   time the hair reaches the jaw. */
const smoothCrown = (y) => smooth(-0.35, 0.75, y);

/* Seconds between blinks, and how long one takes. */
const BLINK_EVERY = [2.6, 6.5];
const BLINK_FOR = 0.12;

export default function Doll({
  className = "",
  expression = "resting",
  hair = "bob",
  hairColor = "pink",
  skinTone = "sand",
}) {
  const mountRef = useRef(null);
  /*
   * Through refs rather than as dependencies. Changing any of these must not
   * tear down and rebuild the scene — that would throw away a WebGL context
   * every time, and browsers hand out about sixteen. The frame loop reads the
   * latest value and rebuilds only the mesh that actually changed.
   */
  const wanted = useRef(expression);
  wanted.current = expression;
  const look = useRef({ hair, hairColor, skinTone });
  look.current = { hair, hairColor, skinTone };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let stop = () => {};

    Promise.all([import("three"), import("three/examples/jsm/environments/RoomEnvironment.js")])
      .then(([THREE, { RoomEnvironment }]) => {
        if (disposed) return;
        stop = run(mount, THREE, RoomEnvironment, wanted, look);
      })
      .catch(() => {
        // A doll is not worth breaking a page over.
      });

    return () => {
      disposed = true;
      stop();
    };
  }, []);

  return (
    <div
      className={`doll ${className}`.trim()}
      ref={mountRef}
      role="img"
      aria-label="A small character that follows your cursor"
    />
  );
}

/* Canvas of a given size with its 2D context. */
function canvasOf(THREE, size, anisotropy) {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return { ctx: el.getContext("2d"), tex };
}

function run(mount, THREE, RoomEnvironment, wanted, look) {
  let width = mount.clientWidth || 1;
  let height = mount.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const aniso = renderer.capabilities.getMaxAnisotropy();

  /*
   * The room is still the light, but quieter than it was. It was carrying the
   * glass before, which needed an environment to refract or it came out a grey
   * ball; skin needs it only as a soft fill, and at full strength it flattens
   * the face by lighting every side of it equally.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 0, 6.8);

  /* A key high and to one side, and a rim from behind to lift the hair off the
     background — without it a dark head on a white page loses its edge. */
  const key = new THREE.DirectionalLight(0xfff4ec, 1.45);
  key.position.set(-2.6, 3.4, 4.2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffe6f0, 0.9);
  rim.position.set(2.4, 1.2, -3);
  scene.add(rim);

  const doll = new THREE.Group();
  scene.add(doll);

  // ── The head ──
  const headGeo = new THREE.SphereGeometry(1, 96, 72);
  {
    const p = headGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [hx, hy, hz] = egg(p.getX(i), p.getY(i), p.getZ(i));

      /*
       * Sockets. The eyes are pressed into the head rather than stuck onto it,
       * which is the whole reason they read as eyes — a ball resting on a
       * surface is a bead, and the difference between the two is a dent.
       */
      let s = 0;
      for (const side of [-1, 1]) {
        const dx = hx - side * EYE.x;
        const dy = hy - EYE.y;
        const dz = hz - 0.72;
        s = Math.max(s, Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy * 1.5 + dz * dz) / 0.5));
      }
      const dent = 1 - 0.17 * s * s;

      p.setXYZ(i, hx * dent, hy * dent, hz * dent);
    }
    headGeo.computeVertexNormals();
  }

  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xf7c49a,
    /*
     * Matt. A clearcoat on a smooth head is vinyl, and a shine sliding over the
     * cheek is the single most mannequin-like thing a face can do. The
     * references have no specular on the skin at all.
     */
    roughness: 0.92,
    clearcoat: 0,
    /* Skin is not a hard surface. The sheen is standing in for light scattering
       under it — without it the cheeks go to plastic at exactly the angle the
       key light hits them. */
    sheen: 0.85,
    sheenColor: new THREE.Color(0xffb9a4),
    sheenRoughness: 0.6,
  });
  doll.add(new THREE.Mesh(headGeo, skin));

  // ── The drawn layer ──
  const DECAL_PX = 1024;
  const decal = canvasOf(THREE, DECAL_PX, aniso);

  /* Bulged onto the head, so the brows and mouth take its curve. Flat, they
     slide off the face as it turns. */
  const decalGeo = new THREE.PlaneGeometry(2, 2, 40, 40);
  {
    /*
     * Asked in the head's own units, not the plane's.
     *
     * The plane spans two units across and the head was built by scaling a unit
     * sphere — 0.94 wide, 1.08 tall — so feeding the plane's coordinates
     * straight into the shape asked about the wrong row of the sphere, and by
     * the lower face the surface it returned sat 0.03 behind where the head
     * actually is. The mouth was drawn correctly and then buried in the chin.
     */
    const p = decalGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i) / 1.05;
      const uy = p.getY(i) / 0.94;
      const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
      const [, , hz] = egg(ux, uy, uz);
      // And a hair in front of it, so it never argues with the skin for depth.
      p.setZ(i, hz + 0.012);
    }
    decalGeo.computeVertexNormals();
  }

  const decalMesh = new THREE.Mesh(
    decalGeo,
    new THREE.MeshBasicMaterial({
      map: decal.tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  doll.add(decalMesh);

  // ── Stars ──
  /*
   * A rounded five-point star, rounded in the outline rather than by the bevel.
   *
   * The bevel only softens the edge where the front face meets the side — seen
   * head on, the silhouette it leaves is still the sharp star it was given, and
   * turned up far enough to round the points it eats them instead. The same
   * thing caught out the old pet's triangle. So each corner is a quadratic with
   * the point itself as the control, run between two places partway down the
   * adjoining edges, and every corner gets it — the inner notches want
   * softening as much as the tips do.
   */
  function starGeometry(outer, inner, k) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? inner : outer;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const along = (a, b) => new THREE.Vector2().lerpVectors(a, b, k);

    const shape = new THREE.Shape();
    const first = along(pts[0], pts[1]);
    shape.moveTo(first.x, first.y);
    for (let i = 0; i < 10; i++) {
      const here = pts[i];
      const next = pts[(i + 1) % 10];
      const after = pts[(i + 2) % 10];
      const stop = along(next, here);
      shape.lineTo(stop.x, stop.y);
      const go = along(next, after);
      shape.quadraticCurveTo(next.x, next.y, go.x, go.y);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.07,
      bevelThickness: 0.07,
      bevelSegments: 5,
      curveSegments: 10,
      steps: 1,
    });
    geo.center();
    return geo;
  }

  /*
   * Placed rather than scattered: out past the hair, spread around the head so
   * no two sit at the same height, and none of them in front of the face. Fixed
   * pastels instead of the variant's colour — these are stickers on the picture
   * rather than part of the character, and the references all use a handful of
   * unrelated sweet colours together.
   */
  const STARS = [
    { at: [-1.5, 0.72, -0.15], size: 0.16, color: 0xffd166, spin: 0.22 },
    { at: [1.46, 0.42, 0.2], size: 0.13, color: 0x9ccdf0, spin: -0.3 },
    { at: [1.3, -0.78, -0.25], size: 0.1, color: 0xffb3c9, spin: 0.36 },
    { at: [-1.28, -0.66, 0.18], size: 0.115, color: 0xb7e3c8, spin: -0.25 },
  ];

  const starGeo = starGeometry(1, 0.46, 0.34);
  const starMats = [];
  const stars = STARS.map((spec, i) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: 0.55,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xffffff),
    });
    starMats.push(mat);
    const mesh = new THREE.Mesh(starGeo, mat);
    mesh.position.set(...spec.at);
    mesh.scale.setScalar(spec.size);
    /* Tipped out of the picture plane so they catch the light on a face rather
       than reading as flat cut-outs. */
    mesh.rotation.set(0.3, i % 2 ? 0.5 : -0.5, 0);
    doll.add(mesh);
    return mesh;
  });

  // ── The nose ──
  /*
   * The one feature that stays solid, and the reason the flat face reads as
   * painted onto a head rather than as a mask floating in front of one. Both
   * references do exactly this: everything drawn except a small bump catching
   * a highlight in the middle of it.
   */
  const noseGeo = new THREE.SphereGeometry(0.055, 20, 14);
  const nose = new THREE.Mesh(noseGeo, skin);
  {
    const uy = -0.36;
    const uz = Math.sqrt(1 - uy * uy);
    const [, hy, hz] = egg(0, uy, uz);
    nose.position.set(0, hy, hz - 0.022);
  }
  nose.scale.set(1, 0.86, 0.7);
  doll.add(nose);

  // ── The hair ──
  let hair = null;
  let hairGeo = null;
  let hairMat = null;
  let buns = [];
  let bunGeo = null;
  let shown = null;

  function dropBuns() {
    for (const b of buns) doll.remove(b);
    buns = [];
    if (bunGeo) {
      bunGeo.dispose();
      bunGeo = null;
    }
  }

  function buildLook(next) {
    const style = HAIRSTYLES[next.hair] || HAIRSTYLES.bob;
    const tint = new THREE.Color((HAIR_COLORS[next.hairColor] || HAIR_COLORS.pink).hex);
    const tone = SKIN_TONES[next.skinTone] || SKIN_TONES.sand;

    /* Skin and blush are just a colour and some numbers, so they never need a
       rebuild — only the hair does. */
    skin.color.set(tone.hex);
    blush = { rgb: tone.blush, a: tone.blushA };

    const cut = shown?.hair !== next.hair;

    if (cut || !hair) {
      if (hair) {
        doll.remove(hair);
        hairGeo.dispose();
      }
      dropBuns();

      hairGeo = new THREE.SphereGeometry(1, 112, 84);
      const p = hairGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const [ex, ey, ez] = egg(p.getX(i), p.getY(i), p.getZ(i));

        let hx = ex * style.volume[0];
        let hy = ey * style.volume[1] + 0.06;
        let hz = ez * style.volume[2];

        /* Strands as ridges running down from the crown, gentle enough to give
           the light something to catch without fighting the shape. */
        const strand = 1 + 0.03 * Math.cos(Math.atan2(hz, hx) * 6) * smoothCrown(hy);
        hx *= strand;
        hz *= strand;

        /*
         * The drop is measured before the window moves anything, and that is
         * the whole fix for the ragged hairline. It used to run afterwards, on
         * the pushed-back z — so a vertex just inside the window had been
         * shoved from the front of the head to the middle of it and reported an
         * angle round the head nothing like its neighbour's a hair outside. The
         * two got completely different lock drops and the boundary tore into a
         * zigzag. It was never a resolution problem.
         */
        const drop = style.drop * hairDrop(hx, hy, hz, style);
        const w = hairWindow(hx, hy, hz, style);
        hz += (-0.34 - hz) * w;
        hy -= drop;

        p.setXYZ(i, hx, hy, hz);
      }
      hairGeo.computeVertexNormals();

      hair = new THREE.Mesh(hairGeo, hairMat);
      doll.add(hair);

      if (style.buns) {
        bunGeo = new THREE.SphereGeometry(style.buns.r, 40, 30);
        for (const side of [-1, 1]) {
          const b = new THREE.Mesh(bunGeo, hairMat);
          b.position.set(side * style.buns.x, style.buns.y, style.buns.z);
          b.scale.set(1, 0.94, 0.94);
          doll.add(b);
          buns.push(b);
        }
      }
    }

    /*
     * Pastel, not deep. These are vinyl toys — the form is read from shading
     * rather than from saturation, and the swatch always looks darker than the
     * model, because a matt surface under a bright key with a white sheen over
     * it is lifted three times before anyone sees it.
     *
     * Matt, too. A pale colour under a full clearcoat is moulded plastic, and
     * the hard even highlight sliding over a smooth shell is what made the
     * first few attempts read as a bonnet as much as the shape did.
     */
    /*
     * How much lifting a colour gets depends on how light it already is.
     *
     * A flat 0.18 toward white with a full white sheen over it is fine on pink
     * and ruinous on black — the two together turned the darkest hair in the
     * set into grey, because a lift that is a nudge on a pale colour is most of
     * the value of a dark one. Scaling both by the colour's own luminance keeps
     * black black and still stops pink going flat.
     */
    const lum = 0.2126 * tint.r + 0.7152 * tint.g + 0.0722 * tint.b;
    hairMat.color.copy(tint).lerp(new THREE.Color(0xffffff), 0.05 + 0.22 * lum);
    hairMat.sheenColor.copy(tint).lerp(new THREE.Color(0xffffff), 0.2 + 0.4 * lum);
    hairMat.sheen = 0.4 + 0.7 * lum;

    /* Only the tongue uses this. */
    lip = `#${tint.clone().lerp(new THREE.Color(0xff9aa8), 0.5).getHexString()}`;

    drawnAt = -1;
    shown = { ...next };
  }

  hairMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.72,
    clearcoat: 0,
    sheen: 1,
    sheenRoughness: 0.35,
  });

  let lip = "#c8365a";
  let blush = { rgb: [226, 112, 124], a: 0.42 };
  const pose = { ...EXPRESSIONS.resting };
  let drawnAt = -1;

  buildLook(look.current);

  // ── State that eases rather than jumps ──
  const pointer = { x: 0, y: 0 };
  const gaze = { x: 0, y: 0 };
  let poke = 0;
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

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  let raf = 0;
  let last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(last ? (now - last) / 1000 : 0.016, 0.05);
    last = now;

    if (mount.clientWidth !== width || mount.clientHeight !== height) onResize();
    const want = look.current;
    if (!shown || want.hair !== shown.hair || want.hairColor !== shown.hairColor ||
        want.skinTone !== shown.skinTone) {
      buildLook(want);
    }

    seed += reduced ? 0 : dt;
    poke = Math.max(0, poke - dt * 2.6);
    const squash = Math.sin(poke * Math.PI) * (0.5 + poke * 0.5);

    // ── Looking ──
    gaze.x += (pointer.x - gaze.x) * Math.min(1, dt * 4.5);
    gaze.y += (pointer.y - gaze.y) * Math.min(1, dt * 4.5);

    /*
     * The head turns a little and the eyes turn more, which is the order a real
     * one does it in — the eyes arrive first and the head follows. Turning them
     * together is what makes a character look like a puppet on a stick.
     */
    doll.rotation.y = gaze.x * 0.34;
    doll.rotation.x = -gaze.y * 0.24;

    doll.position.y = reduced ? 0 : Math.sin(seed * 1.25) * 0.045;

    // ── Blinking ──
    if (!reduced) {
      blinkIn -= dt;
      if (blinkIn <= 0 && blinking <= 0) {
        blinking = BLINK_FOR;
        /* Varied off the clock rather than Math.random, so two dolls on a page
           do not blink in unison but neither needs a random source. */
        blinkIn = rangeAt((Math.sin(seed * 12.9898) * 0.5 + 0.5) % 1);
      }
      if (blinking > 0) blinking -= dt;
    }
    const blink = blinking > 0 ? Math.max(0.04, 1 - blinking / (BLINK_FOR / 2)) : 1;

    const target = EXPRESSIONS[wanted.current] || EXPRESSIONS.resting;
    easeFace(pose, target, Math.min(1, dt * 6));

    /* Each turning at its own rate and drifting on its own phase, so they never
       fall into step with one another or with the doll's own bob. */
    if (!reduced) {
      stars.forEach((star, i) => {
        star.rotation.z = seed * STARS[i].spin;
        star.position.y = STARS[i].at[1] + Math.sin(seed * 0.9 + i * 1.7) * 0.07;
      });
    }

    doll.rotation.z = pose.tilt;
    doll.scale.set(1 + squash * 0.07, 1 - squash * 0.1, 1 + squash * 0.07);

    /*
     * Redrawn only when something has moved. The whole face lives on this
     * texture now, so it has more to say than it did — the blink and the glance
     * are in here as well, because there is no lid to turn and no iris to
     * rotate any more.
     */
    const settled =
      pose.eyeOpen * blink + pose.eyeArc +
      pose.browLY + pose.browRY + pose.browLTilt + pose.browRTilt +
      pose.mouthCurve + pose.mouthOpen + pose.mouthW + pose.mouthX;
    if (Math.abs(settled - drawnAt) > 0.0004) {
      drawDecal(decal.ctx, DECAL_PX, pose, blink, lip, blush);
      decal.tex.needsUpdate = true;
      drawnAt = settled;
    }

    renderer.render(scene, camera);
  }

  if (import.meta.env?.DEV) {
    // So the doll can be taken apart without a rebuild when it does not look
    // the way the arithmetic said it would.
    window.__doll = { scene, doll, camera, key, rim, skin, hairMat, decal, nose, stars };
  }

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    mount.removeEventListener("pointermove", onPointerMove);
    mount.removeEventListener("pointerleave", onLeave);
    mount.removeEventListener("pointerdown", onPoke);
    headGeo.dispose();
    skin.dispose();
    decalGeo.dispose();
    decalMesh.material.dispose();
    decal.tex.dispose();
    noseGeo.dispose();
    starGeo.dispose();
    for (const m of starMats) m.dispose();
    if (hair) hairGeo.dispose();
    hairMat.dispose();
    dropBuns();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) {
      mount.removeChild(renderer.domElement);
    }
  };
}
