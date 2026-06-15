"""
Camino flyover — terrain set (headless).

Reads the prepared Copernicus heightfield and lofts it into a real displaced
terrain mesh: 211 km of the Camino Portugues from Porto to Santiago, vertical
relief exaggerated for the cinematic flyover. Geometry only (UV + smooth
normals) — the Sentinel-2 drape and all shading live on the web side.

Build coords are chosen so the default glTF export (+Y up) lands as:
  X = east (metres→km),  Y = elevation,  north = -Z (the flight flies into -Z).

  & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" \
      --background --factory-startup --python scripts/blender/camino_set.py

Outputs:
  assets-src/camino/camino_raw.glb
  public/assets/camino/camino_meta.json   (bbox, extent, exaggeration, stations)
"""
import json
import os

import bpy
import numpy as np

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

# light smoothing of the resampled field kills aliasing terraces on ridgelines
def smooth(a):
    p = np.pad(a, 1, mode="edge")
    return (
        p[1:-1, 1:-1] * 0.4
        + (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.125
        + (p[:-2, :-2] + p[:-2, 2:] + p[2:, :-2] + p[2:, 2:]) * 0.025
    )

heights = smooth(heights)

# ── vertices ────────────────────────────────────────────────────────────────
jj, ii = np.meshgrid(np.arange(W), np.arange(H))        # ii=row(north→south), jj=col(west→east)
u = jj / (W - 1)
vn = ii / (H - 1)                                       # 0 = north, 1 = south
X = (u - 0.5) * WIDTH_KM                                # east
Y = (0.5 - vn) * DEPTH_KM                               # north positive → glTF -Z
Z = heights / 1000.0 * EXAG                             # elevation in km, exaggerated
verts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]).astype(np.float32)

# per-vertex UV: u east, v flipped so north (vn=0) → v=1 (texture top = north,
# three.js default flipY)
uv_vert = np.column_stack([u.ravel(), (1.0 - vn).ravel()]).astype(np.float32)

# ── quad faces ──────────────────────────────────────────────────────────────
idx = np.arange(H * W).reshape(H, W)
a = idx[:-1, :-1].ravel()
b = idx[:-1, 1:].ravel()
c = idx[1:, 1:].ravel()
d = idx[1:, :-1].ravel()
# wind CCW seen from above (+Z up): a→d→c→b, so normals point UP (→ +Y on glTF
# export). The naive a→b→c→d order is CW from above → down-facing normals →
# the whole terrain back-face-culls to the sky.
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

# strip the default scene of the factory cube/cam/light so only Terrain exports
for o in list(bpy.context.scene.objects):
    if o is not obj:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

raw = os.path.join(SRC, "camino_raw.glb")
bpy.ops.export_scene.gltf(
    filepath=raw,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_normals=True,
    export_texcoords=True,
)

# ── meta for the web side (bbox + extent + stations) ──────────────────────────
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
print(f"wrote {raw} + camino_meta.json")
