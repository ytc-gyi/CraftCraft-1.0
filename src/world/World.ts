// World: chunk management, terrain generation, loading/unloading

import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk';
import { BlockType } from './Block';
import { SaveSystem } from '../storage/SaveSystem.ts';

// ─── Simplex / Perlin noise (self-contained, no external dep) ─────────────────
// Adapted from Stefan Gustavson's implementation (public domain)

const PERM = new Uint8Array(512);
const GRAD3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function dot3(g: number[], x: number, y: number, z: number) {
  return g[0]*x + g[1]*y + g[2]*z;
}
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }

export function simplex2(xin: number, yin: number): number {
  // 2D simplex noise
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t, Y0 = j - t;
  const x0 = xin - X0, y0 = yin - Y0;
  let i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;
  const ii = i & 255, jj = j & 255;
  const gi0 = PERM[ii + PERM[jj]] % 12;
  const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 12;
  const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 12;
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0*x0 - y0*y0;
  if (t0 >= 0) { t0 *= t0; n0 = t0*t0 * (GRAD3[gi0][0]*x0 + GRAD3[gi0][1]*y0); }
  let t1 = 0.5 - x1*x1 - y1*y1;
  if (t1 >= 0) { t1 *= t1; n1 = t1*t1 * (GRAD3[gi1][0]*x1 + GRAD3[gi1][1]*y1); }
  let t2 = 0.5 - x2*x2 - y2*y2;
  if (t2 >= 0) { t2 *= t2; n2 = t2*t2 * (GRAD3[gi2][0]*x2 + GRAD3[gi2][1]*y2); }
  return 70 * (n0 + n1 + n2);
}

export function perlin2(x: number, y: number): number {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = PERM[X] + Y, aa = PERM[a], ab = PERM[a+1];
  const b = PERM[X+1] + Y, ba = PERM[b], bb = PERM[b+1];
  return lerp(
    lerp(dot3(GRAD3[PERM[aa]%12], x,   y,   0), dot3(GRAD3[PERM[ba]%12], x-1, y,   0), u),
    lerp(dot3(GRAD3[PERM[ab]%12], x,   y-1, 0), dot3(GRAD3[PERM[bb]%12], x-1, y-1, 0), u),
    v
  );
}

function octaveNoise(x: number, z: number, octaves: number, persistence: number, lacunarity: number, scale: number): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += simplex2(x * frequency / scale, z * frequency / scale) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxValue;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WATER_LEVEL = 42;
const BEDROCK_LAYERS = 5;
const RENDER_RADIUS = 5; // chunks

export class World {
  private chunks = new Map<string, Chunk>();
  private scene: THREE.Scene;
  private atlas: THREE.Texture;
  private saveSystem: SaveSystem;
  private pendingRebuild = new Set<string>();
  private seed: number;

  constructor(scene: THREE.Scene, atlas: THREE.Texture, saveSystem: SaveSystem) {
    this.scene = scene;
    this.atlas = atlas;
    this.saveSystem = saveSystem;
    this.seed = Math.random() * 10000;
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  private async loadOrGenerateChunk(cx: number, cz: number): Promise<Chunk> {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key)!;

    // Try loading from IndexedDB first
    const saved = await this.saveSystem.loadChunk(cx, cz);
    let chunk: Chunk;
    if (saved) {
      chunk = new Chunk(cx, cz, saved);
    } else {
      chunk = new Chunk(cx, cz);
      this.generateChunk(chunk);
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  private generateChunk(chunk: Chunk): void {
    const { cx, cz } = chunk;
    const s = this.seed;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        // Base terrain height via multi-octave noise
        const baseH = octaveNoise(wx + s, wz + s, 6, 0.5, 2.0, 160) * 0.5 + 0.5;
        const surfaceY = Math.floor(32 + baseH * 40); // range ~32–72

        // Secondary noise for biome variation
        const biomeN = octaveNoise(wx + s * 0.3, wz + s * 0.3, 2, 0.5, 2.0, 400);
        const isDesert = biomeN > 0.35;

        // Height bumps for mountains
        const mountainN = octaveNoise(wx + s * 0.7, wz + s * 0.7, 4, 0.6, 2.2, 80);
        const finalSurface = surfaceY + (mountainN > 0.3 ? Math.floor((mountainN - 0.3) * 60) : 0);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockType.Air;

          if (y === 0) {
            block = BlockType.Bedrock;
          } else if (y < BEDROCK_LAYERS) {
            // probabilistic bedrock
            const bedrockN = simplex2((wx + y) * 0.5, (wz + y) * 0.5);
            block = bedrockN > -0.3 ? BlockType.Bedrock : BlockType.Stone;
          } else if (y < finalSurface - 4) {
            block = BlockType.Stone;
          } else if (y < finalSurface) {
            // Beneath surface: dirt or sand
            if (isDesert || finalSurface <= WATER_LEVEL + 1) {
              block = BlockType.Sand;
            } else {
              block = BlockType.Dirt;
            }
          } else if (y === finalSurface) {
            // Surface block
            if (isDesert || finalSurface <= WATER_LEVEL + 1) {
              block = BlockType.Sand;
            } else if (finalSurface < WATER_LEVEL + 2) {
              block = BlockType.Sand;
            } else {
              block = BlockType.Grass;
            }
          } else if (y <= WATER_LEVEL && block === BlockType.Air) {
            block = BlockType.Water;
          }

          chunk.set(lx, y, lz, block);
        }
      }
    }

