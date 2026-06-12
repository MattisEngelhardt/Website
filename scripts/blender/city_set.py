# Akt II — "Die Stadt der Agenten": baut die Neo-Tokyo-Strassenschlucht
# als ECHTES Blender-Set (Doktrin 12.06.: keine Code-Rechtecke im Browser).
#
#   node scripts/blender/bl.mjs exec scripts/blender/city_set.py   (GUI, live)
#   blender --background --factory-startup --python scripts/blender/city_set.py
#
# Erzeugt: City / Street / Neon / Wires / Beacons / BB_* Meshes mit
# Vertex-Colors (Tint + Fenster-Watt) und die Kamera "CamPath" mit
# 10s-Flug (241 Frames, 24fps) DURCH die Schlucht. Danach:
# city_bake_export.py (AO-Bake + GLB-Export).
import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector

SEED = 20260612
rng = random.Random(SEED)

STOREY = 3.0
CANYON = 10.5  # Fassadenflucht |x|
FPS = 24
FRAMES = 241  # 10 s

# Material-Slots der City-/Street-Meshes
FACADE, WIN, GLASS, METAL = 0, 1, 2, 3

# das Neon-Trio (verschobenes Quintett)
NEON = {
    "sun": (1.0, 0.78, 0.22),
    "cyan": (0.10, 0.88, 0.80),
    "magenta": (1.0, 0.16, 0.42),
}

# ── Szene leeren (idempotent, auch via Socket mehrfach lauffähig) ────
def clean():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                 bpy.data.cameras, bpy.data.images, bpy.data.lights):
        for d in list(coll):
            try:
                coll.remove(d)
            except Exception:
                pass

clean()
print("CITY clean ok")

# ── Materialien (Attribute "Col" -> Cycles UND glTF-Vertexfarben) ────
def make_mat(name, base=(0, 0, 0), rough=0.85, emit=None, strength=0.0,
             use_attr=False, attr_emission=False, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if use_attr:
        # ShaderNodeVertexColor: vom glTF-Exporter als COLOR_0 erkannt
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        if attr_emission:
            nt.links.new(attr.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = strength
        else:
            nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat

m_facade = make_mat("facade", rough=0.9, use_attr=True)
m_win = make_mat("win_lit", base=(0.005, 0.005, 0.008), rough=0.4,
                 use_attr=True, attr_emission=True, strength=3.2)
m_glass = make_mat("win_dark", base=(0.012, 0.015, 0.028), rough=0.18)
m_metal = make_mat("metal", rough=0.6, use_attr=True)
m_street = make_mat("street", rough=0.22, use_attr=True)
m_wire = make_mat("wire", base=(0.004, 0.004, 0.006), rough=0.7)
m_beacon = make_mat("beacon", emit=(1.0, 0.25, 0.12), strength=10.0)
m_neon = {k: make_mat(f"neon_{k}", emit=v, strength=8.0) for k, v in NEON.items()}
m_bb = {p: make_mat(f"neon_{p}", emit=NEON[c], strength=6.0)
        for p, c in (("porter", "sun"), ("amadeus", "cyan"), ("papers", "magenta"))}

# ── bmesh-Helfer ─────────────────────────────────────────────────────
def new_bm():
    bm = bmesh.new()
    col = bm.loops.layers.float_color.new("Col")
    return bm, col

def set_col(face, layer, c):
    for lo in face.loops:
        lo[layer] = (*c, 1.0)

def quad(bm, layer, p, u, v, mat, col):
    f = bm.faces.new((
        bm.verts.new(p),
        bm.verts.new((p[0] + u[0], p[1] + u[1], p[2] + u[2])),
        bm.verts.new((p[0] + u[0] + v[0], p[1] + u[1] + v[1], p[2] + u[2] + v[2])),
        bm.verts.new((p[0] + v[0], p[1] + v[1], p[2] + v[2])),
    ))
    f.material_index = mat
    set_col(f, layer, col)
    return f

def cube(bm, layer, center, size, mat, col):
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1.0)))
    faces = {f for v in res["verts"] for f in v.link_faces}
    for f in faces:
        f.material_index = mat
        set_col(f, layer, col)
    return faces

