// FPS player: pointer lock, AABB physics, sprinting, sneaking, jumping

import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType, BLOCK_DEFS } from '../world/Block';
import { SoundManager } from '../audio/SoundManager.ts';
import { CHUNK_HEIGHT } from '../world/Chunk';

const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH  = 0.6;
const PLAYER_HALF_W = PLAYER_WIDTH / 2;
const EYE_HEIGHT    = 1.62;
const GRAVITY       = 28.0;
const JUMP_VELOCITY = 8.5;
const WALK_SPEED    = 4.5;
const SPRINT_SPEED  = 7.0;
const SNEAK_SPEED   = 1.8;
const MAX_FALL      = 60.0;
const STEP_INTERVAL = 0.42; // seconds between footstep sounds

export class Player {
  camera: THREE.PerspectiveCamera;
  position: THREE.Vector3;
  velocity: THREE.Vector3 = new THREE.Vector3();

  private world: World;
  private sound: SoundManager;

  private yaw   = 0;
  private pitch = 0;

  private onGround = false;
  private isSprinting = false;
  private isSneaking  = false;

  private keys: Record<string, boolean> = {};
  private stepTimer = 0;

  // Hotbar
  hotbarSlot = 0;
  hotbar: BlockType[] = [
    BlockType.Grass,
    BlockType.Dirt,
    BlockType.Stone,
    BlockType.Wood,
    BlockType.Leaves,
    BlockType.Sand,
    BlockType.Glass,
    BlockType.OakLog,
    BlockType.Cobblestone,
  ];

  private locked = false;
  private _onPointerLock?: () => void;
  private _onPointerUnlock?: () => void;

  constructor(camera: THREE.PerspectiveCamera, world: World, sound: SoundManager) {
    this.camera = camera;
    this.world  = world;
    this.sound  = sound;
    this.position = new THREE.Vector3(8, 80, 8);
    this.setupInput();
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space' && this.onGround && this.locked) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
        this.sound.playJump();
      }
      // Number keys 1-9
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.replace('Digit', '')) - 1;
        if (n >= 0 && n <= 8) this.selectHotbar(n);
      }
    });

    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const sens = 0.0018;
      this.yaw   -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch  = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.pitch));
    });

    document.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.selectHotbar((this.hotbarSlot + dir + 9) % 9);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
      if (this.locked)    this._onPointerLock?.();
      else                this._onPointerUnlock?.();
    });
  }

  onLock(fn: () => void)   { this._onPointerLock = fn; }
  onUnlock(fn: () => void) { this._onPointerUnlock = fn; }

  requestLock(): void {
    document.body.requestPointerLock();
  }

  exitLock(): void {
    document.exitPointerLock();
  }

  isLocked(): boolean { return this.locked; }

  selectHotbar(slot: number): void {
    this.hotbarSlot = slot;
    // Dispatch event so UI updates
    document.dispatchEvent(new CustomEvent('hotbar-change', { detail: slot }));
  }

  getSelectedBlock(): BlockType {
    return this.hotbar[this.hotbarSlot];
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.locked) return;

    this.isSprinting = this.keys['ControlLeft'] || this.keys['ControlRight'];
    this.isSneaking  = this.keys['ShiftLeft']   || this.keys['ShiftRight'];

    const speed = this.isSprinting ? SPRINT_SPEED : this.isSneaking ? SNEAK_SPEED : WALK_SPEED;

    // Movement direction in camera space
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right   = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move    = new THREE.Vector3();

    if (this.keys['KeyW']) move.addScaledVector(forward, 1);
    if (this.keys['KeyS']) move.addScaledVector(forward, -1);
    if (this.keys['KeyA']) move.addScaledVector(right, -1);
    if (this.keys['KeyD']) move.addScaledVector(right, 1);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      // Footstep sound
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && this.onGround) {
        this.sound.playStep(this.getBlockBeneath());
        this.stepTimer = STEP_INTERVAL / (this.isSprinting ? 1.5 : 1.0);
      }
    } else {
      this.stepTimer = 0;
    }

    // Horizontal velocity (instant acceleration for Minecraft feel)
    this.velocity.x = move.x;
    this.velocity.z = move.z;

    // Gravity
    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt;
      this.velocity.y  = Math.max(this.velocity.y, -MAX_FALL);
    } else {
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // Sweep and resolve collisions
    this.moveAndCollide(dt);

    // Update camera
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z,
    );
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  // ─── AABB Collision ───────────────────────────────────────────────────────

  private moveAndCollide(dt: number): void {
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;

    // Try each axis separately (standard Minecraft-style sweep)
    this.position.x += dx;
    if (this.collidesAt(this.position)) {
      this.position.x -= dx;
      this.velocity.x = 0;
    }

    this.position.y += dy;
    if (this.collidesAt(this.position)) {
      if (dy < 0) {
        // Snap to floor
        this.position.y = Math.floor(this.position.y) + (dy < 0 ? 1 : 0);
        this.onGround = true;
      } else {
        this.velocity.y = 0;
      }
      this.position.y -= dy;
      // Snap to floor grid
      if (dy < 0) {
        this.snapToFloor();
        this.onGround = true;
      }
      this.velocity.y = 0;
    } else {
      // Check if still on ground
      const testPos = this.position.clone();
      testPos.y -= 0.05;
      this.onGround = this.collidesAt(testPos);
    }

    this.position.z += dz;
    if (this.collidesAt(this.position)) {
      this.position.z -= dz;
      this.velocity.z = 0;
    }

    // Clamp to world bounds
    this.position.y = Math.max(1, Math.min(this.position.y, CHUNK_HEIGHT - 2));
  }

  private snapToFloor(): void {
    const floorY = Math.ceil(this.position.y);
    this.position.y = floorY;
  }

  /** Check AABB overlap with solid world blocks */
  private collidesAt(pos: THREE.Vector3): boolean {
    const minX = Math.floor(pos.x - PLAYER_HALF_W);
    const maxX = Math.floor(pos.x + PLAYER_HALF_W);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + PLAYER_HEIGHT);
    const minZ = Math.floor(pos.z - PLAYER_HALF_W);
    const maxZ = Math.floor(pos.z + PLAYER_HALF_W);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const b = this.world.getBlock(x, y, z);
          if (BLOCK_DEFS[b].solid) return true;
        }
      }
    }
    return false;
  }

  private getBlockBeneath(): BlockType {
    return this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y) - 1,
      Math.floor(this.position.z),
    );
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  getChunkCoords(): [number, number] {
    return [
      Math.floor(this.position.x / 16),
      Math.floor(this.position.z / 16),
    ];
  }

  getFacingName(): string {
    const yawDeg = ((this.yaw * 180 / Math.PI) % 360 + 360) % 360;
    if (yawDeg < 45 || yawDeg >= 315) return 'North (-Z)';
    if (yawDeg < 135) return 'West (-X)';
    if (yawDeg < 225) return 'South (+Z)';
    return 'East (+X)';
  }
}