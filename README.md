# Craft Craft 🛠️

A 2D voxel / tile-based sandbox game built with Godot 4 and GDScript.

## Features
- Procedural 2D terrain generation with caves, water, and underground ore veins (Coal & Iron).
- Smooth 2D platformer player physics (coyote time, acceleration, variable jump height).
- Interactive tile targeting cursor with mouse placement and mining range indicator.
- Dynamic Day/Night lighting cycle via CanvasModulate.
- Item crafting system with expandable recipes.
- Save and Load world & player state to JSON (`user://world_save.json`).

---

## How to Open in Godot 4 Editor

1. Download and install **Godot 4.3** (or later) from [godotengine.org](https://godotengine.org/).
2. Open Godot Engine Project Manager.
3. Click **Import**.
4. Select `craftcraft/project.godot` and click **Import & Edit**.

---

## Controls

- **A / D**: Move Left / Right
- **Space / W**: Jump
- **Mouse Wheel**: Zoom In / Out
- **Left Click**: Mine / Destroy Tile under Mouse Cursor
- **Right Click**: Place Selected Tile under Mouse Cursor
- **1 - 9 Keys**: Select Hotbar Item
- **E Key**: Toggle Crafting Menu
- **F5 Key**: Save Game State
- **F6 Key**: Load Game State

---

## Running the Build Script (`build.sh`)

