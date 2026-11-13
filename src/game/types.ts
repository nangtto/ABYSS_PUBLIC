export type GameState =
  | 'TITLE'
  | 'SANCTUARY'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_UP'
  | 'INVENTORY'
  | 'SHOP'
  | 'BLACKSMITH'
  | 'EVENT'
  | 'REST'
  | 'CODEX'
  | 'GAME_OVER'
  | 'VICTORY';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type WeaponKind =
  | 'sword'
  | 'greatsword'
  | 'dagger'
  | 'spear'
  | 'axe'
  | 'staff'
  | 'bow'
  | 'crossbow'
  | 'gauntlet'
  | 'spellblade';

export type EquipSlot = 'weapon' | 'armor' | 'ring' | 'necklace';

export type SkillElement = 'fire' | 'ice' | 'lightning' | 'dark' | 'physical';

export type RoomType =
  | 'start'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'shop'
  | 'rest'
  | 'event'
  | 'secret'
  | 'boss';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'hit'
  | 'dodge'
  | 'skill'
  | 'death'
  | 'victory';

export interface StatBonus {
  attack?: number;
  attackPct?: number;
  maxHp?: number;
  maxHpPct?: number;
  defense?: number;
  speedPct?: number;
  attackSpeedPct?: number;
  critChance?: number;
  critDamage?: number;
  cooldownReduction?: number;
  dodgeCooldownPct?: number;
  skillDamagePct?: number;
  expGainPct?: number;
  goldGainPct?: number;
  lifesteal?: number;
  thorns?: number;
}

export interface EquipmentItem {
  uid: string;
  templateId: string;
  name: string;
  slot: EquipSlot;
  weaponKind?: WeaponKind;
  rarity: Rarity;
  level: number;
  upgradeLevel: number;
  setId?: string;
  baseStats: StatBonus;
  affixes: { label: string; stats: StatBonus }[];
  specialEffectId?: string;
  specialEffectDesc?: string;
  price: number;
}

export interface SkillDef {
  id: string;
  name: string;
  element: SkillElement;
  slotPreference: 'active' | 'ultimate';
  cooldown: number;
  baseDamage: number;
  radius: number;
  range: number;
  description: string;
  levelDescriptions: string[];
  color: string;
  accentColor: string;
}

export interface OwnedSkill {
  id: string;
  level: number;
}

export interface SkillSynergyDef {
  id: string;
  name: string;
  reqSkills: string[];
  minLevel?: number;
  description: string;
  color: string;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  stats: StatBonus;
  specialTag?: string;
  color: string;
}

export interface ClassDef {
  id: string;
  name: string;
  title: string;
  description: string;
  unlockCondition: string;
  unlockCost?: number;
  starterWeaponTemplate: string;
  starterSkillId: string;
  ultimateSkillId: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseCrit: number;
  primaryColor: string;
  secondaryColor: string;
  capeColor: string;
  spriteStyle: 'knight' | 'mage' | 'rogue' | 'berserker' | 'paladin' | 'ranger' | 'summoner' | 'abyssal';
}

export interface BiomeDef {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  floorStart: number;
  floorEnd: number;
  floorColorA: string;
  floorColorB: string;
  wallColor: string;
  wallTopColor: string;
  accentColor: string;
  ambientMistColor: string;
  hazardType: 'none' | 'poison' | 'lava' | 'ice' | 'curse' | 'lightning' | 'abyss';
  monsterPool: string[];
  bossId: string;
  droneFreq: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  archetype: 'melee' | 'charger' | 'ranged' | 'caster' | 'swarm' | 'tank' | 'assassin';
  hp: number;
  attack: number;
  speed: number;
  radius: number;
  attackRange: number;
  attackCooldown: number;
  windupTime: number;
  expValue: number;
  goldValue: number;
  primaryColor: string;
  secondaryColor: string;
  eyeColor: string;
  spriteShape:
    | 'skeleton'
    | 'slime'
    | 'bat'
    | 'goblin'
    | 'knight'
    | 'wraith'
    | 'golem'
    | 'assassin'
    | 'wolf'
    | 'automaton'
    | 'mushroom'
    | 'elemental'
    | 'turret'
    | 'eyeball'
    | 'tentacle';
  description: string;
}

