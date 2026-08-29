// Block types, IDs, properties, and procedural 16×16 texture atlas

export enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Bedrock = 4,
  Wood = 5,
  Leaves = 6,
  Sand = 7,
  Water = 8,
  Glass = 9,
  Planks = 10,
  Cobblestone = 11,
  Gravel = 12,
  OakLog = 13,
}

export const BLOCK_COUNT = 14;

/** Which faces to render */
export interface BlockDef {
  id: BlockType;
  name: string;
  solid: boolean;
  transparent: boolean;
  /** [top, bottom, side, side, side, side] atlas row for each face */
  faces: { top: number; bottom: number; sides: number };
  color: string;        // debug tint
  placeable: boolean;
  hardness: number;     // break time multiplier
}

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  [BlockType.Air]: {
    id: BlockType.Air, name: 'Air', solid: false, transparent: true,
    faces: { top: 0, bottom: 0, sides: 0 }, color: '#000', placeable: false, hardness: 0,
  },
  [BlockType.Grass]: {
    id: BlockType.Grass, name: 'Grass', solid: true, transparent: false,
    faces: { top: 1, bottom: 2, sides: 3 }, color: '#4a7c2a', placeable: true, hardness: 0.6,
  },
  [BlockType.Dirt]: {
    id: BlockType.Dirt, name: 'Dirt', solid: true, transparent: false,
    faces: { top: 2, bottom: 2, sides: 2 }, color: '#8b5e3c', placeable: true, hardness: 0.5,
  },
  [BlockType.Stone]: {
    id: BlockType.Stone, name: 'Stone', solid: true, transparent: false,
    faces: { top: 4, bottom: 4, sides: 4 }, color: '#888', placeable: true, hardness: 1.5,
  },
  [BlockType.Bedrock]: {
    id: BlockType.Bedrock, name: 'Bedrock', solid: true, transparent: false,
    faces: { top: 5, bottom: 5, sides: 5 }, color: '#333', placeable: false, hardness: Infinity,
  },
  [BlockType.Wood]: {
    id: BlockType.Wood, name: 'Wood Planks', solid: true, transparent: false,
    faces: { top: 6, bottom: 6, sides: 6 }, color: '#a0742a', placeable: true, hardness: 0.8,
  },
  [BlockType.Leaves]: {
    id: BlockType.Leaves, name: 'Leaves', solid: true, transparent: true,
    faces: { top: 7, bottom: 7, sides: 7 }, color: '#2d6b1a', placeable: true, hardness: 0.2,
  },
  [BlockType.Sand]: {
    id: BlockType.Sand, name: 'Sand', solid: true, transparent: false,
    faces: { top: 8, bottom: 8, sides: 8 }, color: '#d4c47a', placeable: true, hardness: 0.5,
  },
  [BlockType.Water]: {
    id: BlockType.Water, name: 'Water', solid: false, transparent: true,
    faces: { top: 9, bottom: 9, sides: 9 }, color: '#2255cc', placeable: false, hardness: 0,
  },
  [BlockType.Glass]: {
    id: BlockType.Glass, name: 'Glass', solid: true, transparent: true,
    faces: { top: 10, bottom: 10, sides: 10 }, color: '#aaddff', placeable: true, hardness: 0.3,
  },
  [BlockType.Planks]: {
    id: BlockType.Planks, name: 'Oak Planks', solid: true, transparent: false,
    faces: { top: 6, bottom: 6, sides: 6 }, color: '#a0742a', placeable: true, hardness: 0.8,
  },
  [BlockType.Cobblestone]: {
    id: BlockType.Cobblestone, name: 'Cobblestone', solid: true, transparent: false,
    faces: { top: 11, bottom: 11, sides: 11 }, color: '#777', placeable: true, hardness: 2.0,
  },
  [BlockType.Gravel]: {
    id: BlockType.Gravel, name: 'Gravel', solid: true, transparent: false,
    faces: { top: 12, bottom: 12, sides: 12 }, color: '#999', placeable: true, hardness: 0.6,
  },
  [BlockType.OakLog]: {
    id: BlockType.OakLog, name: 'Oak Log', solid: true, transparent: false,
    faces: { top: 13, bottom: 13, sides: 14 }, color: '#6b4c2a', placeable: true, hardness: 1.0,
  },
};

