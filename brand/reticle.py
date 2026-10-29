# OUTSNIPE's object: a machined scope reticle in glossy candy green. A thick bevelled ring, four ticks pointing in,
# a bright dot at the centre. Renders the coin image, the site's hero cutout, or a turn for the film.
# blender -b --factory-startup --python brand/reticle.py -- still  <out.png> [samples] [res]
# blender -b --factory-startup --python brand/reticle.py -- cutout <out.png> [samples] [res]
# blender -b --factory-startup --python brand/reticle.py -- turn   <outdir> [samples] [res] [frames]
import bpy, math, sys, os
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = argv[0] if argv else "still"
OUT = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.abspath("reticle.png")
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
RES = int(argv[3]) if len(argv) > 3 else 1500
FRAMES = int(argv[4]) if len(argv) > 4 else 90
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene

def mat(name, color, rough=0.3, metal=0.0, coat=0.0, coat_rough=0.05, emit=None, strength=0.0, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    c = b.inputs.get("Coat Weight") or b.inputs.get("Clearcoat")
    if c: c.default_value = coat
    cr = b.inputs.get("Coat Roughness") or b.inputs.get("Clearcoat Roughness")
    if cr: cr.default_value = coat_rough
    if sss:
        w = b.inputs.get("Subsurface Weight") or b.inputs.get("Subsurface")
        if w: w.default_value = sss
        r = b.inputs.get("Subsurface Radius")
        if r: r.default_value = (0.2, 1.0, 0.4)
    if emit:
        k = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[k].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = strength
    return m, nt, b

# candy green with a faint orange-peel texture under the clear coat
green, gnt, gb = mat("green", (0.0, 0.62, 0.075), 0.2, 0.0, coat=1.0, coat_rough=0.03, sss=0.0)
nz = gnt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 260; nz.inputs["Detail"].default_value = 6
bp = gnt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.035
gnt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); gnt.links.new(bp.outputs["Normal"], gb.inputs["Normal"])
inner, _, _ = mat("inner", (0.012, 0.16, 0.05), 0.42, 0.0, coat=0.6)          # the ring's inner wall, darker
dot, _, dotb = mat("dot", (0.9, 1.0, 0.94), 0.12, coat=1.0, emit=(0.75, 1.0, 0.85), strength=0.55)

def finish(o, bevel=0.03, seg=5, angle=40):
    b = o.modifiers.new("bev", "BEVEL"); b.width = bevel; b.segments = seg; b.limit_method = "ANGLE"; b.angle_limit = math.radians(angle)
    try: b.harden_normals = True
    except Exception: pass
    wn = o.modifiers.new("wn", "WEIGHTED_NORMAL"); wn.keep_sharp = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    try: bpy.ops.object.shade_auto_smooth()
    except Exception: pass

R_OUT, R_IN, DEPTH = 1.12, 0.84, 0.34
# the ring: a circle swept with a soft superellipse profile (flat-ish faces that still curve, so the gloss rolls)
prof = bpy.data.curves.new("prof", "CURVE"); prof.dimensions = "2D"
sp = prof.splines.new("POLY"); N = 96; pa, pb, pn = (R_OUT - R_IN) / 2, DEPTH / 2, 3.2
sp.points.add(N - 1)
for i in range(N):
    t = 2 * math.pi * i / N; c, s_ = math.cos(t), math.sin(t)
    x = pa * math.copysign(abs(c) ** (2 / pn), c); y = pb * math.copysign(abs(s_) ** (2 / pn), s_)
    sp.points[i].co = (x, y, 0, 1)
sp.use_cyclic_u = True
po = bpy.data.objects.new("prof", prof); sc.collection.objects.link(po)
bpy.ops.curve.primitive_bezier_circle_add(radius=(R_OUT + R_IN) / 2)
ring = bpy.context.active_object; ring.name = "ring"
ring.data.bevel_mode = "OBJECT"; ring.data.bevel_object = po; ring.data.resolution_u = 64; ring.data.use_fill_caps = False
bpy.ops.object.convert(target="MESH"); bpy.data.objects.remove(po)
ring.rotation_euler = (math.radians(90), 0, 0); bpy.ops.object.transform_apply(rotation=True)
ring.data.materials.clear(); ring.data.materials.append(green); ring.data.materials.append(inner)
for p in ring.data.polygons:
    c = p.center; n = p.normal
    if abs(n.y) < 0.45 and (c.x * n.x + c.z * n.z) < 0: p.material_index = 1
