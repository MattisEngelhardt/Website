# Sea set for Act I — the brig and the skiff, modelled to match Aivazovsky's
# "Ship at Sunset off Cap Martin". Real 3D geometry the camera and the IFFT
# sea move under, not a flat sprite: a lofted hull, two raked masts with
# square sails on the fore and a gaff main, jibs to the bowsprit, and a small
# open skiff with seated figures for the lower-right of the frame.
#
# Doctrine: production geometry + baked light, exported GEOMETRY-ONLY with a
# vertex-colour attribute (warm back-lit ink, sails a touch lighter where the
# sun shines through). The web scene lights and hazes it; the Kuwahara pass
# finishes it. Two named objects (Brig, Skiff) so the web can float each on
# its own wave.
#
# Run headless:
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/sea_set.py
import bpy, bmesh, math, os
import numpy as np
import mathutils

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "sea")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "sea_assets_raw.glb")

# ── colours (linear, back-lit dusk silhouette) ───────────────────────────
INK = (0.030, 0.024, 0.030)     # hull / masts / rigging — near black, warm
SAIL = (0.40, 0.30, 0.24)       # canvas, sun bleeding through
SAIL_LIT = (0.62, 0.46, 0.33)   # the sun-facing edge of the cloth
FIG = (0.045, 0.035, 0.040)     # the skiff's figures

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── helpers ──────────────────────────────────────────────────────────────
def set_col(me, rgb):
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    n = len(ca.data)
    arr = np.tile(np.array([rgb[0], rgb[1], rgb[2], 1.0], np.float32), n)
    ca.data.foreach_set("color", arr)
    me.color_attributes.active_color_index = \
        [a.name for a in me.color_attributes].index("Col")

def _mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = 0.85
    return m

def add_box(bm, cx, cy, cz, sx, sy, sz):
    """axis box centred at (cx,cy,cz) with half-sizes sx,sy,sz."""
    verts = []
    for dz in (-1, 1):
        for dy in (-1, 1):
            for dx in (-1, 1):
                verts.append(bm.verts.new((cx + dx * sx, cy + dy * sy, cz + dz * sz)))
    faces = [(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6)]
    for f in faces:
        bm.faces.new([verts[i] for i in f])
    return verts

def add_cyl(bm, x0, y0, z0, x1, y1, z1, r, seg=7):
    """a thin cylinder (spar) from p0 to p1."""
    p0 = mathutils.Vector((x0, y0, z0)); p1 = mathutils.Vector((x1, y1, z1))
    axis = (p1 - p0)
    L = axis.length
    if L < 1e-6: return
    axis.normalize()
    # build an orthonormal frame
    up = mathutils.Vector((0, 0, 1))
    if abs(axis.dot(up)) > 0.95: up = mathutils.Vector((1, 0, 0))
    side = axis.cross(up).normalized()
    fwd = axis.cross(side).normalized()
    rings = []
    for end, p in ((0, p0), (1, p1)):
        ring = []
        for a in range(seg):
            ang = a / seg * math.tau
            off = (side * math.cos(ang) + fwd * math.sin(ang)) * r
            ring.append(bm.verts.new((p + off)[:]))
        rings.append(ring)
    for a in range(seg):
        a2 = (a + 1) % seg
        bm.faces.new((rings[0][a], rings[0][a2], rings[1][a2], rings[1][a]))

# a curved sail surface: a quad grid bellied out along its normal
def add_sail(bm, corners, belly=0.5, nu=6, nv=6):
    """corners = [bl, br, tr, tl] (Vectors). Bilinear patch, bulged toward +x
    (downwind, toward the bow which is at +x here)."""
    bl, br, tr, tl = [mathutils.Vector(c) for c in corners]
    grid = [[None]*(nu+1) for _ in range(nv+1)]
    for iv in range(nv+1):
        for iu in range(nu+1):
            u = iu/nu; v = iv/nv
            bottom = bl.lerp(br, u)
            top = tl.lerp(tr, u)
            p = bottom.lerp(top, v)
            # belly: a sine bulge peaking at the centre, pushed +x
            bulge = math.sin(u*math.pi) * math.sin(v*math.pi) * belly
            p.x += bulge
            grid[iv][iu] = bm.verts.new(p[:])
    for iv in range(nv):
        for iu in range(nu):
            bm.faces.new((grid[iv][iu], grid[iv][iu+1],
                          grid[iv+1][iu+1], grid[iv+1][iu]))
    return grid

