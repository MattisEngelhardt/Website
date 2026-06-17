# Peaks set for the Main-Lobby (Workstream A) -- the DISTANT FRIEDRICH MOUNTAINS.
# Doctrine: real production geometry + baked light, never shader-paint. These are
# the cool blue ridges that float on the sea of fog in "Wanderer above the Sea of
# Fog" -- masses that rise OUT of the bank, recede through aerial perspective, and
# turn ever cooler/paler with distance. They render UNLIT with vertex colour
# (baked vertical/sun-ward luminance + a baked aerial blue haze) and are finished
# by the Kuwahara painterly pass. Cheap (~30-80k tris), dramatic, 60fps-friendly.
#
# SIBLING of fog_set.py -- SAME axis convention, SAME deterministic fBm vocabulary,
# SAME procedural-luminance vertex-colour bake (NO Cycles, so no HIP/OPTIX CPU
# fallback stall; the look is fully procedural + an analytic slope-AO).
#
# Blender Z-up -> glTF Y-up export maps (x, y, z)_bl -> (x, z, -y)_gltf, so here:
#   X = left/right (web x),  Y = depth into distance (web -z),  Z = height (web y).
# Built up = world +Z -> loads UPRIGHT with NO web-side rotation (like plinths.glb,
# unlike frame.glb). The web loads this, places the group, multiplies the baked
# luminance by the day-cycle tint, and aerial-fades it further into the sky.
#
# STAGING (matches fog_set.py BANKS at Blender Y 95-235, crest z up to ~ +8.5):
# the ridges sit BEHIND and AMONG those banks, at deeper Y, with crests rising
# well above the fog tops so they read as mountains standing out of the sea, and
# recede to a pale-blue horizon wall at the back.
#
# Run headless (no socket, no GUI conflict):
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/peaks_set.py
import bpy, bmesh, math, os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "lobby")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "peaks_raw.glb")

# -- deterministic value-noise fBm (verbatim from fog_set.py / summit_set.py so
#    every build is identical and the stone vocabulary matches the world) ------
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
    c000 = _h(xi, yi, zi);         c100 = _h(xi + 1, yi, zi)
    c010 = _h(xi, yi + 1, zi);     c110 = _h(xi + 1, yi + 1, zi)
    c001 = _h(xi, yi, zi + 1);     c101 = _h(xi + 1, yi, zi + 1)
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

def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)

# -- scene reset --------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def _mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = 1.0
    return m

# -- the staged ridge masses --------------------------------------------------
# Each ridge is a peaked surface (a profile across its WIDTH heaved up by fBm),
# its feet sunk so the fog hides them, its crests rising above the fog tops. The
# SUN is to the right (+X) -- sun-ward faces catch a warmer/brighter glaze. Deeper
# ridges (larger Y) are paler/cooler from aerial perspective. Five distinct masses
# at staged depths give the painting's layered blue-ridge recession.
#
# spec = (name, cx, cy, width, depth, height, sharp, base_z, seed, depth_t)
#   cx,cy   ridge centre in Blender X (left/right) and Y (into distance)
#   width   span across X;  depth = span across Y (front-to-back thickness)
#   height  crest amplitude of the base profile
#   sharp   profile exponent: low = broad rounded massif, high = sharp pinnacle
#   base_z  where the FEET sit (negative = sunk under the fog so it laps the base)
#   depth_t 0..1 manual aerial-recession bias (0 = nearest/darkest, 1 = palest)
SUN_X = 1.0  # low sun to the right (+X)
RIDGES = [
    # NEAR-MID rounded massif, left of centre -- the first ridge out of the fog,
    # darkest + most detailed (Friedrich's nearer blue mass on the left).
    ("Ridge.Near",  -58.0, 205.0, 150.0,  46.0, 30.0, 1.7,  -16.0,  7.0, 0.18),
    # MID sharp spur, right of centre -- the distinctive pointed peak.
    ("Ridge.Spur",   64.0, 250.0,  78.0,  34.0, 40.0, 4.2,  -18.0, 13.0, 0.34),
    # MID-FAR broad shoulder, centre-left -- fills the gap behind the near massif.
    ("Ridge.Mid",   -10.0, 300.0, 200.0,  50.0, 34.0, 2.0,  -20.0, 21.0, 0.52),
    # FAR twin summits, right -- paler, softened, floating on the deep haze.
    ("Ridge.Far",    96.0, 360.0, 130.0,  44.0, 30.0, 2.6,  -22.0, 29.0, 0.72),
    # the BACK WALL of soft mountains spanning the whole horizon -- palest, the
    # luminous blue infinity the eye dissolves into.
    ("Ridge.Wall",    0.0, 440.0, 460.0,  60.0, 26.0, 1.5,  -22.0, 37.0, 0.92),
]

