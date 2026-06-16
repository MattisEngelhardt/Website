# Carved museum gold-frame for the Friedrich lobby — real swept molding, baked.
# Doctrine: production geometry + baked light, not procedural code-paint.
# We replace the four flat photo-planes (whose TSL "bevel" is a flat gradient
# fake — it smears to plastic yellow under Kuwahara) with ONE real museum frame:
# a genuine swept molding cross-section (outer lip → ogee → cove → bead →
# recessed rabbet) carried around a mitred 3:2 rectangular opening, with a flat
# back and the inner rabbet face the artwork sits against. The gold leaf carries
# a BAKED gilt directional light (low sun raking from the top-left, falling to
# shadow lower-right) plus Cycles AO in the recesses — so it reads as carved
# gilt wood, not a yellow border. Unlit + vertex-colour on the web, finished by
# the Kuwahara painterly pass. The web instances this one GLB four times and
# swaps only the artwork texture per block.
#
# Run headless (no socket needed, no GUI conflict):
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/frame_set.py
import bpy, bmesh, math, os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "lobby")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "frame.glb")

# ── opening + molding geometry constants (local units) ───────────────
# The opening (the artwork window) is 3:2 landscape so the web's PLATE_RATIO
# (height = width * 2/3) drops straight in. Centred at origin, facing +Z.
OPEN_W = 3.0          # opening width  (X)
OPEN_H = 2.0          # opening height (Y)  → 3:2
BORDER = 0.52         # molding border width — wide museum gilt, reads at distance
DEPTH  = 0.30         # molding depth (how far the front face stands proud of the back, +Z)
BACK_Z = 0.0          # the flat back of the frame sits at z = 0
FRONT_Z = DEPTH       # the front-most lip sits at z = DEPTH
RABBET_INSET = 0.06   # how far the rabbet lip overlaps the opening edge (holds the art)
RABBET_Z = DEPTH * 0.30  # z of the rabbet face the art rests against (recessed from front)

# ── the molding cross-section profile ────────────────────────────────
# A 2-D polyline (off, z): `off` = outward offset from the opening edge
# (0 = at the opening rim, +BORDER = the outer edge of the frame); `z` = depth
# in Blender +Z (0 = flat back plane, DEPTH = front-most). We walk it from the
# INNER rabbet, up over the carved face, out to the outer lip, then down the
# outside wall to the back — so the swept strip is a continuous carved band.
#
# Reading inner→outer along the face you get the classic museum silhouette:
#   rabbet floor → rabbet riser → bead (small round) → cove (concave scoop) →
#   ogee (S-curve: hollow then round) → outer fillet → outer lip (top corner) →
#   outer wall down to the back.
# Tuned so the carved relief reads under Kuwahara without exploding the tri count.
def _ogee(n, off0, off1, z0, z1):
    """An S-curve (cyma reversa): concave near the inside, convex near the out."""
    pts = []
    for i in range(1, n + 1):
        t = i / (n + 1)
        # smootherstep gives the hollow-then-round S read
        s = t * t * t * (t * (t * 6 - 15) + 10)
        # bias the curve so it dips (cove-ish) early then swells (round) late
        z = z0 + (z1 - z0) * s
        off = off0 + (off1 - off0) * t
        pts.append((off, z))
    return pts

def _cove(n, off0, off1, z0, z1):
    """A concave quarter-scoop (hollow) — the cove between bead and ogee."""
    pts = []
    for i in range(1, n + 1):
        t = i / (n + 1)
        # quarter-circle hollow: stays low then rises (concave)
        c = 1.0 - math.cos(t * math.pi * 0.5)
        z = z0 + (z1 - z0) * c
        off = off0 + (off1 - off0) * (1.0 - math.cos(t * math.pi * 0.5))
        pts.append((off, z))
    return pts

