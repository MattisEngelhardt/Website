# Pipeline-Proof: erzeugt einen echten Fels in Blender (headless),
# backt Farbe + Normalmap in Cycles und exportiert ein GLB.
#
#   blender --background --factory-startup --python scripts/blender/pipeline_proof.py
#
# Output: assets-src/proof/rock_raw.glb (wird danach mit gltf-transform optimiert)
import bpy
import os
import sys

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets-src", "proof"))
os.makedirs(OUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUT_DIR, "rock_raw.glb")

# ── Szene leeren ─────────────────────────────────────────────────────
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

# ── Grundform: Icosphere, durch Noise zum Fels verformt ─────────────
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0)
rock = bpy.context.active_object
rock.name = "ProofRock"
rock.scale = (1.0, 0.78, 0.62)  # liegender Findling

# grosse Formen
tex_big = bpy.data.textures.new("rock_big", type="CLOUDS")
tex_big.noise_scale = 1.6
mod_big = rock.modifiers.new("displace_big", "DISPLACE")
mod_big.texture = tex_big
mod_big.strength = 0.55

# Kanten / Brüche
tex_cracks = bpy.data.textures.new("rock_cracks", type="VORONOI")
tex_cracks.noise_scale = 0.7
mod_cracks = rock.modifiers.new("displace_cracks", "DISPLACE")
mod_cracks.texture = tex_cracks
mod_cracks.strength = 0.28

# feines Korn
tex_fine = bpy.data.textures.new("rock_fine", type="CLOUDS")
tex_fine.noise_scale = 0.18
mod_fine = rock.modifiers.new("displace_fine", "DISPLACE")
mod_fine.texture = tex_fine
mod_fine.strength = 0.07

bpy.ops.object.modifier_apply(modifier=mod_big.name)
bpy.ops.object.modifier_apply(modifier=mod_cracks.name)
bpy.ops.object.modifier_apply(modifier=mod_fine.name)

# auf Web-Budget reduzieren (~20k Tris) und glätten
mod_dec = rock.modifiers.new("decimate", "DECIMATE")
mod_dec.ratio = 0.12
bpy.ops.object.modifier_apply(modifier=mod_dec.name)
bpy.ops.object.shade_smooth()
print(f"PROOF mesh tris: {len(rock.data.polygons)}")

# ── UVs ──────────────────────────────────────────────────────────────
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003)
bpy.ops.object.mode_set(mode="OBJECT")

# ── Prozedurales Fels-Material (Quelle fürs Baking) ─────────────────
mat = bpy.data.materials.new("RockProcedural")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.92

noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 5.5
noise.inputs["Detail"].default_value = 10.0
noise.inputs["Roughness"].default_value = 0.62

ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.32
ramp.color_ramp.elements[0].color = (0.052, 0.045, 0.042, 1.0)  # dunkler Basalt
ramp.color_ramp.elements[1].position = 0.78
ramp.color_ramp.elements[1].color = (0.32, 0.28, 0.24, 1.0)  # verwitterter Stein
nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

bump_noise = nt.nodes.new("ShaderNodeTexNoise")
bump_noise.inputs["Scale"].default_value = 22.0
bump_noise.inputs["Detail"].default_value = 12.0
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.55
nt.links.new(bump_noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

rock.data.materials.append(mat)

# ── Cycles-Bake: Farbe + Normalmap → 1024er Images ──────────────────
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("PROOF bake device: GPU/OPTIX")
except Exception as e:  # CPU reicht für 1024er Bakes
    scene.cycles.device = "CPU"
    print(f"PROOF bake device: CPU ({e})")

def bake_to_image(name, bake_type, pass_filter=None, colorspace="sRGB"):
    img = bpy.data.images.new(name, 1024, 1024, alpha=False)
    img.colorspace_settings.name = colorspace
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    nt.nodes.active = node
    node.select = True
    kwargs = {"type": bake_type, "margin": 8}
    if pass_filter:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)
    return img, node

bpy.context.view_layer.objects.active = rock
rock.select_set(True)
img_color, node_color = bake_to_image("rock_basecolor", "DIFFUSE", {"COLOR"}, "sRGB")
img_normal, node_normal = bake_to_image("rock_normal", "NORMAL", None, "Non-Color")
print("PROOF bake done")

# ── Export-Material: nur die gebackenen Maps (glTF-tauglich) ────────
for n in [noise, ramp, bump_noise, bump]:
    nt.nodes.remove(n)
nt.links.new(node_color.outputs["Color"], bsdf.inputs["Base Color"])
nmap = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(node_normal.outputs["Color"], nmap.inputs["Color"])
nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

# ── GLB-Export ───────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
rock.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_image_format="AUTO",
)
size_mb = os.path.getsize(GLB_PATH) / 1e6
print(f"PROOF_EXPORT_OK {GLB_PATH} ({size_mb:.2f} MB)")
sys.stdout.flush()