def finalize(bm, name, rgb, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    set_col(me, rgb)
    me.materials.append(_mat(name + "_mat", rgb))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

# ──────────────────────────────────────────────────────────────────────────
# THE BRIG
# Local frame: +x = bow (forward), +y = port (left), +z = up. Waterline z=0.
# Proportions read off the painting: hull ~ 11 long, masts tall and raked,
# foremast carrying two square sails, main carrying a big gaff sail; jibs to
# a long bowsprit. The whole reads as a backlit silhouette.
# ──────────────────────────────────────────────────────────────────────────
HULL_LEN = 12.5
HULL_BEAM = 1.7   # slimmer — Aivazovsky's brig is sleek, not tubby
HULL_DEPTH = 1.35

def build_hull():
    bm = bmesh.new()
    # lofted hull: stations from stern (x=−L/2) to bow (x=+L/2). A slender
    # clipper-ish hull: fine entry at the bow, low freeboard, graceful sheer.
    # Bow and stern collapse to a single stem/stern vertex so the ends cap
    # cleanly (no facet holes).
    NX = 30
    NS = 7  # half-section samples (mirrored)
    L = HULL_LEN
    rings = []
    bow_v = None
    stern_v = None
    for ix in range(NX + 1):
        t = ix / NX                  # 0 stern … 1 bow
        x = (t - 0.5) * L
        # plan: full amidships, fine entry forward, moderate run aft
        plan = math.sin(min(max(t, 0), 1) * math.pi)
        beam = HULL_BEAM * (plan ** 0.85)
        beam *= (1.0 - 0.55 * max(0.0, t - 0.62) / 0.38)  # fine bow
        # sheer: deck sweeps up gently to bow and stern
        deck_z = 0.30 + 0.30 * (abs(t - 0.46) * 2) ** 1.8
        # keel: deepest amidships, rising to the ends
        keel_z = -HULL_DEPTH * (0.25 + 0.75 * plan ** 0.9)
        if t > 0.90:  # the stem rises proud at the bow
            deck_z += (t - 0.90) * 6.0
        # collapse the very ends to a single point → clean cap
        if ix == NX:
            bow_v = bm.verts.new((x + 0.4, 0.0, deck_z * 0.7))
            rings.append(None); continue
        if ix == 0:
            stern_v = bm.verts.new((x - 0.2, 0.0, deck_z * 0.5))
            rings.append(None); continue
        ring = []
        for iy in range(NS + 1):
            s = iy / NS  # 0 deck edge … 1 keel centre
            y = beam * (1 - s)
            z = deck_z + (keel_z - deck_z) * (s ** 1.6)  # round bilge
            ring.append((x, y, z))
        full = ring + [(x, -yy, zz) for (x, yy, zz) in reversed(ring[:-1])]
        rings.append([bm.verts.new(p) for p in full])
    # skin between adjacent rings
    real = [(i, r) for i, r in enumerate(rings) if r is not None]
    for k in range(len(real) - 1):
        a = real[k][1]; b = real[k + 1][1]
        M = len(a)
        for iy in range(M - 1):
            bm.faces.new((a[iy], a[iy+1], b[iy+1], b[iy]))
        # close the section loop (deck-port ↔ deck-stbd) along the top
        bm.faces.new((a[0], b[0], b[-1], a[-1]))
    # fan-cap the bow and stern to their single vertices
    first = real[0][1]; last = real[-1][1]
    for iy in range(len(first) - 1):
        bm.faces.new((stern_v, first[iy + 1], first[iy]))
    for iy in range(len(last) - 1):
        bm.faces.new((bow_v, last[iy], last[iy + 1]))
    return finalize(bm, "BrigHull", INK, smooth=True)

def build_rig():
    """masts, yards, bowsprit, rigging — all ink spars. Tall and elegant,
    raked slightly aft, proportioned off the painting (mast ≈ hull length)."""
    bm = bmesh.new()
    # masts rake aft (toward −x). Foremast forward, mainmast aft.
    fore_base = (2.6, 0.0, 0.4); fore_top = (1.7, 0.0, 11.4)
    main_base = (-1.8, 0.0, 0.5); main_top = (-2.9, 0.0, 12.8)
    add_cyl(bm, *fore_base, *fore_top, 0.085)
    add_cyl(bm, *main_base, *main_top, 0.090)
    # topmast extensions (thinner) above each — the elegant tapering look
    add_cyl(bm, 1.7, 0.0, 11.4, 1.5, 0.0, 13.0, 0.05)
    add_cyl(bm, -2.9, 0.0, 12.8, -3.1, 0.0, 14.3, 0.05)
    # bowsprit reaching forward-up from the stem (long, fine)
    add_cyl(bm, 5.6, 0.0, 0.9, 10.6, 0.0, 2.3, 0.075)
    # fore yards (square-sail spars), athwartship (along y)
    add_cyl(bm, 2.20, -3.0, 7.6, 2.20, 3.0, 7.6, 0.06)   # lower (course) yard
    add_cyl(bm, 1.92, -2.3, 10.0, 1.92, 2.3, 10.0, 0.05) # topsail yard
    # main gaff (angled spar aft) + boom (low, aft)
    add_cyl(bm, -2.4, 0.0, 8.4, -6.2, 0.0, 11.8, 0.06)   # gaff
    add_cyl(bm, -2.0, 0.0, 1.3, -6.6, 0.0, 1.9, 0.06)    # boom
    return finalize(bm, "BrigRig", INK, smooth=True)

def build_sails():
    bm = bmesh.new()
    # FORE COURSE (lower square sail): hangs below the lower yard, billowed
    add_sail(bm, [(2.20,-2.8,3.6),(2.20,2.8,3.6),(2.20,2.9,7.5),(2.20,-2.9,7.5)],
             belly=1.1)
    # FORE TOPSAIL (upper square sail)
    add_sail(bm, [(1.95,-2.2,7.9),(1.95,2.2,7.9),(1.95,2.2,9.9),(1.95,-2.2,9.9)],
             belly=0.75)
    return finalize(bm, "BrigSailsSquare", SAIL, smooth=True)

def build_main_sail():
    bm = bmesh.new()
    # MAIN GAFF SAIL: a tall quad between the mast, the boom and the gaff —
    # fore-and-aft sail, billowed to port.
    bl = mathutils.Vector((-1.9, 0.05, 1.5))   # tack (mast foot at boom)
    br = mathutils.Vector((-6.3, 0.05, 1.9))   # clew (boom end)
    tr = mathutils.Vector((-6.0, 0.05, 11.5))  # peak (gaff end)
    tl = mathutils.Vector((-2.7, 0.05, 8.6))   # throat (mast at gaff)
    nu=nv=7
    grid=[[None]*(nu+1) for _ in range(nv+1)]
    for iv in range(nv+1):
        for iu in range(nu+1):
            u=iu/nu; v=iv/nv
            p=bl.lerp(br,u).lerp(tl.lerp(tr,u),v)
            p.y += math.sin(u*math.pi)*math.sin(v*math.pi)*0.9
            grid[iv][iu]=bm.verts.new(p[:])
    for iv in range(nv):
        for iu in range(nu):
            bm.faces.new((grid[iv][iu],grid[iv][iu+1],grid[iv+1][iu+1],grid[iv+1][iu]))
    return finalize(bm, "BrigSailMain", SAIL, smooth=True)

def build_jibs():
    bm = bmesh.new()
    # two triangular headsails from the bowsprit to the foremast, gently
    # billowed. Subdivided barycentric triangle so the belly reads.
    def tri(a, b, c, belly):
        va = mathutils.Vector(a); vb = mathutils.Vector(b); vc = mathutils.Vector(c)
        n = 4
        grid = {}
        for i in range(n + 1):
            for j in range(n + 1 - i):
                k = n - i - j
                p = (va * i + vb * j + vc * k) / n
                bary = (min(i, j, k) / n) * 3.0  # 0 at edges, 1 at centroid
                p.y += bary * belly
                grid[(i, j)] = bm.verts.new(p[:])
        for i in range(n):
            for j in range(n - i):
                bm.faces.new((grid[(i, j)], grid[(i + 1, j)], grid[(i, j + 1)]))
                if (i + 1, j + 1) in grid:
                    bm.faces.new((grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)]))
    tri((10.4, 0.04, 2.2), (2.7, 0.04, 9.6), (5.0, 0.04, 1.0), 0.5)    # outer jib
    tri((7.6, -0.04, 1.7), (2.7, -0.04, 8.0), (3.7, -0.04, 0.9), 0.4)  # inner jib
    return finalize(bm, "BrigJibs", SAIL, smooth=True)

