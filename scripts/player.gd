extends CharacterBody2D

signal inventory_changed
signal mined_block(position: Vector2i)
signal placed_block(position: Vector2i, block_type: int)

const MAX_SPEED = 260.0
const ACCELERATION = 1400.0
const FRICTION = 1200.0
const JUMP_VELOCITY = -430.0
const REACH_DISTANCE_PIXELS = 190.0
const TILE_SIZE = 16

@onready var camera: Camera2D = $Camera2D

var gravity: float = 1000.0
var health: float = 100.0
var coyote_timer: float = 0.0

var inventory: Dictionary = {
	Blocks.Type.GRASS: 15,
	Blocks.Type.DIRT: 30,
	Blocks.Type.STONE: 20,
	Blocks.Type.WOOD: 10,
	Blocks.Type.TORCH: 5
}
var selected_slot_index: int = 0

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.keycode >= KEY_1 and event.keycode <= KEY_9:
			selected_slot_index = event.keycode - KEY_1
			emit_signal("inventory_changed")
	
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			camera.zoom = (camera.zoom * 1.08).clamp(Vector2(0.5, 0.5), Vector2(2.5, 2.5))
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			camera.zoom = (camera.zoom * 0.92).clamp(Vector2(0.5, 0.5), Vector2(2.5, 2.5))

func _physics_process(delta: float) -> void:
	if is_on_floor():
		coyote_timer = 0.15
	else:
		coyote_timer -= delta
		velocity.y += gravity * delta

	if Input.is_action_just_pressed("jump") and coyote_timer > 0.0:
		velocity.y = JUMP_VELOCITY
		coyote_timer = 0.0

	var input_axis = Input.get_axis("move_left", "move_right")
	if input_axis != 0:
		velocity.x = move_toward(velocity.x, input_axis * MAX_SPEED, ACCELERATION * delta)
	else:
		velocity.x = move_toward(velocity.x, 0, FRICTION * delta)

	move_and_slide()
	queue_redraw()

	if Input.is_action_just_pressed("mine"):
		_handle_mine()
	elif Input.is_action_just_pressed("place"):
		_handle_place()

func _handle_mine() -> void:
	var mouse_pos = get_global_mouse_position()
	if global_position.distance_to(mouse_pos) <= REACH_DISTANCE_PIXELS:
		var tile_coord = Vector2i(floor(mouse_pos.x / TILE_SIZE), floor(mouse_pos.y / TILE_SIZE))
		emit_signal("mined_block", tile_coord)

func _handle_place() -> void:
	var active_type = get_selected_block_type()
	if active_type == Blocks.Type.AIR or active_type == Blocks.Type.PICKAXE:
		return

	if inventory.get(active_type, 0) <= 0:
		return

	var mouse_pos = get_global_mouse_position()
	if global_position.distance_to(mouse_pos) <= REACH_DISTANCE_PIXELS:
		var tile_coord = Vector2i(floor(mouse_pos.x / TILE_SIZE), floor(mouse_pos.y / TILE_SIZE))
		
		# Check tile collision box with player bounds
		var tile_rect = Rect2(Vector2(tile_coord * TILE_SIZE), Vector2(TILE_SIZE, TILE_SIZE))
		var player_rect = Rect2(global_position - Vector2(7, 14), Vector2(14, 28))
		if Blocks.is_solid(active_type) and player_rect.intersects(tile_rect):
			return

		emit_signal("placed_block", tile_coord, active_type)

func _draw() -> void:
	# Draw mouse target highlight cursor
	var mouse_pos = get_local_mouse_position()
	var global_mouse = get_global_mouse_position()
	var in_range = global_position.distance_to(global_mouse) <= REACH_DISTANCE_PIXELS
	
	var tile_coord = Vector2i(floor(global_mouse.x / TILE_SIZE), floor(global_mouse.y / TILE_SIZE))
	var tile_local_pos = to_local(Vector2(tile_coord * TILE_SIZE))
	var target_rect = Rect2(tile_local_pos, Vector2(TILE_SIZE, TILE_SIZE))
	
	var border_color = Color(1, 1, 0, 0.8) if in_range else Color(1, 0, 0, 0.4)
	draw_rect(target_rect, border_color, false, 2.0)

func add_item(item_type: int, amount: int = 1) -> void:
	inventory[item_type] = inventory.get(item_type, 0) + amount
	emit_signal("inventory_changed")

func remove_item(item_type: int, amount: int = 1) -> bool:
	if inventory.get(item_type, 0) >= amount:
		inventory[item_type] -= amount
		if inventory[item_type] <= 0:
			inventory.erase(item_type)
		emit_signal("inventory_changed")
		return true
	return false

func get_selected_block_type() -> int:
	var keys = inventory.keys()
	if selected_slot_index < keys.size():
		return keys[selected_slot_index]
	return Blocks.Type.AIR

func get_save_data() -> Dictionary:
	return {
		"position": [global_position.x, global_position.y],
		"health": health,
		"inventory": inventory
	}

func load_save_data(data: Dictionary) -> void:
	if data.has("position"):
		var p = data["position"]
		global_position = Vector2(p[0], p[1])
	if data.has("health"):
		health = data["health"]
	if data.has("inventory"):
		inventory.clear()
		for k in data["inventory"]:
			inventory[int(k)] = int(data["inventory"][k])
	emit_signal("inventory_changed")