# a machined scale engraved into the front face: 48 notches, longer every 6th (one boolean for all of them)
cutters = []
for i in range(48):
    a = i * 2 * math.pi / 48
    if i % 12 == 0: continue                      # the ticks sit there
    L = 0.13 if i % 6 == 0 else 0.07
    r = R_OUT - 0.07 - L / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.sin(a) * r, -DEPTH / 2, math.cos(a) * r), rotation=(0, a, 0))
    c = bpy.context.active_object; c.scale = (0.022, 0.05, L); bpy.ops.object.transform_apply(scale=True); cutters.append(c)
bpy.ops.object.select_all(action="DESELECT")
for c in cutters: c.select_set(True)
bpy.context.view_layer.objects.active = cutters[0]; bpy.ops.object.join(); cj = bpy.context.active_object
cj.data.materials.append(inner)
bo = ring.modifiers.new("scale", "BOOLEAN"); bo.object = cj; bo.operation = "DIFFERENCE"
bpy.context.view_layer.objects.active = ring; bpy.ops.object.modifier_apply(modifier="scale"); bpy.data.objects.remove(cj)
bpy.context.view_layer.objects.active = ring; bpy.ops.object.shade_smooth()
wn = ring.modifiers.new("wn", "WEIGHTED_NORMAL"); wn.keep_sharp = True
try: bpy.ops.object.shade_auto_smooth(angle=math.radians(50))
except Exception: pass

# four ticks pointing in, and four short nubs outside
parts = [ring]
def tick(angle, r0, r1, w, d):
    mid = (r0 + r1) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.sin(angle) * mid, 0, math.cos(angle) * mid), rotation=(0, angle, 0))
    o = bpy.context.active_object; o.scale = (w, d, r1 - r0); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(green); finish(o, min(w, d) * 0.42, 6, 30); parts.append(o)
for i in range(4):
    a = i * math.pi / 2
    tick(a, 0.40, R_IN + 0.02, 0.15, DEPTH * 0.72)
    tick(a, R_OUT - 0.02, R_OUT + 0.24, 0.17, DEPTH * 0.82)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, segments=48, ring_count=24, location=(0, -0.02, 0))
d = bpy.context.active_object; d.data.materials.append(dot); bpy.ops.object.shade_smooth(); parts.append(d)

# one pivot for the whole reticle, turned a little so it reads as an object
bpy.ops.object.empty_add(location=(0, 0, 0)); piv = bpy.context.active_object
for o in parts: o.parent = piv
TILT = Euler((math.radians(-13), 0, math.radians(27)))
piv.rotation_euler = TILT

