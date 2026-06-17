"""
Camino flyover -- terrain set + cinematic bird's-eye camera (headless).

Reads the prepared Copernicus heightfield and lofts it into a real displaced
terrain mesh: 211 km of the Camino Portugues from Porto to Santiago, vertical
relief exaggerated for the cinematic flyover. Geometry only (UV + smooth
normals) -- the Sentinel-2 drape and all shading live on the web side.

It then choreographs ONE pre-animated cinematic camera: a high, slightly
tilted bird's-eye flight that follows the real route (the waymark stations)
from Porto up the Atlantic coast and inland to Santiago in ~7 s. The whole
strecke in a single clean, smooth Catmull-Rom sweep -- "Google Maps but crazy
better", with NO floating game markers. The web side (src/scenes/camino.ts)
scrubs this baked camera clip by scroll via an AnimationMixer (mirrors
city.ts: action.time = clip.duration * scroll).

Build coords are chosen so the default glTF export (+Y up) lands as:
  X = east (metres->km),  Y = elevation,  north = -Z (the flight flies -Z).
The camera is authored in the SAME build space (X east, Y north, Z up) so the
+Y-up export lands it correctly over the terrain alongside the mesh.

  & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" \\
      --background --factory-startup --python scripts/blender/camino_set.py

Outputs:
  assets-src/camino/camino_raw.glb        (Terrain + CamPath + 7 s flight clip)
  public/assets/camino/camino_meta.json   (bbox, extent, exaggeration, stations)
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath or __file__))))
# bpy.data.filepath is empty in --background; resolve from this script instead
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "assets-src", "camino")

heights = np.load(os.path.join(SRC, "heights.npy")).astype(np.float64)  # [H, W], row 0 = north
meta = json.load(open(os.path.join(SRC, "dem_meta.json")))
geo = json.load(open(os.path.join(ROOT, "scripts", "camino", "geo.json")))

H, W = heights.shape
WIDTH_KM = meta["widthKm"]
DEPTH_KM = meta["depthKm"]
EXAG = meta["exaggeration"]
BBOX = meta["bbox"]

# light smoothing of the resampled field kills aliasing terraces on ridgelines
def smooth(a):
    p = np.pad(a, 1, mode="edge")
    return (
        p[1:-1, 1:-1] * 0.4
        + (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.125
        + (p[:-2, :-2] + p[:-2, 2:] + p[2:, :-2] + p[2:, 2:]) * 0.025
    )

heights = smooth(heights)

# -- vertices -----------------------------------------------------------------
jj, ii = np.meshgrid(np.arange(W), np.arange(H))        # ii=row(north->south), jj=col(west->east)
u = jj / (W - 1)
vn = ii / (H - 1)                                       # 0 = north, 1 = south
X = (u - 0.5) * WIDTH_KM                                # east
Y = (0.5 - vn) * DEPTH_KM                               # north positive -> glTF -Z
Z = heights / 1000.0 * EXAG                             # elevation in km, exaggerated
verts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]).astype(np.float32)

# per-vertex UV: u east, v flipped so north (vn=0) -> v=1 (texture top = north,
# three.js default flipY)
uv_vert = np.column_stack([u.ravel(), (1.0 - vn).ravel()]).astype(np.float32)

# -- quad faces ---------------------------------------------------------------
idx = np.arange(H * W).reshape(H, W)
a = idx[:-1, :-1].ravel()
b = idx[:-1, 1:].ravel()
c = idx[1:, 1:].ravel()
d = idx[1:, :-1].ravel()
# wind CCW seen from above (+Z up): a->d->c->b, so normals point UP (-> +Y on
# glTF export). The naive a->b->c->d order is CW from above -> down-facing
# normals -> the whole terrain back-face-culls to the sky.
faces = np.column_stack([a, d, c, b]).astype(np.int64)

mesh = bpy.data.meshes.new("Terrain")
mesh.from_pydata(verts.tolist(), [], faces.tolist())
mesh.validate()

# UVs per loop (look up each loop's vertex)
uv_layer = mesh.uv_layers.new(name="UVMap")
loop_vi = np.empty(len(mesh.loops), dtype=np.int64)
mesh.loops.foreach_get("vertex_index", loop_vi)
uv_flat = uv_vert[loop_vi].ravel()
uv_layer.data.foreach_set("uv", uv_flat)

mesh.shade_smooth()
mesh.update()

obj = bpy.data.objects.new("Terrain", mesh)
bpy.context.collection.objects.link(obj)

# strip the default scene of the factory cube/cam/light so only Terrain + the
# choreographed CamPath survive to export
for o in list(bpy.context.scene.objects):
    if o is not obj:
        bpy.data.objects.remove(o, do_unlink=True)

# =============================================================================
#  Cinematic bird's-eye camera -- a single pre-animated 7 s flight, baked into
#  the GLB. Authored in build space (X east, Y north, Z up); the +Y-up export
#  rotates it onto the terrain. Mirrors the proven city_set.py pattern:
#  Catmull-Rom path + ~quaternion keyframes with a flip-guard.
# =============================================================================
FPS = 30
SECONDS = 7.0
FRAMES = int(round(FPS * SECONDS)) + 1   # 211 frames @ 30fps -> 7.0 s clip
KEYS = 73                                # dense enough that the spline reads silk

# --- the real route as a smooth ground line (build space) --------------------
# Map a station's lon/lat to the terrain surface, exactly like the mesh does:
#   X = (u - 0.5) * WIDTH_KM ,  Y = (0.5 - vn) * DEPTH_KM
# and sample the (smoothed) heightfield for the ground elevation under it.
LON0, LON1 = BBOX["lonMin"], BBOX["lonMax"]
LAT0, LAT1 = BBOX["latMin"], BBOX["latMax"]

def ground_z(col_u, row_vn):
    """Bilinear height (km, exaggerated) at fractional grid coord (u, vn)."""
    fx = min(max(col_u, 0.0), 1.0) * (W - 1)
    fy = min(max(row_vn, 0.0), 1.0) * (H - 1)
    x0 = int(math.floor(fx)); x1 = min(x0 + 1, W - 1)
    y0 = int(math.floor(fy)); y1 = min(y0 + 1, H - 1)
    tx = fx - x0; ty = fy - y0
    h00 = heights[y0, x0]; h10 = heights[y0, x1]
    h01 = heights[y1, x0]; h11 = heights[y1, x1]
    h = (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty
    return h / 1000.0 * EXAG

def station_point(lon, lat):
    cu = (lon - LON0) / (LON1 - LON0)
    cvn = (LAT1 - lat) / (LAT1 - LAT0)
    x = (cu - 0.5) * WIDTH_KM
    y = (0.5 - cvn) * DEPTH_KM
    z = ground_z(cu, cvn)
    return Vector((x, y, z))

route = [station_point(s["lon"], s["lat"]) for s in geo["stations"]]
# Porto is the south end (low lat -> +Y here); Santiago the north end (-Y here).
# The flight travels from Porto (+Y) toward Santiago (-Y) i.e. into glTF -Z.

def catmull(pts, t):
    """Uniform Catmull-Rom through pts; t in [0,1]. (Same as city_set.py.)"""
    n = len(pts) - 1
    seg = min(int(t * n), n - 1)
    uu = t * n - seg
    p0 = pts[max(seg - 1, 0)]
    p1 = pts[seg]
    p2 = pts[seg + 1]
    p3 = pts[min(seg + 2, n)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * uu + (2 * p0 - 5 * p1 + 4 * p2 - p3) * uu * uu
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * uu * uu * uu)

# --- bird's-eye choreography -------------------------------------------------
# High, slightly tilted aerial: the camera rides ABOVE and slightly BEHIND the
# route point, looking forward-and-down at the land ahead. No orbit, no game
# beacons -- a clean Google-Earth-style flight that reveals the whole corridor.
ALT_KM = 19.0      # clearance above the ground the camera flies at (km)
BEHIND_KM = 16.0   # trail distance opposite travel, so we look INTO the route
FWD_KM = 17.0      # look-target distance ahead along travel
LOOK_DROP = 6.0    # aim this far below the forward ground point -> tilt down

def smoothstep(e0, e1, x):
    if e1 == e0:
        return 0.0 if x < e0 else 1.0
    u2 = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return u2 * u2 * (3.0 - 2.0 * u2)

# gentle establishing lift at Porto and a settling descent onto Santiago
def lift(t):
    start = (1.0 - smoothstep(0.0, 0.10, t)) * 9.0   # rise out of Porto
    land = smoothstep(0.86, 1.0, t) * 4.0            # ease down onto Santiago
    return start - land

def route_at(t):
    return catmull(route, min(max(t, 0.0), 1.0))

def tangent_at(t):
    """Travel direction along the route, flattened to the horizontal plane."""
    e = 0.004
    p0 = route_at(t - e)
    p1 = route_at(t + e)
    d = p1 - p0
    d.z = 0.0
    if d.length < 1e-6:
        return Vector((0.0, -1.0, 0.0))
    return d.normalized()

# --- camera object -----------------------------------------------------------
cam_data = bpy.data.cameras.new("CamPath")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(47.0)   # matches the web FOV default (camino.ts)
cam_data.clip_start = 0.1
cam_data.clip_end = 4000.0
cam = bpy.data.objects.new("CamPath", cam_data)
bpy.context.collection.objects.link(cam)
cam.rotation_mode = "QUATERNION"

scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAMES
scene.camera = cam

prev_q = None
# set LINEAR as the default for NEW keyframes (Blender 5.1's slotted Action API
# dropped action.fcurves, so we can't retune interpolation post-hoc as easily) —
# a perfectly even scrub, the Catmull-Rom path carries the smoothness.
try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
except Exception:
    pass
for i in range(KEYS):
    t = i / (KEYS - 1)
    frame = 1 + round(t * (FRAMES - 1))

    g = route_at(t)
    tan = tangent_at(t)

    # camera sits high, trailing the route point so it flies INTO the corridor
    pos = Vector((
        g.x - tan.x * BEHIND_KM,
        g.y - tan.y * BEHIND_KM,
        g.z + ALT_KM + lift(t),
    ))
    # aim ahead along the route and a touch below the ground -> bird's-eye tilt
    fwd = route_at(min(t + 0.05, 1.0))
    aim = Vector((
        g.x + tan.x * FWD_KM,
        g.y + tan.y * FWD_KM,
        fwd.z - LOOK_DROP,
    ))

    look = (aim - pos).normalized()
    q = look.to_track_quat("-Z", "Y")
    if prev_q is not None and prev_q.dot(q) < 0:
        q.negate()                      # flip-guard: no 180-degree quaternion pop
    prev_q = q.copy()

    cam.location = pos
    cam.rotation_quaternion = q
    cam.keyframe_insert("location", frame=frame)
    cam.keyframe_insert("rotation_quaternion", frame=frame)

# keys are already LINEAR (set via the preference above); just name the clip.
# (Blender 5.1 slotted Action has no .fcurves; new keys carry the LINEAR interp.)
if cam.animation_data and cam.animation_data.action:
    cam.animation_data.action.name = "CaminoFlight"

scene.frame_set(1)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
cam.select_set(True)
bpy.context.view_layer.objects.active = obj

raw = os.path.join(SRC, "camino_raw.glb")
bpy.ops.export_scene.gltf(
    filepath=raw,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_cameras=True,           # bake the CamPath camera + its flight clip
    export_lights=False,
    export_yup=True,
    export_normals=True,
    export_texcoords=True,
    export_animations=True,
    export_frame_range=True,
    export_anim_single_armature=False,
)

# -- meta for the web side (bbox + extent + stations) -------------------------
out_meta = {
    "bbox": meta["bbox"],
    "widthKm": WIDTH_KM,
    "depthKm": DEPTH_KM,
    "exaggeration": EXAG,
    "elevMin": meta["elevMin"],
    "elevMax": meta["elevMax"],
    "stations": geo["stations"],
}
pub = os.path.join(ROOT, "public", "assets", "camino")
os.makedirs(pub, exist_ok=True)
json.dump(out_meta, open(os.path.join(pub, "camino_meta.json"), "w"), indent=2)

print(f"Terrain: {len(verts)} verts, {len(faces)} quads  ({W}x{H})")
print(f"Camera: CamPath, {KEYS} keys, {FRAMES} frames @ {FPS}fps = {SECONDS}s flight")
print(f"wrote {raw} + camino_meta.json")
print("CAMINO_SET_OK")