def _bead(n, off0, off1, z0, zpeak):
    """A small convex round (bead) that bumps proud then settles."""
    pts = []
    for i in range(1, n + 1):
        t = i / (n + 1)
        z = z0 + (zpeak - z0) * math.sin(t * math.pi)  # up-and-over half-round
        off = off0 + (off1 - off0) * t
        pts.append((off, z))
    return pts

def build_profile():
    """Return the carved cross-section as an ordered list of (off, z) points,
    inner (rabbet) → outer-wall (back). Off is outward from the opening edge."""
    p = []
    # 1) rabbet floor — the recessed shelf the art plane sits on. Runs INWARD
    #    of the opening rim (negative offset) so the molding overlaps the art.
    p.append((-RABBET_INSET, RABBET_Z))           # under the artwork edge
    p.append((0.0,            RABBET_Z))           # rabbet floor reaches the rim
    # 2) rabbet riser — a short vertical wall up from the floor to the bead
    p.append((0.015,          RABBET_Z + 0.045))
    # 3) bead — small convex round just inside the face
    p += _bead(3, 0.015, 0.065, RABBET_Z + 0.045, RABBET_Z + 0.105)
    p.append((0.065,          RABBET_Z + 0.070))   # settle off the bead
    # 4) cove — concave scoop rising toward the ogee
    p += _cove(4, 0.065, 0.150, RABBET_Z + 0.070, DEPTH * 0.62)
    # 5) ogee — the S-curve sweep, the main carved face, up to near the front
    p += _ogee(5, 0.150, 0.255, DEPTH * 0.62, FRONT_Z)
    # 6) outer fillet + lip — a flat then a tiny chamfered top corner at the front
    p.append((0.275,          FRONT_Z))            # flat outer fillet at full depth
    p.append((BORDER - 0.010, FRONT_Z - 0.012))    # chamfer the outer top corner
    # 7) outer wall — straight down the outside face to the flat back
    p.append((BORDER,         FRONT_Z - 0.030))
    p.append((BORDER,         BACK_Z))             # outer edge meets the back plane
    return p

# ── scene reset ──────────────────────────────────────────────────────
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

def _mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = 0.55  # gilt leaf: a touch of sheen
    return m

# ── sweep the profile around the rectangular opening path ────────────
# Strategy: parameterise the rectangle perimeter into stations. At each station
# we have an inward-pointing 2-D normal (the direction the profile's `off` axis
# points OUTWARD from the opening, i.e. away from centre). We place the carved
# cross-section perpendicular to the path at that station: each profile point
# (off, z) becomes a 3-D vertex at  rim + outward*off  (with z as given). Then
# we bridge consecutive stations with quads. Corners are handled by mitring:
# at each of the 4 corners the two adjacent edges meet at a shared corner
# station whose outward direction is the 45° bisector, and `off` is scaled by
# 1/cos(45°) so the mitre closes cleanly (standard picture-frame mitre).
#
# The opening rim is the rectangle  x in [-OPEN_W/2, OPEN_W/2],
#                                    y in [-OPEN_H/2, OPEN_H/2].
HW, HH = OPEN_W / 2.0, OPEN_H / 2.0
SEG_PER_SIDE_X = 10   # subdivisions along each horizontal run
SEG_PER_SIDE_Y = 7    # subdivisions along each vertical run

def _rim_point(side, t):
    """A point on the opening rim and its OUTWARD unit direction (away from
    centre), for a given side and parameter t in [0,1]. Corners are emitted
    once (at the end of each side) with a 45° bisector + mitre scale."""
    # corners, CCW from top-right: TR, TL, BL, BR
    if side == 0:   # top edge, going LEFT-to-RIGHT is awkward; go around CCW:
        pass
    # We build sides CCW: bottom (L→R), right (B→T), top (R→L), left (T→B).
    if side == "bottom":
        x = -HW + t * OPEN_W;  y = -HH;  out = (0.0, -1.0);  scale = 1.0
    elif side == "right":
        x = HW;  y = -HH + t * OPEN_H;  out = (1.0, 0.0);  scale = 1.0
    elif side == "top":
        x = HW - t * OPEN_W;  y = HH;  out = (0.0, 1.0);  scale = 1.0
    elif side == "left":
        x = -HW;  y = HH - t * OPEN_H;  out = (-1.0, 0.0);  scale = 1.0
    return (x, y), out, scale

