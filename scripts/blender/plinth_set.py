# Plinth set for the Lobby foreground — real geometry the camera stands on, baked.
# Doctrine: production geometry + baked light, not procedural code-paint.
#
# This is the FOREGROUND 3-D ENVIRONMENT of the "Wanderer above the Sea of Fog"
# lobby. The wanderer figure is GONE — you stepped THROUGH the painting and now
# stand on the rock; you ARE the wanderer. We export GEOMETRY ONLY (no camera,
# no lights): the web keeps its own pan/wind camera, its day-cycle sky gradient
# and its Blender fog-bank (fog.glb), and renders THIS set UNLIT + vertex-colour
# (AO baked in, cheapest possible material) tinted per time-of-day, finished by
# the Kuwahara painterly pass. So we bake NEUTRAL dark Friedrich stone here.
#
# Two things in one export, as named meshes:
#   • "ForeRock"   — the large first-person foreground outcrop. A broad near rock
#                    shelf with a hewn front lip that fills the bottom third of
#                    the frame and tumbles off the bottom edge (the vantage you
#                    perch on). Much bigger/coarser than summit's small Outcrop:
#                    hard angular Friedrich stone, a slight overhang toward you.
#   • "Plinth.001/002/003" — small hewn outcrop LEDGES that rise out of the fog,
#                    little shelves for the nearest gallery canvases to rest on /
#                    lean against (anti-float grounding). Same crag vocabulary,
#                    varied sizes/heights.
#
# ORIENTATION (brain.md Tag 13): glTF export maps Blender +Z (up) → glTF +Y (up).
# For GROUND geometry built with up = world +Z this is CORRECT — it loads upright
# with NO web-side rotation (unlike the frame, which faced +Z and loaded flat).
# So we build with up = world +Z, origin near world origin, the TOP of the rock
# around z = 0, so the web can place it with a simple position offset.
#
# Run headless (no socket, no GUI conflict):
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/plinth_set.py
#
# NOTE: HIP/OPTIX may fall back to CPU bake (a HIPEW init warning) — that is fine.
# We keep AO samples low (64) and the bake still runs correctly on CPU.
import bpy, bmesh, math, os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "lobby")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "plinths.glb")

# ── deterministic value-noise fBm (copied verbatim from summit_set.py so the ──
#    stone vocabulary matches the rest of the world; determinism = identical
#    builds every run) ────────────────────────────────────────────────────────
def _h(i, j, k):
    n = (i * 374761393 + j * 668265263 + k * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 16)) & 0xFFFFFFFF
    return n / 0xFFFFFFFF

def _smooth(t):
    return t * t * t * (t * (t * 6 - 15) + 10)

def vnoise(x, y, z):
    xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
    xf, yf, zf = x - xi, y - yi, z - zi
    u, v, w = _smooth(xf), _smooth(yf), _smooth(zf)
    def lerp(a, b, t): return a + (b - a) * t
    c000 = _h(xi, yi, zi);       c100 = _h(xi + 1, yi, zi)
    c010 = _h(xi, yi + 1, zi);   c110 = _h(xi + 1, yi + 1, zi)
    c001 = _h(xi, yi, zi + 1);   c101 = _h(xi + 1, yi, zi + 1)
    c011 = _h(xi, yi + 1, zi + 1); c111 = _h(xi + 1, yi + 1, zi + 1)
    x00 = lerp(c000, c100, u); x10 = lerp(c010, c110, u)
    x01 = lerp(c001, c101, u); x11 = lerp(c011, c111, u)
    y0 = lerp(x00, x10, v); y1 = lerp(x01, x11, v)
    return lerp(y0, y1, w)  # 0..1

def fbm(x, y, z, octaves=5, ridged=False):
    s, a, f, norm = 0.0, 0.5, 1.0, 0.0
    for _ in range(octaves):
        n = vnoise(x * f, y * f, z * f) * 2 - 1
        if ridged:
            n = 1.0 - abs(n)
            n = n * n
        s += a * n
        norm += a
        f *= 2.0
        a *= 0.5
    return s / norm  # ~ -1..1 (or 0..1 ridged)

# ── scene reset (factory-startup safe: build from scratch, clear default cube) ─
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def set_col(me, rgb):
    """give a mesh a CORNER float colour attribute 'Col' = flat tone."""
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    n = len(ca.data)
    arr = np.tile(np.array([rgb[0], rgb[1], rgb[2], 1.0], np.float32), n)
    ca.data.foreach_set("color", arr)
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("Col")

def _mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = 0.92
    return m

def finalize(bm, name, rgb):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    set_col(me, rgb)
    me.materials.append(_mat(name + "_mat", rgb))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

# Dark Friedrich stone tones (bake stays neutral; web tints per day-cycle).
STONE_FORE = (0.050, 0.044, 0.048)   # the near foreground lip — darkest
STONE_PLINTH = (0.064, 0.058, 0.064) # the rising ledges — a touch lighter

