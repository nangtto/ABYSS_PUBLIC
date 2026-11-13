import {
  AnimState,
  BiomeDef,
  ClassDef,
  DungeonRoom,
  GroundDrop,
  RARITY_COLORS,
  RoomProp,
  WeaponKind,
} from './types';

type PaletteMap = Record<string, string>;

const spriteCache = new Map<string, HTMLCanvasElement>();

function bakePixelMatrix(
  cacheKey: string,
  rows: string[],
  palette: PaletteMap,
  scale = 2
): HTMLCanvasElement {
  const existing = spriteCache.get(cacheKey);
  if (existing) return existing;

  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  spriteCache.set(cacheKey, c);
  return c;
}

const PLAYER_FRAMES: Record<'knight' | 'mage' | 'rogue' | 'default', string[][]> = {
  knight: [
    [
      '....oooooo......',
      '...oSSSSSSo.....',
      '...oSPPPPSo.....',
      '..oSSSSSSSSo....',
      '..oShhEEhhSo....',
      '...ohhhhhho.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSPPPSCCo...',
      '..ooPPPPPPoo....',
      '...oBBBBBBoo....',
      '...oBB..BBo.....',
      '...oBB..BBo.....',
      '...ooo..ooo.....',
      '................',
      '................',
    ],
    [
      '................',
      '....oooooo......',
      '...oSSSSSSo.....',
      '...oSPPPPSo.....',
      '..oSSSSSSSSo....',
      '..oShhEEhhSo....',
      '...ohhhhhho.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSPPPSCCo...',
      '..ooPPPPPPoo....',
      '...oBBBBBBoo....',
      '..oBB....BBo....',
      '..ooo....ooo....',
      '................',
      '................',
    ],
  ],
  mage: [
    [
      '.....oooo.......',
      '....oPPPPo......',
      '...oPPPPPPo.....',
      '..oPPPPPPPPo....',
      '.oooooooooooo...',
      '...ohEEhhEEo....',
      '...ohhhhhhho....',
      '..ooCCCCCCoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSSSSPCCo...',
      '..oCCCCCCCCo....',
      '..oCCCCCCCCo....',
      '...oBBBBBBoo....',
      '...ooo..ooo.....',
      '................',
      '................',
    ],
    [
      '................',
      '.....oooo.......',
      '....oPPPPo......',
      '...oPPPPPPo.....',
      '..oPPPPPPPPo....',
      '.oooooooooooo...',
      '...ohEEhhEEo....',
      '...ohhhhhhho....',
      '..ooCCCCCCoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSSSSPCCo...',
      '..oCCCCCCCCo....',
      '..oBB....BBo....',
      '..ooo....ooo....',
      '................',
      '................',
    ],
  ],
  rogue: [
    [
      '....oooooo......',
      '...oCCCCCCo.....',
      '..oCCCCCCCCo....',
      '..oCChEEhCCo....',
      '..oCCSSSSCCo....',
      '...oCCCCCCo.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '..ooPSSSSPoo....',
      '...oBBBBBBoo....',
      '...oBB..BBo.....',
      '..oBB....BBo....',
      '..ooo....ooo....',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '....oooooo......',
      '...oCCCCCCo.....',
      '..oCCCCCCCCo....',
      '..oCChEEhCCo....',
      '..oCCSSSSCCo....',
      '...oCCCCCCo.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '..ooPSSSSPoo....',
      '...oBBBBBBoo....',
      '..oBB....BBo....',
      '...oBB..BBo.....',
      '...ooo..ooo.....',
      '................',
      '................',
    ],
  ],
  default: [
    [
      '....oooooo......',
      '...oPPPPPPo.....',
      '..oPSSSSSSPo....',
      '..oShhEEhhSo....',
      '...ohhhhhho.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSSSSPCCo...',
      '..ooPPPPPPoo....',
      '...oBBBBBBoo....',
      '...oBB..BBo.....',
      '...oBB..BBo.....',
      '...ooo..ooo.....',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '....oooooo......',
      '...oPPPPPPo.....',
      '..oPSSSSSSPo....',
      '..oShhEEhhSo....',
      '...ohhhhhho.....',
      '..ooPPPPPPoo....',
      '.oCCPPPPPPCCo...',
      '.oCCPSSSSPCCo...',
      '..ooPPPPPPoo....',
      '...oBBBBBBoo....',
      '..oBB....BBo....',
      '..ooo....ooo....',
      '................',
      '................',
      '................',
    ],
  ],
};