hull = build_hull()
rig = build_rig()
sq = build_sails()
mainsl = build_main_sail()
jibs = build_jibs()

# join the brig parts into one object named "Brig"
bpy.ops.object.select_all(action="DESELECT")
for ob in (hull, rig, sq, mainsl, jibs):
    ob.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.object.join()
brig = bpy.context.view_layer.objects.active
brig.name = "Brig"

# ──────────────────────────────────────────────────────────────────────────
# THE SKIFF — small open rowboat with seated figures, lower-right of frame.
# Built around its own origin so the web floats it separately.
# ──────────────────────────────────────────────────────────────────────────
def build_skiff():
    bm = bmesh.new()
    L = 3.6; B = 1.1; D = 0.55
    NX = 12; NS = 5
    stations = []
    for ix in range(NX + 1):
        t = ix / NX
        x = (t - 0.5) * L
        beam = B * (0.25 + 0.75 * math.sin(min(max(t,0),1)*math.pi) ** 0.8)
        deck_z = 0.18 + 0.18 * (abs(t-0.5)*2) ** 1.6
        keel_z = -D * (0.3 + 0.7 * math.sin(min(max(t,0),1)*math.pi))
        ring = []
        for iy in range(NS + 1):
            s = iy / NS
            y = beam * (1 - s)
            z = deck_z + (keel_z - deck_z) * (s ** 1.4)
            ring.append((x, y, z))
        full = ring + [(x, -yy, zz) for (x, yy, zz) in reversed(ring[:-1])]
        stations.append([bm.verts.new(p) for p in full])
    M = len(stations[0])
    for ix in range(NX):
        a = stations[ix]; b = stations[ix + 1]
        for iy in range(M - 1):
            bm.faces.new((a[iy], a[iy+1], b[iy+1], b[iy]))
    sk = finalize(bm, "SkiffHull", INK, smooth=True)
    # figures: little seated blocks down the centreline
    fb = bmesh.new()
    for i, fx in enumerate((-1.0, -0.3, 0.4, 1.1)):
        add_box(fb, fx, 0.0, 0.5, 0.16, 0.22, 0.28)        # torso
        add_box(fb, fx, 0.0, 0.86, 0.12, 0.13, 0.12)       # head
    figs = finalize(fb, "SkiffFigures", FIG, smooth=False)
    # a couple of oars
    ob = bmesh.new()
    add_cyl(ob, 0.0, 0.6, 0.45, 1.7, 1.6, -0.2, 0.04)
    add_cyl(ob, 0.0, -0.6, 0.45, 1.7, -1.6, -0.2, 0.04)
    oars = finalize(ob, "SkiffOars", INK, smooth=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (sk, figs, oars):
        o.select_set(True)
    bpy.context.view_layer.objects.active = sk
    bpy.ops.object.join()
    s = bpy.context.view_layer.objects.active
    s.name = "Skiff"
    return s

skiff = build_skiff()

# ── AO bake (Cycles/OPTIX → vertex colours) on both objects ───────────────
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("BAKE device: GPU/OPTIX")
except Exception as e:
    scene.cycles.device = "CPU"
    print(f"BAKE device: CPU ({e})")

if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.light_settings.distance = 6.0

def bake_ao(ob, floor=0.30):
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
    f = (floor + (1 - floor) * a[0::4]).astype(np.float32)
    for k in range(3):
        c[k::4] *= f
    col.data.foreach_set("color", c)
    me.color_attributes.remove(ao)
    me.color_attributes.active_color_index = \
        [x.name for x in me.color_attributes].index("Col")
    me.update()
    print(f"BAKE ok: {ob.name} ({n} loops)")

for ob in (brig, skiff):
    try:
        bake_ao(ob)
    except Exception as e:
        print(f"BAKE FAILED {ob.name}: {e}")
        if "AO" in ob.data.color_attributes:
            ob.data.color_attributes.remove(ob.data.color_attributes["AO"])

# ── export GEOMETRY-ONLY ──────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for ob in (brig, skiff):
    ob.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_cameras=False, export_animations=False,
              export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = sum(len(o.data.polygons) for o in (brig, skiff))
mb = os.path.getsize(GLB_PATH) / 1e6
print(f"SEA_SET_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