# ── Fenster-Logik: eine Fassade = Grid aus Zellen mit ECHTEN Insets ──
def pick_pane(b):
    """Material + Farbe einer Fensterzelle — Watt/Tint in der Vertexfarbe."""
    if rng.random() > b["lit"]:
        return GLASS, (0.0, 0.0, 0.0)
    r = rng.random()
    if r < b["warmth"]:
        tint = (1.0, 0.55 + rng.random() * 0.18, 0.24)
    elif r < b["warmth"] + 0.13:
        tint = (0.45, 0.92, 0.9)
    elif r < b["warmth"] + 0.19:
        tint = (1.0, 0.34, 0.55)
    else:
        tint = (0.80, 0.82, 0.72)
    # die meisten Fenster gluehen leise, wenige brennen
    w = 0.15 + (rng.random() ** 1.7) * 0.85
    return WIN, (tint[0] * w, tint[1] * w, tint[2] * w)

def facade_grid(bm, layer, origin, u_dir, n_dir, widths, heights,
                margin_u, margin_v, depth, b, shop_row=False):
    """Eine Fassadenebene: Zellen mit zurueckgesetzten Scheiben (Inset-
    Geometrie!). origin = linke untere Ecke, u_dir = Breitenrichtung,
    v = +Z, n_dir = Aussennormale."""
    faces = []
    up = Vector((0, 0, 1))
    u = Vector(u_dir)
    n = Vector(n_dir)
    cv = 0.0
    for ri, rh in enumerate(heights):
        cu = 0.0
        for wi, cw in enumerate(widths):
            p0 = Vector(origin) + u * cu + up * cv
            mu = cw * margin_u
            mv = rh * margin_v
            shop = shop_row and ri == 0
            if shop:
                mu, mv = cw * 0.10, rh * 0.12
            ou, ov = mu, mv
            # Wandring (4 Quads)
            faces.append(quad(bm, layer, p0, u * cw, up * ov, FACADE, b["tint"]))
            faces.append(quad(bm, layer, p0 + up * (rh - ov), u * cw, up * ov, FACADE, b["tint"]))
            faces.append(quad(bm, layer, p0 + up * ov, u * ou, up * (rh - 2 * ov), FACADE, b["tint"]))
            faces.append(quad(bm, layer, p0 + u * (cw - ou) + up * ov, u * ou, up * (rh - 2 * ov), FACADE, b["tint"]))
            # Laibungen + zurueckgesetzte Scheibe (Windings: sichtbare
            # Seite zeigt in die Oeffnung)
            iw = cw - 2 * ou
            ih = rh - 2 * ov
            pin = p0 + u * ou + up * ov
            d = n * (-depth)
            faces.append(quad(bm, layer, pin, u * iw, d, FACADE, b["tint"]))
            faces.append(quad(bm, layer, pin + up * ih, d, u * iw, FACADE, b["tint"]))
            faces.append(quad(bm, layer, pin, d, up * ih, FACADE, b["tint"]))
            faces.append(quad(bm, layer, pin + u * iw, up * ih, d, FACADE, b["tint"]))
            if shop:
                mat, col = WIN, (1.0, 0.55 + rng.random() * 0.22, 0.22) if rng.random() < 0.78 else (0.4, 0.9, 0.85)
                col = (col[0] * 0.95, col[1] * 0.95, col[2] * 0.95)
            else:
                mat, col = pick_pane(b)
            faces.append(quad(bm, layer, pin + d, u * iw, up * ih, mat, col))
            cu += cw
        cv += rh
    return faces