# ── 1. ForeRock — the first-person foreground outcrop (you perch on it) ───────
# A broad near rock SHELF: a flat-ish standing top just below the eye, a hard
# hewn FRONT LIP that overhangs slightly toward the viewer (−y, the camera side),
# and the whole near edge tumbling off the bottom of the frame. Built up = +Z,
# top of the shelf around z = 0 so the web places it with a simple offset.
#
#   +y = into the distance (away from camera / toward the fog & canvases)
#   −y = toward the camera (the near lip that runs off the bottom edge)
def build_forerock():
    bm = bmesh.new()
    N = 80                       # grid resolution (clean silhouette > micro-detail)
    SPANX, SPANY = 46.0, 30.0    # MUCH bigger than summit's small Outcrop
    verts = [[None] * (N + 1) for _ in range(N + 1)]
    for iy in range(N + 1):
        for ix in range(N + 1):
            gx = (ix / N - 0.5) * SPANX
            gy = (iy / N - 0.5) * SPANY          # +y into distance, −y toward cam
            # broad standing shelf: a near-flat plateau just under the eye, with
            # a gentle crown so the top reads as worn rock rather than a slab.
            crown = (1.0 - (abs(gx) / (SPANX * 0.62)) ** 2.0) * 1.4
            crown = max(-0.8, crown)
            # hard angular hewn stone — strong ridged high frequencies (facets)
            crag = fbm(gx * 0.20 + 7, gy * 0.20 - 3, 0.0, 6) * 2.6
            ridge = fbm(gx * 0.46, gy * 0.48, 4.0, 5, ridged=True) * 2.4
            facet = fbm(gx * 1.05, gy * 1.05, 8.0, 3, ridged=True) * 0.9
            z = crown + crag * 0.55 + ridge * 0.7 + facet - 1.0
            # keep the central standing patch flatter (a foothold under the eye)
            stand = max(0.0, 1.0 - math.hypot(gx * 0.10, (gy - 2.0) * 0.16))
            z = z * (1.0 - 0.55 * stand) - 0.4 * stand
            # the FAR edge (toward the fog) drops away so the rock ends at the bank
            if gy > 6.0:
                z -= ((gy - 6.0) / 9.0) ** 1.5 * 16.0
            # the sides break off into the void past the shoulders
            sx = max(0.0, abs(gx) - SPANX * 0.30)
            z -= (sx ** 1.6) * 0.55
            # the NEAR lip (−y, toward the camera) is a hewn FRONT FACE that
            # tumbles off the bottom edge of the frame; a slight OVERHANG toward
            # the viewer (push −y front verts a touch closer as they drop).
            overhang = 0.0
            if gy < -3.0:
                drop = (-3.0 - gy) / 9.0
                z -= drop ** 1.45 * 26.0
                overhang = drop ** 1.3 * 2.2    # lip leans toward camera (−y)
            # angular hewn jitter on the horizontal position (no soft blob)
            jx = (vnoise(gx * 0.55, gy * 0.55, 5) - 0.5) * 1.5
            jy = (vnoise(gx * 0.55, gy * 0.55, 17) - 0.5) * 1.5
            verts[iy][ix] = bm.verts.new((gx + jx, gy + jy - overhang, z))
    for iy in range(N):
        for ix in range(N):
            bm.faces.new((verts[iy][ix], verts[iy][ix + 1],
                          verts[iy + 1][ix + 1], verts[iy + 1][ix]))
    # flat shading reads the facets as hard hewn Friedrich stone
    for f in bm.faces:
        f.smooth = False
    return finalize(bm, "ForeRock", STONE_FORE)

