class_name SaveManager
extends Node

const SAVE_FILE_PATH = "user://world_save.json"

static func save_game(world_data: Dictionary, player_data: Dictionary) -> bool:
	var save_dict = {
		"version": 1,
		"world": world_data,
		"player": player_data
	}
	var json_string = JSON.stringify(save_dict, "\t")
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	if file == null:
		print("Failed to open save file for writing: ", FileAccess.get_open_error())
		return false
	file.store_string(json_string)
	file.close()
	print("Game saved successfully to ", SAVE_FILE_PATH)
	return true

static func load_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE_FILE_PATH):
		print("Save file does not exist.")
		return {}
	
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if file == null:
		print("Failed to open save file for reading.")
		return {}
	
	var json_string = file.get_as_text()
	file.close()
	
	var json = JSON.new()
	var parse_result = json.parse(json_string)
	if parse_result != OK:
		print("JSON Parse Error: ", json.get_error_message())
		return {}
		
	return json.get_data()