def _corner(name):
    """Corner rim point + 45° outward bisector + mitre scale (1/cos45)."""
    s2 = 1.0 / math.cos(math.radians(45.0))  # = sqrt(2)
    if name == "BR":   # bottom-right
        return (HW, -HH), (s2 * 0.70710678, -s2 * 0.70710678)
    if name == "TR":   # top-right
        return (HW, HH), (s2 * 0.70710678, s2 * 0.70710678)
    if name == "TL":   # top-left
        return (-HW, HH), (-s2 * 0.70710678, s2 * 0.70710678)
    if name == "BL":   # bottom-left
        return (-HW, -HH), (-s2 * 0.70710678, -s2 * 0.70710678)

def build_frame():
    profile = build_profile()
    P = len(profile)
    bm = bmesh.new()

    # Build the ordered list of perimeter STATIONS going CCW. Each station is
    # (rim_xy, outward_dir). Corners are inserted once between sides as the
    # mitred bisector station so the four runs join without gaps.
    stations = []
    # bottom edge BL→BR (interior stations only; corners added explicitly)
    stations.append(_corner("BL"))
    for i in range(1, SEG_PER_SIDE_X):
        rim, out, sc = _rim_point("bottom", i / SEG_PER_SIDE_X)
        stations.append((rim, out))
    stations.append(_corner("BR"))
    # right edge BR→TR
    for i in range(1, SEG_PER_SIDE_Y):
        rim, out, sc = _rim_point("right", i / SEG_PER_SIDE_Y)
        stations.append((rim, out))
    stations.append(_corner("TR"))
    # top edge TR→TL
    for i in range(1, SEG_PER_SIDE_X):
        rim, out, sc = _rim_point("top", i / SEG_PER_SIDE_X)
        stations.append((rim, out))
    stations.append(_corner("TL"))
    # left edge TL→BL
    for i in range(1, SEG_PER_SIDE_Y):
        rim, out, sc = _rim_point("left", i / SEG_PER_SIDE_Y)
        stations.append((rim, out))
    # (loop closes back to BL — handled by wrap-around below)

    S = len(stations)
    # 3-D vertex grid: rings[s][p]
    rings = [[None] * P for _ in range(S)]
    for s in range(S):
        (rx, ry), (ox, oy) = stations[s]
        for k, (off, z) in enumerate(profile):
            vx = rx + ox * off
            vy = ry + oy * off
            rings[s][k] = bm.verts.new((vx, vy, z))

    # Bridge consecutive rings with quads (wrap the last → first to close).
    for s in range(S):
        s2 = (s + 1) % S
        for k in range(P - 1):
            bm.faces.new((rings[s][k], rings[s][k + 1],
                          rings[s2][k + 1], rings[s2][k]))

    # ── flat BACKING panel behind the rabbet (the frame has a real back) ──
    # A thin plane filling the opening at the back plane z = BACK_Z, slightly
    # overlapping the rabbet inset so there is no gap. Two tris (a quad).
    bx, by = HW - RABBET_INSET + 0.002, HH - RABBET_INSET + 0.002
    b0 = bm.verts.new((-bx, -by, BACK_Z))
    b1 = bm.verts.new(( bx, -by, BACK_Z))
    b2 = bm.verts.new(( bx,  by, BACK_Z))
    b3 = bm.verts.new((-bx,  by, BACK_Z))
    bm.faces.new((b0, b1, b2, b3))

    # ── flat inner RABBET face the art rests against ──────────────────
    # A plane at z = RABBET_Z spanning the opening (out to the rabbet lip), so
    # the artwork plane (web: art.position.z = DEPTH/2) seats on a real shelf.
    rx2, ry2 = HW - RABBET_INSET, HH - RABBET_INSET
    r0 = bm.verts.new((-rx2, -ry2, RABBET_Z))
    r1 = bm.verts.new(( rx2, -ry2, RABBET_Z))
    r2 = bm.verts.new(( rx2,  ry2, RABBET_Z))
    r3 = bm.verts.new((-rx2,  ry2, RABBET_Z))
    bm.faces.new((r0, r1, r2, r3))

    # Smooth shading reads the ogee/cove as a carved sweep (flat would facet it).
    for f in bm.faces:
        f.smooth = True

    # rich, bright gilt leaf so the molding reads against the luminous sky
    return finalize(bm, "Frame", (0.92, 0.70, 0.34))

