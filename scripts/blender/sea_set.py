# Sea set for Act I -- the BRIG (a richly-rigged ~1820s tall ship) rebuilt
# EXTREM detailliert, plus the small skiff. Reference: Aivazovsky's backlit
# ships (assets-src/paintings/aivazovsky_capmartin_3882.jpg) -- a richly-rigged
# tall ship crossing in front of the low sun, a lace of masts, spars and
# rigging in silhouette. The magic is the RIGGING LACE against the sky, so this
# build spends almost its whole tri budget on SILHOUETTE detail:
#   * a planked carvel hull with real sheer, wales, bulwarks + caprail,
#     channels, a carved transom + headrails/trailboards at the stem;
#   * a full bowsprit + jibboom with dolphin striker + bobstays;
#   * THREE masts, each lower-mast + top + crosstrees + topmast + topgallant
#     mast + royal pole, with yards (course/topsail/topgallant/royal) and
#     footropes on every yard;
#   * many CAMBERED square sails (belly + foot scallop + reef bands), staysails
#     and jibs between the masts, and a gaff spanker aft;
#   * DENSE standing rigging: shrouds with realistic spacing AND ratlines across
#     every shroud panel (the signature lace), fore/back/topmast stays, bobstay,
#     plus a sampling of running rigging (halyards/braces/sheets);
#   * deck furniture readable in silhouette: capstan, helm/wheel, ship's boat on
#     skids, hatches, fife rails, belaying pins, a binnacle; an ensign +
#     masthead pennants streaming.
#
# Doctrine: production geometry + baked light, exported GEOMETRY-ONLY with a
# vertex-colour attribute ("Col"): a DARK back-lit ink hull/rig/rigging, sails a
# touch lighter where the sun bleeds through, a warm up-sun rim baked by hand.
# The web renders it cheap (unlit, reading attribute('color')) and the scene's
# grade / Kuwahara finishes it (the gilt comes from haze-to-gold + dark verts).
#
# Two named objects so the web floats each on its own wave:
#   Brig    (hull + rig + sails + rigging + furniture, joined)
#   Skiff   (small open boat + figures + oars, joined)
# NAMES ARE LOAD-BEARING: src/scenes/sea.ts does getObjectByName('Brig'|'Skiff').
#
# LOCAL FRAME (Blender): +X = bow (forward), +Y = port (left), +Z = up.
#   Waterline at z = 0; the hull is modelled with real draft BELOW z=0; the
#   waterline footprint is kept roughly symmetric about the origin (the web
#   sinks the hull by SHIP.draft and floats it on its own wave).
# glTF axis map: Blender (x,y,z) -> glTF (x, z, -y) with export_yup=True, i.e.
#   Blender +Z(up) -> glTF +Y(up)   [loads upright]
#   Blender +X(bow) -> glTF +X       [HEADING AXIS = +X in the loaded GLB]
#   Blender +Y(port)-> glTF -Z
# => In the web, an un-rotated Brig points its bow toward glTF +X. To make it
#    cross laterally (L->R) the web yaws it about Y so the bow follows +X path.
#
# Run headless (the orchestrator drives this; this script does NOT run shells):
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/sea_set.py
# Export -> assets-src/sea/sea_assets_raw.glb ; the orchestrator meshopt-
# compresses to public/assets/sea/sea_assets.glb with the LOCKED flags
#   gltf-transform optimize ... --compress meshopt --simplify false
#       --palette false --join false --flatten false
import bpy, bmesh, math, os
import numpy as np
import mathutils

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "sea")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "sea_assets_raw.glb")

# =========================================================================
# TUNABLE KNOBS -- every number Mattis can turn lives here at the top.
# =========================================================================
# -- hull -----------------------------------------------------------------
HULL_LEN   = 13.0     # stem to transom along +X (web SHIP.halfLen ~ HULL_LEN/2)
HULL_BEAM  = 1.85     # max full beam; slim clipper-ish hull
HULL_DEPTH = 1.55     # keel depth below waterline at amidships
FREEBOARD  = 0.78     # deck height above waterline amidships
BULWARK_H  = 0.30     # rail wall height above the deck edge
# -- masts (x = fore..aft position, base/head z, rake aft per metre up) ----
#   Three masts. Each entry: foot_x, foot_z, head heights and taper handled
#   inside build_rig() via the MASTS table.
RAKE       = 0.085    # masts lean aft (toward -X) this many metres per metre up
MAST_SCALE = 1.0      # global multiplier on every mast/yard HEIGHT (silhouette)
# -- rigging lace ---------------------------------------------------------
SHROUDS_PER_SIDE_LOWER = 9   # lower shrouds each side per mast (more = denser)
SHROUDS_PER_SIDE_TOP   = 6   # topmast shrouds each side per mast
RATLINE_DZ   = 0.30   # vertical spacing of ratlines (smaller = MORE lace)
RIG_R        = 0.018  # standing-rigging tube radius (thin = fine lace)
RAT_R        = 0.013  # ratline tube radius (thinner)
RIG_SEG      = 6      # sides per rigging tube (the lace dominates the tri count)
# -- sails ----------------------------------------------------------------
SAIL_SET   = True     # True = sails SET (drawing, cambered); False = furled bundles
SAIL_NU    = 14       # sail grid columns (across the yard) -- belly resolution
SAIL_NV    = 11       # sail grid rows (head->foot) -- reef-band resolution
REEF_BANDS = True     # crease the cloth at reef bands (adds silhouette ripple)

# -- colours (linear, back-lit dusk silhouette) ---------------------------
# Near-black warm wood for the hull/rig/rigging so it reads as a silhouette;
# the AO bake darkens the recesses, the warm sun-side rim is added by hand on
# the up-sun faces. Sails glow where the low sun bleeds through.
INK       = (0.030, 0.024, 0.030)   # hull planking / masts / rigging
INK_WALE  = (0.018, 0.014, 0.018)   # wales + bulwark cap -- darker accent line
DECK      = (0.055, 0.043, 0.038)   # deck planking, a touch warmer/lighter
RIM       = (0.085, 0.060, 0.040)   # warm sun-side rim tint (mixed in by face)
SAIL      = (0.40, 0.30, 0.24)      # canvas, sun bleeding through
SAIL_LIT  = (0.62, 0.46, 0.33)      # the sun-facing edge of the cloth
FIG       = (0.045, 0.035, 0.040)   # the skiff's figures
PENNANT   = (0.55, 0.40, 0.30)      # ensign / masthead pennant cloth

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# =========================================================================
# helpers (mirroring summit_set.py / city_set.py idioms)
# =========================================================================
def set_col(me, rgb):
    """flat CORNER float colour attribute 'Col' on a whole mesh."""
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

# Per-bmesh vertex-colour layer idiom (city_set.py): build with a "Col" loop
# layer so we can tint individual faces (deck vs wale vs sun-rim) before the
# mesh exists, then finalize keeps that attribute.
def new_bm():
    bm = bmesh.new()
    col = bm.loops.layers.float_color.new("Col")
    return bm, col