def building(bm, layer, cx, cy, w, d, h, b, detail="punched", shop=False):
    """Geschlossener Baukoerper: 4 Fassaden-Grids + Dach + Boden +
    Bruestung; detail: punched | band (Band = breite Fensterzeilen)."""
    storeys = max(2, round(h / STOREY))
    ground = 4.4 if shop else STOREY
    upper = storeys - 1
    heights = [ground] + [STOREY] * upper
    H = sum(heights)

    def cols(width):
        if detail == "band":
            n = max(1, round(width / 4.4))
        else:
            n = max(2, round(width / 2.0))
        return [width / n] * n

    if detail == "band":
        heights = [ground] + [STOREY * 2] * max(1, round(upper / 2))
        H = sum(heights)
    mv = 0.34 if detail == "punched" else 0.22
    mu = 0.30 if detail == "punched" else 0.12

    x0, x1 = cx - w / 2, cx + w / 2
    y0, y1 = cy - d / 2, cy + d / 2
    facade_grid(bm, layer, (x0, y0, 0), (1, 0, 0), (0, -1, 0), cols(w), heights, mu, mv, 0.28, b, shop)
    facade_grid(bm, layer, (x1, y1, 0), (-1, 0, 0), (0, 1, 0), cols(w), heights, mu, mv, 0.28, b, shop)
    facade_grid(bm, layer, (x1, y0, 0), (0, 1, 0), (1, 0, 0), cols(d), heights, mu, mv, 0.28, b, shop)
    facade_grid(bm, layer, (x0, y1, 0), (0, -1, 0), (-1, 0, 0), cols(d), heights, mu, mv, 0.28, b, shop)
    # Dach + Boden
    quad(bm, layer, (x0, y0, H), (w, 0, 0), (0, d, 0), FACADE, (b["tint"][0] * 0.32, b["tint"][1] * 0.32, b["tint"][2] * 0.32))
    quad(bm, layer, (x0, y0, 0), (0, d, 0), (w, 0, 0), FACADE, b["tint"])

    # Bruestung
    t = 0.22
    pc = (b["tint"][0] * 0.7, b["tint"][1] * 0.7, b["tint"][2] * 0.7)
    cube(bm, layer, (cx, y0 + t / 2, H + 0.35), (w, t, 0.7), FACADE, pc)
    cube(bm, layer, (cx, y1 - t / 2, H + 0.35), (w, t, 0.7), FACADE, pc)
    cube(bm, layer, (x0 + t / 2, cy, H + 0.35), (t, d - 2 * t, 0.7), FACADE, pc)
    cube(bm, layer, (x1 - t / 2, cy, H + 0.35), (t, d - 2 * t, 0.7), FACADE, pc)

    # Dach-Requisiten
    mc = (0.045, 0.05, 0.062)
    for _ in range(rng.randrange(1, 3)):
        if rng.random() < 0.8:
            cube(bm, layer, (cx + (rng.random() - 0.5) * w * 0.5, cy + (rng.random() - 0.5) * d * 0.5, H + 0.55),
                 (1.0 + rng.random() * 1.2, 0.9 + rng.random() * 0.8, 0.9 + rng.random() * 0.6), METAL, mc)
    if rng.random() < 0.35 and detail == "punched":
        # Wassertank
        r, th = 0.9, 2.2
        mat = Matrix.Translation((cx - w * 0.22, cy + d * 0.2, H + th / 2))
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=r, depth=th, matrix=mat)
        faces = {f for v in res["verts"] for f in v.link_faces}
        for f in faces:
            f.material_index = METAL
            set_col(f, layer, mc)
    if h > 30 and rng.random() < 0.7:
        # Antenne
        mat = Matrix.Translation((cx, cy, H + 3.2))
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.05, depth=6.4, matrix=mat)
        faces = {f for v in res["verts"] for f in v.link_faces}
        for f in faces:
            f.material_index = METAL
            set_col(f, layer, mc)
    return H

# ── Stadt-Layout ─────────────────────────────────────────────────────
bm_city, col_city = new_bm()

