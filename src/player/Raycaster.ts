// Block targeting, wireframe selection, break/place

import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType, BLOCK_DEFS } from '../world/Block';
import { SoundManager } from '../audio/SoundManager.ts';
import { Player } from './Player';

const MAX_REACH = 5.0;
const RAY_STEPS = 64;

interface HitResult {
  blockPos: THREE.Vector3;
  faceNormal: THREE.Vector3;
  distance: number;
}

export class VoxelRaycaster {
  private world: World;
  private player: Player;
  private sound: SoundManager;
  private scene: THREE.Scene;

  private selectionMesh: THREE.LineSegments;
  private lastHit: HitResult | null = null;

  constructor(world: World, player: Player, sound: SoundManager, scene: THREE.Scene) {
    this.world  = world;
    this.player = player;
    this.sound  = sound;
    this.scene  = scene;
    this.selectionMesh = this.buildSelectionMesh();
    this.scene.add(this.selectionMesh);
    this.selectionMesh.visible = false;
    this.setupMouseInput();
  }

  private buildSelectionMesh(): THREE.LineSegments {
    // Wireframe cube slightly larger than 1 voxel
    const e = 0.002; // epsilon offset
    const s = 1 + e * 2;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s));
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1.5 });
    const mesh = new THREE.LineSegments(geo, mat);
    return mesh;
  }

  private setupMouseInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.player.isLocked()) return;
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });

    // Prevent context menu in-game
    document.addEventListener('contextmenu', (e) => {
      if (this.player.isLocked()) e.preventDefault();
    });
  }

  // DDA voxel traversal
  private castRay(): HitResult | null {
    const camera = this.player.camera;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;

    const tDeltaX = Math.abs(1 / dir.x);
    const tDeltaY = Math.abs(1 / dir.y);
    const tDeltaZ = Math.abs(1 / dir.z);

    let tMaxX = dir.x > 0 ? (x + 1 - origin.x) / dir.x : (origin.x - x) / -dir.x;
    let tMaxY = dir.y > 0 ? (y + 1 - origin.y) / dir.y : (origin.y - y) / -dir.y;
    let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) / dir.z : (origin.z - z) / -dir.z;

    let lastFace = new THREE.Vector3();
    let t = 0;

    for (let i = 0; i < RAY_STEPS; i++) {
      const b = this.world.getBlock(x, y, z);
      if (BLOCK_DEFS[b].solid && b !== BlockType.Air) {
        return {
          blockPos: new THREE.Vector3(x, y, z),
          faceNormal: lastFace.clone(),
          distance: t,
        };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        lastFace.set(-stepX, 0, 0);
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        lastFace.set(0, -stepY, 0);
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        lastFace.set(0, 0, -stepZ);
      }

      if (t > MAX_REACH) break;
    }
    return null;
  }

  private breakBlock(): void {
    const hit = this.lastHit;
    if (!hit) return;
    const { x, y, z } = hit.blockPos;
    const block = this.world.getBlock(x, y, z);
    if (block === BlockType.Bedrock || block === BlockType.Air) return;

    this.sound.playBreak(block);
    this.world.setBlock(x, y, z, BlockType.Air);
    this.selectionMesh.visible = false;
  }

  private placeBlock(): void {
    const hit = this.lastHit;
    if (!hit) return;

    const placePos = hit.blockPos.clone().add(hit.faceNormal);
    const { x, y, z } = placePos;

    // Don't place inside player
    const playerMin = this.player.position.clone().sub(new THREE.Vector3(0.3, 0, 0.3));
    const playerMax = this.player.position.clone().add(new THREE.Vector3(0.3, 1.8, 0.3));
    if (
      x >= Math.floor(playerMin.x) && x <= Math.floor(playerMax.x) &&
      y >= Math.floor(playerMin.y) && y <= Math.floor(playerMax.y) &&
      z >= Math.floor(playerMin.z) && z <= Math.floor(playerMax.z)
    ) return;

    const selected = this.player.getSelectedBlock();
    if (!BLOCK_DEFS[selected].placeable) return;
    if (this.world.getBlock(x, y, z) !== BlockType.Air) return;

    this.sound.playPlace(selected);
    this.world.setBlock(x, y, z, selected);
  }

  update(): void {
    this.lastHit = this.castRay();

    if (this.lastHit) {
      const { x, y, z } = this.lastHit.blockPos;
      this.selectionMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.selectionMesh.visible = true;

      // Update debug block info
      const b = this.world.getBlock(x, y, z);
      const el = document.getElementById('debug-block');
      if (el) el.textContent = `Block: ${BLOCK_DEFS[b].name} (${x}, ${y}, ${z})`;
    } else {
      this.selectionMesh.visible = false;
      const el = document.getElementById('debug-block');
      if (el) el.textContent = 'Block: Air';
    }
  }
}