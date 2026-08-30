class_name Crafting
extends Node

static var RECIPES = [
	{
		"name": "Wooden Pickaxe",
		"output": Blocks.Type.PICKAXE,
		"output_count": 1,
		"ingredients": {
			Blocks.Type.WOOD: 3
		}
	},
	{
		"name": "Stone Brick (x4)",
		"output": Blocks.Type.STONE_BRICK,
		"output_count": 4,
		"ingredients": {
			Blocks.Type.STONE: 2
		}
	},
	{
		"name": "Torch (x4)",
		"output": Blocks.Type.TORCH,
		"output_count": 4,
		"ingredients": {
			Blocks.Type.WOOD: 1,
			Blocks.Type.COAL: 1
		}
	},
	{
		"name": "Wood Wall (x4)",
		"output": Blocks.Type.WOOD_WALL,
		"output_count": 4,
		"ingredients": {
			Blocks.Type.WOOD: 1
		}
	},
	{
		"name": "Wood Planks",
		"output": Blocks.Type.WOOD,
		"output_count": 4,
		"ingredients": {
			Blocks.Type.WOOD: 1
		}
	}
]

static func can_craft(recipe: Dictionary, inventory: Dictionary) -> bool:
	var ingredients = recipe["ingredients"]
	for item in ingredients:
		var required_amount = ingredients[item]
		if inventory.get(item, 0) < required_amount:
			return false
	return true

static func craft(recipe: Dictionary, inventory: Dictionary) -> bool:
	if not can_craft(recipe, inventory):
		return false
	
	var ingredients = recipe["ingredients"]
	for item in ingredients:
		inventory[item] -= ingredients[item]
		if inventory[item] <= 0:
			inventory.erase(item)
			
	var output = recipe["output"]
	var count = recipe["output_count"]
	inventory[output] = inventory.get(output, 0) + count
	return true
