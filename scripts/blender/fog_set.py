# Fog set for the Main-Lobby (Workstream A) — the SEA OF FOG as real geometry.
# Doctrine: production geometry + baked light, not a fragment-heavy raymarch.
# The old TSL volumetric cost ~17fps and read as thin haze; this is a real
# billowing surface — Friedrich's luminous sea — that renders UNLIT with vertex
# colour (a baked vertical/sun-ward luminance gradient) and is finished by the
# Kuwahara painterly pass. Cheap (a few thousand tris), dramatic, 60fps-friendly.
#
# Composition: you stand just above the heaving top of the sea and look down-and-
# across it. A near sea surface fills the lower frame with crests + valleys; a few
# distinct banks rise out of it in the mid-distance; everything recedes through
# aerial perspective (handled web-side by distance fade to the sky).
#
# Blender Z-up → glTF Y-up export maps (x, y, z)_bl → (x, z, -y)_gltf, so here:
#   X = left/right (web x),  Y = depth into distance (web -z),  Z = height (web y).
# The web loads this, positions/scales the group, multiplies the baked luminance
# by the day-cycle fog tint, and aerial-fades distant verts to the sky.
#
# Run headless:
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/fog_set.py
import bpy, bmesh, math, os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "lobby")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "fog_raw.glb")

# ── deterministic value-noise fBm (identical every build) ────────────
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
    return s / norm  # ~ -1..1

# ── scene reset ──────────────────────────────────────────────────────
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

def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)

# ── the fog surface — billowing sea + distinct rising banks ──────────
# A single mesh: a wide grid in X (left/right) and Y (depth), displaced in Z
# (height) by a big rolling swell + 2-octave puffs + a few localized bank humps.
# Vertex colour bakes a luminance gradient: bright warm crests catching the low
# sun, cool blue-grey shadowed valleys — the web re-tints per time of day.

# localized fog banks rising out of the sea in the mid/far distance
# (cx, cy, radius, height) in Blender X/Y/Z
BANKS = [
    (-46.0, 95.0, 40.0, 6.5),
    (34.0,  120.0, 46.0, 7.5),
    (-8.0,  165.0, 60.0, 8.5),
    (62.0,  150.0, 38.0, 6.0),
    (-70.0, 145.0, 44.0, 6.8),
]
SUN_X = 1.0  # the low sun is to the right (+X) — crests on that side glow warmer

def surface_z(x, y):
    # big rolling swell (long wavelength) + layered puffs + crisp ridged crests
    swell = fbm(x * 0.013 + 4.0, y * 0.010 - 2.0, 0.0, 4) * 8.5
    puff  = fbm(x * 0.045, y * 0.045 + 9.0, 3.0, 4) * 3.8
    fine  = fbm(x * 0.09, y * 0.09 + 2.0, 5.0, 4) * 1.8
    chop  = fbm(x * 0.16, y * 0.16, 7.0, 3, ridged=True) * 1.6
    z = -2.5 + swell + puff + fine + chop
    # rising banks (soft gaussian humps modulated by noise so they're not domes)
    for (cx, cy, rad, h) in BANKS:
        d = math.hypot((x - cx), (y - cy) * 0.85) / rad
        if d < 1.6:
            g = math.exp(-(d * d) * 1.5)
            wob = 0.6 + fbm(x * 0.06 + cx, y * 0.06 + cy, 12.0, 3) * 0.7
            z += g * h * wob
    return z

def build_sea():
    bm = bmesh.new()
    NX, NY = 150, 150
    X0, X1 = -150.0, 150.0
    Y0, Y1 = -45.0, 235.0
    verts = [[None] * (NX + 1) for _ in range(NY + 1)]
    zmin, zmax = 1e9, -1e9
    zgrid = [[0.0] * (NX + 1) for _ in range(NY + 1)]
    for iy in range(NY + 1):
        # denser sampling near the camera (small Y) via a mild ease on the depth
        ty = iy / NY
        gy = Y0 + (Y1 - Y0) * (ty ** 1.25)
        for ix in range(NX + 1):
            gx = X0 + (X1 - X0) * (ix / NX)
            z = surface_z(gx, gy)
            zgrid[iy][ix] = z
            zmin = min(zmin, z); zmax = max(zmax, z)
            verts[iy][ix] = bm.verts.new((gx, gy, z))
    for iy in range(NY):
        for ix in range(NX):
            bm.faces.new((verts[iy][ix], verts[iy][ix + 1],
                          verts[iy + 1][ix + 1], verts[iy + 1][ix]))
    bm.normal_update()
    me = bpy.data.meshes.new("Sea")
    bm.to_mesh(me)
    bm.free()
    # ── procedural luminance bake into a CORNER colour attribute 'Col' ──
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    span = max(zmax - zmin, 1e-3)
    cool = np.array([0.50, 0.58, 0.72])   # deep shadowed valley (cool blue-grey, moody)
    warm = np.array([1.12, 1.06, 0.96])   # sun-lit crest (warm near-white, luminous)
    cols = np.empty(len(ca.data) * 4, np.float32)
    li = 0
    for poly in me.polygons:
        for vidx in poly.vertices:
            co = me.vertices[vidx].co
            crest = clamp01((co.z - zmin) / span)
            crest = crest ** 1.5  # bias dark: only the true crests light up
            # sun-ward: the +X half catches the low sun warmer/brighter
            sun = clamp01((co.x / 150.0) * 0.5 + 0.5)
            lum = 0.30 + 0.85 * crest + 0.16 * sun * crest
            tint = cool + (warm - cool) * crest
            c = tint * lum
            cols[li:li+3] = c[:3]
            cols[li+3] = 1.0
            li += 4
    ca.data.foreach_set("color", cols)
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("Col")
    me.materials.append(_mat("Sea_mat", (0.8, 0.85, 0.92)))
    # smooth shading — fog is soft, not faceted
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("Sea", me)
    scene.collection.objects.link(ob)
    return ob

ob_sea = build_sea()

# ── export (geometry + vertex colour, no camera/light) ───────────────
bpy.ops.object.select_all(action="DESELECT")
ob_sea.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_cameras=False, export_animations=False, export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = len(ob_sea.data.polygons)
mb = os.path.getsize(GLB_PATH) / 1e6
print(f"FOG_SET_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
