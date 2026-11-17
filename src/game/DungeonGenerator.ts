import { getBiomeForFloor, isBossFloor } from './data/biomes';
import { RELICS } from './data/relics';
import { generateRandomEquipment } from './data/weapons';
import {
  Direction,
  DungeonRoom,
  RoomHazard,
  RoomObstacle,
  RoomProp,
  RoomType,
  ShopEntry,
} from './types';

export interface FloorMap {
  floor: number;
  rooms: Map<string, DungeonRoom>;
  startRoomId: string;
  bossRoomId: string | null;
}

const DIRS: { dir: Direction; dx: number; dy: number; opp: Direction }[] = [
  { dir: 'up', dx: 0, dy: -1, opp: 'down' },
  { dir: 'down', dx: 0, dy: 1, opp: 'up' },
  { dir: 'left', dx: -1, dy: 0, opp: 'right' },
  { dir: 'right', dx: 1, dy: 0, opp: 'left' },
];

export class DungeonGenerator {
  public generateFloor(floor: number, luckBonusPct = 0): FloorMap {
    const biome = getBiomeForFloor(floor);
    const hasBoss = isBossFloor(floor);
    const floorVariance = Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 2);
    const targetRoomCount = hasBoss
      ? Math.min(12, 6 + Math.floor(floor / 4) + floorVariance)
      : Math.min(11, 5 + Math.floor(floor / 3) + floorVariance);

    const coords = new Map<string, { gx: number; gy: number; type: RoomType }>();
    const key = (gx: number, gy: number) => `${gx},${gy}`;

    coords.set(key(0, 0), { gx: 0, gy: 0, type: 'start' });
    const frontier: { gx: number; gy: number }[] = [{ gx: 0, gy: 0 }];

    while (coords.size < targetRoomCount && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length);
      const base = frontier[idx];
      const shuffledDirs = [...DIRS].sort(() => Math.random() - 0.5);
      let added = false;

      for (const d of shuffledDirs) {
        const nx = base.gx + d.dx;
        const ny = base.gy + d.dy;
        const k = key(nx, ny);
        if (!coords.has(k)) {
          const neighborCount = DIRS.filter((check) => coords.has(key(nx + check.dx, ny + check.dy))).length;
          const shouldOpen = neighborCount <= 1 || Math.random() < 0.35;
          if (shouldOpen) {
            coords.set(k, { gx: nx, gy: ny, type: 'combat' });
            frontier.push({ gx: nx, gy: ny });
            added = true;
            break;
          }
        }
      }

