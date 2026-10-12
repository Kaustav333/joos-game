import bpy
import math
import os

OUTPUT_DIR = r"c:\Users\kaust\Downloads\joos-little-universe\public\models"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure scene exists
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_mat(name, hex_color, roughness=0.6, metallic=0.0, emission_hex=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    # Convert hex to sRGB float
    def hex_to_rgb(h):
        h = h.lstrip('#')
        rgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
        # Approximate sRGB to linear for Blender
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
# 1. GHIBLI FAIRYTALE CASTLE
# ==============================================================================
def build_castle():
    reset_scene()
    
    # Materials with rich Ghibli watercolor palette
    mat_stone_base = create_mat("StoneBase", "#d6c9b4", roughness=0.8)
    mat_stone_wall = create_mat("StoneWall", "#f0e6d2", roughness=0.7)
    mat_stone_trim = create_mat("StoneTrim", "#c4b59f", roughness=0.65)
    mat_roof_royal = create_mat("RoofRoyal", "#3a5f8a", roughness=0.5) # Slate blue Ghibli roof
    mat_roof_terracotta = create_mat("RoofTerracotta", "#c45436", roughness=0.55) # Terracotta clay tiles
    mat_wood_dark  = create_mat("WoodDark", "#4a2e18", roughness=0.8)
    mat_gold       = create_mat("Gold", "#f5b738", roughness=0.3, metallic=0.7)
    mat_window_glow= create_mat("WindowGlow", "#ffe49e", roughness=0.2, emission_hex="#ffb03a", emission_strength=2.2)
    mat_banner     = create_mat("Banner", "#c73e3a", roughness=0.7)
    mat_heart      = create_mat("HeartMat", "#ff4d79", roughness=0.3, emission_hex="#ff2060", emission_strength=2.5)

    root = bpy.data.objects.new("Castle_Root", None)
    bpy.context.collection.objects.link(root)

    # --- Courtyard Base ---
    add_box("BaseCourtyard", (28, 26, 1.2), (0, 0, 0.6), mat_stone_base, root)
    add_box("BaseUpper", (26, 24, 0.4), (0, 0, 1.4), mat_stone_trim, root)
    
    # Courtyard Balustrades
    for x in range(-12, 13, 3):
        add_box(f"Baluster_N_{x}", (0.5, 0.5, 1.1), (x, 12, 2.1), mat_stone_trim, root)
        add_box(f"Baluster_S_{x}", (0.5, 0.5, 1.1), (x, -12, 2.1), mat_stone_trim, root)
    add_box("Rail_N", (25, 0.4, 0.25), (0, 12, 2.7), mat_stone_trim, root)
    add_box("Rail_S", (25, 0.4, 0.25), (0, -12, 2.7), mat_stone_trim, root)

    # --- Central Grand Keep ---
    keep_w, keep_d, keep_h = 14, 12, 11
    keep_z = 1.6 + keep_h / 2
    add_box("MainKeep", (keep_w, keep_d, keep_h), (0, 2, keep_z), mat_stone_wall, root)
    
    # Keep Stone Trim & Corbels
    add_box("KeepTrimTop", (keep_w + 0.6, keep_d + 0.6, 0.5), (0, 2, 1.6 + keep_h), mat_stone_trim, root)
    add_box("KeepTrimMid", (keep_w + 0.4, keep_d + 0.4, 0.35), (0, 2, 1.6 + keep_h * 0.55), mat_stone_trim, root)
    
    # Battlements on Keep
    for b in range(-6, 7, 2):
        add_box(f"KeepCrenel_F_{b}", (1.1, 0.5, 1.0), (b, -keep_d/2 + 2, 1.6 + keep_h + 0.5), mat_stone_trim, root)
        add_box(f"KeepCrenel_B_{b}", (1.1, 0.5, 1.0), (b, keep_d/2 + 2, 1.6 + keep_h + 0.5), mat_stone_trim, root)

    # Steep Pitched Roof on Keep
    roof_h = 6.0
    r_cone = add_cone("KeepRoof", 7.5, roof_h, (0, 2, 1.6 + keep_h + roof_h/2), mat_roof_terracotta, rot=(0,0,math.pi/4), vertices=4, parent=root)
    r_cone.scale = (1.2, 1.0, 1.0)

    # --- High Clock Tower / Spire ---
    clock_r, clock_h = 2.4, 18.0
    clock_z = 1.6 + clock_h / 2
    add_cylinder("ClockTower", clock_r, clock_h, (0, 4.5, clock_z), mat_stone_wall, vertices=16, parent=root)
    add_cylinder("ClockBelfry", clock_r + 0.4, 2.5, (0, 4.5, 1.6 + clock_h + 1.25), mat_stone_trim, vertices=16, parent=root)
    # Bell openings
    for ang in [0, math.pi/2, math.pi, math.pi*1.5]:
        ox = math.cos(ang) * (clock_r + 0.1)
        oy = 4.5 + math.sin(ang) * (clock_r + 0.1)
        add_box(f"BelfryArch_{ang}", (0.8, 0.8, 1.6), (ox, oy, 1.6 + clock_h + 1.25), mat_wood_dark, root)
    
    # Grand Slate Spire
    spire_h = 8.5
    add_cone("ClockSpire", clock_r + 0.5, spire_h, (0, 4.5, 1.6 + clock_h + 2.5 + spire_h/2), mat_roof_royal, vertices=16, parent=root)
    # Golden Star Finial
    finial = add_sphere("GoldFinial", 0.55, (0, 4.5, 1.6 + clock_h + 2.5 + spire_h + 0.4), mat_gold, parent=root)
    add_cone("FinialTip", 0.2, 0.8, (0, 4.5, 1.6 + clock_h + 2.5 + spire_h + 1.0), mat_gold, parent=root)

    # --- 4 Majestic Corner Turrets ---
    corners = [(-8.5, -5.5), (8.5, -5.5), (-8.5, 9.5), (8.5, 9.5)]
    for idx, (cx, cy) in enumerate(corners):
        t_r, t_h = 2.2, 14.5
        add_cylinder(f"Turret_{idx}", t_r, t_h, (cx, cy, 1.6 + t_h/2), mat_stone_wall, vertices=16, parent=root)
        # Stone corbel ring
        add_cylinder(f"TurretCorbel_{idx}", t_r + 0.45, 0.8, (cx, cy, 1.6 + t_h), mat_stone_trim, vertices=16, parent=root)
        # Conical Roof
        troof_mat = mat_roof_royal if idx % 2 == 0 else mat_roof_terracotta
        troof_h = 5.8
        add_cone(f"TurretRoof_{idx}", t_r + 0.5, troof_h, (cx, cy, 1.6 + t_h + troof_h/2 + 0.4), troof_mat, vertices=16, parent=root)
        # Gold ball finial
        add_sphere(f"TurretFinial_{idx}", 0.35, (cx, cy, 1.6 + t_h + troof_h + 0.6), mat_gold, parent=root)
        # Tower windows
        add_box(f"TurretWin_{idx}", (0.6, 0.6, 1.2), (cx + (0.8 if cx > 0 else -0.8), cy - 1.2, 1.6 + t_h * 0.65), mat_window_glow, root)
        # Fluttering Pennant Flag
        add_cylinder(f"FlagPole_{idx}", 0.05, 1.8, (cx, cy, 1.6 + t_h + troof_h + 1.2), mat_gold, vertices=8, parent=root)
        pennant = add_cone(f"Pennant_{idx}", 0.35, 1.2, (cx, cy + 0.5, 1.6 + t_h + troof_h + 1.5), mat_banner, rot=(math.pi/2, 0, 0), vertices=3, parent=root)

    # --- Arched Grand Entrance Portal ---
    portal_z = 1.6 + 3.2
    add_box("PortalFrame", (4.8, 1.4, 5.8), (0, -4.2, portal_z), mat_stone_trim, root)
    add_box("PortalDoor", (3.2, 0.4, 4.8), (0, -4.1, 1.6 + 2.4), mat_wood_dark, root)
    add_cylinder("PortalArch", 1.8, 0.6, (0, -4.1, 1.6 + 4.8), mat_stone_trim, rot=(math.pi/2, 0, 0), vertices=14, parent=root)

    # --- Glowing Stained Glass Windows on Front Facade ---
    for wx in [-3.8, 3.8]:
        add_box(f"FacadeWin_{wx}", (1.4, 0.3, 2.6), (wx, -4.1, 1.6 + 7.8), mat_window_glow, root)
        add_cylinder(f"FacadeWinArch_{wx}", 0.7, 0.35, (wx, -4.1, 1.6 + 9.1), mat_stone_trim, rot=(math.pi/2, 0, 0), vertices=12, parent=root)

    # --- Sanctuary Finale Terrace & Heart Monument ---
    sanc_z = 1.6 + 0.6
    add_cylinder("SanctuaryDais", 4.2, 0.8, (0, -8.5, sanc_z), mat_stone_trim, vertices=24, parent=root)
    add_cylinder("SanctuaryRing", 3.4, 0.4, (0, -8.5, sanc_z + 0.6), mat_stone_base, vertices=24, parent=root)
    add_cylinder("SanctuaryAltar", 1.3, 1.6, (0, -8.5, sanc_z + 1.5), mat_stone_trim, vertices=16, parent=root)
    
    # Ornate 3D Heart
    h_group = bpy.data.objects.new("Heart_Group", None)
    h_group.location = (0, -8.5, sanc_z + 3.0)
    bpy.context.collection.objects.link(h_group)
    h_group.parent = root
    
    s1 = add_sphere("HeartLobeL", 0.7, (-0.42, 0, 0.15), mat_heart, scale=(1, 0.7, 1), parent=h_group)
    s2 = add_sphere("HeartLobeR", 0.7, (0.42, 0, 0.15), mat_heart, scale=(1, 0.7, 1), parent=h_group)
    cone_tip = add_cone("HeartTip", 0.82, 1.4, (0, 0, -0.65), mat_heart, rot=(math.pi, 0, 0), vertices=16, parent=h_group)
    cone_tip.scale = (1.0, 0.7, 1.0)

    # Orbiting Star Markers on Dais
    for i in range(12):
        ang = i * (math.pi * 2 / 12)
        sx = math.cos(ang) * 3.6
        sy = -8.5 + math.sin(ang) * 3.6
        add_sphere(f"SanctuaryStar_{i}", 0.18, (sx, sy, sanc_z + 1.2), mat_gold, parent=root)

    # Welcoming Approach Steps
    for st in range(6):
        sw = 8.5 - st * 0.4
        add_box(f"Stair_{st}", (sw, 1.4, 0.28), (0, -12.5 - st * 1.3, 1.6 - st * 0.28), mat_stone_trim, root)
    
    # Entrance Lantern Pillars
    for px in [-4.6, 4.6]:
        add_cylinder(f"LanternPillar_{px}", 0.35, 1.8, (px, -19.5, 0.9), mat_stone_trim, vertices=8, parent=root)
        add_sphere(f"LanternOrb_{px}", 0.26, (px, -19.5, 2.0), mat_window_glow, parent=root)

    # Export Castle to GLB
    filepath = os.path.join(OUTPUT_DIR, "castle.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported castle to {filepath}")

# ==============================================================================
# 2. GHIBLI MULTI-LAYERED FLUFFY ANIME TREE
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
    t_base = add_cylinder("TrunkBase", 0.45 * scale, 2.6 * scale, (0, 0, 1.3 * scale), mat_trunk, vertices=12, parent=root)
    # Root flares
    for r_idx in range(4):
        ang = r_idx * (math.pi / 2) + 0.3
        rx = math.cos(ang) * 0.45 * scale
        ry = math.sin(ang) * 0.45 * scale
        flare = add_cone(f"Root_{r_idx}", 0.25 * scale, 0.9 * scale, (rx, ry, 0.4 * scale), mat_trunk, rot=(math.sin(ang)*0.4, -math.cos(ang)*0.4, 0), vertices=8, parent=root)

    # Branch forks
    b1 = add_cylinder("Branch1", 0.25 * scale, 1.6 * scale, (0.45 * scale, 0.2 * scale, 2.4 * scale), mat_trunk, rot=(0.2, 0.4, 0), vertices=10, parent=root)
    b2 = add_cylinder("Branch2", 0.22 * scale, 1.5 * scale, (-0.4 * scale, -0.3 * scale, 2.5 * scale), mat_trunk, rot=(-0.3, -0.35, 0), vertices=10, parent=root)

    # Fluffy Ghibli foliage clouds: multiple overlapping puffs creating organic silhouette
    puffs = [
        # (offset_x, offset_y, offset_z, radius, scale_xyz, mat)
        (0.0, 0.0, 3.4 * scale, 1.6 * scale, (1.2, 1.1, 0.95), mat_leaf_top),
        (0.8 * scale, 0.3 * scale, 3.2 * scale, 1.25 * scale, (1.1, 1.0, 0.9), mat_leaf_top),
        (-0.7 * scale, -0.3 * scale, 3.3 * scale, 1.3 * scale, (1.05, 1.1, 0.92), mat_leaf_top),
        (0.2 * scale, 0.9 * scale, 3.1 * scale, 1.15 * scale, (1.1, 1.0, 0.95), mat_leaf_mid),
        (-0.2 * scale, -0.8 * scale, 3.0 * scale, 1.2 * scale, (1.0, 1.15, 0.88), mat_leaf_mid),
        (0.9 * scale, -0.6 * scale, 2.7 * scale, 1.1 * scale, (1.0, 1.0, 0.85), mat_leaf_dark),
        (-0.8 * scale, 0.7 * scale, 2.8 * scale, 1.1 * scale, (1.1, 0.95, 0.88), mat_leaf_dark),
        (0.0, 0.0, 4.4 * scale, 1.0 * scale, (1.0, 1.0, 0.85), mat_leaf_top), # crown puff
    ]

    for idx, (px, py, pz, pr, psc, pmat) in enumerate(puffs):
        puff = add_sphere(f"FoliagePuff_{idx}", pr, (px, py, pz), pmat, scale=psc, segments=14, rings=10, parent=root)
        smooth_shading(puff)

    filepath = os.path.join(OUTPUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported {name} to {filepath}")

# ==============================================================================
# 3. GHIBLI COTTAGE CAFÉ (The Little Cup Café)
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

    # Wooden Deck Porch
    add_box("CafeDeck", (9.5, 9.0, 0.4), (0, 1.2, 0.2), mat_wood_deck, root)
    
    # Cottage Main Building
    c_w, c_d, c_h = 7.0, 5.5, 4.8
    add_box("CafeBody", (c_w, c_d, c_h), (0, -0.6, 0.4 + c_h/2), mat_plaster, root)

    # Half-Timbering Beams
    for sx in [-c_w/2 + 0.1, c_w/2 - 0.1]:
        add_box(f"CornerBeam_{sx}", (0.28, 0.28, c_h), (sx, -0.6 + c_d/2, 0.4 + c_h/2), mat_timber, root)
        add_box(f"CornerBeam_B_{sx}", (0.28, 0.28, c_h), (sx, -0.6 - c_d/2, 0.4 + c_h/2), mat_timber, root)
    # Horizontal beams
    add_box("BeamTopFront", (c_w, 0.25, 0.25), (0, -0.6 + c_d/2, 0.4 + c_h), mat_timber, root)
    add_box("BeamMidFront", (c_w, 0.22, 0.22), (0, -0.6 + c_d/2, 0.4 + c_h*0.55), mat_timber, root)
    # Cross diagonal timber beams
    b_diag1 = add_box("BeamDiag1", (0.16, 0.16, c_h*0.75), (-1.8, -0.6 + c_d/2, 0.4 + c_h*0.55), mat_timber, root)
    b_diag1.rotation_euler = (0, 0.55, 0)
    b_diag2 = add_box("BeamDiag2", (0.16, 0.16, c_h*0.75), (1.8, -0.6 + c_d/2, 0.4 + c_h*0.55), mat_timber, root)
    b_diag2.rotation_euler = (0, -0.55, 0)

    # Steep Gabled Roof with Overhanging Eaves
    roof_h = 3.6
    r_obj = add_cone("CafeRoof", 5.8, roof_h, (0, -0.6, 0.4 + c_h + roof_h/2), mat_roof, rot=(0, 0, math.pi/4), vertices=4, parent=root)
    r_obj.scale = (1.25, 1.05, 1.0)
    
    # Eave trim
    add_box("EaveFront", (c_w + 1.2, 0.25, 0.35), (0, -0.6 + c_d/2 + 0.5, 0.4 + c_h + 0.1), mat_timber, root)

    # Dormer Window on Roof
    add_box("DormerBox", (1.6, 1.5, 1.4), (0, -0.6 + 1.6, 0.4 + c_h + 1.4), mat_plaster, root)
    d_roof = add_cone("DormerRoof", 1.4, 1.1, (0, -0.6 + 1.6, 0.4 + c_h + 2.3), mat_roof, rot=(0,0,math.pi/4), vertices=4, parent=root)
    add_box("DormerWin", (0.8, 0.1, 0.8), (0, -0.6 + 2.35, 0.4 + c_h + 1.4), mat_window, root)

    # Stone Chimney with Terracotta Pot
    add_box("ChimneyBody", (1.0, 1.0, 4.2), (2.4, -0.6 - 1.2, 0.4 + c_h + 1.8), mat_stone, root)
    add_cylinder("ChimneyPot", 0.28, 0.7, (2.4, -0.6 - 1.2, 0.4 + c_h + 4.1), mat_roof, vertices=12, parent=root)

    # Front Door with Porch Light
    add_box("FrontDoor", (1.4, 0.15, 2.7), (-1.6, -0.6 + c_d/2 + 0.08, 0.4 + 1.35), mat_timber, root)
    add_sphere("DoorKnob", 0.08, (-1.1, -0.6 + c_d/2 + 0.2, 0.4 + 1.35), mat_gold, parent=root)
    add_sphere("PorchLantern", 0.18, (-1.6, -0.6 + c_d/2 + 0.4, 0.4 + 3.1), mat_window, parent=root)

    # Glowing Leaded Glass Window with Flower Box
    add_box("CafeWindow", (1.8, 0.15, 1.6), (1.6, -0.6 + c_d/2 + 0.08, 0.4 + 2.2), mat_window, root)
    add_box("FlowerBox", (2.1, 0.45, 0.35), (1.6, -0.6 + c_d/2 + 0.32, 0.4 + 1.25), mat_timber, root)
    # Flowers in Box
    for fl in range(7):
        fl_mat = mat_flower if fl % 2 == 0 else mat_flower_y
        add_sphere(f"WindowFlower_{fl}", 0.14, (0.7 + fl * 0.3, -0.6 + c_d/2 + 0.35, 0.4 + 1.5), fl_mat, parent=root)

    # Striped Fabric Awning over Deck
    for aw in range(-3, 4):
        aw_mat = mat_awning_r if aw % 2 == 0 else mat_awning_w
        aw_piece = add_box(f"AwningStripe_{aw}", (0.72, 2.4, 0.12), (aw * 0.75, -0.6 + c_d/2 + 1.5, 0.4 + 3.3), aw_mat, root)
        aw_piece.rotation_euler = (0.24, 0, 0)
    
    # Wooden Support Posts for Awning
    for px in [-2.4, 2.4]:
        add_cylinder(f"AwningPost_{px}", 0.08, 2.8, (px, -0.6 + c_d/2 + 2.6, 0.4 + 1.4), mat_timber, vertices=8, parent=root)

    # Outdoor Bistro Table & Chairs
    add_cylinder("BistroTableTop", 0.8, 0.08, (1.6, 3.2, 0.4 + 0.95), mat_wood_deck, vertices=16, parent=root)
    add_cylinder("BistroTableLeg", 0.08, 0.95, (1.6, 3.2, 0.4 + 0.48), mat_timber, vertices=8, parent=root)
    # Teapot on table
    add_sphere("Teapot", 0.14, (1.6, 3.2, 0.4 + 1.1), mat_plaster, parent=root)
    add_cylinder("Teacup", 0.06, 0.08, (1.85, 3.2, 0.4 + 1.04), mat_plaster, vertices=8, parent=root)

    # Chairs
    for c_ang in [0, math.pi]:
        cx = 1.6 + math.sin(c_ang) * 1.1
        cy = 3.2 + math.cos(c_ang) * 1.1
        add_cylinder(f"ChairSeat_{c_ang}", 0.32, 0.06, (cx, cy, 0.4 + 0.55), mat_wood_deck, vertices=12, parent=root)
        c_back = add_box(f"ChairBack_{c_ang}", (0.55, 0.08, 0.55), (cx, cy + (0.28 if c_ang == 0 else -0.28), 0.4 + 0.85), mat_wood_deck, root)
        c_back.rotation_euler = (0.1 if c_ang == 0 else -0.1, 0, 0)

    # Hanging Café Sign (Teacup board)
    add_box("CafeSignBoard", (1.6, 0.1, 0.85), (-2.8, -0.6 + c_d/2 + 0.6, 0.4 + 3.8), mat_timber, root)
    add_cylinder("SignCupIcon", 0.18, 0.14, (-2.8, -0.6 + c_d/2 + 0.68, 0.4 + 3.8), mat_plaster, rot=(math.pi/2,0,0), vertices=12, parent=root)

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
    mat_leaf  = create_mat("VineLeaf", "#489e44", roughness=0.6)
    mat_flower= create_mat("WisteriaFlower", "#a668c9", roughness=0.55)

    root = bpy.data.objects.new("Garden_Root", None)
    bpy.context.collection.objects.link(root)

    # --- Tiered Classical Fountain ---
    # Octagonal Lower Basin
    add_cylinder("FountainBasinOuter", 3.2, 0.8, (0, 0, 0.4), mat_stone, vertices=8, parent=root)
    add_cylinder("FountainWaterLower", 2.8, 0.75, (0, 0, 0.45), mat_water, vertices=8, parent=root)
    
    # Central Pedestal
    add_cylinder("FountainPedestal", 0.75, 1.4, (0, 0, 1.1), mat_stone, vertices=12, parent=root)
    # Upper Shell Basin
    add_cylinder("FountainUpperBasin", 1.6, 0.35, (0, 0, 1.95), mat_stone, vertices=16, parent=root)
    add_cylinder("FountainWaterUpper", 1.4, 0.32, (0, 0, 2.0), mat_water, vertices=16, parent=root)
    # Top Finial & Spout
    add_sphere("FountainFinial", 0.38, (0, 0, 2.45), mat_gold, parent=root)
    add_cone("FountainSpout", 0.15, 0.4, (0, 0, 2.8), mat_gold, parent=root)

    # --- Wisteria Garden Arch ---
    arch_x, arch_y = -6.0, 0.0
    for sx in [-1.5, 1.5]:
        for sy in [-0.8, 0.8]:
            add_cylinder(f"ArchPost_{sx}_{sy}", 0.1, 3.2, (arch_x + sx, arch_y + sy, 1.6), mat_wood, vertices=8, parent=root)
    # Overhead rafters
    for r in range(-4, 5):
        add_box(f"ArchRafter_{r}", (3.6, 0.12, 0.14), (arch_x, arch_y + r * 0.35, 3.25), mat_wood, root)
    # Wisteria Blossom Clusters hanging down
    for w in range(16):
        ang = w * 0.4
        wx = arch_x + math.sin(ang) * 1.4
        wy = arch_y + (w % 5 - 2) * 0.45
        wz = 2.8 - (w % 3) * 0.3
        add_sphere(f"Wisteria_{w}", 0.28, (wx, wy, wz), mat_flower, scale=(0.8, 0.8, 1.4), parent=root)

    # --- Stone Garden Bench ---
    bx, by = 5.0, 0.0
    add_box("BenchSeat", (2.4, 0.8, 0.18), (bx, by, 0.6), mat_stone, root)
    add_box("BenchBack", (2.4, 0.18, 0.75), (bx, by - 0.35, 1.05), mat_stone, root)
    add_cylinder("BenchLegL", 0.2, 0.55, (bx - 0.9, by, 0.28), mat_stone, vertices=8, parent=root)
    add_cylinder("BenchLegR", 0.2, 0.55, (bx + 0.9, by, 0.28), mat_stone, vertices=8, parent=root)

    filepath = os.path.join(OUTPUT_DIR, "garden.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB')
    print(f"Exported garden to {filepath}")

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
if __name__ == "__main__":
    print("Building Ghibli 3D assets with Blender...")
    
    # 1. Fairytale Castle
    build_castle()
    
    # 2. Anime Trees (Oak, Cherry Blossom, Golden Autumn)
    # Summer Oak: Rich vibrant emerald palette
    build_tree("tree_oak", {
        "top": "#82cf53",  # sunlit golden lime
        "mid": "#48a336",  # vibrant meadow emerald
        "dark":"#266e20",  # deep forest shadow
    }, {"hex": "#5e3c23"}, scale=1.0)
    
    # Sakura Cherry: Soft Ghibli pastel pinks
    build_tree("tree_cherry", {
        "top": "#ffb5ca",  # sunlit cherry blossom peach
        "mid": "#f788a8",  # vibrant sakura pink
        "dark":"#c44d75",  # deep rose shadow
    }, {"hex": "#755038"}, scale=1.1)

    # Golden Autumn Ginkgo
    build_tree("tree_autumn", {
        "top": "#ffd147",  # golden yellow
        "mid": "#f09829",  # warm orange amber
        "dark":"#b85e18",  # deep copper shadow
    }, {"hex": "#543720"}, scale=0.95)

    # 3. Cottage Café
    build_cafe()

    # 4. Wishing Garden Sanctuary
    build_garden()

    print("ALL GHIBLI ASSETS BUILT AND EXPORTED SUCCESSFULLY!")