HEROES = [
    {"proj": "porter", "x": -17.0, "y": 108.0, "w": 20, "d": 20, "h": 112, "screen_z": 50, "screen_w": 17.0,
     "name": "PORTER", "color": "sun"},
    {"proj": "amadeus", "x": 16.0, "y": 84.0, "w": 16, "d": 16, "h": 80, "screen_z": 37, "screen_w": 11.5,
     "name": "AMADEUS", "color": "cyan"},
    {"proj": "papers", "x": 19.0, "y": 126.0, "w": 15, "d": 15, "h": 62, "screen_z": 30, "screen_w": 10.5,
     "name": "PAPERS", "color": "magenta"},
]

def hero_clear(x, y, w, d):
    return any(abs(x - t["x"]) < (w + t["w"]) / 2 + 1.5 and abs(y - t["y"]) < (d + t["d"]) / 2 + 1.5 for t in HEROES)

placed = []  # (side, y, depth) der Front-Reihe fuer Schilder/Vending

# Front-Reihe: Fassadenflucht an |x| = CANYON, echtes Fenster-Detail
for side in (-1, 1):
    y = -38.0
    while y < 152.0:
        w = 8.0 + rng.random() * 6.5  # entlang y
        d = 7.0 + rng.random() * 3.0  # entlang x
        h = STOREY * rng.randrange(5, 12)
        cx = side * (CANYON + d / 2)
        cy = y + w / 2
        if not hero_clear(cx, cy, d, w):
            b = {"tint": rng.choice([
                    (0.050, 0.055, 0.075), (0.065, 0.065, 0.090),
                    (0.085, 0.065, 0.055), (0.040, 0.050, 0.062)]),
                 "lit": 0.16 + rng.random() * 0.16,
                 "warmth": 0.55 + rng.random() * 0.2}
            building(bm_city, col_city, cx, cy, d, w, h, b, "punched", shop=True)
            placed.append((side, cy, w))
        y += w + 1.2 + rng.random() * 2.2

# Mittlere Reihe: Band-Tower 30–70 m
for side in (-1, 1):
    y = -34.0
    while y < 150.0:
        w = 11.0 + rng.random() * 6
        d = 10.0 + rng.random() * 5
        h = 30 + rng.random() * 40
        cx = side * (24.5 + rng.random() * 7)
        cy = y + w / 2
        if not hero_clear(cx, cy, d, w):
            b = {"tint": (0.045, 0.050, 0.072),
                 "lit": 0.26 + rng.random() * 0.18, "warmth": 0.45}
            building(bm_city, col_city, cx, cy, d, w, h, b, "band")
        y += w + 3 + rng.random() * 5

# Hintere Reihe: ferne Silhouetten-Tower (Haze frisst Details)
back_tops = []
for side in (-1, 1):
    y = -30.0
    while y < 150.0:
        w = 14.0 + rng.random() * 8
        h = 60 + rng.random() * 70
        cx = side * (44 + rng.random() * 14)
        cy = y + w / 2
        b = {"tint": (0.035, 0.045, 0.065), "lit": 0.36, "warmth": 0.4}
        H = building(bm_city, col_city, cx, cy, 12 + rng.random() * 5, w, h, b, "band")
        back_tops.append((cx, cy, H))
        y += w + 4 + rng.random() * 8

# Hero-Tuerme (Projekte) mit Ruecksprung-Silhouette
for t in HEROES:
    b = {"tint": (0.052, 0.058, 0.085), "lit": 0.40, "warmth": 0.4}
    building(bm_city, col_city, t["x"], t["y"], t["w"], t["d"], t["h"] * 0.62, b, "band")
    building(bm_city, col_city, t["x"], t["y"], t["w"] * 0.74, t["d"] * 0.74, t["h"] * 0.86, b, "band")
    building(bm_city, col_city, t["x"], t["y"], t["w"] * 0.5, t["d"] * 0.5, t["h"], b, "band")

# AC-Boxen an Front-Fassaden (haengende Kisten — Kowloon-Textur)
for side, cy, w in placed:
    fx = side * CANYON
    for _ in range(int(w * 0.5)):
        if rng.random() < 0.45:
            z = 4.4 + rng.randrange(0, 6) * STOREY + 0.6
            yy = cy - w / 2 + 0.8 + rng.random() * (w - 1.6)
            cube(bm_city, col_city, (fx - side * 0.22, yy, z), (0.5, 0.62, 0.42), METAL, (0.05, 0.055, 0.07))