# cool aerial-haze blue the ridges recede into (Friedrich's distant blue-grey).
# Web aerial-fade pushes them FURTHER into the sky on top of this, so keep this a
# believable mountain-blue, not the sky itself.
HAZE_BLUE = np.array([0.52, 0.60, 0.74])
# near rock base tone (dark cool Friedrich stone, sun-ward warmer)
ROCK_DARK = np.array([0.14, 0.16, 0.22])
ROCK_WARM = np.array([0.42, 0.40, 0.40])   # sun-lit upper/right faces, warm grey
ROCK_COOL = np.array([0.20, 0.26, 0.36])   # shadowed lower/left faces, cool

def build_ridge(name, cx, cy, width, depth, height, sharp, base_z, seed, depth_t):
    """A peaked ridge surface, displaced by fBm, feet sunk under the fog.
    Returns the linked object. Procedural luminance + aerial haze baked into the
    'Col' CORNER vertex-colour attribute (no Cycles)."""
    bm = bmesh.new()
    # resolution scales with width so far/wide ridges keep silhouette detail but
    # the near ones stay crisp; clamp to keep tris in the ~30-80k total budget.
    NX = max(40, min(140, int(width / 1.4)))
    NY = max(8, min(20, int(depth / 2.6)))
    verts = [[None] * (NX + 1) for _ in range(NY + 1)]
    zmin, zmax = 1e9, -1e9
    zgrid = [[0.0] * (NX + 1) for _ in range(NY + 1)]
    for iy in range(NY + 1):
        ty = iy / NY                     # 0 = front face, 1 = back
        gy = cy + (ty - 0.5) * depth
        for ix in range(NX + 1):
            tx = ix / NX                 # 0..1 across the width
            gx = cx + (tx - 0.5) * width
            # peaked profile across the width: a few summits, not one bump
            prof = math.sin(clamp01(tx) * math.pi) ** sharp
            # break the single peak into a serrated ridgeline of summits
            ridgeline = 0.55 + 0.45 * fbm(tx * 5.0 + seed, 0.0, seed, 4, ridged=True)
            z = base_z + prof * height * ridgeline
            # big shape displacement (the mass) + erosion detail (the texture)
            z += fbm(gx * 0.012 + seed, gy * 0.012, seed, 5) * height * 0.42
            z += fbm(gx * 0.05, gy * 0.05, seed + 3, 4, ridged=True) * height * 0.20
            z += fbm(gx * 0.14, gy * 0.14, seed + 7, 3) * height * 0.07
            # the back rows fall away so the mass has a far shoulder, not a cliff
            z -= (ty ** 1.6) * height * 0.28
            zgrid[iy][ix] = z
            zmin = min(zmin, z); zmax = max(zmax, z)
            verts[iy][ix] = bm.verts.new((gx, gy, z))
    for iy in range(NY):
        for ix in range(NX):
            bm.faces.new((verts[iy][ix], verts[iy][ix + 1],
                          verts[iy + 1][ix + 1], verts[iy + 1][ix]))
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()

    # -- procedural luminance + aerial-haze bake into CORNER 'Col' --
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    span = max(zmax - zmin, 1e-3)
    # face normals (poly.normal) drive a cheap analytic sun/AO term below; they
    # are always available after bm.normal_update() + to_mesh, no recompute needed.
    cols = np.empty(len(ca.data) * 4, np.float32)
    li = 0
    for poly in me.polygons:
        nz = poly.normal.z          # upward-facing crests catch light
        nx = poly.normal.x          # +X faces are sun-ward
        for vidx in poly.vertices:
            co = me.vertices[vidx].co
            crest = clamp01((co.z - zmin) / span)
            # height-lit rock: dark base -> lit upper faces; bias dark so only
            # the upper crests glow (Friedrich's ridges are dark-footed, lit-topped)
            lit = crest ** 1.25
            # analytic light: upward + sun-ward faces brighten, undersides darken
            facing = clamp01(0.45 + 0.40 * nz + 0.25 * nx * SUN_X)
            sunward = clamp01(0.5 + 0.5 * nx * SUN_X)
            # base rock colour: cool shadow -> warm sun-lit, by lit*facing
            tone_t = clamp01(lit * (0.5 + 0.5 * facing))
            rock = ROCK_COOL + (ROCK_WARM - ROCK_COOL) * tone_t
            rock = ROCK_DARK + (rock - ROCK_DARK) * (0.35 + 0.65 * lit)
            # a warm sun glaze on the very upper sun-ward crests
            rock = rock + (np.array([0.30, 0.22, 0.10]) * (lit ** 2.2) * sunward)
            # -- aerial perspective: blend toward HAZE_BLUE by staged depth, and
            #    a touch more on the lower (fog-lapped) feet so the bank eats them --
            foot = clamp01(1.0 - (co.z - zmin) / span)   # 1 at the feet
            aer = clamp01(depth_t + foot * 0.30 * (1.0 - depth_t))
            aer = aer ** 0.85
            c = rock * (1.0 - aer) + HAZE_BLUE * aer
            cols[li:li+3] = np.clip(c[:3], 0.0, 1.4)
            cols[li+3] = 1.0
            li += 4
    ca.data.foreach_set("color", cols)
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("Col")
    me.materials.append(_mat(name + "_mat", (0.35, 0.4, 0.5)))
    # smooth shading: distant mountains read as soft masses, Kuwahara blurs detail
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