      if (!added) {
        frontier.splice(idx, 1);
      }
    }

    if (coords.size < 5) {
      const extraOffsets = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
      ];
      for (const [dx, dy] of extraOffsets) {
        const k = key(dx, dy);
        if (!coords.has(k) && coords.size < targetRoomCount) {
          coords.set(k, { gx: dx, gy: dy, type: 'combat' });
        }
      }
    }

    const entries = Array.from(coords.values()).filter((c) => !(c.gx === 0 && c.gy === 0));
    entries.sort((a, b) => Math.abs(b.gx) + Math.abs(b.gy) - (Math.abs(a.gx) + Math.abs(a.gy)));

    let bossRoomId: string | null = null;
    if (entries.length > 0) {
      const farthest = entries[0];
      if (hasBoss) {
        farthest.type = 'boss';
        bossRoomId = key(farthest.gx, farthest.gy);
      } else {
        farthest.type = 'elite';
      }
    }

    const specials: RoomType[] = ['treasure', 'shop'];
    if (floor >= 2) specials.push('event');
    if (floor % 2 === 0 || hasBoss) specials.push('rest');
    if (floor >= 3 && Math.random() < 0.7) specials.push('secret');
    if (floor >= 4 && Math.random() < 0.5) specials.push('rest');

    let sIdx = 0;
    for (let i = 1; i < entries.length && sIdx < specials.length; i++) {
      const target = entries[i];
      if (target.type !== 'boss' && target.type !== 'elite') {
        const shouldConvert = i % 2 === 1 || entries.length - i > specials.length - sIdx + 1;
        if (shouldConvert) {
          target.type = specials[sIdx];
          sIdx++;
        }
      }
    }

    for (let i = 1; i < entries.length; i++) {
      if (entries[i].type === 'combat' && floor >= 3 && Math.random() < Math.min(0.38, 0.1 + floor * 0.016)) {
        entries[i].type = 'elite';
        break;
      }
    }

    const rooms = new Map<string, DungeonRoom>();
    for (const c of coords.values()) {
      const id = key(c.gx, c.gy);
      const isLarge = c.type === 'boss' || c.type === 'elite';
      const width = isLarge ? 1056 : c.type === 'combat' ? 864 : 720;
      const height = isLarge ? 720 : c.type === 'combat' ? 624 : 528;

      const doors: Record<Direction, string | null> = {
        up: null,
        down: null,
        left: null,
        right: null,
      };
      for (const d of DIRS) {
        const nk = key(c.gx + d.dx, c.gy + d.dy);
        if (coords.has(nk)) {
          doors[d.dir] = nk;
        }
      }

      const { obstacles, hazards, props, shopInventory } = this.populateRoom(
        c.type,
        width,
        height,
        floor,
        biome.hazardType,
        hasBoss,
        luckBonusPct
      );

      const autoCleared =
        c.type === 'start' ||
        c.type === 'treasure' ||
        c.type === 'shop' ||
        c.type === 'rest' ||
        c.type === 'event' ||
        c.type === 'secret';

      rooms.set(id, {
        id,
        gx: c.gx,
        gy: c.gy,
        type: c.type,
        width,
        height,
        cleared: autoCleared,
        visited: c.type === 'start',
        doors,
        obstacles,
        hazards,
        props,
        shopInventory,
      });
    }

    return {
      floor,
      rooms,
      startRoomId: key(0, 0),
      bossRoomId,
    };
  }

  private populateRoom(
    type: RoomType,
    width: number,
    height: number,
    floor: number,
    hazardType: DungeonRoom['hazards'][number]['kind'] | 'none',
    _hasBoss: boolean,
    luckBonusPct: number
  ): {
    obstacles: RoomObstacle[];
    hazards: RoomHazard[];
    props: RoomProp[];
    shopInventory?: ShopEntry[];
  } {
    const obstacles: RoomObstacle[] = [];
    const hazards: RoomHazard[] = [];
    const props: RoomProp[] = [];
    let shopInventory: ShopEntry[] | undefined;

    const cx = width / 2;
    const cy = height / 2;

    if (type === 'combat' || type === 'elite') {
      const pattern = Math.floor(Math.random() * 5);
      if (pattern === 0) {
        const dx = width * 0.25;
        const dy = height * 0.25;
        obstacles.push(
          { x: cx - dx - 22, y: cy - dy - 22, w: 44, h: 44, kind: 'pillar' },
          { x: cx + dx - 22, y: cy - dy - 22, w: 44, h: 44, kind: 'pillar' },
          { x: cx - dx - 22, y: cy + dy - 22, w: 44, h: 44, kind: 'pillar' },
          { x: cx + dx - 22, y: cy + dy - 22, w: 44, h: 44, kind: 'pillar' }
        );
      } else if (pattern === 1) {
        obstacles.push(
          { x: cx - 170, y: cy - 28, w: 48, h: 56, kind: 'crystal' },
          { x: cx + 122, y: cy - 28, w: 48, h: 56, kind: 'crystal' }
        );
      } else if (pattern === 2) {
        obstacles.push(
          { x: cx - 140, y: cy - 110, w: 56, h: 40, kind: 'crate' },
          { x: cx + 84, y: cy + 70, w: 56, h: 40, kind: 'crate' }
        );
      } else if (pattern === 3) {
        obstacles.push(
          { x: cx - 180, y: cy - 60, w: 36, h: 120, kind: 'pillar' },
          { x: cx + 144, y: cy - 60, w: 36, h: 120, kind: 'pillar' }
        );
      } else {
        obstacles.push(
          { x: cx - 96, y: cy - 70, w: 48, h: 48, kind: 'crystal' },
          { x: cx + 48, y: cy + 25, w: 48, h: 48, kind: 'crystal' }
        );
      }

      if (hazardType !== 'none' && Math.random() < 0.7) {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          hazards.push({
            x: cx + (Math.random() - 0.5) * (width * 0.45),
            y: cy + (Math.random() - 0.5) * (height * 0.45),
            radius: 36 + Math.random() * 22,
            kind: hazardType,
          });
        }
      }
    } else if (type === 'boss') {
      obstacles.push(
        { x: 180, y: 150, w: 48, h: 48, kind: 'pillar' },
        { x: width - 228, y: 150, w: 48, h: 48, kind: 'pillar' },
        { x: 180, y: height - 198, w: 48, h: 48, kind: 'pillar' },
        { x: width - 228, y: height - 198, w: 48, h: 48, kind: 'pillar' },
        { x: cx - 70, y: cy - 110, w: 44, h: 44, kind: 'statue' },
        { x: cx + 26, y: cy + 70, w: 44, h: 44, kind: 'statue' }
      );
    } else if (type === 'treasure') {
      props.push({
        id: 'prop_chest',
        kind: 'chest',
        x: cx,
        y: cy,
        used: false,
        label: '보물 상자 열기 [F]',
      });
    } else if (type === 'secret') {
      props.push({
        id: 'prop_secret',
        kind: 'secret_chest',
        x: cx,
        y: cy,
        used: false,
        label: '비밀 금고 열기 [F]',
      });
    } else if (type === 'rest') {
      props.push({
        id: 'prop_shrine',
        kind: 'shrine',
        x: cx - 60,
        y: cy,
        used: false,
        label: '회복의 성소 사용 [F]',
      });
      props.push({
        id: 'prop_anvil',
        kind: 'anvil',
        x: cx + 60,
        y: cy,
        used: false,
        label: '대장간 강화 [F]',
      });
    } else if (type === 'event') {
      props.push({
        id: 'prop_event',
        kind: 'event_altar',
        x: cx,
        y: cy,
        used: false,
        label: '고대의 제단 조사 [F]',
      });
    } else if (type === 'shop') {
      props.push({
        id: 'prop_shop',
        kind: 'shopkeeper',
        x: cx - 40,
        y: cy - 10,
        used: false,
        label: '심연 상점 이용 [F]',
      });
      props.push({
        id: 'prop_anvil_shop',
        kind: 'anvil',
        x: cx + 70,
        y: cy - 10,
        used: false,
        label: '대장간 강화 [F]',
      });
      shopInventory = this.generateShopInventory(floor, luckBonusPct);
    }

    return { obstacles, hazards, props, shopInventory };
  }

  private generateShopInventory(floor: number, luckBonusPct: number): ShopEntry[] {
    const itemA = generateRandomEquipment(floor, 'weapon', luckBonusPct);
    const itemB = generateRandomEquipment(floor, undefined, luckBonusPct);
    const relic = RELICS[Math.floor(Math.random() * RELICS.length)];

    return [
      {
        id: 'shop_potion',
        kind: 'potion',
        name: '생명력 회복 물약',
        desc: '사용 시 최대 체력의 40%를 즉시 회복하는 휴대용 물약을 1개 구매합니다.',
        price: 35 + floor * 5,
        sold: false,
      },
      {
        id: 'shop_stone',
        kind: 'skill_stone',
        name: '스킬 강화석',
        desc: '보유 스킬을 즉시 강화하거나 새 스킬을 깨우치는 마력석.',
        price: 55 + floor * 8,
        sold: false,
      },
      {
        id: 'shop_item_a',
        kind: 'item',
        name: itemA.name,
        desc: `Lv.${itemA.level} 무기 · 상점에서 판매하는 검증된 장비`,
        price: itemA.price,
        sold: false,
        item: itemA,
      },
      {
        id: 'shop_item_b',
        kind: 'item',
        name: itemB.name,
        desc: `Lv.${itemB.level} 장비 · 무작위 옵션 부여`,
        price: itemB.price,
        sold: false,
        item: itemB,
      },
      {
        id: 'shop_relic',
        kind: 'relic',
        name: `유물: ${relic.name}`,
        desc: relic.description,
        price: 95 + floor * 15,
        sold: false,
        relicId: relic.id,
      },
    ];
  }
}