def face_col(face, layer, c):
    for lo in face.loops:
        lo[layer] = (c[0], c[1], c[2], 1.0)

def add_box(bm, layer, cx, cy, cz, sx, sy, sz, col):
    """axis box centred at (cx,cy,cz) with half-sizes; tinted col."""
    verts = []
    for dz in (-1, 1):
        for dy in (-1, 1):
            for dx in (-1, 1):
                verts.append(bm.verts.new((cx + dx * sx, cy + dy * sy, cz + dz * sz)))
    faces = [(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6)]
    for f in faces:
        fc = bm.faces.new([verts[i] for i in f])
        face_col(fc, layer, col)

def add_cyl(bm, layer, x0, y0, z0, x1, y1, z1, r, col, seg=8, taper=1.0,
            cap=False):
    """a cylinder (spar / line) from p0 to p1; r1 = r, r2 = r*taper.
    cap=True closes both ends with a fan (use for stout spars/posts)."""
    p0 = mathutils.Vector((x0, y0, z0)); p1 = mathutils.Vector((x1, y1, z1))
    axis = (p1 - p0)
    L = axis.length
    if L < 1e-6:
        return
    axis.normalize()
    up = mathutils.Vector((0, 0, 1))
    if abs(axis.dot(up)) > 0.95:
        up = mathutils.Vector((1, 0, 0))
    side = axis.cross(up).normalized()
    fwd = axis.cross(side).normalized()
    rings = []
    for end, (p, rr) in enumerate(((p0, r), (p1, r * taper))):
        ring = []
        for a in range(seg):
            ang = a / seg * math.tau
            off = (side * math.cos(ang) + fwd * math.sin(ang)) * rr
            ring.append(bm.verts.new((p + off)[:]))
        rings.append(ring)
    for a in range(seg):
        a2 = (a + 1) % seg
        fc = bm.faces.new((rings[0][a], rings[0][a2], rings[1][a2], rings[1][a]))
        face_col(fc, layer, col)
    if cap:
        for end, ring in enumerate(rings):
            c = bm.verts.new((p0 if end == 0 else p1)[:])
            order = ring if end == 1 else list(reversed(ring))
            for a in range(seg):
                a2 = (a + 1) % seg
                fc = bm.faces.new((c, order[a], order[a2]))
                face_col(fc, layer, col)

def add_line(bm, layer, p0, p1, r, col, seg=None):
    """a very thin tube for rigging (cheap: RIG_SEG sides)."""
    s = RIG_SEG if seg is None else seg
    add_cyl(bm, layer, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], r, col, seg=s)