objs = []
for spec in RIDGES:
    objs.append(build_ridge(*spec))

# -- optional Cycles AO refine (best-effort; SKIPPED safely if no device) ------
# The procedural bake above already reads as lit rock. If Cycles is available we
# multiply in a real AO so the valleys between summits self-shadow -- but we never
# BLOCK on it (HIP/OPTIX may fall back to CPU; if anything fails we keep the
# procedural colour, which already looks right).
def try_ao_refine(obs):
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 16
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "OPTIX"
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            scene.cycles.device = "GPU"
        except Exception:
            scene.cycles.device = "CPU"
        if scene.world is None:
            scene.world = bpy.data.worlds.new("World")
        scene.world.light_settings.distance = 22.0
        for ob in obs:
            me = ob.data
            if "AO" not in me.color_attributes:
                me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
            me.color_attributes.active_color_index = \
                [a.name for a in me.color_attributes].index("AO")
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
            col = me.color_attributes["Col"]; ao = me.color_attributes["AO"]
            n = len(col.data)
            c = np.empty(n * 4, np.float32); a = np.empty(n * 4, np.float32)
            col.data.foreach_get("color", c); ao.data.foreach_get("color", a)
            # gentle AO (floor 0.55): only deepen the valleys, keep the bake's lum
            f = (0.55 + 0.45 * a[0::4]).astype(np.float32)
            for k in range(3):
                c[k::4] *= f
            col.data.foreach_set("color", c)
            me.color_attributes.remove(ao)
            me.color_attributes.active_color_index = \
                [x.name for x in me.color_attributes].index("Col")
            me.update()
            print("PEAKS AO refine ok: " + ob.name)
    except Exception as e:
        print("PEAKS AO refine SKIPPED (" + str(e) + ") -- procedural colour kept")
        for ob in obs:
            if "AO" in ob.data.color_attributes:
                ob.data.color_attributes.remove(ob.data.color_attributes["AO"])

try_ao_refine(objs)

# -- export (geometry + vertex colour, no camera/light) -----------------------
bpy.ops.object.select_all(action="DESELECT")
for ob in objs:
    ob.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_cameras=False, export_animations=False, export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = sum(len(o.data.polygons) for o in objs)
mb = os.path.getsize(GLB_PATH) / 1e6
# bbox over all ridges (Blender space)
bxmin = min(min(v.co.x for v in o.data.vertices) for o in objs)
bxmax = max(max(v.co.x for v in o.data.vertices) for o in objs)
bymin = min(min(v.co.y for v in o.data.vertices) for o in objs)
bymax = max(max(v.co.y for v in o.data.vertices) for o in objs)
bzmin = min(min(v.co.z for v in o.data.vertices) for o in objs)
bzmax = max(max(v.co.z for v in o.data.vertices) for o in objs)
names = ",".join(o.name for o in objs)
print("PEAKS_OK")
print("  meshes = " + names)
print("  quads=%d  (tris ~= %d)  -> %s (%.2f MB)" % (tris, tris * 2, GLB_PATH, mb))
print("  bbox_blender X[%.1f,%.1f] Y[%.1f,%.1f] Z[%.1f,%.1f]"
      % (bxmin, bxmax, bymin, bymax, bzmin, bzmax))
print("  -> web bbox (x,y,z)=(X, Z, -Y): x[%.1f,%.1f] y[%.1f,%.1f] z[%.1f,%.1f]"
      % (bxmin, bxmax, bzmin, bzmax, -bymax, -bymin))
print("  INTENDED PLACEMENT: group scale 1.0, position (0,0,0); ridges already")
print("  sit at web z %.0f..%.0f (behind fog.glb banks at web z -45..-235)," % (-bymax, -bymin))
print("  crests up to web y ~%.0f (above the fog tops ~+8). Tune via ?pkx/?pky/?pkz/?pks." % bzmax)
