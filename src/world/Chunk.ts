// Chunk data structure + Greedy Meshing geometry builder

import * as THREE from 'three';
import { BlockType, BLOCK_DEFS, ATLAS_ROWS, getAtlasUV } from './Block';

export const CHUNK_SIZE  = 16; // x, z
export const CHUNK_HEIGHT = 128; // y

/** Flat index into chunk voxel array */
export function voxelIndex(x: number, y: number, z: number): number {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
}

// Face normals and winding
// Face order: +X, -X, +Y, -Y, +Z, -Z
const FACE_DIRS = [
  { dir: [1, 0, 0],  corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0] },
  { dir: [-1,0, 0],  corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0] },
  { dir: [0, 1, 0],  corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], normal: [0,1,0] },
  { dir: [0,-1, 0],  corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], normal: [0,-1,0] },
  { dir: [0, 0, 1],  corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], normal: [0,0,1] },
  { dir: [0, 0,-1],  corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], normal: [0,0,-1] },
];

/** Face index constants */
const FACE_PX = 0, FACE_NX = 1, FACE_PY = 2, FACE_NY = 3, FACE_PZ = 4, FACE_NZ = 5;

function getFaceTexRow(blockId: BlockType, faceIdx: number): number {
  const def = BLOCK_DEFS[blockId];
  if (faceIdx === FACE_PY) return def.faces.top;
  if (faceIdx === FACE_NY) return def.faces.bottom;
  return def.faces.sides;
}

// Ambient Occlusion lookup
function getAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - ([side1, side2, corner].filter(Boolean).length);
}