const MONSTER_MATRICES: Record<string, string[]> = {
  skeleton: [
    '....oooooo......',
    '...oPPPPPPo.....',
    '..oPPEPPEPPo....',
    '..oPPPPPPPPo....',
    '...oP.PP.Po.....',
    '....oooooo......',
    '..ooPPPPPPoo....',
    '.oPPoSSSSoPPo...',
    '.oPo.oPPo.oPo...',
    '.....oPPo.......',
    '....oPo.oPo.....',
    '...oPo...oPo....',
    '...ooo...ooo....',
    '................',
  ],
  slime: [
    '................',
    '.....oooooo.....',
    '...ooPPPPPPoo...',
    '..oPPPPSSPPPPo..',
    '.oPPPEEPPPPEEPo.',
    '.oPPPPPPPPPPPPo.',
    'oPPSSPPPPPPSSPPo',
    'oPPPPPPPPPPPPPPo',
    'oSSSSSSSSSSSSSSo',
    '.oooooooooooooo.',
    '................',
  ],
  bat: [
    '................',
    '.oo..........oo.',
    'oPPo...oo...oPPo',
    'oPPPo.oPPo.oPPPo',
    '.oPPPoPEEPoPPPo.',
    '..oPPPPPPPPPPo..',
    '...ooPPPPPPoo...',
    '....oSS..SSo....',
    '................',
  ],
  goblin: [
    '....oooooo......',
    '.oooPPPPPPooo...',
    'oPPPPPEEPPPPPo..',
    '..ooPPPPPPoo....',
    '...ooSSSSoo.....',
    '..oSSPPPPSSo....',
    '.oPPoSSSSoPPo...',
    '....oSSSSo......',
    '...oPo..oPo.....',
    '...ooo..ooo.....',
  ],
  knight: [
    '....oooooo......',
    '...oSSSSSSo.....',
    '..oSPPPPPPSo....',
    '..oSPEEEEPPo....',
    '..oSSSSSSSSo....',
    '.ooPPPPPPPPoo...',
    'oSSPPPPPPPPSSo..',
    'oSSPPSSSSPPSSo..',
    '.ooPPPPPPPPoo...',
    '...oSS..SSo.....',
    '...oSS..SSo.....',
    '...ooo..ooo.....',
  ],
  wraith: [
    '....oooooo......',
    '...oPPPPPPo.....',
    '..oPPEEEEPPo....',
    '..oPPPPPPPPo....',
    '.ooPPSSSSPPoo...',
    '.oPPPPPPPPPPo...',
    '.oPPSSPPSSPPo...',
    '..oPPPPPPPPo....',
    '..oPo.oo.oPo....',
    '.oPo......oPo...',
  ],
  golem: [
    '...oooooooo.....',
    '..oPPPPPPPPo....',
    '.oPPPEEEEPPPo...',
    '.oPPSSSSSSPPo...',
    'ooPPPPPPPPPPoo..',
    'oSSPPPPPPPPSSo..',
    'oSSPPSSSSPPSSo..',
    'oSSPPPPPPPPSSo..',
    '.ooPPSSSSPPoo...',
    '..oPPo..oPPo....',
    '..oooo..oooo....',
  ],
  assassin: [
    '....oooooo......',
    '...oSSSSSSo.....',
    '..oSSPPPPSSo....',
    '..oSSEEEESS....',
    '...oSSSSSSo.....',
    '..ooPPPPPPoo....',
    '.oSSPPPPPPSSo...',
    '..oPPPPPPPPo....',
    '...oSS..SSo.....',
    '..oSo....oSo....',
  ],
  wolf: [
    '................',
    '..oo......oo....',
    '.oPPo....oPPo...',
    '.oPPPo..oPPPo...',
    '..oPPPPPPPPo....',
    '..oPPEEEEPPo....',
    '.ooPPPPPPPPoo...',
    'oSSPPPPPPPPSSo..',
    '.ooPP....PPoo...',
    '..oPo....oPo....',
  ],
  automaton: [
    '....oooooo......',
    '...oSSSSSSo.....',
    '..oSPPEEPPSo....',
    '..oSSSSSSSSo....',
    '.ooPPPPPPPPoo...',
    'oSSPPPEEPPPSSo..',
    'oSSPPPPPPPPSSo..',
    '.ooPPPPPPPPoo...',
    '...oSS..SSo.....',
    '...ooo..ooo.....',
  ],
  mushroom: [
    '....oooooo......',
    '..ooPPPPPPoo....',
    '.oPPSSPPSSPPo...',
    'oPPPPPPPPPPPPo..',
    'oooooooooooooo..',
    '...oSSSSSSo.....',
    '...oSEEEESo.....',
    '...oSSSSSSo.....',
    '...oooooooo.....',
  ],
  elemental: [
    '......oo........',
    '....ooPPoo......',
    '...oPPPPPPo.....',
    '..oPPEEEEPPo....',
    '..oPPSSSSPPo....',
    '.ooPPPPPPPPoo...',
    '..oSSPPPPSSo....',
    '...ooPPPPoo.....',
    '.....oooo.......',
  ],
  turret: [
    '....oooooo......',
    '...oSSSSSSo.....',
    '..oSSPEEPSSo....',
    '.ooPPPPPPPPoo...',
    'oSSPPPPPPPPSSo..',
    'oSSPPSSSSPPSSo..',
    '.ooPPPPPPPPoo...',
    '...oooooooo.....',
  ],
  eyeball: [
    '....oooooo......',
    '..ooPPPPPPoo....',
    '.oPPPPSSPPPPo...',
    'oPPPPEEEEPPPPo..',
    'oPPPPEWWEEPPPo..',
    'oPPPPEEEEPPPPo..',
    '.oPPPPSSPPPPo...',
    '..ooPPPPPPoo....',
    '....oo..oo......',
  ],
  tentacle: [
    '......oooo......',
    '.....oPPPPo.....',
    '....oPPEEPPo....',
    '....oPPPPPPo....',
    '...oPPSSSSPPo...',
    '..oPPPPPPPPPPo..',
    '.oPPo.oPPo.oPPo.',
    '.ooo..oooo..ooo.',
  ],
};

