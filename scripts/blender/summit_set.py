# Summit set for Act 0 — real geometry the camera moves past, baked.
# Doctrine: production geometry + baked light, not procedural code-paint.
# We export GEOMETRY ONLY (no camera): the web scene keeps its own
# mouse-wind + descent camera and its TSL sky / sea-of-fog, and adds
# this terrain for honest depth — a dark Friedrich outcrop in front,
# crags breaking the fog, soft hazed peaks behind. Unlit + vertex-colour
# (AO baked in) on the web, finished by the Kuwahara painterly pass.
#
# Composition mirrors "Wanderer above the Sea of Fog": the wanderer's
# rock fills the foreground (running off the bottom), a rounded massif
# left and a sharp pinnacle right sit far across the fog.
#
# Run headless (no socket needed, no GUI conflict):
#   & "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" \
#       --background --factory-startup --python scripts/blender/summit_set.py
import bpy, bmesh, math, os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "summit")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "summit_raw.glb")

# ── deterministic value-noise fBm (so every build is identical) ──────
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
        bsdf.inputs["Roughness"].default_value = 0.92
    return m

# ── 1. the foreground outcrop (the wanderer's rock) ──────────────────
# a craggy mound: high near the back-centre (where the figure stands),
# falling away to the sides and tumbling off the front of the frame.
def build_outcrop():
    bm = bmesh.new()
    N = 64
    SPANX, SPANY = 28.0, 24.0
    # the summit point — slightly back and right, where the wanderer stands
    SX, SY = 2.5, 4.5
    verts = [[None] * (N + 1) for _ in range(N + 1)]
    for iy in range(N + 1):
        for ix in range(N + 1):
            gx = (ix / N - 0.5) * SPANX
            gy = (iy / N - 0.5) * SPANY          # +y = into the distance
            r = math.hypot((gx - SX) * 0.92, (gy - SY) * 0.82)
            # a high plateau by the summit, not a smooth dome
            plateau = max(0.0, 1.0 - (r / 12.0)) ** 1.15 * 6.8
            # jagged hewn stone — strong ridged high frequencies
            crag = fbm(gx * 0.22 + 11, gy * 0.22 - 4, 0.0, 6) * 2.8
            ridge = fbm(gx * 0.5, gy * 0.52, 5.0, 5, ridged=True) * 3.0
            facet = fbm(gx * 1.1, gy * 1.1, 9.0, 3, ridged=True) * 1.1
            z = plateau + crag * 0.7 + ridge + facet - 2.4
            # past the summit's shoulders the rock breaks off into the void
            z -= (max(0.0, r - 9.0) ** 1.7) * 1.7
            # the near lip (toward the camera) tumbles off the bottom edge
            if gy < -2.5:
                z -= ((-2.5 - gy) / 9.0) ** 1.55 * 22.0
            jx = (vnoise(gx * 0.6, gy * 0.6, 9) - 0.5) * 1.3
            jy = (vnoise(gx * 0.6, gy * 0.6, 21) - 0.5) * 1.3
            verts[iy][ix] = bm.verts.new((gx + jx, gy + jy, z))
    for iy in range(N):
        for ix in range(N):
            bm.faces.new((verts[iy][ix], verts[iy][ix + 1],
                          verts[iy + 1][ix + 1], verts[iy + 1][ix]))
    # flat shading reads the facets as hewn stone
    for f in bm.faces:
        f.smooth = False
    return finalize(bm, "Outcrop", (0.055, 0.048, 0.052))

