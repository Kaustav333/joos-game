import bpy
import math
import os

OUTPUT_DIR = r"c:\Users\kaust\Downloads\joos-little-universe\public\models"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_mat(name, hex_color, roughness=0.6, metallic=0.0, emission_hex=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    def hex_to_rgb(h):
        h = h.lstrip('#')
        rgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
        return [c ** 2.2 for c in rgb] + [1.0]

    if bsdf:
        bsdf.inputs['Base Color'].default_value = hex_to_rgb(hex_color)
        if 'Roughness' in bsdf.inputs:
            bsdf.inputs['Roughness'].default_value = roughness
        if 'Metallic' in bsdf.inputs:
            bsdf.inputs['Metallic'].default_value = metallic
        if emission_hex and 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = hex_to_rgb(emission_hex)
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat

def assign_mat(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat

def add_box(name, size, loc, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if mat: assign_mat(obj, mat)
    if parent: obj.parent = parent
    return obj

def add_cylinder(name, radius, depth, loc, mat=None, rot=(0,0,0), vertices=16, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if mat: assign_mat(obj, mat)
    if parent: obj.parent = parent
    return obj

def add_cone(name, radius1, depth, loc, mat=None, rot=(0,0,0), vertices=16, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if mat: assign_mat(obj, mat)
    if parent: obj.parent = parent
    return obj

def add_sphere(name, radius, loc, mat=None, scale=(1,1,1), segments=16, rings=12, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if mat: assign_mat(obj, mat)
    if parent: obj.parent = parent
    return obj

def smooth_shading(obj):
    for f in obj.data.polygons:
        f.use_smooth = True

# ==============================================================================
# PLAYER CHARACTER (Ghibli Adventurer)
# ==============================================================================
def build_player():
    reset_scene()

    mat_skin   = create_mat("SkinMat", "#fadfc2", roughness=0.6)
    mat_hair   = create_mat("HairMat", "#382416", roughness=0.7)
    mat_coat   = create_mat("CoatMat", "#cf4b38", roughness=0.6) # Coral Red Ghibli Coat
    mat_scarf  = create_mat("ScarfMat", "#f2cf72", roughness=0.65) # Warm Yellow Scarf
    mat_pants  = create_mat("PantsMat", "#3d555c", roughness=0.75) # Slate Teal Pants
    mat_boots  = create_mat("BootsMat", "#472c1c", roughness=0.7)
    mat_satchel= create_mat("SatchelMat", "#7a4623", roughness=0.6)
    mat_gold   = create_mat("GoldButton", "#f5b738", roughness=0.3, metallic=0.7)
    mat_eye    = create_mat("EyeDark", "#1a1614", roughness=0.2)
    mat_blush  = create_mat("BlushPink", "#f28a9b", roughness=0.8)

    root = bpy.data.objects.new("Player_Root", None)
    bpy.context.collection.objects.link(root)

    # Torso (Coat)
    coat = add_cylinder("PlayerCoat", 0.38, 0.85, (0, 0, 1.15), mat_coat, vertices=14, parent=root)
    # Coat hem flare
    add_cone("CoatHem", 0.44, 0.3, (0, 0, 0.8), mat_coat, vertices=14, parent=root)
    # Brass buttons
    for by in [0.95, 1.15, 1.35]:
        add_sphere(f"Button_{by}", 0.035, (0, 0.39, by), mat_gold, parent=root)

    # Scarf wrapped around neck
    add_cylinder("ScarfCollar", 0.36, 0.22, (0, 0, 1.62), mat_scarf, vertices=14, parent=root)
    # Scarf tail trailing behind
    s_tail = add_box("ScarfTail", (0.24, 0.08, 0.65), (0.16, -0.32, 1.35), mat_scarf, root)
    s_tail.rotation_euler = (-0.35, 0.15, 0)

    # Satchel adventure bag slung across hip
    add_box("SatchelBag", (0.28, 0.14, 0.26), (-0.42, 0.05, 1.05), mat_satchel, root)
    add_sphere("SatchelBuckle", 0.035, (-0.42, 0.13, 1.05), mat_gold, parent=root)

    # Head
    head = add_sphere("PlayerHead", 0.38, (0, 0, 1.95), mat_skin, scale=(1.0, 0.95, 1.05), parent=root)
    smooth_shading(head)

    # Anime Eyes (forward is +Y in Blender)
    for sx in [-0.14, 0.14]:
        add_sphere(f"Eye_{sx}", 0.045, (sx, 0.36, 1.95), mat_eye, scale=(1.0, 0.4, 1.2), parent=root)
        # Cute cheek blush
        add_sphere(f"Blush_{sx}", 0.055, (sx * 1.5, 0.34, 1.86), mat_blush, scale=(1.0, 0.3, 0.6), parent=root)

    # Stylized Anime Hair (Ghibli mop)
    hair_crown = add_sphere("HairCrown", 0.42, (0, -0.06, 2.05), mat_hair, scale=(1.04, 1.02, 1.0), parent=root)
    smooth_shading(hair_crown)
    # Front bangs
    for bx in [-0.22, 0.0, 0.22]:
        add_cone(f"HairBang_{bx}", 0.12, 0.28, (bx, 0.32, 2.08), mat_hair, rot=(0.6, 0, 0), vertices=6, parent=root)

    # Arms
    for sx in [-0.46, 0.46]:
        add_cylinder(f"Arm_{sx}", 0.11, 0.6, (sx, 0, 1.25), mat_coat, rot=(0, sx * 0.1, 0), vertices=8, parent=root)
        add_sphere(f"Hand_{sx}", 0.09, (sx * 1.05, 0, 0.9), mat_skin, parent=root)

    # Legs & Boots
    for sx in [-0.18, 0.18]:
        add_cylinder(f"Leg_{sx}", 0.12, 0.45, (sx, 0, 0.55), mat_pants, vertices=8, parent=root)
        # Boot
        add_box(f"Boot_{sx}", (0.18, 0.28, 0.22), (sx, 0.04, 0.18), mat_boots, root)

    filepath = os.path.join(OUTPUT_DIR, "player.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported player to {filepath}")

# ==============================================================================
# COMPANION CAT (Ghibli Anime Cat)
# ==============================================================================
def build_cat():
    reset_scene()

    mat_cat_fur  = create_mat("CatFurOrange", "#e89f46", roughness=0.7)
    mat_cat_belly= create_mat("CatWhite", "#fcf5ea", roughness=0.7)
    mat_cat_pink = create_mat("CatPink", "#f29199", roughness=0.6)
    mat_cat_eye  = create_mat("CatEye", "#2a3b2b", roughness=0.2)
    mat_collar   = create_mat("CatCollar", "#c73e3a", roughness=0.5)
    mat_bell     = create_mat("CatBell", "#f5b738", roughness=0.25, metallic=0.8)

    root = bpy.data.objects.new("Cat_Root", None)
    bpy.context.collection.objects.link(root)

    # Chubby Rounded Body
    body = add_sphere("CatBody", 0.45, (0, 0, 0.45), mat_cat_fur, scale=(0.85, 1.15, 0.95), parent=root)
    smooth_shading(body)

    # White bib / belly patch
    belly = add_sphere("CatBelly", 0.38, (0, 0.15, 0.42), mat_cat_belly, scale=(0.7, 0.9, 0.8), parent=root)
    smooth_shading(belly)

    # Head
    head = add_sphere("CatHead", 0.38, (0, 0.45, 0.78), mat_cat_fur, scale=(1.1, 0.95, 0.95), parent=root)
    smooth_shading(head)

    # Cute Triangular Ears
    for sx in [-0.22, 0.22]:
        ear = add_cone(f"Ear_{sx}", 0.16, 0.35, (sx, 0.42, 1.12), mat_cat_fur, rot=(0, sx * -0.2, 0), vertices=4, parent=root)
        add_cone(f"EarInner_{sx}", 0.1, 0.25, (sx, 0.48, 1.12), mat_cat_pink, rot=(0, sx * -0.2, 0), vertices=4, parent=root)

    # Anime Cat Face
    for sx in [-0.14, 0.14]:
        add_sphere(f"CatEye_{sx}", 0.045, (sx, 0.74, 0.82), mat_cat_eye, parent=root)
        # White cheeks
        add_sphere(f"Cheek_{sx}", 0.12, (sx * 0.9, 0.68, 0.72), mat_cat_belly, scale=(1.0, 0.6, 0.8), parent=root)
    # Tiny pink nose
    add_sphere("CatNose", 0.035, (0, 0.8, 0.78), mat_cat_pink, parent=root)

    # Red Collar with Golden Bell
    add_cylinder("CatCollar", 0.32, 0.08, (0, 0.35, 0.68), mat_collar, vertices=14, parent=root)
    add_sphere("CatBell", 0.07, (0, 0.65, 0.66), mat_bell, parent=root)

    # Curved Tail
    for t_i in range(5):
        t_ang = t_i * 0.28
        tz = 0.45 + t_i * 0.14
        ty = -0.45 - math.sin(t_ang) * 0.25
        add_sphere(f"TailSegment_{t_i}", 0.1 - t_i * 0.01, (0, ty, tz), mat_cat_fur, parent=root)

    # Paws
    for sx in [-0.22, 0.22]:
        add_sphere(f"PawFront_{sx}", 0.11, (sx, 0.35, 0.1), mat_cat_belly, scale=(0.9, 1.2, 0.7), parent=root)
        add_sphere(f"PawBack_{sx}", 0.12, (sx * 1.1, -0.25, 0.1), mat_cat_belly, scale=(1.0, 1.3, 0.7), parent=root)

    filepath = os.path.join(OUTPUT_DIR, "cat.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported cat to {filepath}")

if __name__ == "__main__":
    build_player()
    build_cat()
    print("ALL GHIBLI CHARACTERS EXPORTED!")
