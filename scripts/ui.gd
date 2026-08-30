extends CanvasLayer

signal item_selected(slot_index: int)
signal craft_requested(recipe_index: int)

@onready var hotbar_container: HBoxContainer = $Control/HotbarContainer
@onready var health_label: Label = $Control/TopBar/HealthLabel
@onready var time_label: Label = $Control/TopBar/TimeLabel
@onready var crafting_window: Panel = $Control/CraftingWindow
@onready var recipe_list: VBoxContainer = $Control/CraftingWindow/ScrollContainer/RecipeList
@onready var status_label: Label = $Control/StatusLabel

var hotbar_slots: Array[Button] = []
var selected_slot: int = 0

func _ready() -> void:
	crafting_window.visible = false
	status_label.text = ""
	_setup_hotbar()
	_setup_crafting_ui()

func _setup_hotbar() -> void:
	for child in hotbar_container.get_children():
		child.queue_free()
	hotbar_slots.clear()

	for i in range(9):
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(55, 55)
		btn.text = str(i + 1) + "\nEmpty"
		var slot_idx = i
		btn.pressed.connect(func(): select_slot(slot_idx))
		hotbar_container.add_child(btn)
		hotbar_slots.append(btn)

	highlight_slot(0)

func _setup_crafting_ui() -> void:
	for child in recipe_list.get_children():
		child.queue_free()

	for idx in range(Crafting.RECIPES.size()):
		var recipe = Crafting.RECIPES[idx]
		var btn = Button.new()
		var ing_str = ""
		for ing in recipe["ingredients"]:
			ing_str += "%s x%d " % [Blocks.get_name(ing), recipe["ingredients"][ing]]
		btn.text = "%s (Requires: %s)" % [recipe["name"], ing_str]
		var r_idx = idx
		btn.pressed.connect(func(): emit_signal("craft_requested", r_idx))
		recipe_list.add_child(btn)

func update_hotbar(inventory: Dictionary, selected_idx: int) -> void:
	selected_slot = selected_idx
	var items = inventory.keys()
	
	for i in range(9):
		var btn = hotbar_slots[i]
		if i < items.size():
			var item_type = items[i]
			var count = inventory[item_type]
			var name_str = Blocks.get_name(item_type)
			btn.text = "%d\n%s\n(%d)" % [i + 1, name_str, count]
			btn.self_modulate = Blocks.get_color(item_type).lightened(0.2)
		else:
			btn.text = "%d\nEmpty" % [i + 1]
			btn.self_modulate = Color(1, 1, 1)

	highlight_slot(selected_idx)

func highlight_slot(idx: int) -> void:
	for i in range(hotbar_slots.size()):
		var btn = hotbar_slots[i]
		if i == idx:
			btn.modulate = Color(1.2, 1.2, 0.4)
		else:
			btn.modulate = Color(1, 1, 1)

func select_slot(idx: int) -> void:
	selected_slot = idx
	highlight_slot(idx)
	emit_signal("item_selected", idx)

func update_health(health: float) -> void:
	health_label.text = "HP: %d/100" % int(health)

func update_time(time_of_day: float) -> void:
	var total_minutes = int(time_of_day * 24 * 60)
	var hours = (total_minutes / 60) % 24
	var minutes = total_minutes % 60
	time_label.text = "Time: %02d:%02d" % [hours, minutes]

func toggle_crafting() -> void:
	crafting_window.visible = !crafting_window.visible

func is_crafting_open() -> bool:
	return crafting_window.visible

func show_message(msg: String, duration: float = 2.0) -> void:
	status_label.text = msg
	var timer = get_tree().create_timer(duration)
	await timer.timeout
	if status_label.text == msg:
		status_label.text = ""
