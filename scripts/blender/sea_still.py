# Look-dev still for the sea set — the brig (and skiff) seen broadside,
# slightly from the bow, against the sunset HDRI, so the silhouette can be
# judged side-by-side with Aivazovsky before it goes on the web.
#   blender --background --factory-startup \
#       --python scripts/blender/sea_set.py --python scripts/blender/sea_still.py
import bpy, math, os, mathutils

ROOT = r"c:\Users\engel\OneDrive\000000000000000000000000000000000000000 ai\AI Agents Projects\agent fable 5"
HDRI = os.path.join(ROOT, "assets-src", "polyhaven", "hdri", "qwantani_sunset_puresky_4k.hdr")
OUT = os.path.join(ROOT, "verify-out", "sea-blender.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.device = "GPU"
scene.render.resolution_x = 1280
scene.render.resolution_y = 860
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"

# sunset sky, sun low to the left to read the silhouette as in the painting
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
mp.inputs["Rotation"].default_value[2] = math.radians(135)  # sun to camera-left
bg.inputs["Strength"].default_value = 1.0

# unlit vertex-colour preview, like the web look
for ob in bpy.data.objects:
    if ob.type != "MESH":
        continue
    m = bpy.data.materials.new(ob.name + "_vc")
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

# move the skiff out to the lower-right of the frame, smaller and forward
skiff = bpy.data.objects.get("Skiff")
if skiff:
    skiff.location = (4.5, -6.0, 0.0)
    skiff.rotation_euler = (0, 0, math.radians(-30))

# a low broadside camera, three-quarter from the bow, like the painting
cam_data = bpy.data.cameras.new("Look")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(42.0)
cam = bpy.data.objects.new("Look", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (14.0, -20.0, 4.2)
aim = (0.5, 0.0, 4.5)
direction = mathutils.Vector(aim) - cam.location
cam.rotation_mode = "QUATERNION"
cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")

bpy.ops.render.render(write_still=True)
bpy.data.images["Render Result"].save_render(OUT)
print("SEA_STILL_OK", OUT)
