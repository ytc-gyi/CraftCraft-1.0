extends Node2D

const TILE_SIZE = 16
const WORLD_WIDTH = 256
const WORLD_HEIGHT = 128
const SEA_LEVEL = 45

@onready var canvas_modulate: CanvasModulate = $CanvasModulate

var terrain_noise: FastNoiseLite = FastNoiseLite.new()
var cave_noise: FastNoiseLite = FastNoiseLite.new()
var ore_noise: FastNoiseLite = FastNoiseLite.new()

# Storage format: Vector2i(x, y) -> block_type (int)
var blocks_grid: Dictionary = {}
var static_body: StaticBody2D

var time_of_day: float = 0.25 # 0.0 to 1.0 (0.25 is noon)
var day_duration_seconds: float = 300.0 # 5 minutes full cycle

func _ready() -> void:
	static_body = StaticBody2D.new()
	add_child(static_body)
	
	terrain_noise.seed = 1337
	terrain_noise.noise_type = FastNoiseLite.TYPE_PERLIN
	terrain_noise.frequency = 0.025

	cave_noise.seed = 4242
	cave_noise.noise_type = FastNoiseLite.TYPE_PERLIN
	cave_noise.frequency = 0.06

	ore_noise.seed = 9999
	ore_noise.noise_type = FastNoiseLite.TYPE_PERLIN
	ore_noise.frequency = 0.12

	generate_world()

func _process(delta: float) -> void:
	time_of_day += delta / day_duration_seconds
	if time_of_day >= 1.0:
		time_of_day -= 1.0

	if canvas_modulate:
		var cycle_rad = time_of_day * TAU
		var light_level = clamp(sin(cycle_rad), 0.12, 1.0)
		canvas_modulate.color = Color(light_level, light_level * 0.95, light_level + 0.08, 1.0)

func generate_world() -> void:
	blocks_grid.clear()

	for x in range(WORLD_WIDTH):
		var surface_y = int(remap(terrain_noise.get_noise_1d(x), -1.0, 1.0, 30, 48))
		for y in range(WORLD_HEIGHT):
			if y < surface_y:
				if y >= SEA_LEVEL:
					blocks_grid[Vector2i(x, y)] = Blocks.Type.WATER
				else:
					blocks_grid[Vector2i(x, y)] = Blocks.Type.AIR
			else:
				# Cave generation check
				var c_val = cave_noise.get_noise_2d(x, y)
				if y > surface_y + 4 and c_val > 0.35:
					blocks_grid[Vector2i(x, y)] = Blocks.Type.AIR
					continue

				if y == surface_y:
					if y >= SEA_LEVEL:
						blocks_grid[Vector2i(x, y)] = Blocks.Type.SAND
					else:
						blocks_grid[Vector2i(x, y)] = Blocks.Type.GRASS
				elif y <= surface_y + 5:
					blocks_grid[Vector2i(x, y)] = Blocks.Type.DIRT
				else:
					# Ore veins distribution
					var o_val = ore_noise.get_noise_2d(x, y)
					if o_val > 0.45:
						blocks_grid[Vector2i(x, y)] = Blocks.Type.COAL
					elif o_val < -0.5:
						blocks_grid[Vector2i(x, y)] = Blocks.Type.IRON
					else:
						blocks_grid[Vector2i(x, y)] = Blocks.Type.STONE

	# Spawn Trees
	var rng = RandomNumberGenerator.new()
	rng.seed = 777
	for x in range(6, WORLD_WIDTH - 6, 5):
		if rng.randf() > 0.35:
			var surface_y = int(remap(terrain_noise.get_noise_1d(x), -1.0, 1.0, 30, 48))
			if surface_y < SEA_LEVEL:
				_spawn_tree(x, surface_y - 1)

	rebuild_world_rendering_and_physics()

func _spawn_tree(x: int, y: int) -> void:
	var height = randi_range(4, 6)
	for h in range(height):
		blocks_grid[Vector2i(x, y - h)] = Blocks.Type.WOOD

	var leaf_y = y - height
	for lx in range(x - 2, x + 3):
		for ly in range(leaf_y - 2, leaf_y + 1):
			var pos = Vector2i(lx, ly)
			if not blocks_grid.has(pos) or blocks_grid[pos] == Blocks.Type.AIR:
				blocks_grid[pos] = Blocks.Type.LEAVES

func get_block(pos: Vector2i) -> int:
	return blocks_grid.get(pos, Blocks.Type.AIR)

func set_block(pos: Vector2i, block_type: int) -> void:
	blocks_grid[pos] = block_type
	rebuild_world_rendering_and_physics()

func rebuild_world_rendering_and_physics() -> void:
	queue_redraw()
	
	for child in static_body.get_children():
		child.queue_free()

	for pos in blocks_grid:
		var b_type = blocks_grid[pos]
		if Blocks.is_solid(b_type):
			var col = CollisionShape2D.new()
			var shape = RectangleShape2D.new()
			shape.size = Vector2(TILE_SIZE, TILE_SIZE)
			col.shape = shape
			col.position = Vector2(pos.x * TILE_SIZE + TILE_SIZE / 2.0, pos.y * TILE_SIZE + TILE_SIZE / 2.0)
			static_body.add_child(col)

func _draw() -> void:
	# Draw Sky/Underground Background fill
	draw_rect(Rect2(0, 0, WORLD_WIDTH * TILE_SIZE, SEA_LEVEL * TILE_SIZE), Color(0.45, 0.72, 0.98), true)
	draw_rect(Rect2(0, SEA_LEVEL * TILE_SIZE, WORLD_WIDTH * TILE_SIZE, (WORLD_HEIGHT - SEA_LEVEL) * TILE_SIZE), Color(0.12, 0.1, 0.1), true)

	for pos in blocks_grid:
		var b_type = blocks_grid[pos]
		if b_type == Blocks.Type.AIR:
			continue

		var rect = Rect2(Vector2(pos * TILE_SIZE), Vector2(TILE_SIZE, TILE_SIZE))
		var color = Blocks.get_color(b_type)
		draw_rect(rect, color, true)
		
		# Draw subtle tile border accent
		if b_type != Blocks.Type.WATER:
			draw_rect(rect, Color(0, 0, 0, 0.15), false, 1.0)

func get_save_data() -> Dictionary:
	var data = {}
	for pos in blocks_grid:
		var key = "%d,%d" % [pos.x, pos.y]
		data[key] = blocks_grid[pos]
	return {
		"blocks": data,
		"time_of_day": time_of_day
	}

func load_save_data(data: Dictionary) -> void:
	if not data.has("blocks"):
		return
	blocks_grid.clear()
	var b_data = data["blocks"]
	for k in b_data:
		var coords = k.split(",")
		if coords.size() == 2:
			var pos = Vector2i(int(coords[0]), int(coords[1]))
			blocks_grid[pos] = int(b_data[k])
	if data.has("time_of_day"):
		time_of_day = data["time_of_day"]
	rebuild_world_rendering_and_physics()