export class PixelRenderer {
  public drawRoom(
    ctx: CanvasRenderingContext2D,
    room: DungeonRoom,
    biome: BiomeDef,
    time: number
  ): void {
    const tile = 48;
    const cols = Math.ceil(room.width / tile);
    const rows = Math.ceil(room.height / tile);

    // Outer void
    ctx.fillStyle = '#05070c';
    ctx.fillRect(-120, -120, room.width + 240, room.height + 240);

    // Floor checkerboard + pixel cracks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tile;
        const y = r * tile;
        const isAlt = (r + c) % 2 === 0;
        ctx.fillStyle = isAlt ? biome.floorColorA : biome.floorColorB;
        ctx.fillRect(x, y, tile, tile);

        // Subtle pixel stone edge highlights
        if ((r * 7 + c * 13) % 5 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x + 6, y + 8, 10, 2);
          ctx.fillRect(x + 24, y + 32, 14, 2);
        }
        if ((r * 11 + c * 5) % 7 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x + 12, y + 18, 6, 6);
        }
      }
    }

    // Hazards (poison, lava, ice, curse, etc.)
    for (const h of room.hazards) {
      const pulse = 0.78 + Math.sin(time * 3 + h.x) * 0.14;
      ctx.save();
      ctx.globalAlpha = 0.65 * pulse;
      if (h.kind === 'lava') {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 0.68, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'poison') {
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'ice') {
        ctx.fillStyle = '#0369a1';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#4c1d95';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Perimeter walls (32px thick)
    const wt = 32;
    ctx.fillStyle = biome.wallColor;
    ctx.fillRect(0, 0, room.width, wt);
    ctx.fillRect(0, room.height - wt, room.width, wt);
    ctx.fillRect(0, 0, wt, room.height);
    ctx.fillRect(room.width - wt, 0, wt, room.height);

    // Wall bevel top
    ctx.fillStyle = biome.wallTopColor;
    ctx.fillRect(0, 0, room.width, 10);
    ctx.fillRect(0, room.height - wt, room.width, 8);
    ctx.fillRect(0, 0, 10, room.height);
    ctx.fillRect(room.width - wt, 0, 10, room.height);

    // Doors
    this.drawDoors(ctx, room, biome, time);

    // Obstacles
    for (const obs of room.obstacles) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(obs.x + 4, obs.y + 8, obs.w, obs.h);

      ctx.fillStyle = biome.wallColor;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = biome.wallTopColor;
      ctx.fillRect(obs.x, obs.y, obs.w, 10);

      if (obs.kind === 'crystal') {
        ctx.fillStyle = biome.accentColor;
        ctx.fillRect(obs.x + obs.w * 0.3, obs.y + 6, obs.w * 0.4, obs.h * 0.55);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(obs.x + 4, obs.y + 12, obs.w - 8, 4);
      }
    }

    // Props
    for (const prop of room.props) {
      this.drawProp(ctx, prop, biome, time);
    }
  }

  private drawDoors(
    ctx: CanvasRenderingContext2D,
    room: DungeonRoom,
    biome: BiomeDef,
    time: number
  ): void {
    const doorLen = 96;
    const wt = 32;
    const isOpen = room.cleared;
    const glow = 0.55 + Math.sin(time * 4) * 0.25;

    const drawGate = (x: number, y: number, w: number, h: number) => {
      if (isOpen) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = biome.accentColor;
        ctx.globalAlpha = 0.35 * glow;
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + w / 2 - 4, y + h / 2 - 4, 8, 8);
      }
    };

    if (room.doors.up) drawGate(room.width / 2 - doorLen / 2, 0, doorLen, wt);
    if (room.doors.down) drawGate(room.width / 2 - doorLen / 2, room.height - wt, doorLen, wt);
    if (room.doors.left) drawGate(0, room.height / 2 - doorLen / 2, wt, doorLen);
    if (room.doors.right) drawGate(room.width - wt, room.height / 2 - doorLen / 2, wt, doorLen);
  }

  private drawProp(
    ctx: CanvasRenderingContext2D,
    prop: RoomProp,
    biome: BiomeDef,
    time: number
  ): void {
    const { x, y, kind, used } = prop;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (kind === 'chest' || kind === 'secret_chest') {
      const col = kind === 'secret_chest' ? '#e879f9' : '#f59e0b';
      ctx.fillStyle = used ? '#334155' : '#78350f';
      ctx.fillRect(-16, -12, 32, 22);
      ctx.fillStyle = used ? '#475569' : col;
      ctx.fillRect(-16, -12, 32, 6);
      ctx.fillRect(-4, -6, 8, 8);
      if (!used) {
        ctx.globalAlpha = 0.25 + Math.sin(time * 4) * 0.15;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, -2, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'portal') {
      const pulse = 1 + Math.sin(time * 4) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = biome.accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -4, 22, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -4, 8, 12, time * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'shrine') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(-14, -18, 28, 30);
      ctx.fillStyle = used ? '#64748b' : '#34d399';
      ctx.fillRect(-6, -24, 12, 12);
    } else if (kind === 'shopkeeper') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-16, -10, 32, 20);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-8, -22, 16, 14);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -17, 3, 3);
      ctx.fillRect(2, -17, 3, 3);
    } else if (kind === 'anvil') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(-14, -4, 28, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-18, -12, 36, 9);
    } else if (kind === 'event_altar') {
      ctx.fillStyle = '#312e81';
      ctx.fillRect(-15, -16, 30, 26);
      ctx.fillStyle = used ? '#475569' : '#c084fc';
      ctx.beginPath();
      ctx.arc(0, -18, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public drawDrop(ctx: CanvasRenderingContext2D, drop: GroundDrop, time: number): void {
    const bob = Math.sin(time * 5 + drop.x) * 3;
    const col = RARITY_COLORS[drop.rarity] || '#fbbf24';
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);

    // Glow beam for rare+ items
    if (drop.kind === 'item' || drop.kind === 'relic' || drop.kind === 'crystal' || drop.kind === 'shard') {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = col;
      ctx.fillRect(-6, -34, 12, 36);
      ctx.globalAlpha = 1;
    }

    if (drop.kind === 'gold') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-3, -3, 4, 4);
    } else if (drop.kind === 'potion') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6, -4, 12, 11);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-3, -9, 6, 5);
    } else if (drop.kind === 'crystal') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    } else if (drop.kind === 'shard') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    } else if (drop.kind === 'skill_stone') {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#f0abfc';
      ctx.fillRect(-3, -3, 6, 6);
    } else if (drop.kind === 'relic') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -2, 4, 4);
    } else {
      // Equipment chest/orb
      ctx.fillStyle = col;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -8, 16, 16);
    }

    ctx.restore();
  }

  public drawPlayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facingAngle: number,
    classDef: ClassDef,
    weaponKind: WeaponKind,
    animState: AnimState,
    animTimer: number,
    attackProgress: number,
    isInvuln: boolean,
    hitFlash: number
  ): void {
    const styleKey =
      classDef.spriteStyle === 'knight' || classDef.spriteStyle === 'paladin'
        ? 'knight'
        : classDef.spriteStyle === 'mage' || classDef.spriteStyle === 'abyssal'
        ? 'mage'
        : classDef.spriteStyle === 'rogue' || classDef.spriteStyle === 'ranger'
        ? 'rogue'
        : 'default';

    const frames = PLAYER_FRAMES[styleKey];
    const frameIdx = animState === 'walk' || animState === 'run' ? Math.floor(animTimer * 10) % 2 : 0;
    const palette: PaletteMap = {
      o: '#090d16',
      P: hitFlash > 0 ? '#ffffff' : classDef.primaryColor,
      S: hitFlash > 0 ? '#ffffff' : classDef.secondaryColor,
      C: hitFlash > 0 ? '#ffffff' : classDef.capeColor,
      B: '#1e293b',
      h: '#fde68a',
      E: '#0f172a',
    };
    const sprite = bakePixelMatrix(
      `player_${classDef.id}_${frameIdx}_${hitFlash > 0 ? 'hit' : 'n'}`,
      frames[frameIdx],
      palette,
      3
    );

    ctx.save();
    ctx.translate(x, y);

    if (isInvuln) {
      ctx.globalAlpha = 0.55;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Squash & stretch
    let scaleX = Math.cos(facingAngle) < 0 ? -1 : 1;
    let scaleY = 1;
    if (animState === 'dodge') {
      scaleX *= 1.18;
      scaleY = 0.85;
    } else if (animState === 'attack') {
      scaleX *= 1.08;
      scaleY = 0.94;
    } else if (animState === 'victory') {
      ctx.translate(0, -Math.abs(Math.sin(animTimer * 8)) * 8);
    } else if (animState === 'death') {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.6;
    }

    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2 - 4);
    ctx.restore();

    // Draw held / swinging weapon in facing direction
    if (animState !== 'death') {
      this.drawWeapon(ctx, weaponKind, facingAngle, attackProgress, classDef.primaryColor);
    }

    ctx.restore();
  }

  private drawWeapon(
    ctx: CanvasRenderingContext2D,
    kind: WeaponKind,
    facingAngle: number,
    attackProgress: number,
    accent: string
  ): void {
    ctx.save();
    let angle = facingAngle;
    let reach = 14;

    if (attackProgress > 0) {
      if (kind === 'spear' || kind === 'gauntlet') {
        reach += Math.sin(attackProgress * Math.PI) * 20;
      } else if (kind === 'sword' || kind === 'greatsword' || kind === 'axe' || kind === 'spellblade') {
        const swing = (attackProgress - 0.5) * 2.3;
        angle += swing;
      } else if (kind === 'dagger') {
        reach += Math.sin(attackProgress * Math.PI) * 12;
        angle += (attackProgress - 0.5) * 1.1;
      }
    }

    ctx.rotate(angle);
    ctx.translate(reach, 0);

    if (kind === 'greatsword') {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, -4, 34, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(4, -2, 28, 3);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3, -8, 6, 16);
    } else if (kind === 'spear') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-8, -2, 34, 4);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(24, -4, 12, 8);
    } else if (kind === 'axe') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, -2, 22, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(14, -10, 10, 14);
    } else if (kind === 'staff') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, -2, 24, 4);
      ctx.fillStyle = accent;
      ctx.fillRect(22, -5, 8, 10);
    } else if (kind === 'bow' || kind === 'crossbow') {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(4, 0, 13, -1.1, 1.1);
      ctx.stroke();
    } else if (kind === 'dagger') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, -2, 16, 4);
    } else if (kind === 'gauntlet') {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, -6, 14, 12);
    } else {
      // Sword & Spellblade
      ctx.fillStyle = kind === 'spellblade' ? '#e879f9' : '#e2e8f0';
      ctx.fillRect(0, -3, 24, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-2, -6, 4, 12);
    }

    ctx.restore();
  }

  public drawEnemySprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    shape: string,
    x: number,
    y: number,
    radius: number,
    primaryColor: string,
    secondaryColor: string,
    eyeColor: string,
    flipX: boolean,
    hitFlash: number,
    isBoss: boolean,
    time: number
  ): void {
    const matrix = MONSTER_MATRICES[shape] || MONSTER_MATRICES.skeleton;
    const scale = isBoss ? Math.max(3, Math.round(radius / 7)) : Math.max(2, Math.round(radius / 6));
    const palette: PaletteMap = {
      o: '#090d16',
      P: hitFlash > 0 ? '#ffffff' : primaryColor,
      S: hitFlash > 0 ? '#ffffff' : secondaryColor,
      E: hitFlash > 0 ? '#ffffff' : eyeColor,
      W: '#ffffff',
    };
    const sprite = bakePixelMatrix(
      `mob_${id}_${scale}_${hitFlash > 0 ? 'hit' : 'n'}`,
      matrix,
      palette,
      scale
    );

    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.85, radius * 0.85, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(time * 6 + x * 0.05) * 2;
    ctx.translate(0, bob);
    if (flipX) ctx.scale(-1, 1);

    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  }
}
