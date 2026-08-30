extends Node

@onready var world = $World
@onready var player = $Player
@onready var ui = $UI

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	player.inventory_changed.connect(_on_player_inventory_changed)
	player.mined_block.connect(_on_player_mined_block)
	player.placed_block.connect(_on_player_placed_block)
	
	ui.item_selected.connect(_on_ui_item_selected)
	ui.craft_requested.connect(_on_ui_craft_requested)

	ui.update_hotbar(player.inventory, player.selected_slot_index)
	ui.update_health(player.health)

func _process(_delta: float) -> void:
	if ui:
		ui.update_time(world.time_of_day)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_just_pressed("toggle_crafting"):
		ui.toggle_crafting()
	elif event.is_action_just_pressed("save_game"):
		save_game()
	elif event.is_action_just_pressed("load_game"):
		load_game()
	elif event.is_action_just_pressed("ui_cancel"):
		if ui.is_crafting_open():
			ui.toggle_crafting()

func _on_player_inventory_changed() -> void:
	ui.update_hotbar(player.inventory, player.selected_slot_index)

func _on_player_mined_block(pos: Vector2i) -> void:
	var b_type = world.get_block(pos)
	if b_type != Blocks.Type.AIR and b_type != Blocks.Type.WATER:
		world.set_block(pos, Blocks.Type.AIR)
		player.add_item(b_type, 1)

func _on_player_placed_block(pos: Vector2i, block_type: int) -> void:
	if player.remove_item(block_type, 1):
		world.set_block(pos, block_type)

func _on_ui_item_selected(slot_index: int) -> void:
	player.selected_slot_index = slot_index

func _on_ui_craft_requested(recipe_index: int) -> void:
	var recipe = Crafting.RECIPES[recipe_index]
	if Crafting.craft(recipe, player.inventory):
		ui.show_message("Crafted: " + recipe["name"])
		player.emit_signal("inventory_changed")
	else:
		ui.show_message("Missing materials!")

func save_game() -> void:
	var w_data = world.get_save_data()
	var p_data = player.get_save_data()
	if SaveManager.save_game(w_data, p_data):
		ui.show_message("Game Saved!")

func load_game() -> void:
	var data = SaveManager.load_game()
	if data.size() > 0:
		if data.has("world"):
			world.load_save_data(data["world"])
		if data.has("player"):
			player.load_save_data(data["player"])
		ui.show_message("Game Loaded!")
