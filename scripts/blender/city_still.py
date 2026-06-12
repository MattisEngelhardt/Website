# Look-Dev-Stills des City-Sets: Cycles/OPTIX, Volumen-Haze, AgX.
# Rendert Stationen des Kamerapfads nach verify-out/ (gitignored).
#   node scripts/blender/bl.mjs exec scripts/blender/city_still.py
import bpy
import os

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
OUT = os.path.join(ROOT, "verify-out")
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene

# ── Welt: Nachthimmel + Regen-Haze als Volumen ───────────────────────
world = bpy.data.worlds.get("CityNight") or bpy.data.worlds.new("CityNight")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputWorld")
bg = nt.nodes.new("ShaderNodeBackground")
# Lichtdom der Stadt: der Himmel selbst gluht leicht violett
bg.inputs["Color"].default_value = (0.012, 0.008, 0.026, 1.0)
bg.inputs["Strength"].default_value = 1.0
vol = nt.nodes.new("ShaderNodeVolumeScatter")
vol.inputs["Color"].default_value = (0.36, 0.30, 0.55, 1.0)  # violetter Regen-Haze
vol.inputs["Density"].default_value = 0.004
vol.inputs["Anisotropy"].default_value = 0.35
nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

# ── Cycles auf der echten GPU ────────────────────────────────────────
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("STILL device: GPU/OPTIX")
except Exception as e:
    scene.cycles.device = "CPU"
    print(f"STILL device: CPU ({e})")

scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Punchy"
except Exception:
    pass
scene.view_settings.exposure = 0.25

cam = bpy.data.objects.get("CamPath")
if cam:
    scene.camera = cam

for frame in (1, 110, 200, 241):
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT, f"city-blender-f{frame:03d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"STILL f{frame} -> {scene.render.filepath}")
print("STILL_OK")