// ─── Procedural Texture Atlas ────────────────────────────────────────────────
// 16 rows × 1 column of 16×16 tiles
// Row indices match `faces` values above.

export const ATLAS_TILE_SIZE = 16;
export const ATLAS_COLS = 1;
export const ATLAS_ROWS = 15; // rows 0–14

/** Generate the full procedural texture atlas as a canvas */
export function createTextureAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_TILE_SIZE * ATLAS_COLS;
  canvas.height = ATLAS_TILE_SIZE * ATLAS_ROWS;
  const ctx = canvas.getContext('2d')!;

  const drawTile = (row: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.translate(0, row * ATLAS_TILE_SIZE);
    fn(ctx);
    ctx.restore();
  };

  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  };

  // Row 0 – Air / placeholder (black)
  drawTile(0, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 16, 16);
  });

  // Row 1 – Grass Top
  drawTile(1, (c) => {
    const r = rng(101);
    c.fillStyle = '#5a9e32';
    c.fillRect(0, 0, 16, 16);
    // Darker flecks
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#4a8828' : '#6ab840';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 2 – Dirt
  drawTile(2, (c) => {
    const r = rng(202);
    c.fillStyle = '#8b5e3c';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#6b4228' : '#a0703a';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 3 – Grass Side (top grass strip + dirt below)
  drawTile(3, (c) => {
    const r = rng(303);
    // dirt base
    c.fillStyle = '#8b5e3c';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * 16), y = 4 + Math.floor(r() * 12);
      c.fillStyle = r() > 0.5 ? '#6b4228' : '#a0703a';
      c.fillRect(x, y, 1, 1);
    }
    // grass top strip
    c.fillStyle = '#5a9e32';
    c.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(r() * 2);
      c.fillStyle = r() > 0.5 ? '#4a8828' : '#6ab840';
      c.fillRect(x, h, 1, 1);
    }
  });

  // Row 4 – Stone
  drawTile(4, (c) => {
    const r = rng(404);
    c.fillStyle = '#888';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 28; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#6e6e6e' : '#9e9e9e';
      c.fillRect(x, y, 1, 1);
    }
    // cracks
    c.fillStyle = '#555';
    c.fillRect(3, 7, 4, 1);
    c.fillRect(10, 3, 3, 1);
    c.fillRect(8, 12, 5, 1);
  });

  // Row 5 – Bedrock
  drawTile(5, (c) => {
    const r = rng(505);
    c.fillStyle = '#2a2a2a';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#111' : '#444';
      c.fillRect(x, y, 1, 1);
    }
    // blocky pattern
    c.fillStyle = '#333';
    c.fillRect(0, 0, 6, 1); c.fillRect(0, 0, 1, 6);
    c.fillRect(8, 8, 8, 1); c.fillRect(8, 8, 1, 8);
  });

  // Row 6 – Wood Planks
  drawTile(6, (c) => {
    const r = rng(606);
    c.fillStyle = '#c8a050';
    c.fillRect(0, 0, 16, 16);
    // plank lines
    c.fillStyle = '#a07838';
    c.fillRect(0, 4, 16, 1);
    c.fillRect(0, 9, 16, 1);
    c.fillRect(0, 14, 16, 1);
    // grain
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#b89040' : '#d8b060';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 7 – Leaves
  drawTile(7, (c) => {
    const r = rng(707);
    c.fillStyle = '#2d6b1a';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#1a5010' : '#3d8025';
      c.fillRect(x, y, 1, 1);
    }
    // transparent "holes"
    c.clearRect(0, 0, 2, 2);
    c.clearRect(14, 0, 2, 2);
    c.clearRect(0, 14, 2, 2);
    c.clearRect(14, 14, 2, 2);
    c.clearRect(7, 7, 1, 1);
    c.clearRect(4, 11, 1, 1);
    c.clearRect(11, 4, 1, 1);
  });

  // Row 8 – Sand
  drawTile(8, (c) => {
    const r = rng(808);
    c.fillStyle = '#d4c47a';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#b8a860' : '#e8d890';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 9 – Water
  drawTile(9, (c) => {
    const r = rng(909);
    c.fillStyle = 'rgba(30, 100, 200, 0.78)';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? 'rgba(60,130,230,0.6)' : 'rgba(10,80,170,0.6)';
      c.fillRect(x, y, 1, 1);
    }
    // wave lines
    c.fillStyle = 'rgba(100,180,255,0.45)';
    c.fillRect(2, 5, 6, 1);
    c.fillRect(10, 10, 5, 1);
  });

  // Row 10 – Glass
  drawTile(10, (c) => {
    c.clearRect(0, 0, 16, 16);
    c.fillStyle = 'rgba(180, 230, 255, 0.35)';
    c.fillRect(0, 0, 16, 16);
    // border
    c.fillStyle = 'rgba(200, 245, 255, 0.8)';
    c.fillRect(0, 0, 16, 1);
    c.fillRect(0, 15, 16, 1);
    c.fillRect(0, 0, 1, 16);
    c.fillRect(15, 0, 1, 16);
    // shine
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(2, 2, 3, 3);
  });

  // Row 11 – Cobblestone
  drawTile(11, (c) => {
    const r = rng(111);
    c.fillStyle = '#777';
    c.fillRect(0, 0, 16, 16);
    const stones = [
      [0,0,7,7],[8,0,8,7],[0,8,8,8],[9,8,7,8]
    ] as const;
    const colors = ['#6a6a6a','#848484','#5e5e5e','#929292'];
    stones.forEach(([x,y,w,h], i) => {
      c.fillStyle = colors[i];
      c.fillRect(x+1, y+1, w-2, h-2);
    });
    c.fillStyle = '#555';
    c.fillRect(0, 7, 16, 1);
    c.fillRect(8, 0, 1, 7);
    c.fillRect(9, 8, 1, 8);
    for (let i = 0; i < 15; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#636363' : '#8e8e8e';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 12 – Gravel
  drawTile(12, (c) => {
    const r = rng(1212);
    c.fillStyle = '#999';
    c.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(r() * 14), y = Math.floor(r() * 14);
      const s = 1 + Math.floor(r() * 3);
      const g = Math.floor(r() * 80 + 80);
      c.fillStyle = `rgb(${g},${g},${g})`;
      c.fillRect(x, y, s, s);
    }
  });

  // Row 13 – Oak Log Top
  drawTile(13, (c) => {
    const r = rng(1313);
    c.fillStyle = '#8a6228';
    c.fillRect(0, 0, 16, 16);
    // rings
    c.strokeStyle = '#6b4a1a';
    c.lineWidth = 1;
    c.beginPath(); c.arc(8, 8, 6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(8, 8, 3, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#7a5420';
    c.fillRect(7, 7, 2, 2);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#6b4a18' : '#9a7230';
      c.fillRect(x, y, 1, 1);
    }
  });

  // Row 14 – Oak Log Side
  drawTile(14, (c) => {
    const r = rng(1414);
    c.fillStyle = '#8a6228';
    c.fillRect(0, 0, 16, 16);
    // vertical bark stripes
    const stripes = [0,3,5,9,12,14];
    stripes.forEach((x) => {
      c.fillStyle = '#6b4a1a';
      c.fillRect(x, 0, 1, 16);
    });
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      c.fillStyle = r() > 0.5 ? '#7a5420' : '#9a7230';
      c.fillRect(x, y, 1, 1);
    }
    // end caps (dark top/bottom band)
    c.fillStyle = '#5a3a10';
    c.fillRect(0, 0, 16, 1);
    c.fillRect(0, 15, 16, 1);
  });

  return canvas;
}

/** UV rect for a given atlas row (normalized 0–1) */
export function getAtlasUV(row: number): { u0: number; v0: number; u1: number; v1: number } {
  const tileH = 1 / ATLAS_ROWS;
  return {
    u0: 0,
    v0: row * tileH,
    u1: 1,
    v1: (row + 1) * tileH,
  };
}