# Lightbox-Schilder quer zur Fassade (Shibuya-Dichte — die Referenz
# stapelt leuchtende Kaesten auf jeder Hoehe)
# warm-dominant wie die Referenz: Natriumgelb/Orange/Rot tragen,
# Cyan/Magenta sind die Akzente
LIGHTBOX_TINTS = [
    (1.0, 0.62, 0.20), (1.0, 0.62, 0.20), (1.0, 0.30, 0.12),
    (1.0, 0.30, 0.12), (1.0, 0.82, 0.50), (0.95, 0.30, 0.18),
    (0.50, 0.85, 0.95), (0.95, 0.40, 0.55), (0.90, 0.88, 0.72),
]
for side, cy, w in placed:
    for _ in range(2):
        if rng.random() < 0.75:
            bz = 3.4 + rng.random() * 10
            by = cy - w / 2 + 0.8 + rng.random() * max(w - 1.6, 0.5)
            bw = 0.7 + rng.random() * 0.7
            bh = 0.6 + rng.random() * 1.7
            bx = side * (CANYON - bw / 2 + 0.06)
            cube(bm_city, col_city, (bx, by, bz), (bw, 0.16, bh), METAL, (0.04, 0.04, 0.05))
            tint = rng.choice(LIGHTBOX_TINTS)
            for sy in (-1, 1):
                f = quad(bm_city, col_city, (bx - bw / 2, by + sy * 0.085, bz - bh / 2),
                         (bw, 0, 0), (0, 0, bh), WIN, tint)
                if sy > 0:
                    f.normal_flip()  # Leuchtflaeche zeigt von der Platte weg

# Vending-Machines + Poller auf dem Gehweg
bollard_c = (0.04, 0.045, 0.06)
for side in (-1, 1):
    y = -30.0
    while y < 140.0:
        if rng.random() < 0.6:
            vy = y + rng.random() * 6
            bx = side * (CANYON - 0.85)
            cube(bm_city, col_city, (bx, vy, 1.08), (0.78, 0.95, 1.8), METAL, (0.05, 0.05, 0.065))
            # leuchtende Front zur Strasse
            tint = rng.choice([(0.55, 0.85, 0.95), (1.0, 0.7, 0.35), (0.95, 0.4, 0.55)])
            f = quad(bm_city, col_city, (bx - side * 0.41, vy - 0.38, 0.36), (0, 0.76, 0), (0, 0, 1.3), WIN, tint)
            if side > 0:
                f.normal_flip()
        y += 14 + rng.random() * 9
for side in (-1, 1):
    for y in range(-32, 140, 12):
        mat = Matrix.Translation((side * 7.35, y + rng.random() * 3, 0.32))
        res = bmesh.ops.create_cone(bm_city, cap_ends=True, segments=8, radius1=0.08, radius2=0.07, depth=0.64, matrix=mat)
        for fc in {f for v in res["verts"] for f in v.link_faces}:
            fc.material_index = METAL
            set_col(fc, col_city, bollard_c)

print(f"CITY buildings: {len(bm_city.faces)} faces")

# ── Strasse: Fahrbahn, Gehwege, Bordstein, Markierungen ─────────────
bm_st, col_st = new_bm()
ASPHALT = (0.022, 0.024, 0.034)
SIDEWALK = (0.040, 0.042, 0.052)
CURB = (0.060, 0.064, 0.078)
Y0, Y1 = -42.0, 158.0
SEG = 4.0
y = Y0
while y < Y1:
    y2 = min(y + SEG, Y1)
    quad(bm_st, col_st, (-7, y, 0), (14, 0, 0), (0, y2 - y, 0), FACADE, ASPHALT)
    for side in (-1, 1):
        xo = side * 7
        xi = side * CANYON
        quad(bm_st, col_st, (xo, y, 0.16), (xi - xo, 0, 0), (0, y2 - y, 0), FACADE, SIDEWALK)
        f = quad(bm_st, col_st, (xo, y, 0), (0, 0, 0.16), (0, y2 - y, 0), FACADE, CURB)
        if side < 0:
            f.normal_flip()  # Bordstein zeigt zur Fahrbahnmitte
    y = y2
