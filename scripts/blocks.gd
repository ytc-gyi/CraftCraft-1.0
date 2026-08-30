class_name Blocks
extends Node

enum Type {
	AIR = 0,
	GRASS = 1,
	DIRT = 2,
	STONE = 3,
	SAND = 4,
	WATER = 5,
	WOOD = 6,
	LEAVES = 7,
	PICKAXE = 8,
	COAL = 9,
	IRON = 10,
	TORCH = 11,
	WOOD_WALL = 12,
	STONE_BRICK = 13
}

static var DATA = {
	Type.AIR: {
		"name": "Air",
		"solid": false,
		"transparent": true,
		"color": Color(0, 0, 0, 0)
	},
	Type.GRASS: {
		"name": "Grass",
		"solid": true,
		"transparent": false,
		"color": Color(0.28, 0.78, 0.28)
	},
	Type.DIRT: {
		"name": "Dirt",
		"solid": true,
		"transparent": false,
		"color": Color(0.48, 0.30, 0.16)
	},
	Type.STONE: {
		"name": "Stone",
		"solid": true,
		"transparent": false,
		"color": Color(0.55, 0.55, 0.58)
	},
	Type.SAND: {
		"name": "Sand",
		"solid": true,
		"transparent": false,
		"color": Color(0.90, 0.84, 0.55)
	},
	Type.WATER: {
		"name": "Water",
		"solid": false,
		"transparent": true,
		"color": Color(0.20, 0.50, 0.90, 0.65)
	},
	Type.WOOD: {
		"name": "Wood Log",
		"solid": true,
		"transparent": false,
		"color": Color(0.40, 0.24, 0.12)
	},
	Type.LEAVES: {
		"name": "Leaves",
		"solid": true,
		"transparent": true,
		"color": Color(0.18, 0.60, 0.22, 0.9)
	},
	Type.PICKAXE: {
		"name": "Pickaxe",
		"solid": false,
		"transparent": true,
		"color": Color(0.70, 0.75, 0.95)
	},
	Type.COAL: {
		"name": "Coal Ore",
		"solid": true,
		"transparent": false,
		"color": Color(0.22, 0.22, 0.25)
	},
	Type.IRON: {
		"name": "Iron Ore",
		"solid": true,
		"transparent": false,
		"color": Color(0.72, 0.55, 0.42)
	},
	Type.TORCH: {
		"name": "Torch",
		"solid": false,
		"transparent": true,
		"color": Color(0.98, 0.75, 0.18)
	},
	Type.WOOD_WALL: {
		"name": "Wood Wall",
		"solid": false,
		"transparent": true,
		"color": Color(0.50, 0.32, 0.18, 0.8)
	},
	Type.STONE_BRICK: {
		"name": "Stone Brick",
		"solid": true,
		"transparent": false,
		"color": Color(0.38, 0.38, 0.42)
	}
}

static func get_color(block_type: int) -> Color:
	if DATA.has(block_type):
		return DATA[block_type]["color"]
	return Color(0, 0, 0, 0)

static func get_name(block_type: int) -> String:
	if DATA.has(block_type):
		return DATA[block_type]["name"]
	return "Unknown"

static func is_solid(block_type: int) -> bool:
	if DATA.has(block_type):
		return DATA[block_type]["solid"]
	return false

static func is_transparent(block_type: int) -> bool:
	if DATA.has(block_type):
		return DATA[block_type]["transparent"]
	return false