export type EliteAffix = 'regen' | 'teleport' | 'nova' | 'summon' | 'shield' | 'frenzy';

export interface BossDef {
  id: string;
  name: string;
  title: string;
  biomeIndex: number;
  hp: number;
  attack: number;
  speed: number;
  radius: number;
  expValue: number;
  goldValue: number;
  primaryColor: string;
  secondaryColor: string;
  eyeColor: string;
  patterns: ('slam' | 'barrage' | 'dash' | 'summon' | 'laser_ring' | 'meteor')[];
  description: string;
}

export interface RoomObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pillar' | 'crate' | 'statue' | 'crystal';
}

export interface RoomHazard {
  x: number;
  y: number;
  radius: number;
  kind: 'poison' | 'lava' | 'ice' | 'curse' | 'lightning' | 'abyss';
}

export interface RoomProp {
  id: string;
  kind: 'chest' | 'shrine' | 'shopkeeper' | 'anvil' | 'event_altar' | 'portal' | 'secret_chest';
  x: number;
  y: number;
  used: boolean;
  label: string;
}

export interface DungeonRoom {
  id: string;
  gx: number;
  gy: number;
  type: RoomType;
  width: number;
  height: number;
  cleared: boolean;
  visited: boolean;
  doors: Record<Direction, string | null>;
  obstacles: RoomObstacle[];
  hazards: RoomHazard[];
  props: RoomProp[];
  shopInventory?: ShopEntry[];
  eventResolved?: boolean;
}

export interface ShopEntry {
  id: string;
  kind: 'potion' | 'item' | 'relic' | 'crystal' | 'skill_stone';
  name: string;
  desc: string;
  price: number;
  sold: boolean;
  item?: EquipmentItem;
  relicId?: string;
}

export interface GroundDrop {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'gold' | 'potion' | 'crystal' | 'shard' | 'skill_stone' | 'item' | 'relic';
  amount?: number;
  item?: EquipmentItem;
  relicId?: string;
  rarity: Rarity;
  age: number;
}

export interface LevelUpChoice {
  id: string;
  kind: 'new_skill' | 'upgrade_skill' | 'stat_boost' | 'relic';
  title: string;
  subtitle: string;
  description: string;
  color: string;
  skillId?: string;
  relicId?: string;
  statKey?: keyof StatBonus;
  statValue?: number;
}

export interface MetaUpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  perLevelValue: number;
  unit: string;
}

export interface RunRecord {
  date: string;
  classId: string;
  className: string;
  floor: number;
  biomeName: string;
  kills: number;
  bossesKilled: number;
  level: number;
  victory: boolean;
  durationSec: number;
}

export interface CodexData {
  monstersSeen: string[];
  bossesDefeated: string[];
  weaponsFound: string[];
  relicsFound: string[];
  skillsUsed: string[];
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  mobileControlsMode: 'auto' | 'on' | 'off';
}

export interface SaveData {
  version: number;
  abyssCrystals: number;
  ancientShards: number;
  unlockedClasses: string[];
  unlockedWeapons: string[];
  metaUpgrades: Record<string, number>;
  codex: CodexData;
  records: RunRecord[];
  settings: GameSettings;
  activeRun: SerializedRun | null;
}

export interface SerializedRun {
  classId: string;
  floor: number;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  gold: number;
  potions: number;
  skillStones: number;
  kills: number;
  bossesKilled: number;
  elapsedSec: number;
  revivesLeft: number;
  equipped: Record<EquipSlot, EquipmentItem | null>;
  inventory: EquipmentItem[];
  skills: OwnedSkill[];
  activeSkillSlots: [string | null, string | null, string | null];
  relics: string[];
  bonusStats: StatBonus;
}

export const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '일반',
  uncommon: '고급',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
  mythic: '신화',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythic: '#fb7185',
};

export const ELEMENT_LABELS: Record<SkillElement, string> = {
  fire: '화염',
  ice: '얼음',
  lightning: '번개',
  dark: '암흑',
  physical: '물리',
};

export const ELEMENT_COLORS: Record<SkillElement, string> = {
  fire: '#f97316',
  ice: '#38bdf8',
  lightning: '#facc15',
  dark: '#c084fc',
  physical: '#e2e8f0',
};