# Mittellinie (gestrichelt) + Zebrastreifen
y = Y0 + 2
while y < Y1:
    quad(bm_st, col_st, (-0.09, y, 0.012), (0.18, 0, 0), (0, 2.2, 0), FACADE, (0.30, 0.30, 0.26))
    y += 5.2
for i in range(9):
    quad(bm_st, col_st, (-6.4 + i * 1.5, 38.0, 0.012), (0.7, 0, 0), (0, 3.8, 0), FACADE, (0.26, 0.26, 0.24))
for f in bm_st.faces:
    if f.normal.z < -0.5:
        f.normal_flip()
print(f"CITY street: {len(bm_st.faces)} faces")

# ── Neon: Schilder, Buchstaben, Roehren ──────────────────────────────
bm_neon, col_neon = new_bm()
neon_slots = {"sun": 0, "cyan": 1, "magenta": 2}

def glyph_meshes(text, size):
    """Extrudierte Text-Glyphen als Meshes (echte Geometrie)."""
    out = []
    for ch in text:
        cu = bpy.data.curves.new(f"g_{ch}", "FONT")
        cu.body = ch
        cu.size = size
        cu.extrude = size * 0.05
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        ob = bpy.data.objects.new(f"g_{ch}", cu)
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    meshes = []
    for ob in out:
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
        meshes.append(me)
        bpy.data.objects.remove(ob, do_unlink=True)
    return meshes

def append_mesh(bm, layer, me, matrix, slot):
    n0 = len(bm.verts)
    f0 = len(bm.faces)
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts[n0:])
    for f in bm.faces[f0:]:
        f.material_index = slot
        set_col(f, layer, (1, 1, 1))
    bpy.data.meshes.remove(me)

# Vertikale Schilder mit den Worten der Stadt
SIGNS = [
    ("AGENTS", "cyan", 1, -15.0, 16.5),
    ("LOCAL", "magenta", -1, 2.0, 14.0),
    ("BUILD", "sun", 1, 18.0, 17.5),
    ("SHIP", "cyan", -1, 34.0, 12.5),
    ("OPEN", "magenta", 1, 50.0, 15.0),
    ("ARCADE", "sun", -1, 66.0, 18.0),
]
ROT_FACE_MINUS_Y = Matrix.Rotation(math.pi / 2, 4, "X")
for word, color, side, sy, top in SIGNS:
    slot = neon_slots[color]
    n = len(word)
    board_h = n * 1.18 + 0.8
    bx = side * (CANYON - 0.72)
    bz = top - board_h / 2
    # Traegerplatte (dunkel) + Neonrahmen auf beiden Y-Seiten
    cube(bm_neon, col_neon, (bx, sy, bz), (1.34, 0.16, board_h), 3, (0.02, 0.02, 0.03))
    for dy in (-0.1, 0.1):
        for dx in (-0.7, 0.7):
            cube(bm_neon, col_neon, (bx + dx, sy + dy, bz), (0.06, 0.04, board_h + 0.12), slot, (1, 1, 1))
    meshes = glyph_meshes(word, 0.95)
    for i, me in enumerate(meshes):
        z = top - 0.85 - i * 1.18
        # Glyphen beidseitig lesbar: ±Y
        append_mesh(bm_neon, col_neon, me, Matrix.Translation((bx, sy - 0.13, z)) @ ROT_FACE_MINUS_Y, slot)
    # zweite Seite: gespiegelte Kopie der Glyphen (fuer Rueckblick)
print("CITY signs ok")