ob_frame = build_frame()

# ── bake a directional GILT term into 'Col' from the loop normals ────
# Before AO, fold a baked directional light into the vertex colour so the gold
# catches a LOW SUN on its top-left and falls to shadow lower-right. We compute
# it procedurally from each loop's normal · sun-dir (numpy, no second bake):
# faces tilted up-and-left toward the sun brighten; faces tilted down/right or
# tucked into the recesses darken. Tasteful range so it reads as carved gilt
# wood, not chrome.
SUN = np.array([-0.5, 0.6, 0.5], np.float32)
SUN /= np.linalg.norm(SUN)

def gilt_directional(ob, lo=0.62, hi=1.30):
    me = ob.data
    # Per-loop (split) normals carry the carved relief. Blender 4.1+ computes
    # them automatically (the calc_normals_split() call was removed); just read
    # them. If the loop normals are unpopulated for any reason, fall back to the
    # vertex normal of each loop's vertex so the term still works.
    me.update()
    loops = me.loops
    n = len(loops)
    nrm = np.empty(n * 3, np.float32)
    loops.foreach_get("normal", nrm)
    nrm = nrm.reshape(n, 3)
    if not np.any(np.abs(nrm) > 1e-6):  # loop normals empty → use vertex normals
        vidx = np.empty(n, np.int32)
        loops.foreach_get("vertex_index", vidx)
        vn = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("normal", vn)
        nrm = vn.reshape(-1, 3)[vidx]
    d = nrm @ SUN                       # -1..1 : alignment with the sun
    t = np.clip(d * 0.5 + 0.5, 0.0, 1.0)
    fac = (lo + (hi - lo) * (t ** 1.15)).astype(np.float32)  # gamma-ish lift
    col = me.color_attributes["Col"]
    c = np.empty(n * 4, np.float32)
    col.data.foreach_get("color", c)
    for k in range(3):
        c[k::4] *= fac
    np.clip(c, 0.0, 1.0, out=c)
    col.data.foreach_set("color", c)
    me.update()
    print(f"GILT directional ok: {ob.name} ({n} loops)")

# ── AO bake (Cycles/OPTIX → vertex colours) so the recesses darken ───
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
scene.world.light_settings.distance = 1.2  # small frame → short AO distance

def bake_ao(ob, floor=0.30):
    me = ob.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("AO")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    # Col *= (floor + (1-floor)*AO) — recessed rabbet/cove fall to shadow
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

# directional gilt first (multiplies the flat gold), then AO on top of it
try:
    gilt_directional(ob_frame)
except Exception as e:
    print(f"GILT FAILED {ob_frame.name}: {e}")

try:
    bake_ao(ob_frame)
except Exception as e:
    print(f"BAKE FAILED {ob_frame.name}: {e}")
    if "AO" in ob_frame.data.color_attributes:
        ob_frame.data.color_attributes.remove(ob_frame.data.color_attributes["AO"])

# ── export ───────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
ob_frame.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_cameras=False, export_animations=False, export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = len(ob_frame.data.polygons)
mb = os.path.getsize(GLB_PATH) / 1e6
print(f"FRAME_SET_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
