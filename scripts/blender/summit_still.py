# Look-dev still for the summit set — a camera resembling the web view
# (low, gazing forward across the fog toward the peaks) under the sunset
# HDRI. Lets us judge the composition before integrating on the web.
#   blender --background --factory-startup --python summit_set.py --python summit_still.py
# (run AFTER summit_set.py in the same process, or it rebuilds first)
import bpy, math, os

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
HDRI = os.path.join(ROOT, "assets-src", "polyhaven", "hdri", "qwantani_sunset_puresky_4k.hdr")
OUT = os.path.join(ROOT, "verify-out", "summit-blender.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.device = "GPU"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"

# sunset sky
world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
bg = nt.nodes.new("ShaderNodeBackground")
env = nt.nodes.new("ShaderNodeTexEnvironment")
out = nt.nodes.new("ShaderNodeOutputWorld")
try:
    env.image = bpy.data.images.load(HDRI)
except Exception as e:
    print("HDRI load failed:", e)
mp = nt.nodes.new("ShaderNodeMapping")
tc = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
mp.inputs["Rotation"].default_value[2] = math.radians(20)
bg.inputs["Strength"].default_value = 1.0

# vertex-colour preview material so the still resembles the unlit web look
for name in ("Outcrop", "Crags", "Peaks"):
    ob = bpy.data.objects.get(name)
    if not ob:
        continue
    m = bpy.data.materials.new(name + "_vc")
    m.use_nodes = True
    nt2 = m.node_tree
    nt2.nodes.clear()
    o = nt2.nodes.new("ShaderNodeOutputMaterial")
    e = nt2.nodes.new("ShaderNodeEmission")
    vc = nt2.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt2.links.new(vc.outputs["Color"], e.inputs["Color"])
    nt2.links.new(e.outputs["Emission"], o.inputs["Surface"])
    ob.data.materials.clear()
    ob.data.materials.append(m)

cam_data = bpy.data.cameras.new("Look")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(55.0)
cam = bpy.data.objects.new("Look", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
# a 3/4 elevated view to judge the rock's silhouette + the layers behind
import mathutils
cam.location = (-22.0, -24.0, 18.0)
aim = (0.0, 24.0, -1.0)
direction = mathutils.Vector(aim) - cam.location
cam.rotation_mode = "QUATERNION"
cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")

bpy.ops.render.render(write_still=True)
bpy.data.images["Render Result"].save_render(OUT)
print("SUMMIT_STILL_OK", OUT)