# Shop-Neonroehren ueber den Erdgeschossen
for side, cy, w in placed:
    if rng.random() < 0.8:
        ln = min(w * 0.7, 2.2 + rng.random() * 3.2)
        color = rng.choice(list(neon_slots))
        cube(bm_neon, col_neon, (side * (CANYON - 0.09), cy, 4.62), (0.10, ln, 0.13), neon_slots[color], (1, 1, 1))
        if rng.random() < 0.4:
            c2 = rng.choice(list(neon_slots))
            cube(bm_neon, col_neon, (side * (CANYON - 0.09), cy + 0.2, 4.30), (0.08, ln * 0.7, 0.09), neon_slots[c2], (1, 1, 1))

# ── Hero-Billboards: Panel + Schrift + Rahmen, je Projekt ein Objekt ─
bb_objects = []
for t in HEROES:
    bmb, colb = new_bm()
    sw, sh = t["screen_w"], t["screen_w"] * 0.42
    cx, cy, cz = t["x"], t["y"] - t["d"] / 2 - 0.45, t["screen_z"]
    cube(bmb, colb, (cx, cy + 0.18, cz), (sw + 0.7, 0.36, sh + 0.7), 0, (0.018, 0.02, 0.03))  # Panel
    # Screenflaeche (sehr dunkel, glaenzend) — Normale -Y zur Kamera
    quad(bmb, colb, (cx - sw / 2, cy - 0.005, cz - sh / 2), (sw, 0, 0), (0, 0, sh), 1, (0.01, 0.012, 0.02))
    # Neonrahmen
    for dz in (-sh / 2 - 0.16, sh / 2 + 0.16):
        cube(bmb, colb, (cx, cy - 0.02, cz + dz), (sw + 0.46, 0.08, 0.1), 2, (1, 1, 1))
    for dx in (-sw / 2 - 0.16, sw / 2 + 0.16):
        cube(bmb, colb, (cx + dx, cy - 0.02, cz), (0.1, 0.08, sh + 0.46), 2, (1, 1, 1))
    # Projektname als extrudierte Glyphen
    meshes = glyph_meshes(t["name"], sh * 0.38)
    total_w = sh * 0.38 * 0.86 * len(t["name"])
    for i, me in enumerate(meshes):
        x = cx - total_w / 2 + (i + 0.5) * (total_w / len(t["name"]))
        append_mesh(bmb, colb, me, Matrix.Translation((x, cy - 0.12, cz + sh * 0.07)) @ ROT_FACE_MINUS_Y, 2)
    # Unterzeile als Lichtbalken
    cube(bmb, colb, (cx, cy - 0.06, cz - sh * 0.3), (total_w * 0.8, 0.05, 0.09), 2, (1, 1, 1))

    me = bpy.data.meshes.new(f"BB_{t['proj']}")
    bmb.to_mesh(me)
    bmb.free()
    me.materials.append(m_metal)
    me.materials.append(m_glass)
    me.materials.append(m_bb[t["proj"]])
    ob = bpy.data.objects.new(f"BB_{t['proj']}", me)
    bpy.context.scene.collection.objects.link(ob)
    bb_objects.append(ob)
print("CITY billboards ok")