def add_catenary(bm, layer, p0, p1, r, col, sag, n=5):
    """a hanging line (footrope / slack stay) sagging -Z by `sag` at midspan."""
    a = mathutils.Vector(p0); b = mathutils.Vector(p1)
    prev = a
    for i in range(1, n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z -= math.sin(t * math.pi) * sag
        add_line(bm, layer, prev[:], p[:], r, col)
        prev = p

# a curved (cambered) square sail: a quad grid bellied along the wind. The
# wind blows toward the bow (+X) here, so the belly bulges +X; the foot droops
# a little under its own weight, and (optionally) reef bands crease the cloth.
def add_square_sail(bm, layer, x, y_half, z_bot, z_top, belly,
                    col, lit_col, nu=None, nv=None, furl=False):
    """A square sail hung across the yard at height z_top, reaching to z_bot.
    Spans y in [-y_half, +y_half]; cambered toward +X by `belly`. Sun-side
    (port, +y, toward the sun in the web) edge tinted lighter. If furl=True the
    cloth is gathered up to the yard as a scalloped bundle."""
    nu = SAIL_NU if nu is None else nu
    nv = SAIL_NV if nv is None else nv
    grid = [[None] * (nu + 1) for _ in range(nv + 1)]
    H = (z_top - z_bot)
    for iv in range(nv + 1):
        for iu in range(nu + 1):
            u = iu / nu          # 0 stbd edge .. 1 port edge
            v = iv / nv          # 0 foot .. 1 head (yard)
            yy = (u * 2 - 1) * y_half
            if furl:
                # gathered to the yard: a knobbly scalloped roll just under z_top
                roll = 0.18 + 0.10 * math.sin(u * math.pi * 6.0)
                zz = z_top - (1 - v) * roll
                bulge = math.sin(u * math.pi * 6.0) * 0.06 + 0.18 * (1 - v)
                grid[iv][iu] = bm.verts.new((x + bulge, yy, zz))
                continue
            zz = z_bot + H * v
            # belly: sine bulge peaking centre, pushed +X (downwind)
            bulge = math.sin(u * math.pi) * math.sin(v * math.pi) * belly
            # reef-band crease: a small periodic pinch across the cloth height
            if REEF_BANDS:
                bulge += math.sin(v * math.pi * 3.0) * 0.04 * math.sin(u * math.pi)
            # foot scallop: the unfooted clew droops between the corners
            droop = (1.0 - v) * math.sin(u * math.pi) * 0.12 * H
            grid[iv][iu] = bm.verts.new((x + bulge, yy, zz - droop * (1 - v)))
    for iv in range(nv):
        for iu in range(nu):
            fc = bm.faces.new((grid[iv][iu], grid[iv][iu + 1],
                               grid[iv + 1][iu + 1], grid[iv + 1][iu]))
            # tint the up-sun (port / +y => high u) third lighter
            u_mid = (iu + 0.5) / nu
            c = lit_col if u_mid > 0.66 else col
            face_col(fc, layer, c)
    return grid

def finalize(name, bm, rgb_fallback, smooth=True):
    """Turn a bmesh that already carries a 'Col' loop layer into an object."""
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    if "Col" not in me.color_attributes:
        set_col(me, rgb_fallback)
    else:
        me.color_attributes.active_color_index = \
            [a.name for a in me.color_attributes].index("Col")
    me.materials.append(_mat(name + "_mat", rgb_fallback))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

# =========================================================================
# HULL station shape -- proportions read off Aivazovsky's backlit ships.
# Sleek, sheer rising to bow and stern, fine entry, narrow transom.
# =========================================================================
def sheer_z(t):
    """deck-edge height above waterline along the hull (t: 0 stern .. 1 bow).
    Graceful sheer: rises to bow and stern, lowest just abaft amidships."""
    s = (abs(t - 0.42) * 2.0) ** 1.7
    z = FREEBOARD + 0.55 * s
    if t > 0.88:                       # the stem rises proud at the bow
        z += (t - 0.88) * 5.2
    if t < 0.07:                       # a touch of poop at the stern
        z += (0.07 - t) * 2.2
    return z

def beam_at(t):
    """half-beam along the hull; full amidships, fine entry forward, a moderate
    run aft to a narrow transom."""
    plan = math.sin(min(max(t, 0.0), 1.0) * math.pi)
    b = HULL_BEAM * 0.5 * (plan ** 0.78)
    b *= (1.0 - 0.50 * max(0.0, t - 0.60) / 0.40)   # fine bow
    b = max(b, 0.02)
    return b

def keel_z(t):
    """keel depth (negative) along the hull; deepest amidships."""
    plan = math.sin(min(max(t, 0.0), 1.0) * math.pi)
    return -HULL_DEPTH * (0.22 + 0.78 * plan ** 0.85)

def build_hull():
    """A planked carvel hull: lofted stations, real bilge, a flat carved
    transom at the stern and a sharp stem at the bow, with separate wale
    strakes, a bulwark wall + caprail, channels, headrails and a keel. Tinted
    with a 'Col' layer. Returns the hull object."""
    bm, col = new_bm()
    NX = 56                            # stations stem->stern (was 40)
    NS = 12                            # half-section samples (deck -> keel)
    rings = []
    bow_v = None
    transom = None
    for ix in range(NX + 1):
        t = ix / NX                    # 0 stern .. 1 bow
        x = (t - 0.5) * HULL_LEN
        dz = sheer_z(t)
        kz = keel_z(t)
        bm_beam = beam_at(t)
        if ix == NX:                   # sharp stem: single vertex forward
            bow_v = bm.verts.new((x + 0.5, 0.0, dz * 0.55))
            rings.append(("bow", None))
            continue
        if ix == 0:                    # flat transom: a vertical edge, not a point
            ring = []
            for iy in range(NS + 1):
                s = iy / NS
                z = dz + (kz - dz) * (s ** 1.5)
                y = bm_beam * 0.62 * (1 - s * 0.4)
                ring.append((x, y, z))
            full = ring + [(x, -yy, zz) for (xx, yy, zz) in reversed(ring[:-1])]
            transom = [bm.verts.new(p) for p in full]
            rings.append(("transom", transom))
            continue
        ring = []
        for iy in range(NS + 1):
            s = iy / NS                # 0 deck edge .. 1 keel centre
            y = bm_beam * (1 - s)
            z = dz + (kz - dz) * (s ** 1.55)
            ring.append((x, y, z))
        full = ring + [(x, -yy, zz) for (xx, yy, zz) in reversed(ring[:-1])]
        rings.append(("ring", [bm.verts.new(p) for p in full]))

    # skin between adjacent real rings
    real = [(i, kind, r) for i, (kind, r) in enumerate(rings) if r is not None]
    for k in range(len(real) - 1):
        a = real[k][2]; b = real[k + 1][2]
        M = min(len(a), len(b))
        for iy in range(M - 1):
            fc = bm.faces.new((a[iy], a[iy + 1], b[iy + 1], b[iy]))
            face_col(fc, col, INK_WALE if iy == 0 or iy == M - 2 else INK)
        fc = bm.faces.new((a[0], b[0], b[-1], a[-1]))
        face_col(fc, col, INK_WALE)

    # cap the transom (flat carved stern face) with a fan, then add a window row
    if transom is not None:
        ce = bm.verts.new((transom[0].co.x - 0.12, 0.0,
                           (transom[0].co.z + transom[len(transom) // 2].co.z) * 0.5))
        for iy in range(len(transom)):
            a = transom[iy]; b = transom[(iy + 1) % len(transom)]
            fc = bm.faces.new((ce, a, b))
            face_col(fc, col, INK_WALE)

    # fan-cap the bow to the stem vertex
    last = real[-1][2]
    for iy in range(len(last) - 1):
        fc = bm.faces.new((bow_v, last[iy], last[iy + 1]))
        face_col(fc, col, INK)

    # -- deck: a cambered planked surface just below the sheer line --------
    dk_rows = []
    for ix in range(1, NX, 2):
        t = ix / NX
        x = (t - 0.5) * HULL_LEN
        dz = sheer_z(t) - 0.10
        bw = beam_at(t) * 0.92
        row = []
        for iy in range(-5, 6):
            u = iy / 5.0
            y = u * bw
            camber = (1 - u * u) * 0.10
            row.append(bm.verts.new((x, y, dz + camber)))
        dk_rows.append(row)
    for r in range(len(dk_rows) - 1):
        a = dk_rows[r]; b = dk_rows[r + 1]
        for iy in range(len(a) - 1):
            fc = bm.faces.new((a[iy], a[iy + 1], b[iy + 1], b[iy]))
            face_col(fc, col, DECK)

    # -- bulwark wall + caprail standing proud of the deck all round -------
    railpts = []
    for ix in range(2, NX - 1):
        t = ix / NX
        x = (t - 0.5) * HULL_LEN
        dz = sheer_z(t)
        bw = beam_at(t)
        railpts.append((x, bw, dz))
    def bulwark(side):
        for k in range(len(railpts) - 1):
            x0, y0, z0 = railpts[k]; x1, y1, z1 = railpts[k + 1]
            # inner wall
            v0 = bm.verts.new((x0, side * y0, z0))
            v1 = bm.verts.new((x1, side * y1, z1))
            v2 = bm.verts.new((x1, side * y1, z1 + BULWARK_H))
            v3 = bm.verts.new((x0, side * y0, z0 + BULWARK_H))
            fc = bm.faces.new((v0, v1, v2, v3)); face_col(fc, col, INK_WALE)
            # caprail (a flat top cap, slightly proud outboard)
            c0 = bm.verts.new((x0, side * (y0 + 0.05), z0 + BULWARK_H))
            c1 = bm.verts.new((x1, side * (y1 + 0.05), z1 + BULWARK_H))
            fc = bm.faces.new((v3, v2, c1, c0)); face_col(fc, col, INK_WALE)
    bulwark(1.0); bulwark(-1.0)

    # -- wale strakes: two heavy belts of planking running the length -------
    def wale(zfrac, thick, c):
        for side in (-1.0, 1.0):
            prev = None
            for ix in range(2, NX - 1):
                t = ix / NX
                x = (t - 0.5) * HULL_LEN
                dz = sheer_z(t); kz = keel_z(t)
                z = dz + (kz - dz) * zfrac
                bw = beam_at(t) * (1 - zfrac * 0.7)
                cur = (x, side * (bw + 0.03), z)
                if prev is not None:
                    add_cyl(bm, col, prev[0], prev[1], prev[2],
                            cur[0], cur[1], cur[2], thick, c, seg=5)
                prev = cur
    wale(0.18, 0.05, INK_WALE)    # main wale
    wale(0.34, 0.04, INK_WALE)    # lower wale

    # -- channels: short outrigger ledges where shrouds anchor (per mast) ---
    for (mx, half) in ((2.6, 0.55), (-0.2, 0.6), (-3.0, 0.55)):
        t = (mx / HULL_LEN) + 0.5
        bw = beam_at(max(0.05, min(0.95, t)))
        dz = sheer_z(max(0.05, min(0.95, t)))
        for side in (-1.0, 1.0):
            add_box(bm, col, mx, side * (bw + 0.14), dz + BULWARK_H * 0.6,
                    half, 0.12, 0.03, INK_WALE)

    # -- keel + sternpost + stempost (a fine fin in silhouette) -------------
    prevk = None
    for ix in range(0, NX + 1):
        t = ix / NX
        x = (t - 0.5) * HULL_LEN
        kz = keel_z(t) - 0.04
        cur = (x, 0.0, kz)
        if prevk is not None:
            add_cyl(bm, col, prevk[0], prevk[1], prevk[2],
                    cur[0], cur[1], cur[2], 0.05, INK_WALE, seg=4)
        prevk = cur

    # -- headrails / trailboards + a simple figurehead at the stem ----------
    stem_x = HULL_LEN * 0.5
    add_cyl(bm, col, stem_x - 0.2, 0.0, sheer_z(0.97) * 0.9,
            stem_x + 0.9, 0.0, 1.1, 0.05, INK_WALE, seg=5)      # upper headrail
    add_cyl(bm, col, stem_x - 0.2, 0.0, sheer_z(0.97) * 0.55,
            stem_x + 0.8, 0.0, 0.7, 0.045, INK_WALE, seg=5)     # lower headrail
    add_box(bm, col, stem_x + 0.55, 0.0, 0.9, 0.16, 0.10, 0.18, INK)  # figurehead block

    return finalize("BrigHull", bm, INK, smooth=True)

# =========================================================================
# THE RIG -- three masts, each fully sparred, plus bowsprit assembly, yards
# with footropes, gaff + boom for the spanker. Returns (object, MASTS table)
# so the rigging + sails can reference exact geometry.
# =========================================================================
# Each mast: dict with foot x, and the z-heights of its sections. Heads are
# where shrouds/stays terminate. Built with rake (lean aft per metre up).
def mast_x_at(foot_x, z):
    """x of a raked mast at height z (lower foot at z~0.6)."""
    return foot_x - RAKE * max(0.0, z - 0.6)

MASTS = [
    # name        foot_x  lower_top  cap   top_top  cross  tg_top  royal_top  r_lower
    dict(name="fore", foot_x=2.7,  lower_top=9.4*MAST_SCALE, top_top=13.2*MAST_SCALE,
         tg_top=15.4*MAST_SCALE, royal_top=17.0*MAST_SCALE, r=0.105),
    dict(name="main", foot_x=-0.2, lower_top=10.4*MAST_SCALE, top_top=14.6*MAST_SCALE,
         tg_top=16.9*MAST_SCALE, royal_top=18.6*MAST_SCALE, r=0.115),
    dict(name="mizzen", foot_x=-3.2, lower_top=8.6*MAST_SCALE, top_top=12.2*MAST_SCALE,
         tg_top=14.2*MAST_SCALE, royal_top=15.6*MAST_SCALE, r=0.09),
]

# Yard table is derived per mast inside build_rig(); we cache yard geometry
# (centre x, z, half-length) for the sails and footropes to reuse.
YARDS = {}   # (mast_name, level) -> (cx, cz, half)

def build_rig():
    bm, col = new_bm()

    def mast_section(foot_x, z0, z1, r0, r1):
        x0 = mast_x_at(foot_x, z0); x1 = mast_x_at(foot_x, z1)
        add_cyl(bm, col, x0, 0.0, z0, x1, 0.0, z1, r0, INK,
                taper=r1 / max(r0, 1e-5), seg=8, cap=True)

    for m in MASTS:
        fx = m["foot_x"]
        # lower mast (stout, from deck to its top)
        mast_section(fx, 0.5, m["lower_top"], m["r"], m["r"] * 0.62)
        # top platform (a real disc-ish box where lower mast meets topmast)
        tx = mast_x_at(fx, m["lower_top"])
        add_box(bm, col, tx, 0.0, m["lower_top"], 0.55, 0.46, 0.05, INK_WALE)
        # trestletrees / top rim cross-pieces (silhouette nubs)
        add_box(bm, col, tx + 0.18, 0.0, m["lower_top"] + 0.04, 0.10, 0.40, 0.03, INK)
        add_box(bm, col, tx - 0.18, 0.0, m["lower_top"] + 0.04, 0.10, 0.40, 0.03, INK)
        # topmast
        mast_section(fx, m["lower_top"], m["top_top"], m["r"] * 0.55, m["r"] * 0.40)
        # crosstrees up high
        cx = mast_x_at(fx, m["top_top"])
        add_box(bm, col, cx, 0.0, m["top_top"], 0.30, 0.28, 0.035, INK_WALE)
        # topgallant mast
        mast_section(fx, m["top_top"], m["tg_top"], m["r"] * 0.36, m["r"] * 0.26)
        # royal pole + truck (a little ball finial)
        mast_section(fx, m["tg_top"], m["royal_top"], m["r"] * 0.24, m["r"] * 0.14)
        rx = mast_x_at(fx, m["royal_top"])
        add_box(bm, col, rx, 0.0, m["royal_top"] + 0.05, 0.05, 0.05, 0.05, INK)

        # -- yards on this mast: course / topsail / topgallant / royal -----
        # levels: (z fraction of lower..royal, half-length, radius)
        yard_defs = [
            ("course", 0.62, m["r"], 3.3),
            ("topsail", m["lower_top"] + (m["top_top"] - m["lower_top"]) * 0.45,
             m["r"] * 0.7, 2.7),
            ("topgallant", m["top_top"] + (m["tg_top"] - m["top_top"]) * 0.45,
             m["r"] * 0.5, 2.0),
            ("royal", m["tg_top"] + (m["royal_top"] - m["tg_top"]) * 0.45,
             m["r"] * 0.36, 1.5),
        ]
        # the mizzen carries no big course square sail (it has the spanker),
        # but keep a crossjack yard for the lace.
        for level, zspec, yr, half in yard_defs:
            if level == "course":
                cz = m["lower_top"] * zspec
            else:
                cz = zspec
            cxm = mast_x_at(fx, cz)
            # the yard hangs a touch forward of the mast
            cxm += 0.10
            add_cyl(bm, col, cxm, -half, cz, cxm, half, cz, yr, INK,
                    taper=1.0, seg=6, cap=True)
            # yard arms taper: add little end caps already via cap=True
            YARDS[(m["name"], level)] = (cxm, cz, half)
            # footropes: a catenary slung under the yard, with a few stirrups
            add_catenary(bm, col, (cxm, -half * 0.92, cz),
                         (cxm, half * 0.92, cz), 0.012, INK, sag=0.28, n=7)
            for s in (-0.6, -0.25, 0.0, 0.25, 0.6):
                add_line(bm, col, (cxm, s * half, cz),
                         (cxm, s * half, cz - 0.22), 0.010, INK)

    # -- bowsprit + jibboom + dolphin striker -----------------------------
    add_cyl(bm, col, 6.0, 0.0, 1.0, 9.4, 0.0, 2.0, 0.085, INK, taper=0.7, cap=True)
    add_cyl(bm, col, 9.4, 0.0, 2.0, 11.8, 0.0, 2.7, 0.05, INK, taper=0.6, cap=True)
    add_cyl(bm, col, 11.8, 0.0, 2.7, 13.2, 0.0, 3.1, 0.032, INK, taper=0.6)  # flying jibboom
    # dolphin striker (martingale): a short spar hanging DOWN under the jibboom
    add_cyl(bm, col, 9.4, 0.0, 2.0, 9.2, 0.0, 1.1, 0.035, INK, taper=0.6, cap=True)
    # spritsail yard across the bowsprit
    add_cyl(bm, col, 8.2, -1.4, 1.55, 8.2, 1.4, 1.55, 0.04, INK, seg=6, cap=True)

    # -- spanker spars on the mizzen: gaff (angled aft-up) + boom (low aft) -
    mz = MASTS[2]["foot_x"]
    add_cyl(bm, col, mz - 0.1, 0.0, 6.6, mz - 4.6, 0.0, 10.2, 0.05, INK,
            taper=0.8, cap=True)                                  # gaff
    add_cyl(bm, col, mz + 0.2, 0.0, 1.4, mz - 5.0, 0.0, 1.9, 0.055, INK,
            taper=0.85, cap=True)                                 # boom

    return finalize("BrigRig", bm, INK, smooth=True)

# =========================================================================
# SAILS -- a full suit of cambered square sails on every mast (course /
# topsail / topgallant / royal), reusing the cached YARDS so cloth hangs from
# the real spars. Plus staysails/jibs and the gaff spanker.
# =========================================================================
def build_sails():
    bm, col = new_bm()
    # for each yard that should carry a square sail, hang cloth from it down to
    # the yard below (or to a sensible foot).
    levels = ["course", "topsail", "topgallant", "royal"]
    belly_by = {"course": 1.05, "topsail": 0.80, "topgallant": 0.55, "royal": 0.40}
    for m in MASTS:
        name = m["name"]
        # the mizzen lowest sail is the spanker (fore-and-aft), skip its course
        sail_levels = levels[1:] if name == "mizzen" else levels
        for i, lv in enumerate(sail_levels):
            key = (name, lv)
            if key not in YARDS:
                continue
            cx, cz, half = YARDS[key]
            # foot reaches down toward the next-lower yard (or deck for course)
            order = ["course", "topsail", "topgallant", "royal"]
            idx = order.index(lv)
            if idx == 0:
                z_bot = 2.4
            else:
                lower_key = (name, order[idx - 1])
                z_bot = YARDS[lower_key][1] + 0.25 if lower_key in YARDS else cz - 3.0
            add_square_sail(bm, col, x=cx + 0.05, y_half=half * 0.95,
                            z_bot=z_bot, z_top=cz - 0.05,
                            belly=belly_by[lv], col=SAIL, lit_col=SAIL_LIT,
                            furl=not SAIL_SET)
    return finalize("BrigSailsSquare", bm, SAIL, smooth=True)

def build_main_sail():
    """The fore-and-aft SPANKER on the mizzen, between the boom and the gaff,
    cambered to port (+Y, toward the sun in the web)."""
    bm, col = new_bm()
    mz = MASTS[2]["foot_x"]
    bl = mathutils.Vector((mz + 0.05, 0.05, 1.6))     # tack (mast foot at boom)
    br = mathutils.Vector((mz - 4.8, 0.05, 1.9))      # clew (boom end)
    tr = mathutils.Vector((mz - 4.4, 0.05, 9.8))      # peak (gaff end)
    tl = mathutils.Vector((mz - 0.1, 0.05, 6.7))      # throat (mast at gaff)
    nu = nv = 9
    grid = [[None] * (nu + 1) for _ in range(nv + 1)]
    for iv in range(nv + 1):
        for iu in range(nu + 1):
            u = iu / nu; v = iv / nv
            p = bl.lerp(br, u).lerp(tl.lerp(tr, u), v)
            p.y += math.sin(u * math.pi) * math.sin(v * math.pi) * 0.95
            grid[iv][iu] = bm.verts.new(p[:])
    for iv in range(nv):
        for iu in range(nu):
            fc = bm.faces.new((grid[iv][iu], grid[iv][iu + 1],
                               grid[iv + 1][iu + 1], grid[iv + 1][iu]))
            face_col(fc, col, SAIL_LIT if (iu + 0.5) / nu > 0.6 else SAIL)
    return finalize("BrigSailMain", bm, SAIL, smooth=True)

def build_jibs():
    """Triangular headsails on the bowsprit/jibboom and staysails between the
    masts. Subdivided barycentric triangles so the belly reads as cloth."""
    bm, col = new_bm()
    def tri(a, b, c, belly, n=7):
        va = mathutils.Vector(a); vb = mathutils.Vector(b); vc = mathutils.Vector(c)
        grid = {}
        for i in range(n + 1):
            for j in range(n + 1 - i):
                k = n - i - j
                p = (va * i + vb * j + vc * k) / n
                bary = (min(i, j, k) / n) * 3.0
                p.y += bary * belly
                grid[(i, j)] = bm.verts.new(p[:])
        for i in range(n):
            for j in range(n - i):
                f1 = bm.faces.new((grid[(i, j)], grid[(i + 1, j)], grid[(i, j + 1)]))
                face_col(f1, col, SAIL)
                if (i + 1, j + 1) in grid:
                    f2 = bm.faces.new((grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)]))
                    face_col(f2, col, SAIL_LIT)
    fore_x = MASTS[0]["foot_x"]; main_x = MASTS[1]["foot_x"]; miz_x = MASTS[2]["foot_x"]
    # flying jib (jibboom tip -> fore topmast head -> bowsprit)
    tri((13.2, 0.04, 3.1), (mast_x_at(fore_x, 13.0), 0.04, 13.0), (9.4, 0.04, 2.0), 0.55)
    # outer jib
    tri((11.8, 0.04, 2.7), (mast_x_at(fore_x, 11.0), 0.04, 11.0), (8.0, 0.04, 1.6), 0.50)
    # inner jib / fore-topmast staysail
    tri((9.4, 0.04, 2.0), (mast_x_at(fore_x, 9.0), 0.04, 9.0), (6.0, 0.04, 1.1), 0.45)
    # main staysails between fore and main (the diagonal triangles up high)
    tri((mast_x_at(fore_x, 8.5), -0.04, 8.5), (mast_x_at(main_x, 13.5), -0.04, 13.5),
        (mast_x_at(main_x, 6.5), -0.04, 6.5), 0.45)
    tri((mast_x_at(fore_x, 4.5), -0.04, 4.5), (mast_x_at(main_x, 9.5), -0.04, 9.5),
        (mast_x_at(main_x, 2.0), -0.04, 2.0), 0.40)
    # mizzen staysail between main and mizzen
    tri((mast_x_at(main_x, 8.0), -0.04, 8.0), (mast_x_at(miz_x, 12.0), -0.04, 12.0),
        (mast_x_at(miz_x, 5.0), -0.04, 5.0), 0.42)
    return finalize("BrigJibs", bm, SAIL, smooth=True)

# =========================================================================
# RIGGING -- the signature LACE. Shrouds with ratlines across EVERY panel on
# every mast, fore/back/topmast stays, bobstays, and running lines.
# =========================================================================
def build_rigging():
    bm, col = new_bm()

    def deadeye_xz(foot_x):
        """deck-edge anchor x and z for a mast's channels (where shrouds start)."""
        t = (foot_x / HULL_LEN) + 0.5
        t = max(0.05, min(0.95, t))
        return foot_x, beam_at(t) + 0.14, sheer_z(t) + BULWARK_H * 0.6

    def shroud_set(foot_x, head_z, n, spread_scale, top_y, fore_aft_spread,
                   ratlines=True):
        """A fan of `n` shrouds each side from the channel up to a mast head,
        with ratlines as horizontal rungs across each adjacent shroud pair.
        This is the dominant tri sink and the signature silhouette lace."""
        bx, by, bz = deadeye_xz(foot_x)
        head_x = mast_x_at(foot_x, head_z)
        for side in (-1.0, 1.0):
            # build the n shroud lines, remember their endpoints for ratlines
            bases = []
            tops = []
            for kk in range(n):
                u = kk / max(n - 1, 1)
                base = (bx + (u - 0.5) * fore_aft_spread,
                        side * by * spread_scale,
                        bz)
                top = (head_x + (u - 0.5) * fore_aft_spread * 0.25,
                       side * top_y,
                       head_z)
                add_line(bm, col, base, top, RIG_R, INK)
                bases.append(mathutils.Vector(base))
                tops.append(mathutils.Vector(top))
            if not ratlines or n < 2:
                continue
            # ratlines: horizontal rungs at fixed dz, spanning all shrouds at
            # that height (interpolate each shroud's point at z).
            z0 = bz + 0.4
            z1 = head_z - 0.6
            nz = max(1, int((z1 - z0) / RATLINE_DZ))
            for r in range(nz):
                z = z0 + (r + 0.5) * (z1 - z0) / nz
                pts = []
                for kk in range(n):
                    a = bases[kk]; b = tops[kk]
                    if b.z <= a.z + 1e-3:
                        continue
                    tt = (z - a.z) / (b.z - a.z)
                    if tt < 0.0 or tt > 1.0:
                        pts = []
                        break
                    pts.append(a.lerp(b, tt))
                if len(pts) < 2:
                    continue
                for kk in range(len(pts) - 1):
                    add_line(bm, col, pts[kk][:], pts[kk + 1][:], RAT_R, INK)

    for m in MASTS:
        fx = m["foot_x"]
        # lower shrouds (dense, with ratlines -- the big lace)
        shroud_set(fx, m["lower_top"] - 0.2, SHROUDS_PER_SIDE_LOWER,
                   spread_scale=1.0, top_y=0.40, fore_aft_spread=1.5,
                   ratlines=True)
        # topmast shrouds (fewer, narrower, with ratlines)
        shroud_set(fx, m["top_top"] - 0.2, SHROUDS_PER_SIDE_TOP,
                   spread_scale=0.45, top_y=0.26, fore_aft_spread=0.8,
                   ratlines=True)

    # -- stays running fore-and-aft (the great diagonal lines) ------------
    fore_x = MASTS[0]["foot_x"]; main_x = MASTS[1]["foot_x"]; miz_x = MASTS[2]["foot_x"]
    def stay(foot_x, head_z, to):
        add_line(bm, col, (mast_x_at(foot_x, head_z), 0.0, head_z), to, RIG_R, INK)
    # forestays from fore mast heads down to the bowsprit / stem
    stay(fore_x, MASTS[0]["lower_top"] - 0.2, (9.0, 0.0, 1.9))
    stay(fore_x, MASTS[0]["top_top"] - 0.2, (11.6, 0.0, 2.6))
    stay(fore_x, MASTS[0]["tg_top"] - 0.2, (13.0, 0.0, 3.0))
    # main stays: main heads -> fore mast
    stay(main_x, MASTS[1]["lower_top"] - 0.2, (mast_x_at(fore_x, 6.0), 0.0, 6.0))
    stay(main_x, MASTS[1]["top_top"] - 0.2, (mast_x_at(fore_x, 9.4), 0.0, 9.4))
    stay(main_x, MASTS[1]["tg_top"] - 0.2, (mast_x_at(fore_x, 12.0), 0.0, 12.0))
    # mizzen stays: mizzen heads -> main mast
    stay(miz_x, MASTS[2]["lower_top"] - 0.2, (mast_x_at(main_x, 6.0), 0.0, 6.0))
    stay(miz_x, MASTS[2]["top_top"] - 0.2, (mast_x_at(main_x, 9.4), 0.0, 9.4))

    # -- backstays: mast tops -> the quarters (aft deck edge) -------------
    def backstay(foot_x, head_z, aft_x):
        hx = mast_x_at(foot_x, head_z)
        for side in (0.9, -0.9):
            add_line(bm, col, (hx, 0.0, head_z), (aft_x, side, 1.1), RIG_R, INK)
    backstay(fore_x, MASTS[0]["top_top"] - 0.2, -4.4)
    backstay(fore_x, MASTS[0]["tg_top"] - 0.2, -4.8)
    backstay(main_x, MASTS[1]["top_top"] - 0.2, -5.2)
    backstay(main_x, MASTS[1]["tg_top"] - 0.2, -5.6)
    backstay(miz_x, MASTS[2]["top_top"] - 0.2, -6.2)
    backstay(miz_x, MASTS[2]["tg_top"] - 0.2, -6.6)

    # -- bobstays + bowsprit shrouds (hold the bowsprit down/out) ---------
    add_line(bm, col, (9.4, 0.0, 2.0), (6.2, 0.0, -0.2), RIG_R, INK)   # bobstay
    add_line(bm, col, (11.8, 0.0, 2.7), (7.2, 0.0, -0.1), RIG_R, INK)  # outer bobstay
    add_line(bm, col, (9.2, 0.0, 1.1), (8.4, 0.6, 1.6), RAT_R, INK)    # striker stay
    add_line(bm, col, (9.2, 0.0, 1.1), (8.4, -0.6, 1.6), RAT_R, INK)
    for side in (0.6, -0.6):
        add_line(bm, col, (9.4, 0.0, 2.0), (7.6, side, sheer_z(0.92) + 0.2), RAT_R, INK)

    # -- a sampling of running rigging: braces, halyards, sheets ----------
    for m in MASTS:
        for lv in ("course", "topsail", "topgallant"):
            if (m["name"], lv) in YARDS:
                cx, cz, half = YARDS[(m["name"], lv)]
                # braces from yard arms leading aft
                add_line(bm, col, (cx, half, cz), (cx - 2.2, half * 0.4, cz - 1.5),
                         RAT_R, INK)
                add_line(bm, col, (cx, -half, cz), (cx - 2.2, -half * 0.4, cz - 1.5),
                         RAT_R, INK)
                # halyard down to the deck
                add_line(bm, col, (cx, 0.0, cz), (m["foot_x"], 0.0, 1.0),
                         RAT_R, INK)
    return finalize("BrigRigging", bm, INK, smooth=True)

# =========================================================================
# DECK FURNITURE -- readable in silhouette: capstan, helm/wheel, ship's boat
# on skids, hatches, fife rails + belaying pins, a binnacle.
# =========================================================================
def build_furniture():
    bm, col = new_bm()
    # deck reference height near amidships
    def dz_at(x):
        t = max(0.05, min(0.95, (x / HULL_LEN) + 0.5))
        return sheer_z(t) - 0.10

    # capstan: a drum amidships with whelps + capstan bars sticking out
    cap_x = 0.6; cap_z = dz_at(cap_x)
    add_cyl(bm, col, cap_x, 0.0, cap_z, cap_x, 0.0, cap_z + 0.45, 0.20, INK,
            taper=0.85, seg=10, cap=True)
    for k in range(8):
        ang = k / 8 * math.tau
        add_cyl(bm, col, cap_x, 0.0, cap_z + 0.40,
                cap_x + math.cos(ang) * 0.55, math.sin(ang) * 0.55, cap_z + 0.42,
                0.02, INK, seg=4)                       # capstan bars

    # helm: ship's wheel aft, a ring on a stand
    wh_x = -4.2; wh_z = dz_at(wh_x) + 0.4
    add_box(bm, col, wh_x, 0.0, dz_at(wh_x) + 0.2, 0.06, 0.18, 0.2, INK)  # binnacle stand
    # the wheel itself: a torus-ish ring of spokes + rim
    R = 0.34
    rim_prev = None
    for k in range(13):
        ang = k / 12 * math.tau
        p = (wh_x, math.cos(ang) * R, wh_z + math.sin(ang) * R)
        if rim_prev is not None:
            add_cyl(bm, col, rim_prev[0], rim_prev[1], rim_prev[2],
                    p[0], p[1], p[2], 0.018, INK, seg=4)
        rim_prev = p
        if k < 12 and k % 2 == 0:                       # spokes (some stick proud)
            add_line(bm, col, (wh_x, 0.0, wh_z),
                     (wh_x, math.cos(ang) * (R + 0.08), wh_z + math.sin(ang) * (R + 0.08)),
                     0.015, INK)

    # binnacle box just forward of the wheel
    add_box(bm, col, wh_x + 0.5, 0.0, dz_at(wh_x) + 0.18, 0.14, 0.12, 0.18, INK)

    # ship's boat stowed on skids amidships (a little upturned hull)
    bx = 1.6; bz = dz_at(bx) + 0.25
    NXb = 8; NSb = 4
    rows = []
    for ix in range(NXb + 1):
        t = ix / NXb
        x = bx + (t - 0.5) * 1.8
        beam = 0.34 * math.sin(min(max(t, 0), 1) * math.pi) ** 0.7
        ddz = bz + 0.12 * (abs(t - 0.5) * 2) ** 1.5
        kz = bz - 0.22 * math.sin(min(max(t, 0), 1) * math.pi)
        ring = []
        for iy in range(NSb + 1):
            s = iy / NSb
            y = beam * (1 - s)
            z = ddz + (kz - ddz) * (s ** 1.3)
            ring.append((x, y, z))
        full = ring + [(x, -yy, zz) for (xx, yy, zz) in reversed(ring[:-1])]
        rows.append([bm.verts.new(p) for p in full])
    M = len(rows[0])
    for ix in range(NXb):
        a = rows[ix]; b = rows[ix + 1]
        for iy in range(M - 1):
            fc = bm.faces.new((a[iy], a[iy + 1], b[iy + 1], b[iy]))
            face_col(fc, col, INK)
    for sx in (bx - 0.6, bx + 0.6):                     # skids under the boat
        add_box(bm, col, sx, 0.0, bz - 0.24, 0.05, 0.5, 0.04, INK)

    # hatches / gratings (a couple of low boxes)
    for hx in (-1.6, 3.4):
        add_box(bm, col, hx, 0.0, dz_at(hx) + 0.08, 0.32, 0.4, 0.08, DECK)

    # fife rails + belaying pins around each mast foot
    for m in MASTS:
        fx = m["foot_x"]; fz = dz_at(fx)
        for side in (0.55, -0.55):
            add_cyl(bm, col, fx + 0.4, side, fz + 0.05, fx - 0.4, side, fz + 0.05,
                    0.03, INK, seg=5)                   # fife rail bar
            for px in (fx + 0.3, fx + 0.1, fx - 0.1, fx - 0.3):
                add_cyl(bm, col, px, side, fz + 0.02, px, side, fz + 0.22,
                        0.014, INK, seg=4)              # belaying pins

    return finalize("BrigFurniture", bm, INK, smooth=True)

# =========================================================================
# FLAGS -- an ensign streaming aft from the gaff peak + masthead pennants on
# every mast. Tiny moving accents that lengthen the silhouette.
# =========================================================================
def build_flags():
    bm, col = new_bm()
    def streamer(base, length, drop, waves, nu=8, nv=3, c=PENNANT):
        b = mathutils.Vector(base)
        grid = [[None] * (nu + 1) for _ in range(nv + 1)]
        for iv in range(nv + 1):
            for iu in range(nu + 1):
                u = iu / nu; v = iv / nv
                p = b + mathutils.Vector((-u * length,
                                          math.sin(u * waves) * 0.18 * u,
                                          -v * drop * (0.4 + 0.6 * u)))
                grid[iv][iu] = bm.verts.new(p[:])
        for iv in range(nv):
            for iu in range(nu):
                fc = bm.faces.new((grid[iv][iu], grid[iv][iu + 1],
                                   grid[iv + 1][iu + 1], grid[iv + 1][iu]))
                face_col(fc, col, c)
    # ensign at the gaff peak (mizzen)
    mz = MASTS[2]["foot_x"]
    streamer((mz - 4.4, 0.0, 9.8), 1.8, 0.7, 6.0, c=PENNANT)
    # long masthead pennants on each mast royal truck
    for m in MASTS:
        rx = mast_x_at(m["foot_x"], m["royal_top"])
        streamer((rx, 0.0, m["royal_top"] + 0.05), 2.6, 0.18, 9.0, nv=2, c=SAIL_LIT)
    return finalize("BrigFlags", bm, PENNANT, smooth=True)

# -- build + join the brig ------------------------------------------------
hull = build_hull()
rig = build_rig()
sq = build_sails()
mainsl = build_main_sail()
jibs = build_jibs()
rigging = build_rigging()
furn = build_furniture()
flags = build_flags()

bpy.ops.object.select_all(action="DESELECT")
parts = [hull, rig, sq, mainsl, jibs, rigging, furn, flags]
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.object.join()
brig = bpy.context.view_layer.objects.active
brig.name = "Brig"

# =========================================================================
# THE SKIFF -- small open rowboat with seated figures, lower-right of frame.
# Built around its own origin so the web floats it separately. Stays simple.
# =========================================================================
def build_skiff():
    bm, col = new_bm()
    L = 3.8; B = 1.15; D = 0.6
    NX = 16; NS = 6
    stations = []
    for ix in range(NX + 1):
        t = ix / NX
        x = (t - 0.5) * L
        beam = B * 0.5 * (0.25 + 0.75 * math.sin(min(max(t, 0), 1) * math.pi) ** 0.8)
        dz = 0.20 + 0.20 * (abs(t - 0.5) * 2) ** 1.6
        kz = -D * (0.3 + 0.7 * math.sin(min(max(t, 0), 1) * math.pi))
        ring = []
        for iy in range(NS + 1):
            s = iy / NS
            y = beam * (1 - s)
            z = dz + (kz - dz) * (s ** 1.4)
            ring.append((x, y, z))
        full = ring + [(x, -yy, zz) for (xx, yy, zz) in reversed(ring[:-1])]
        stations.append([bm.verts.new(p) for p in full])
    M = len(stations[0])
    for ix in range(NX):
        a = stations[ix]; b = stations[ix + 1]
        for iy in range(M - 1):
            fc = bm.faces.new((a[iy], a[iy + 1], b[iy + 1], b[iy]))
            face_col(fc, col, INK)
    # caprail around the gunwale
    prev = None
    for ix in range(NX + 1):
        t = ix / NX
        x = (t - 0.5) * L
        beam = B * 0.5 * (0.25 + 0.75 * math.sin(min(max(t, 0), 1) * math.pi) ** 0.8)
        dz = 0.20 + 0.20 * (abs(t - 0.5) * 2) ** 1.6
        cur = (x, beam, dz)
        if prev is not None:
            for side in (1.0, -1.0):
                add_cyl(bm, col, prev[0], side * prev[1], prev[2],
                        cur[0], side * cur[1], cur[2], 0.025, INK_WALE, seg=4)
        prev = cur
    # thwarts (seats) across the boat
    for fx in (-0.9, 0.0, 0.9):
        add_box(bm, col, fx, 0.0, 0.18, 0.06, 0.42, 0.03, DECK)
    sk = finalize("SkiffHull", bm, INK, smooth=True)

    # figures: little seated blocks down the centreline
    fb, fcol = new_bm()
    for fx in (-1.0, -0.3, 0.4, 1.1):
        add_box(fb, fcol, fx, 0.0, 0.52, 0.16, 0.22, 0.28, FIG)   # torso
        add_box(fb, fcol, fx, 0.0, 0.88, 0.12, 0.13, 0.12, FIG)   # head
    figs = finalize("SkiffFigures", fb, FIG, smooth=False)

    # a couple of oars
    ob, ocol = new_bm()
    add_cyl(ob, ocol, 0.0, 0.6, 0.45, 1.7, 1.6, -0.2, 0.04, INK)
    add_cyl(ob, ocol, 0.0, -0.6, 0.45, 1.7, -1.6, -0.2, 0.04, INK)
    oars = finalize("SkiffOars", ob, INK, smooth=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in (sk, figs, oars):
        o.select_set(True)
    bpy.context.view_layer.objects.active = sk
    bpy.ops.object.join()
    s = bpy.context.view_layer.objects.active
    s.name = "Skiff"
    return s

skiff = build_skiff()

# =========================================================================
# a hand-painted warm sun-side RIM before the AO bake. The web's sun is to
# port/+Y and slightly forward; tint faces whose normal faces +Y (port) and up
# a touch warmer so the silhouette gets a gilt edge. (AO then darkens recesses.)
# =========================================================================
def add_sun_rim(ob, sun=mathutils.Vector((0.25, 0.93, 0.26)).normalized(),
                amount=0.55):
    me = ob.data
    if "Col" not in me.color_attributes:
        return
    ca = me.color_attributes["Col"]
    polys = me.polygons
    cols = np.empty(len(ca.data) * 4, np.float32)
    ca.data.foreach_get("color", cols)
    for p in polys:
        n = p.normal
        d = n.x * sun.x + n.y * sun.y + n.z * sun.z
        if d <= 0.15:
            continue
        w = min(max((d - 0.15) / 0.85, 0.0), 1.0) * amount
        for li in p.loop_indices:
            base = li * 4
            for c in range(3):
                cols[base + c] = cols[base + c] * (1 - w) + RIM[c] * w
    ca.data.foreach_set("color", cols)
    me.update()

for ob in (brig, skiff):
    try:
        add_sun_rim(ob)
        print(f"RIM ok: {ob.name}")
    except Exception as e:
        print(f"RIM skipped {ob.name}: {e}")

# =========================================================================
# AO bake (Cycles -> vertex colours) on both objects. OPTIX if available;
# fall back to CPU on the HIPEW warning. Modest samples so it still finishes.
# =========================================================================
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
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

def bake_ao(ob, floor=0.32):
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

# =========================================================================
# export GEOMETRY-ONLY (vertex colour, no images, no cameras/anim), Y-up
# =========================================================================
bpy.ops.object.select_all(action="DESELECT")
for ob in (brig, skiff):
    ob.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_yup=True, export_cameras=False, export_animations=False,
              export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

# =========================================================================
# report
# =========================================================================
def bbox(ob):
    cs = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
    xs = [c.x for c in cs]; ys = [c.y for c in cs]; zs = [c.z for c in cs]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

tris = sum(len(o.data.polygons) for o in (brig, skiff))
mb = os.path.getsize(GLB_PATH) / 1e6
bmin, bmax = bbox(brig)
smin, smax = bbox(skiff)
print(f"SEA_SET_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
print(f"SHIP_OK name=Brig heading_axis=+X(bow, Blender) -> glTF +X  "
      f"tris={len(brig.data.polygons)} "
      f"bbox_min=({bmin[0]:.2f},{bmin[1]:.2f},{bmin[2]:.2f}) "
      f"bbox_max=({bmax[0]:.2f},{bmax[1]:.2f},{bmax[2]:.2f})")
print(f"SKIFF_OK name=Skiff tris={len(skiff.data.polygons)} "
      f"bbox_min=({smin[0]:.2f},{smin[1]:.2f},{smin[2]:.2f}) "
      f"bbox_max=({smax[0]:.2f},{smax[1]:.2f},{smax[2]:.2f})")
