# AO-Bake (Cycles/OPTIX -> Vertex-Colors) + GLB-Export des City-Sets.
# Voraussetzung: city_set.py ist gelaufen (Objekte City/Street/Neon/...).
#   node scripts/blender/bl.mjs exec scripts/blender/city_bake_export.py
import bpy
import os
import numpy as np

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT_DIR = os.path.join(ROOT, "assets-src", "city")
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "city_raw.glb")

scene = bpy.context.scene

# ── Cycles/OPTIX ─────────────────────────────────────────────────────
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
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

# AO-Reichweite begrenzen (Schluchten sonst komplett schwarz)
try:
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = 10.0
except Exception as e:
    print(f"BAKE ao distance skipped: {e}")

WIN_SLOT = 1  # Material-Slot "win_lit" im City-Mesh — kein AO auf Licht

def bake_ao(ob):
    me = ob.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color_index = [a.name for a in me.color_attributes].index("AO")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    print(f"BAKE ao ok: {ob.name}")

def combine(ob, skip_slots=()):
    """Col *= AO (geklemmt), Licht-Slots bleiben unberuehrt; AO-Layer weg."""
    me = ob.data
    col = me.color_attributes["Col"]
    ao = me.color_attributes["AO"]
    n = len(col.data)
    c = np.empty(n * 4, dtype=np.float32)
    a = np.empty(n * 4, dtype=np.float32)
    col.data.foreach_get("color", c)
    ao.data.foreach_get("color", a)
    pm = np.empty(len(me.polygons), dtype=np.int32)
    lt = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("material_index", pm)
    me.polygons.foreach_get("loop_total", lt)
    loop_mat = np.repeat(pm, lt)
    mask = ~np.isin(loop_mat, np.array(skip_slots, dtype=np.int32)) if skip_slots else np.ones(n, dtype=bool)
    f = np.where(mask, 0.25 + 0.75 * a[0::4], 1.0).astype(np.float32)
    for k in range(3):
        c[k::4] *= f
    col.data.foreach_set("color", c)
    me.color_attributes.remove(ao)
    me.color_attributes.active_color_index = [x.name for x in me.color_attributes].index("Col")
    me.update()
    print(f"BAKE combine ok: {ob.name} ({n} loops)")

for name, skips in (("City", (WIN_SLOT,)), ("Street", ())):
    ob = bpy.data.objects.get(name)
    if not ob:
        print(f"BAKE skip, missing: {name}")
        continue
    try:
        bake_ao(ob)
        combine(ob, skips)
    except Exception as e:
        # fail-soft: Set bleibt nutzbar, nur ohne AO
        print(f"BAKE FAILED on {name}: {e}")
        if "AO" in ob.data.color_attributes:
            ob.data.color_attributes.remove(ob.data.color_attributes["AO"])

# ── GLB-Export: Set + Kamera-Flug ────────────────────────────────────
EXPORT = ["City", "Street", "Neon", "Wires", "Beacons",
          "BB_porter", "BB_amadeus", "BB_papers", "CamPath"]
bpy.ops.object.select_all(action="DESELECT")
for name in EXPORT:
    ob = bpy.data.objects.get(name)
    if ob:
        ob.select_set(True)
    else:
        print(f"EXPORT missing: {name}")
scene.frame_set(1)

kwargs = dict(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_cameras=True,
    export_animations=True,
    export_image_format="AUTO",
)
try:
    bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

size_mb = os.path.getsize(GLB_PATH) / 1e6
print(f"CITY_EXPORT_OK {GLB_PATH} ({size_mb:.2f} MB)")