# ── 2. crags breaking the surface of the sea of fog ──────────────────
def build_crags():
    bm = bmesh.new()
    # (x, y, base_radius, height) — scattered mid-distance, low
    specs = [
        (-14.0, 26.0, 2.6, 3.4),
        (-9.0, 34.0, 2.0, 2.2),
        (12.5, 30.0, 3.0, 3.0),
        (7.0, 40.0, 2.2, 2.6),
        (-2.0, 48.0, 2.4, 2.0),
    ]
    for si, (cx, cy, br, h) in enumerate(specs):
        rings, seg = 5, 12
        cols = [[None] * seg for _ in range(rings)]
        apex = bm.verts.new((cx + (vnoise(cx, cy, si) - 0.5) * 2,
                             cy + (vnoise(cy, cx, si) - 0.5) * 2,
                             h - 8.0))
        for ri in range(rings):
            rr = br * (ri + 1) / rings
            zz = h * (1 - (ri / rings) ** 1.4) - 8.0
            for a in range(seg):
                ang = a / seg * math.tau
                rough = 0.7 + fbm(math.cos(ang) * 2 + si, math.sin(ang) * 2, ri, 4) * 0.5
                px = cx + math.cos(ang) * rr * rough
                py = cy + math.sin(ang) * rr * rough
                pz = zz + (vnoise(px, py, ri + si) - 0.5) * 1.1
                cols[ri][a] = bm.verts.new((px, py, pz))
        for a in range(seg):
            a2 = (a + 1) % seg
            bm.faces.new((apex, cols[0][a], cols[0][a2]))
            for ri in range(rings - 1):
                bm.faces.new((cols[ri][a], cols[ri][a2],
                              cols[ri + 1][a2], cols[ri + 1][a]))
    return finalize(bm, "Crags", (0.07, 0.066, 0.072))

# ── 3. the far massifs (rounded peak left, sharp pinnacle right) ──────
def build_peaks():
    bm = bmesh.new()
    # long hazed ridge spanning the horizon, plus two named summits
    def ridge(cx, cy, width, depth, height, sharp, seedz):
        N = 28
        rows = 6
        grid = [[None] * (N + 1) for _ in range(rows + 1)]
        for ry in range(rows + 1):
            for ix in range(N + 1):
                gx = cx + (ix / N - 0.5) * width
                gy = cy + (ry / rows - 0.5) * depth
                t = ix / N
                # a peaked profile across the width
                prof = math.sin(t * math.pi) ** (sharp)
                z = prof * height
                z += fbm(gx * 0.08 + seedz, gy * 0.08, seedz, 5) * height * 0.4
                z += fbm(gx * 0.25, gy * 0.25, seedz + 3, 4, ridged=True) * height * 0.18
                z -= 14.0  # the fog sits well above their feet
                grid[ry][ix] = bm.verts.new((gx, gy, z))
        for ry in range(rows):
            for ix in range(N):
                bm.faces.new((grid[ry][ix], grid[ry][ix + 1],
                              grid[ry + 1][ix + 1], grid[ry + 1][ix]))
    # back wall of soft mountains
    ridge(0.0, 95.0, 200.0, 30.0, 20.0, 2.2, 1.0)
    # the rounded massif, left of centre
    ridge(-34.0, 78.0, 60.0, 26.0, 24.0, 1.6, 7.0)
    # the sharp pinnacle, right of centre (Friedrich's distinctive spur)
    ridge(40.0, 82.0, 26.0, 20.0, 30.0, 5.0, 13.0)
    return finalize(bm, "Peaks", (0.30, 0.34, 0.43))

ob_out = build_outcrop()
ob_crag = build_crags()
ob_peak = build_peaks()

# ── AO bake (Cycles/OPTIX → vertex colours) on the near stone ────────
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
scene.world.light_settings.distance = 14.0

def bake_ao(ob, floor=0.22):
    me = ob.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("AO")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    # Col *= (floor + (1-floor)*AO)
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

for ob in (ob_out, ob_crag):
    try:
        bake_ao(ob)
    except Exception as e:
        print(f"BAKE FAILED {ob.name}: {e}")
        if "AO" in ob.data.color_attributes:
            ob.data.color_attributes.remove(ob.data.color_attributes["AO"])

# ── export ───────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for ob in (ob_out, ob_crag, ob_peak):
    ob.select_set(True)
kwargs = dict(filepath=GLB_PATH, export_format="GLB", use_selection=True,
              export_cameras=False, export_animations=False, export_image_format="NONE")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

tris = sum(len(o.data.polygons) for o in (ob_out, ob_crag, ob_peak))
mb = os.path.getsize(GLB_PATH) / 1e6
print(f"SUMMIT_SET_OK polygons={tris} -> {GLB_PATH} ({mb:.2f} MB)")