# backdrop: near-black green with a soft green bloom behind the reticle (ticker only)
def backdrop():
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4.0, 0), rotation=(math.radians(90), 0, 0))
    pl = bpy.context.active_object
    m = bpy.data.materials.new("bg"); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord"); gr = nt.nodes.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.22, 0.22, 0.22)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.0012, 0.0022, 0.0017, 1); ramp.color_ramp.elements[1].position = 0.97
    ramp.color_ramp.elements[1].color = (0.006, 0.055, 0.022, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    nt.links.new(gr.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 0.55; nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    pl.data.materials.append(m)
    try: pl.visible_shadow = False
    except Exception: pass

# lights: a big soft key from the upper left, a cool top strip for the long highlight, a green rim from behind right
def area(name, loc, size, energy, color=(1, 1, 1), shape="RECTANGLE", sy=None):
    bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.active_object; l.name = name
    l.data.energy = energy; l.data.color = color; l.data.shape = shape; l.data.size = size; l.data.size_y = sy or size
    l.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return l
area("key", (-4.6, -1.2, 3.6), 3.0, 520)
area("strip", (0.4, -0.9, 4.6), 6.0, 360, (0.92, 0.97, 1.0), sy=0.6)
area("rim", (3.8, 1.6, 1.2), 2.0, 520, (0.45, 1.0, 0.6))
area("rim2", (-3.4, 1.8, -2.2), 2.0, 300, (0.35, 1.0, 0.55))
area("fill", (2.5, -3.5, -3.5), 2.0, 40)
# a long thin strip behind the camera: its reflection crosses the glossy face as one diagonal streak
sh = area("sheen", (-1.6, -9.0, 2.2), 0.35, 260, (1, 1, 1), sy=7.0); sh.rotation_euler.rotate_axis("Z", math.radians(38))
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
# the environment: dark below, a soft bright band above, so glossy faces carry a sheen
wn = world.node_tree; bg = wn.nodes["Background"]
wtc = wn.nodes.new("ShaderNodeTexCoord"); sep = wn.nodes.new("ShaderNodeSeparateXYZ"); wr = wn.nodes.new("ShaderNodeValToRGB")
wr.color_ramp.elements[0].position = 0.0; wr.color_ramp.elements[0].color = (0.002, 0.003, 0.0025, 1)
wr.color_ramp.elements[1].position = 0.6; wr.color_ramp.elements[1].color = (0.05, 0.11, 0.07, 1)
e2 = wr.color_ramp.elements.new(0.18); e2.color = (0.006, 0.008, 0.007, 1)
wn.links.new(wtc.outputs["Generated"], sep.inputs["Vector"]); wn.links.new(sep.outputs["Z"], wr.inputs["Fac"]); wn.links.new(wr.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.9

bpy.ops.object.camera_add(location=(0, -7.0, 0)); cam = bpy.context.active_object; sc.camera = cam
cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 70
def centre():
    # aim at the middle of what the camera actually sees (the tilt pushes the ring sideways)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    xs, zs = [], []
    for o in parts:
        e = o.evaluated_get(dg); mw = e.matrix_world
        for v in e.to_mesh().vertices: w = mw @ v.co; xs.append(w.x); zs.append(w.z)
        e.to_mesh_clear()
    cam.location.x = (min(xs) + max(xs)) / 2; cam.location.z = (min(zs) + max(zs)) / 2
    cam.location.x -= 0.1   # perspective makes the near (left) side look bigger: balance it by eye
centre()

sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dt in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dt; prefs.get_devices()
            if any(d.type == dt for d in prefs.devices):
                for d in prefs.devices: d.use = d.type == dt
                sc.cycles.device = "GPU"; break
        except TypeError: pass
except Exception: pass
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.image_settings.file_format = "PNG"
try: sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = -0.35
except TypeError: pass
sc.use_nodes = True
try:
    tree = sc.node_tree; rl = tree.nodes.get("Render Layers") or tree.nodes.new("CompositorNodeRLayers"); comp = tree.nodes.get("Composite") or tree.nodes.new("CompositorNodeComposite")
    gl = tree.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "HIGH"; gl.threshold = 0.9; gl.size = 7
    try: gl.mix = -0.6
    except Exception: pass
    tree.links.new(rl.outputs["Image"], gl.inputs["Image"]); tree.links.new(gl.outputs["Image"], comp.inputs["Image"])
    if MODE != "still": tree.links.new(rl.outputs["Alpha"], comp.inputs["Alpha"])
except Exception as e: print("no glare", e)

if MODE == "still":
    backdrop(); sc.render.resolution_x = sc.render.resolution_y = RES; cam.data.lens = 70
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
elif MODE == "cutout":
    sc.render.resolution_x = sc.render.resolution_y = RES; cam.data.lens = 66
    sc.render.film_transparent = True; sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
else:
    # a slow quarter turn that settles on the hero angle (the film's end card)
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.film_transparent = True; sc.render.image_settings.color_mode = "RGBA"; cam.data.lens = 66
    os.makedirs(OUT, exist_ok=True)
    for f in range(FRAMES):
        p = f / max(1, FRAMES - 1); e = 1 - (1 - p) ** 3
        piv.rotation_euler = Euler((TILT.x * e + math.radians(-20) * (1 - e), 0, TILT.z * e + math.radians(-80) * (1 - e)))
        dotb.inputs["Emission Strength"].default_value = 0.55 + 10 * math.exp(-((p - 0.82) ** 2) / 0.004)
        sc.render.filepath = os.path.join(OUT, "r%03d.png" % f); bpy.ops.render.render(write_still=True)
print("done", MODE)
