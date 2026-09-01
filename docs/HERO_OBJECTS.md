# The things that fall on the homepage

`src/components/GravityPills.jsx` drops objects into the space above the rule
and lets them pile up on it. Three draws them, Matter runs the physics, and the
two meet in pixels: Matter simulates in the container's own coordinates and the
result is mapped into world units each frame, so the floor of the simulation is
the rule on the page rather than something positioned to look like it.

Everything is deterministic. No randomness anywhere, and the simulation is fed
a fixed step, so the same page gives the same pile every time — the same
objects in the same places at the same angles. That is not only for looks: if
these ever become links, a link should not be somewhere different on every
load.

## The list

One array near the top of the file, in the order they drop:

| field | meaning |
|---|---|
| `at` | where it enters across the width, 0 to 1 |
| `length`, `girth` | size, as multiples of the shared unit |
| `tilt`, `spin` | the angle it enters at, and how fast it is turning |
| `kind` | `pill` (the default), `shirt`, or `bag` |
| `color` | the glass tint; ignored by anything drawn from artwork |

Size is bounded by the width, by the height of the yard, and by a flat cap.
Width alone is not enough: the room above the rule is whatever the page has
left over, so a pile that just fits a tall window buries a short one.

## The pills are parked, not deleted

They were taken off the page when the hero went over to clothing. Nothing that
draws them was removed — `pillShape`, the glass material and the convex-hull
outline are all still there, because a pill is a `kind` rather than the only
thing this file knows how to make.

To put them back, paste these rows in above the garments:

```js
{ color: "#FF6B4A", length: 1.22, girth: 0.34, at: 0.1,  tilt: -0.3,  spin: 0.02 },
{ color: "#FFC53D", length: 0.85, girth: 0.42, at: 0.28, tilt: 0.24,  spin: -0.03 },
{ color: "#2BC8CE", length: 0.7,  girth: 0.38, at: 0.61, tilt: 0.34,  spin: -0.02 },
{ color: "#C8F060", length: 1.25, girth: 0.3,  at: 0.78, tilt: -0.2,  spin: 0.03 },
{ color: "#4A7BE8", length: 1.0,  girth: 0.36, at: 0.91, tilt: 0.4,   spin: -0.015 },
{ color: "#F2A086", length: 0.8,  girth: 0.44, at: 0.36, tilt: -0.36, spin: 0.02 },
{ color: "#FFC53D", length: 0.95, girth: 0.33, at: 0.7,  tilt: 0.3,   spin: -0.025 },
```

Those seven were tuned so the pile clears the top of the yard on every window
shape tested. Adding objects without taking others away will overfill it.

## Adding a garment from a PNG

The shape is traced once, by hand, and the result pasted into the file — there
is no tracing at runtime.

1. Put the file in `public/` and open the site.
2. Run the snippet below in the browser console. It rasterises the image, walks
   the outer boundary, finds any enclosed hole, simplifies both and prints them.
3. Paste the two arrays into the file beside `BAG_OUTER` / `BAG_HOLE`.

The hole matters more than it sounds. Traced as an outer silhouette alone, a
bag comes out as a plain dome — it is the gap under the handle that makes it
read as a bag at all. Anything with a handle, a strap or a buckle needs it.