    // Tree generation
    this.trySpawnTrees(chunk);
  }

  private trySpawnTrees(chunk: Chunk): void {
    const { cx, cz } = chunk;
    const s = this.seed;

    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        // Tree probability using noise (so it looks natural)
        const treeN = simplex2(wx * 0.3 + s * 1.7, wz * 0.3 + s * 2.3);
        if (treeN < 0.6) continue;

        // Find surface
        let surfaceY = -1;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const b = chunk.get(lx, y, lz);
          if (b === BlockType.Grass) { surfaceY = y; break; }
        }
        if (surfaceY < 0 || surfaceY <= WATER_LEVEL + 2) continue;

        const trunkH = 4 + Math.floor(simplex2(wx * 1.1, wz * 1.1) * 2);
        const leafR = 2;
        const leafTop = surfaceY + trunkH + 2;

        // Trunk
        for (let ty = 1; ty <= trunkH; ty++) {
          if (surfaceY + ty < CHUNK_HEIGHT) {
            chunk.set(lx, surfaceY + ty, lz, BlockType.OakLog);
          }
        }
        // Leaf canopy
        for (let dy = -1; dy <= 2; dy++) {
          const ry = surfaceY + trunkH + dy;
          if (ry >= CHUNK_HEIGHT) continue;
          const radius = dy >= 1 ? 1 : leafR;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue; // clip corners
              const nx = lx + dx, nz = lz + dz;
              if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
              if (chunk.get(nx, ry, nz) === BlockType.Air) {
                chunk.set(nx, ry, nz, BlockType.Leaves);
              }
            }
          }
        }
      }
    }
  }

  // Get block at world coordinates (cross-chunk aware)
  getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.Air;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BlockType.Air;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.get(lx, wy, lz);
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = this.chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.set(lx, wy, lz, type);
    this.pendingRebuild.add(key);

    // Rebuild neighbors if on chunk border
    if (lx === 0)             this.pendingRebuild.add(this.chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE-1)  this.pendingRebuild.add(this.chunkKey(cx + 1, cz));
    if (lz === 0)             this.pendingRebuild.add(this.chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE-1)  this.pendingRebuild.add(this.chunkKey(cx, cz + 1));

    // Persist
    this.saveSystem.saveChunk(cx, cz, chunk.voxels);
  }

  private rebuildChunkMesh(chunk: Chunk): void {
    // Remove old meshes
    if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
    if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); }
    if (chunk.transparentMesh) { this.scene.remove(chunk.transparentMesh); chunk.transparentMesh.geometry.dispose(); }

    const getNeighbor = (wx: number, wy: number, wz: number) => this.getBlock(wx, wy, wz);
    const { opaque, transparent, water } = chunk.buildMesh(this.atlas, getNeighbor);

    chunk.mesh = opaque;
    chunk.transparentMesh = transparent;
    chunk.waterMesh = water;

    this.scene.add(opaque);
    if (transparent.geometry.attributes['position']?.count > 0) this.scene.add(transparent);
    if (water.geometry.attributes['position']?.count > 0) this.scene.add(water);
  }

  async update(playerX: number, playerZ: number, onProgress?: (pct: number) => void): Promise<void> {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Collect chunks to load
    const needed = new Set<string>();
    const toLoad: Array<[number, number]> = [];

    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        if (dx*dx + dz*dz > RENDER_RADIUS * RENDER_RADIUS) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const key = this.chunkKey(cx, cz);
        needed.add(key);
        if (!this.chunks.has(key)) toLoad.push([cx, cz]);
      }
    }

    // Load new chunks
    for (let i = 0; i < toLoad.length; i++) {
      const [cx, cz] = toLoad[i];
      await this.loadOrGenerateChunk(cx, cz);
      if (onProgress) onProgress((i + 1) / toLoad.length);
    }

    // Rebuild dirty chunks
    for (const key of [...this.pendingRebuild]) {
      const chunk = this.chunks.get(key);
      if (chunk && needed.has(key)) {
        this.rebuildChunkMesh(chunk);
      }
      this.pendingRebuild.delete(key);
    }

    // Build meshes for newly loaded chunks
    for (const [cx, cz] of toLoad) {
      const chunk = this.chunks.get(this.chunkKey(cx, cz));
      if (chunk && chunk.dirty) this.rebuildChunkMesh(chunk);
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        if (chunk.mesh)            { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
        if (chunk.waterMesh)       { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); }
        if (chunk.transparentMesh) { this.scene.remove(chunk.transparentMesh); chunk.transparentMesh.geometry.dispose(); }
        this.chunks.delete(key);
      }
    }
  }

  /** Called once on startup to do an initial synchronous load with progress */
  async initialLoad(playerX: number, playerZ: number, onProgress: (pct: number) => void): Promise<void> {
    await this.update(playerX, playerZ, onProgress);
  }

  getSurfaceY(wx: number, wz: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = this.getBlock(wx, y, wz);
      if (b !== BlockType.Air && b !== BlockType.Water) return y;
    }
    return 64;
  }
}