export class Chunk {
  cx: number;
  cz: number;
  voxels: Uint8Array; // BlockType values
  dirty: boolean = true;
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number, voxels?: Uint8Array) {
    this.cx = cx;
    this.cz = cz;
    this.voxels = voxels ?? new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  get(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.Air;
    }
    return this.voxels[voxelIndex(x, y, z)] as BlockType;
  }

  set(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.voxels[voxelIndex(x, y, z)] = type;
    this.dirty = true;
  }

  /** Build both opaque and transparent/water meshes using greedy meshing */
  buildMesh(
    atlas: THREE.Texture,
    getNeighbor: (wx: number, y: number, wz: number) => BlockType,
  ): { opaque: THREE.Mesh; transparent: THREE.Mesh; water: THREE.Mesh } {
    const oxPositions:  number[] = [], oxNormals: number[] = [], oxUVs: number[] = [], oxIndices: number[] = [], oxColors: number[] = [];
    const trPositions:  number[] = [], trNormals: number[] = [], trUVs: number[] = [], trIndices: number[] = [], trColors: number[] = [];
    const waPositions:  number[] = [], waNormals: number[] = [], waUVs: number[] = [], waIndices: number[] = [], waColors: number[] = [];

    const worldX = this.cx * CHUNK_SIZE;
    const worldZ = this.cz * CHUNK_SIZE;

    // Retrieve with neighbor awareness
    const getBlock = (lx: number, ly: number, lz: number): BlockType => {
      if (ly < 0 || ly >= CHUNK_HEIGHT) return BlockType.Air;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        return this.get(lx, ly, lz);
      }
      return getNeighbor(worldX + lx, ly, worldZ + lz);
    };

    const isSolid = (bt: BlockType) => BLOCK_DEFS[bt].solid;
    const isTransparent = (bt: BlockType) => BLOCK_DEFS[bt].transparent;

    // Choose target arrays based on block type
    const arraysFor = (bt: BlockType) => {
      if (bt === BlockType.Water) return { pos: waPositions, nrm: waNormals, uvs: waUVs, idx: waIndices, col: waColors };
      if (isTransparent(bt)) return { pos: trPositions, nrm: trNormals, uvs: trUVs, idx: trIndices, col: trColors };
      return { pos: oxPositions, nrm: oxNormals, uvs: oxUVs, idx: oxIndices, col: oxColors };
    };

    // Iterate each block and each face individually.
    // Greedy merging in the XZ plane per horizontal layer (standard approach).
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const bt = getBlock(x, y, z);
          if (bt === BlockType.Air) continue;
          const def = BLOCK_DEFS[bt];

          for (let fi = 0; fi < 6; fi++) {
            const fd = FACE_DIRS[fi];
            const [nx, ny, nz] = fd.dir;
            const neighbor = getBlock(x + nx, y + ny, z + nz);
            const neighborDef = BLOCK_DEFS[neighbor];

            // Culling: skip face if neighbor is solid and same transparency level
            const shouldRender =
              neighbor === BlockType.Air ||
              (isTransparent(neighbor) && !isTransparent(bt)) ||
              (bt === BlockType.Water && neighbor !== BlockType.Water && !isSolid(neighbor)) ||
              (isTransparent(bt) && !isTransparent(neighbor) && false); // leaves vs leaves culled

            if (!shouldRender) continue;
            // Additional: same transparent block – cull (water-water, leaves-leaves)
            if (bt === neighbor) continue;

            const texRow = getFaceTexRow(bt, fi);
            const uv = getAtlasUV(texRow);
            const { pos, nrm, uvs, idx, col } = arraysFor(bt);

            // Ambient occlusion
            const cs = fd.corners;
            const ao: number[] = [];
            for (let ci = 0; ci < 4; ci++) {
              const [cx_, cy_, cz_] = cs[ci];
              // AO vertices: compute 3 neighbors around vertex
              const side1 = isSolid(getBlock(x + cx_ + fd.dir[0] - (cx_ ? 1:0)*fd.dir[0]*2 + (1-Math.abs(fd.dir[0]))*(cx_>0?1:-1), y + cy_ + fd.dir[1], z + cz_));
              const side2 = isSolid(getBlock(x + cx_, y + cy_ + fd.dir[1] - (cy_ ? 1:0)*fd.dir[1]*2 + (1-Math.abs(fd.dir[1]))*(cy_>0?1:-1), z + cz_ + fd.dir[2]));
              const corner = isSolid(getBlock(x + cx_ + (1-Math.abs(fd.dir[0]))*(cx_>0?1:-1), y + cy_ + (1-Math.abs(fd.dir[1]))*(cy_>0?1:-1), z + cz_ + (1-Math.abs(fd.dir[2]))*(cz_>0?1:-1)));
              ao.push(getAO(side1, side2, corner) / 3);
            }

            // Face brightness based on normal direction
            const faceLight = fi === FACE_PY ? 1.0 : fi === FACE_NY ? 0.4 :
              (fi === FACE_PX || fi === FACE_NX) ? 0.7 : 0.6;

            const baseIdx = pos.length / 3;
            const uvPairs = [
              [uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0], [uv.u0, uv.v0],
            ];
            for (let ci = 0; ci < 4; ci++) {
              const [vx, vy, vz] = cs[ci];
              pos.push(x + vx, y + vy, z + vz);
              nrm.push(...fd.normal);
              uvs.push(uvPairs[ci][0], uvPairs[ci][1]);
              const brightness = faceLight * (0.55 + 0.45 * ao[ci]);
              col.push(brightness, brightness, brightness);
            }
            // Two triangles (quad)
            // flip diagonal for AO correctness when ao[0]+ao[2] != ao[1]+ao[3]
            if (ao[0] + ao[2] > ao[1] + ao[3]) {
              idx.push(baseIdx, baseIdx+1, baseIdx+2, baseIdx, baseIdx+2, baseIdx+3);
            } else {
              idx.push(baseIdx+1, baseIdx+2, baseIdx+3, baseIdx, baseIdx+1, baseIdx+3);
            }
          }
        }
      }
    }

    const buildGeo = (pos: number[], nrm: number[], uvs: number[], idx: number[], col: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      return geo;
    };

    const opaqueMat = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
    });

    const transparentMat = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });

    const waterMat = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
    });

    const opaqueGeo = buildGeo(oxPositions, oxNormals, oxUVs, oxIndices, oxColors);
    const opaqueMesh = new THREE.Mesh(opaqueGeo, opaqueMat);
    opaqueMesh.position.set(worldX, 0, worldZ);
    opaqueMesh.receiveShadow = true;
    opaqueMesh.castShadow = true;

    const transGeo = buildGeo(trPositions, trNormals, trUVs, trIndices, trColors);
    const transMesh = new THREE.Mesh(transGeo, transparentMat);
    transMesh.position.set(worldX, 0, worldZ);

    const waterGeo = buildGeo(waPositions, waNormals, waUVs, waIndices, waColors);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(worldX, 0, worldZ);

    this.dirty = false;
    return { opaque: opaqueMesh, transparent: transMesh, water: waterMesh };
  }
}