# ── 2. Plinth ledges — small hewn shelves rising out of the fog ───────────────
# Same crag vocabulary as summit_set.py build_crags: a faceted cone shell, but
# with a flatter TOP SHELF for a canvas to rest on / lean against. Each ledge is
# its own named mesh (Plinth.001/002/003) so the web can place/scale them under
# the nearest staged canvases. Built up = +Z; the shelf top sits near z so the
# web drops them just under each near frame.
def build_plinth(name, cx, cy, radius, height, seed):
    bm = bmesh.new()
    rings, seg = 5, 14
    cols = [[None] * seg for _ in range(rings)]
    # a flat-ish crown (the shelf the canvas leans on) instead of a sharp apex
    crown_r = radius * 0.34
    crown = [None] * seg
    for a in range(seg):
        ang = a / seg * math.tau
        rough = 0.78 + fbm(math.cos(ang) * 2 + seed, math.sin(ang) * 2, 0, 4) * 0.32
        px = cx + math.cos(ang) * crown_r * rough
        py = cy + math.sin(ang) * crown_r * rough
        pz = height + (vnoise(px, py, seed) - 0.5) * 0.5
        crown[a] = bm.verts.new((px, py, pz))
    centre = bm.verts.new((cx, cy, height + 0.18))
    for ri in range(rings):
        rr = radius * (ri + 1) / rings
        # the body tapers down to the fog; the lower rings sink below z=0
        zz = height * (1.0 - ((ri + 1) / rings) ** 1.3) - height * 0.18
        for a in range(seg):
            ang = a / seg * math.tau
            # hewn faceting — ridged high frequencies, angular not smooth
            rough = 0.70 + fbm(math.cos(ang) * 2 + seed, math.sin(ang) * 2, ri + 1, 4) * 0.5
            ridge = fbm(math.cos(ang) * 3, math.sin(ang) * 3, ri + seed, 3, ridged=True) * 0.6
            px = cx + math.cos(ang) * rr * (rough + ridge * 0.2)
            py = cy + math.sin(ang) * rr * (rough + ridge * 0.2)
            pz = zz + (vnoise(px, py, ri + seed) - 0.5) * 1.2
            cols[ri][a] = bm.verts.new((px, py, pz))
    # cap the crown (the flat shelf)
    for a in range(seg):
        a2 = (a + 1) % seg
        bm.faces.new((centre, crown[a], crown[a2]))
    # crown → first ring
    for a in range(seg):
        a2 = (a + 1) % seg
        bm.faces.new((crown[a], cols[0][a], cols[0][a2], crown[a2]))
    # body rings
    for ri in range(rings - 1):
        for a in range(seg):
            a2 = (a + 1) % seg
            bm.faces.new((cols[ri][a], cols[ri][a2],
                          cols[ri + 1][a2], cols[ri + 1][a]))
    for f in bm.faces:
        f.smooth = False
    return finalize(bm, name, STONE_PLINTH)

# build the meshes ------------------------------------------------------------
ob_fore = build_forerock()
# three ledges of varied size/height, scattered so they don't line up in a row.
ob_p1 = build_plinth("Plinth.001", -9.0, 5.0, 3.4, 2.6, 31)   # near-left, larger
ob_p2 = build_plinth("Plinth.002", 8.5, 9.0, 2.6, 2.0, 47)    # mid-right
ob_p3 = build_plinth("Plinth.003", 1.5, 14.0, 2.0, 1.5, 59)   # smaller, further
PLINTHS = (ob_p1, ob_p2, ob_p3)
ALL = (ob_fore,) + PLINTHS
for ob in ALL:
    print(f"BUILD {ob.name}: {len(ob.data.polygons)} faces")

# ── AO bake (Cycles → vertex colours) on the dark stone ──────────────────────
# NOTE: HIP/OPTIX may emit a HIPEW init warning and fall back to CPU — fine. We
# select GPU if available, else CPU; samples kept low (64) so the CPU bake is
# quick and still clean enough (Kuwahara blurs micro-detail anyway).
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("BAKE device: GPU/OPTIX (may fall back to CPU on HIPEW warning)")
except Exception as e:
    scene.cycles.device = "CPU"
    print(f"BAKE device: CPU ({e})")

if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.light_settings.distance = 14.0

def bake_ao(ob, floor=0.22):
    """Cycles AO → vertex colour, then Col *= floor + (1-floor)*AO (floor 0.22,
    same as the existing outcrop) so crevices darken but never go fully black."""
    me = ob.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("AO")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    col = me.color_attributes["Col"]; ao = me.color_attributes["AO"]
    n = len(col.data)
    c = np.empty(n * 4, np.float32); a = np.empty(n * 4, np.float32)
    col.data.foreach_get("color", c); ao.data.foreach_get("color", a)
    f = (floor + (1 - floor) * a[0::4]).astype(np.float32)
    for k in range(3):
        c[k::4] *= f
    col.data.foreach_set("color", c)
    me.color_attributes.remove(ao)
    me.color_attributes.active_color_index = [x.name for x in me.color_attributes].index("Col")
    me.update()
    print(f"BAKE ok: {ob.name} ({n} loops)")

for ob in ALL:
    try:
        bake_ao(ob)
    except Exception as e:
        print(f"BAKE FAILED {ob.name}: {e}")
        if "AO" in ob.data.color_attributes:
            ob.data.color_attributes.remove(ob.data.color_attributes["AO"])

# ── export ───────────────────────────────────────────────────────────────────
# Binary GLB, vertex colours (COLOR_0), apply modifiers, default +Y up. We do
# NOT meshopt-compress here — gltf-transform is run afterward with the locked
# flags (--compress meshopt --simplify false --palette false --join false
# --flatten false).
bpy.ops.object.select_all(action="DESELECT")
for ob in ALL:
    ob.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_apply=True, export_cameras=False, export_lights=False,
              export_animations=False, export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = sum(len(o.data.polygons) for o in ALL)
mb = os.path.getsize(GLB_PATH) / 1e6
print(f"meshes: ForeRock, Plinth.001, Plinth.002, Plinth.003")
print(f"PLINTHS_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