```js
const img = new Image(); img.src = '/YOUR-FILE.png'; await img.decode();
const MAX = 300, k = MAX / Math.max(img.width, img.height);
const W = Math.round(img.width * k), H = Math.round(img.height * k);
const c = document.createElement('canvas'); c.width = W; c.height = H;
const g = c.getContext('2d', { willReadFrequently: true });
g.drawImage(img, 0, 0, W, H);
const d = g.getImageData(0, 0, W, H).data;
const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128;
const N = [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
function trace(sx, sy, inside) {
  let b = 7, cx = sx, cy = sy, out = [], guard = 0;
  do {
    out.push([cx, cy]);
    let moved = false;
    for (let i = 1; i <= 8; i++) {
      const ni = (b + i) % 8, nx = cx + N[ni][0], ny = cy + N[ni][1];
      if (inside(nx, ny)) { b = (ni + 4) % 8; cx = nx; cy = ny; moved = true; break; }
    }
    if (!moved) break;
  } while ((cx !== sx || cy !== sy) && ++guard < 200000);
  return out;
}
let ox = -1, oy = -1;
outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) { ox = x; oy = y; break outer; }
const outerPath = trace(ox, oy, on);
const bg = new Uint8Array(W * H), st = [[0, 0]];
while (st.length) { const [x, y] = st.pop(); if (x<0||y<0||x>=W||y>=H) continue;
  const i = y*W+x; if (bg[i] || on(x,y)) continue; bg[i] = 1; st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
let hx=-1, hy=-1, best=0; const seen = new Uint8Array(W*H);
for (let y=0;y<H;y++) for (let x=0;x<W;x++) { const i=y*W+x;
  if (on(x,y)||bg[i]||seen[i]) continue; let size=0, fx=x, fy=y; const s2=[[x,y]];
  while (s2.length) { const [px,py]=s2.pop(); if(px<0||py<0||px>=W||py>=H) continue;
    const j=py*W+px; if (seen[j]||on(px,py)||bg[j]) continue; seen[j]=1; size++;
    if (py<fy||(py===fy&&px<fx)){fx=px;fy=py;} s2.push([px+1,py],[px-1,py],[px,py+1],[px,py-1]); }
  if (size>best){best=size; hx=fx; hy=fy;} }
const holePath = best > 30 ? trace(hx, hy, (x,y)=> x>=0&&y>=0&&x<W&&y<H && !on(x,y) && !bg[y*W+x]) : [];
function rdp(p, eps) { if (p.length < 3) return p;
  const [ax,ay]=p[0], [bx,by]=p[p.length-1]; let idx=0, dmax=0;
  for (let i=1;i<p.length-1;i++){ const [px,py]=p[i]; const den=Math.hypot(by-ay,bx-ax)||1;
    const dist=Math.abs((by-ay)*px-(bx-ax)*py+bx*ay-by*ax)/den; if(dist>dmax){dmax=dist;idx=i;} }
  if (dmax<=eps) return [p[0], p[p.length-1]];
  return [...rdp(p.slice(0,idx+1),eps).slice(0,-1), ...rdp(p.slice(idx),eps)]; }
const o = rdp(outerPath, 1.1), h = rdp(holePath, 1.1);
let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
for (const [x,y] of o){ mnx=Math.min(mnx,x); mny=Math.min(mny,y); mxx=Math.max(mxx,x); mxy=Math.max(mxy,y); }
const s=1/Math.max(mxx-mnx,mxy-mny), cx2=(mnx+mxx)/2, cy2=(mny+mxy)/2;
const norm = p => p.map(([x,y]) => [ +(((x-cx2)*s).toFixed(3)), +(((cy2-y)*s).toFixed(3)) ]);
// UV bounds, for drawing the object in its own artwork rather than in glass
let umnx=1e9,umny=1e9,umxx=-1,umxy=-1;
for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (on(x,y)) {
  if(x<umnx)umnx=x; if(x>umxx)umxx=x; if(y<umny)umny=y; if(y>umxy)umxy=y; }
console.log('OUTER', JSON.stringify(norm(o)));
console.log('HOLE ', JSON.stringify(norm(h)));
console.log('UV   ', JSON.stringify({ u0:+(umnx/W).toFixed(4), u1:+((umxx+1)/W).toFixed(4),
  v0:+(1-(umxy+1)/H).toFixed(4), v1:+(1-umny/H).toFixed(4) }));
```

## Glass or artwork

Both work, and they look very different.

**Glass** puts the object in the same material as everything else. It suits
closed, simple silhouettes: a bag's handle gives the light one clean arc to
wrap and it reads instantly. It suits limbs badly — a t-shirt's notches split
the light into competing highlights and it reads as a puffy sticker.

**Artwork** draws the object in its own picture: a flat `ShapeGeometry` of the
silhouette and its hole, textured, unlit and untone-mapped so the colours are
the file's rather than the scene's. It is not extruded — giving a photograph
thickness produces a bevelled rim of stretched pixels and a side wall of
nothing. It reads as a real product immediately, and reads as pasted on, which
may be the point or may not.

If you go the artwork route, export as PNG or WebP. `public/bag.svg` is 696kB
of vectorised photograph — three times the whole of Three — rasterised on every
load, where the same picture as WebP would be tens of kilobytes.