# ── Stromleitungen ueber der Schlucht (Catenary-Polylines) ───────────
bm_w, col_w = new_bm()
def wire(p0, p1, sag, r=0.022, segs=10):
    pts = []
    for i in range(segs + 1):
        t = i / segs
        p = Vector(p0).lerp(Vector(p1), t)
        p.z -= sag * 4 * t * (1 - t)
        pts.append(p)
    cu = bpy.data.curves.new("wire", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1.0)
    cu.bevel_depth = r
    cu.bevel_resolution = 1
    ob = bpy.data.objects.new("wire", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    n0 = len(bm_w.verts)
    f0 = len(bm_w.faces)
    bm_w.from_mesh(me)
    bm_w.verts.ensure_lookup_table()
    bm_w.faces.ensure_lookup_table()
    for f in bm_w.faces[f0:]:
        set_col(f, col_w, (0.004, 0.004, 0.006))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    bpy.data.curves.remove(cu)

wy = -34.0
while wy < 150.0:
    if not (-16.0 < wy < 8.0):  # Kamerafenster beim Sturzflug freihalten
        z = 11.5 + rng.random() * 4.5
        for k in range(rng.randrange(1, 3)):
            wire((-CANYON + 0.1, wy + k * 0.5, z + k * 0.55),
                 (CANYON - 0.1, wy + k * 0.4 + rng.random(), z + rng.random() * 1.2),
                 1.0 + rng.random() * 0.8)
    wy += 11 + rng.random() * 7
print(f"CITY wires: {len(bm_w.faces)} faces")

# ── Beacons (rote Pulse) auf den hoechsten Daechern ──────────────────
bm_b, col_b = new_bm()
beacon_spots = [(t["x"], t["y"], t["h"] + 0.5) for t in HEROES]
beacon_spots += [(x, y, H + 0.5) for x, y, H in sorted(back_tops, key=lambda s: -s[2])[:4]]
for x, y, z in beacon_spots:
    res = bmesh.ops.create_icosphere(bm_b, subdivisions=1, radius=0.45, matrix=Matrix.Translation((x, y, z)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        set_col(f, col_b, (1, 1, 1))

# ── Meshes -> Objekte ────────────────────────────────────────────────
def to_object(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

ob_city = to_object("City", bm_city, [m_facade, m_win, m_glass, m_metal])
ob_street = to_object("Street", bm_st, [m_street])
ob_neon = to_object("Neon", bm_neon, [m_neon["sun"], m_neon["cyan"], m_neon["magenta"], m_metal])
ob_wires = to_object("Wires", bm_w, [m_wire])
ob_beacons = to_object("Beacons", bm_b, [m_beacon])

# ── Kamera: der Flug DURCH die Schlucht, in Blender choreographiert ──
CAM_PTS = [
    Vector((0.0, -68.0, 52.0)),
    Vector((-3.5, -34.0, 28.0)),
    Vector((2.8, 2.0, 9.5)),
    Vector((-1.8, 40.0, 3.4)),
    Vector((0.5, 70.0, 5.0)),
]
AIM_PTS = [
    Vector((0.0, 25.0, 20.0)),
    Vector((0.0, 40.0, 14.0)),
    Vector((-2.0, 55.0, 9.0)),
    Vector((-6.0, 85.0, 14.0)),
    Vector((-16.0, 106.0, 50.0)),
]

def catmull(pts, t):
    n = len(pts) - 1
    seg = min(int(t * n), n - 1)
    u = t * n - seg
    p0 = pts[max(seg - 1, 0)]
    p1 = pts[seg]
    p2 = pts[seg + 1]
    p3 = pts[min(seg + 2, n)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)

cam_data = bpy.data.cameras.new("CamPath")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(55.0)
cam_data.clip_start = 0.1
cam_data.clip_end = 600.0
cam = bpy.data.objects.new("CamPath", cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.rotation_mode = "QUATERNION"

scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAMES
scene.camera = cam

prev_q = None
KEYS = 61
for i in range(KEYS):
    t = i / (KEYS - 1)
    frame = 1 + round(t * (FRAMES - 1))
    pos = catmull(CAM_PTS, t)
    aim = catmull(AIM_PTS, t)
    d = (aim - pos).normalized()
    q = d.to_track_quat("-Z", "Y")
    if prev_q is not None and prev_q.dot(q) < 0:
        q.negate()
    prev_q = q.copy()
    cam.location = pos
    cam.rotation_quaternion = q
    cam.keyframe_insert("location", frame=frame)
    cam.keyframe_insert("rotation_quaternion", frame=frame)
scene.frame_set(1)

tris = sum(len(o.data.polygons) for o in (ob_city, ob_street, ob_neon, ob_wires, ob_beacons))
tris += sum(len(o.data.polygons) for o in bb_objects)
print(f"CITY_SET_OK polygons={tris} objects={4 + 1 + len(bb_objects)}")
