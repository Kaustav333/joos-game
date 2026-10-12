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

def shade_smooth(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()

def add_box(name, size, loc, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if mat: assign_mat(obj, mat)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

def add_cylinder(name, radius, depth, loc, mat=None, rot=(0,0,0), vertices=24, parent=None, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if mat: assign_mat(obj, mat)
    if smooth: shade_smooth(obj)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

def add_cone(name, radius1, depth, loc, mat=None, rot=(0,0,0), vertices=24, parent=None, smooth=True):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if mat: assign_mat(obj, mat)
    if smooth: shade_smooth(obj)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

def add_sphere(name, radius, loc, mat=None, scale=(1,1,1), segments=32, rings=24, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    shade_smooth(obj)
    if mat: assign_mat(obj, mat)
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

# ==============================================================================
# 1. GHIBLI FAIRYTALE CASTLE
# ==============================================================================
def build_castle():
    reset_scene()
    
    mat_stone_base = create_mat("StoneBase", "#d6c9b4", roughness=0.8)
    mat_stone_wall = create_mat("StoneWall", "#f0e6d2", roughness=0.7)
    mat_stone_trim = create_mat("StoneTrim", "#c4b59f", roughness=0.65)
    mat_roof_royal = create_mat("RoofRoyal", "#3a5f8a", roughness=0.5)
    mat_roof_terracotta = create_mat("RoofTerracotta", "#c45436", roughness=0.55)
    mat_wood_dark  = create_mat("WoodDark", "#4a2e18", roughness=0.8)
    mat_gold       = create_mat("Gold", "#f5b738", roughness=0.3, metallic=0.7)
    mat_window_glow= create_mat("WindowGlow", "#ffe49e", roughness=0.2, emission_hex="#ffb03a", emission_strength=2.2)
    mat_banner     = create_mat("Banner", "#c73e3a", roughness=0.7)
    mat_heart      = create_mat("HeartMat", "#ff4d79", roughness=0.3, emission_hex="#ff2060", emission_strength=2.5)

    root = bpy.data.objects.new("Castle_Root", None)
    bpy.context.collection.objects.link(root)

    # --- Courtyard Base (Open, welcoming, low-profile) ---
    add_box("BaseCourtyard", (24, 22, 0.8), (0, 4, 0.4), mat_stone_base, root)
    add_box("BaseUpper", (22, 20, 0.3), (0, 4, 0.95), mat_stone_trim, root)

    # --- Central Grand Keep ---
    keep_w, keep_d, keep_h = 13, 10, 10
    keep_z = 1.1 + keep_h / 2
    add_box("MainKeep", (keep_w, keep_d, keep_h), (0, 5, keep_z), mat_stone_wall, root)
    
    # Keep Stone Trim & Corbels
    add_box("KeepTrimTop", (keep_w + 0.5, keep_d + 0.5, 0.4), (0, 5, 1.1 + keep_h), mat_stone_trim, root)
    add_box("KeepTrimMid", (keep_w + 0.3, keep_d + 0.3, 0.3), (0, 5, 1.1 + keep_h * 0.55), mat_stone_trim, root)
    
    # Battlements on Keep
    for b in range(-5, 6, 2):
        add_box(f"KeepCrenel_F_{b}", (1.0, 0.4, 0.8), (b, -keep_d/2 + 5, 1.1 + keep_h + 0.4), mat_stone_trim, root)
        add_box(f"KeepCrenel_B_{b}", (1.0, 0.4, 0.8), (b, keep_d/2 + 5, 1.1 + keep_h + 0.4), mat_stone_trim, root)

    # Steep Pitched Roof on Keep
    roof_h = 5.5
    r_cone = add_cone("KeepRoof", 6.8, roof_h, (0, 5, 1.1 + keep_h + roof_h/2), mat_roof_terracotta, rot=(0,0,math.pi/4), vertices=4, parent=root)
    r_cone.scale = (1.2, 1.0, 1.0)

    # --- High Clock Tower / Spire ---
    clock_r, clock_h = 2.2, 16.0
    clock_z = 1.1 + clock_h / 2
    add_cylinder("ClockTower", clock_r, clock_h, (0, 6.5, clock_z), mat_stone_wall, vertices=24, parent=root)
    add_cylinder("ClockBelfry", clock_r + 0.35, 2.2, (0, 6.5, 1.1 + clock_h + 1.1), mat_stone_trim, vertices=24, parent=root)
    
    # Grand Slate Spire
    spire_h = 8.0
    add_cone("ClockSpire", clock_r + 0.4, spire_h, (0, 6.5, 1.1 + clock_h + 2.2 + spire_h/2), mat_roof_royal, vertices=24, parent=root)
    add_sphere("GoldFinial", 0.5, (0, 6.5, 1.1 + clock_h + 2.2 + spire_h + 0.35), mat_gold, parent=root)

    # --- 4 Corner Turrets ---
    corners = [(-7.5, -0.5), (7.5, -0.5), (-7.5, 10.5), (7.5, 10.5)]
    for idx, (cx, cy) in enumerate(corners):
        t_r, t_h = 2.0, 13.0
        add_cylinder(f"Turret_{idx}", t_r, t_h, (cx, cy, 1.1 + t_h/2), mat_stone_wall, vertices=20, parent=root)
        add_cylinder(f"TurretCorbel_{idx}", t_r + 0.35, 0.7, (cx, cy, 1.1 + t_h), mat_stone_trim, vertices=20, parent=root)
        troof_mat = mat_roof_royal if idx % 2 == 0 else mat_roof_terracotta
        troof_h = 5.2
        add_cone(f"TurretRoof_{idx}", t_r + 0.45, troof_h, (cx, cy, 1.1 + t_h + troof_h/2 + 0.35), troof_mat, vertices=20, parent=root)
        add_sphere(f"TurretFinial_{idx}", 0.3, (cx, cy, 1.1 + t_h + troof_h + 0.5), mat_gold, parent=root)

    # --- Arched Grand Entrance Portal ---
    add_box("PortalFrame", (4.4, 1.2, 5.2), (0, -0.1, 1.1 + 2.6), mat_stone_trim, root)
    add_box("PortalDoor", (3.0, 0.3, 4.4), (0, 0.0, 1.1 + 2.2), mat_wood_dark, root)
    add_cylinder("PortalArch", 1.6, 0.5, (0, 0.0, 1.1 + 4.4), mat_stone_trim, rot=(math.pi/2, 0, 0), vertices=16, parent=root)

    # Glowing Windows
    for wx in [-3.2, 3.2]:
        add_box(f"FacadeWin_{wx}", (1.2, 0.25, 2.2), (wx, -0.1, 1.1 + 7.0), mat_window_glow, root)

    # --- Sanctuary Finale Terrace & Heart Monument ---
    sanc_z = 1.1 + 0.4
    add_cylinder("SanctuaryDais", 3.8, 0.6, (0, -3.5, sanc_z), mat_stone_trim, vertices=32, parent=root)
    add_cylinder("SanctuaryRing", 3.0, 0.3, (0, -3.5, sanc_z + 0.45), mat_stone_base, vertices=32, parent=root)
    add_cylinder("SanctuaryAltar", 1.2, 1.4, (0, -3.5, sanc_z + 1.2), mat_stone_trim, vertices=20, parent=root)
    
    # Ornate 3D Heart Monument
    h_group = bpy.data.objects.new("Heart_Group", None)
    h_group.location = (0, -3.5, sanc_z + 2.4)
    bpy.context.collection.objects.link(h_group)
    h_group.parent = root
    h_group.matrix_parent_inverse = root.matrix_world.inverted()
    
    add_sphere("HeartLobeL", 0.65, (-0.38, 0, 0.12), mat_heart, scale=(1, 0.7, 1), parent=h_group)
    add_sphere("HeartLobeR", 0.65, (0.38, 0, 0.12), mat_heart, scale=(1, 0.7, 1), parent=h_group)
    cone_tip = add_cone("HeartTip", 0.75, 1.2, (0, 0, -0.55), mat_heart, rot=(math.pi, 0, 0), vertices=20, parent=h_group)
    cone_tip.scale = (1.0, 0.7, 1.0)

    # Orbiting Star Markers
    for i in range(12):
        ang = i * (math.pi * 2 / 12)
        sx = math.cos(ang) * 3.2
        sy = -3.5 + math.sin(ang) * 3.2
        add_sphere(f"SanctuaryStar_{i}", 0.16, (sx, sy, sanc_z + 1.0), mat_gold, parent=root)

    # Broad, Gentle Approach Steps (low-rise so they never block view)
    for st in range(5):
        sw = 8.0 - st * 0.4
        add_box(f"Stair_{st}", (sw, 1.2, 0.18), (0, -6.5 - st * 1.1, 1.1 - st * 0.18), mat_stone_trim, root)
    
    # Lantern Pillars
    for px in [-4.0, 4.0]:
        add_cylinder(f"LanternPillar_{px}", 0.3, 1.4, (px, -11.5, 0.7), mat_stone_trim, vertices=12, parent=root)
        add_sphere(f"LanternOrb_{px}", 0.22, (px, -11.5, 1.5), mat_window_glow, parent=root)

    filepath = os.path.join(OUTPUT_DIR, "castle.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported castle to {filepath}")

# ==============================================================================
# 2. GHIBLI MULTI-LAYERED FLUFFY ANIME TREE (Silky Smooth Clouds)
# ==============================================================================
def build_tree(name, leaves_palette, trunk_mat_cfg, scale=1.0):
    reset_scene()
    
    mat_trunk = create_mat("TrunkMat", trunk_mat_cfg["hex"], roughness=0.85)
    mat_leaf_top = create_mat("LeafTop", leaves_palette["top"], roughness=0.6)
    mat_leaf_mid = create_mat("LeafMid", leaves_palette["mid"], roughness=0.6)
    mat_leaf_dark= create_mat("LeafDark", leaves_palette["dark"], roughness=0.65)
    
    root = bpy.data.objects.new(f"{name}_Root", None)
    bpy.context.collection.objects.link(root)

    # Organic sculpted trunk
    t_base = add_cylinder("TrunkBase", 0.42 * scale, 2.5 * scale, (0, 0, 1.25 * scale), mat_trunk, vertices=16, parent=root)
    # Root flares
    for r_idx in range(4):
        ang = r_idx * (math.pi / 2) + 0.3
        rx = math.cos(ang) * 0.42 * scale
        ry = math.sin(ang) * 0.42 * scale
        add_cone(f"Root_{r_idx}", 0.22 * scale, 0.8 * scale, (rx, ry, 0.35 * scale), mat_trunk, rot=(math.sin(ang)*0.4, -math.cos(ang)*0.4, 0), vertices=12, parent=root)

    # Branch forks
    add_cylinder("Branch1", 0.22 * scale, 1.5 * scale, (0.42 * scale, 0.2 * scale, 2.3 * scale), mat_trunk, rot=(0.2, 0.4, 0), vertices=12, parent=root)
    add_cylinder("Branch2", 0.2 * scale, 1.4 * scale, (-0.38 * scale, -0.28 * scale, 2.4 * scale), mat_trunk, rot=(-0.3, -0.35, 0), vertices=12, parent=root)

    # Fluffy Ghibli foliage clouds with HIGH POLY (32x24) + Smooth Shading
    puffs = [
        (0.0, 0.0, 3.4 * scale, 1.55 * scale, (1.2, 1.1, 0.95), mat_leaf_top),
        (0.75 * scale, 0.3 * scale, 3.2 * scale, 1.2 * scale, (1.1, 1.0, 0.9), mat_leaf_top),
        (-0.65 * scale, -0.3 * scale, 3.3 * scale, 1.25 * scale, (1.05, 1.1, 0.92), mat_leaf_top),
        (0.2 * scale, 0.85 * scale, 3.1 * scale, 1.1 * scale, (1.1, 1.0, 0.95), mat_leaf_mid),
        (-0.2 * scale, -0.75 * scale, 3.0 * scale, 1.15 * scale, (1.0, 1.15, 0.88), mat_leaf_mid),
        (0.85 * scale, -0.55 * scale, 2.7 * scale, 1.05 * scale, (1.0, 1.0, 0.85), mat_leaf_dark),
        (-0.75 * scale, 0.65 * scale, 2.8 * scale, 1.05 * scale, (1.1, 0.95, 0.88), mat_leaf_dark),
        (0.0, 0.0, 4.3 * scale, 0.95 * scale, (1.0, 1.0, 0.85), mat_leaf_top),
    ]

    for idx, (px, py, pz, pr, psc, pmat) in enumerate(puffs):
        add_sphere(f"FoliagePuff_{idx}", pr, (px, py, pz), pmat, scale=psc, segments=32, rings=24, parent=root)

    filepath = os.path.join(OUTPUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported {name} to {filepath}")

# ==============================================================================
# 3. GHIBLI COTTAGE CAFÉ
# ==============================================================================
def build_cafe():
    reset_scene()
    
    mat_plaster = create_mat("PlasterCream", "#f7f1e1", roughness=0.75)
    mat_timber  = create_mat("TimberWood", "#422817", roughness=0.8)
    mat_roof    = create_mat("RoofTerracotta", "#c85236", roughness=0.55)
    mat_awning_r= create_mat("AwningRed", "#c73e3a", roughness=0.6)
    mat_awning_w= create_mat("AwningCream", "#faf4e8", roughness=0.6)
    mat_stone   = create_mat("StoneWall", "#baa997", roughness=0.85)
    mat_window  = create_mat("WindowGlow", "#ffdf96", roughness=0.2, emission_hex="#ffaa30", emission_strength=1.8)
    mat_wood_deck=create_mat("WoodDeck", "#9e683f", roughness=0.7)
    mat_flower  = create_mat("FlowerPink", "#f26b8a", roughness=0.6)
    mat_flower_y= create_mat("FlowerYellow", "#fac832", roughness=0.6)
    mat_gold    = create_mat("GoldMetal", "#f5b738", roughness=0.3, metallic=0.7)

    root = bpy.data.objects.new("Cafe_Root", None)
    bpy.context.collection.objects.link(root)

    add_box("CafeDeck", (9.0, 8.5, 0.35), (0, 1.0, 0.18), mat_wood_deck, root)
    
    c_w, c_d, c_h = 6.5, 5.0, 4.4
    add_box("CafeBody", (c_w, c_d, c_h), (0, -0.6, 0.35 + c_h/2), mat_plaster, root)

    for sx in [-c_w/2 + 0.1, c_w/2 - 0.1]:
        add_box(f"CornerBeam_{sx}", (0.25, 0.25, c_h), (sx, -0.6 + c_d/2, 0.35 + c_h/2), mat_timber, root)
        add_box(f"CornerBeam_B_{sx}", (0.25, 0.25, c_h), (sx, -0.6 - c_d/2, 0.35 + c_h/2), mat_timber, root)
    add_box("BeamTopFront", (c_w, 0.22, 0.22), (0, -0.6 + c_d/2, 0.35 + c_h), mat_timber, root)
    add_box("BeamMidFront", (c_w, 0.2, 0.2), (0, -0.6 + c_d/2, 0.35 + c_h*0.55), mat_timber, root)

    roof_h = 3.4
    r_obj = add_cone("CafeRoof", 5.4, roof_h, (0, -0.6, 0.35 + c_h + roof_h/2), mat_roof, rot=(0, 0, math.pi/4), vertices=4, parent=root)
    r_obj.scale = (1.25, 1.05, 1.0)

    add_box("DormerBox", (1.5, 1.4, 1.3), (0, -0.6 + 1.5, 0.35 + c_h + 1.3), mat_plaster, root)
    add_cone("DormerRoof", 1.3, 1.0, (0, -0.6 + 1.5, 0.35 + c_h + 2.1), mat_roof, rot=(0,0,math.pi/4), vertices=4, parent=root)
    add_box("DormerWin", (0.75, 0.1, 0.75), (0, -0.6 + 2.2, 0.35 + c_h + 1.3), mat_window, root)

    add_box("ChimneyBody", (0.9, 0.9, 3.8), (2.2, -0.6 - 1.1, 0.35 + c_h + 1.6), mat_stone, root)
    add_cylinder("ChimneyPot", 0.25, 0.6, (2.2, -0.6 - 1.1, 0.35 + c_h + 3.7), mat_roof, vertices=16, parent=root)

    add_box("FrontDoor", (1.3, 0.15, 2.5), (-1.5, -0.6 + c_d/2 + 0.08, 0.35 + 1.25), mat_timber, root)
    add_sphere("DoorKnob", 0.07, (-1.05, -0.6 + c_d/2 + 0.18, 0.35 + 1.25), mat_gold, parent=root)

    add_box("CafeWindow", (1.6, 0.15, 1.5), (1.5, -0.6 + c_d/2 + 0.08, 0.35 + 2.0), mat_window, root)
    add_box("FlowerBox", (1.9, 0.4, 0.3), (1.5, -0.6 + c_d/2 + 0.3, 0.35 + 1.15), mat_timber, root)
    for fl in range(6):
        fl_mat = mat_flower if fl % 2 == 0 else mat_flower_y
        add_sphere(f"WindowFlower_{fl}", 0.12, (0.7 + fl * 0.3, -0.6 + c_d/2 + 0.32, 0.35 + 1.35), fl_mat, parent=root)

    for aw in range(-3, 4):
        aw_mat = mat_awning_r if aw % 2 == 0 else mat_awning_w
        aw_piece = add_box(f"AwningStripe_{aw}", (0.68, 2.2, 0.1), (aw * 0.7, -0.6 + c_d/2 + 1.4, 0.35 + 3.1), aw_mat, root)
        aw_piece.rotation_euler = (0.24, 0, 0)
    for px in [-2.2, 2.2]:
        add_cylinder(f"AwningPost_{px}", 0.07, 2.6, (px, -0.6 + c_d/2 + 2.4, 0.35 + 1.3), mat_timber, vertices=12, parent=root)

    add_cylinder("BistroTableTop", 0.75, 0.07, (1.5, 2.8, 0.35 + 0.9), mat_wood_deck, vertices=20, parent=root)
    add_cylinder("BistroTableLeg", 0.07, 0.9, (1.5, 2.8, 0.35 + 0.45), mat_timber, vertices=12, parent=root)
    add_sphere("Teapot", 0.13, (1.5, 2.8, 0.35 + 1.02), mat_plaster, parent=root)

    filepath = os.path.join(OUTPUT_DIR, "cafe.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported cafe to {filepath}")

# ==============================================================================
# 4. WISHING GARDEN SANCTUARY & FOUNTAIN
# ==============================================================================
def build_garden():
    reset_scene()

    mat_stone = create_mat("GardenStone", "#d4c8b6", roughness=0.7)
    mat_water = create_mat("WaterClear", "#48b8cc", roughness=0.1, metallic=0.1)
    mat_gold  = create_mat("GoldGleam", "#f5b738", roughness=0.3, metallic=0.7)
    mat_wood  = create_mat("RusticWood", "#5c3d26", roughness=0.8)
    mat_flower= create_mat("WisteriaFlower", "#a668c9", roughness=0.55)

    root = bpy.data.objects.new("Garden_Root", None)
    bpy.context.collection.objects.link(root)

    add_cylinder("FountainBasinOuter", 3.0, 0.7, (0, 0, 0.35), mat_stone, vertices=24, parent=root)
    add_cylinder("FountainWaterLower", 2.6, 0.65, (0, 0, 0.4), mat_water, vertices=24, parent=root)
    
    add_cylinder("FountainPedestal", 0.7, 1.3, (0, 0, 1.0), mat_stone, vertices=16, parent=root)
    add_cylinder("FountainUpperBasin", 1.5, 0.3, (0, 0, 1.8), mat_stone, vertices=24, parent=root)
    add_cylinder("FountainWaterUpper", 1.3, 0.28, (0, 0, 1.85), mat_water, vertices=24, parent=root)
    add_sphere("FountainFinial", 0.35, (0, 0, 2.25), mat_gold, parent=root)

    arch_x, arch_y = -5.0, 0.0
    for sx in [-1.4, 1.4]:
        for sy in [-0.7, 0.7]:
            add_cylinder(f"ArchPost_{sx}_{sy}", 0.09, 3.0, (arch_x + sx, arch_y + sy, 1.5), mat_wood, vertices=12, parent=root)
    for r in range(-3, 4):
        add_box(f"ArchRafter_{r}", (3.4, 0.1, 0.12), (arch_x, arch_y + r * 0.35, 3.05), mat_wood, root)
    for w in range(14):
        ang = w * 0.45
        wx = arch_x + math.sin(ang) * 1.3
        wy = arch_y + (w % 5 - 2) * 0.4
        wz = 2.6 - (w % 3) * 0.28
        add_sphere(f"Wisteria_{w}", 0.25, (wx, wy, wz), mat_flower, scale=(0.8, 0.8, 1.3), parent=root)

    bx, by = 4.5, 0.0
    add_box("BenchSeat", (2.2, 0.75, 0.16), (bx, by, 0.55), mat_stone, root)
    add_box("BenchBack", (2.2, 0.16, 0.7), (bx, by - 0.32, 0.98), mat_stone, root)
    add_cylinder("BenchLegL", 0.18, 0.5, (bx - 0.8, by, 0.25), mat_stone, vertices=12, parent=root)
    add_cylinder("BenchLegR", 0.18, 0.5, (bx + 0.8, by, 0.25), mat_stone, vertices=12, parent=root)

    filepath = os.path.join(OUTPUT_DIR, "garden.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported garden to {filepath}")

if __name__ == "__main__":
    print("Re-generating smooth Ghibli models...")
    build_castle()
    build_tree("tree_oak", {
        "top": "#82cf53", "mid": "#48a336", "dark":"#266e20"
    }, {"hex": "#5e3c23"}, scale=1.0)
    build_tree("tree_cherry", {
        "top": "#ffb5ca", "mid": "#f788a8", "dark":"#c44d75"
    }, {"hex": "#755038"}, scale=1.1)
    build_tree("tree_autumn", {
        "top": "#ffd147", "mid": "#f09829", "dark":"#b85e18"
    }, {"hex": "#543720"}, scale=0.95)
    build_cafe()
    build_garden()
    print("SMOOTH MODELS EXPORTED!")
