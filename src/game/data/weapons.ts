import { EquipmentItem, EquipSlot, Rarity, RARITY_ORDER, StatBonus, WeaponKind } from '../types';

export interface WeaponProfile {
  kind: WeaponKind;
  label: string;
  cooldown: number;
  range: number;
  arcDeg: number;
  damageMult: number;
  projectileSpeed?: number;
  knockback: number;
  comboHits?: number;
  color: string;
  description: string;
}

export const WEAPON_PROFILES: Record<WeaponKind, WeaponProfile> = {
  sword: { kind: 'sword', label: '한손검', cooldown: 0.32, range: 74, arcDeg: 115, damageMult: 1, knockback: 160, color: '#93c5fd', description: '빠르고 안정적인 부채꼴 근접 베기.' },
  greatsword: { kind: 'greatsword', label: '대검', cooldown: 0.62, range: 105, arcDeg: 155, damageMult: 1.85, knockback: 300, color: '#fca5a5', description: '느리지만 넓은 범위와 강력한 충격파를 가하는 내려치기.' },
  dagger: { kind: 'dagger', label: '단검', cooldown: 0.19, range: 56, arcDeg: 85, damageMult: 0.68, knockback: 90, color: '#6ee7b7', description: '초고속 연속 공격과 높은 치명타 잠재력.' },
  spear: { kind: 'spear', label: '창', cooldown: 0.38, range: 120, arcDeg: 45, damageMult: 1.2, knockback: 210, color: '#fde047', description: '긴 사거리의 직선 찌르기로 적을 밀쳐냅니다.' },
  axe: { kind: 'axe', label: '도끼', cooldown: 0.48, range: 86, arcDeg: 140, damageMult: 1.5, knockback: 260, color: '#fb923c', description: '강력한 회전 베기로 주변 적을 분쇄합니다.' },
  staff: { kind: 'staff', label: '지팡이', cooldown: 0.42, range: 420, arcDeg: 30, damageMult: 1.05, projectileSpeed: 470, knockback: 100, color: '#c084fc', description: '관통 마력이 담긴 원거리 마법탄을 발사합니다.' },
  bow: { kind: 'bow', label: '활', cooldown: 0.34, range: 490, arcDeg: 20, damageMult: 0.95, projectileSpeed: 640, knockback: 110, color: '#34d399', description: '빠르고 정확한 화살을 연사합니다.' },
  crossbow: { kind: 'crossbow', label: '석궁', cooldown: 0.5, range: 460, arcDeg: 28, damageMult: 1.38, projectileSpeed: 720, knockback: 185, color: '#f59e0b', description: '묵직한 관통 볼트를 발사합니다.' },
  gauntlet: { kind: 'gauntlet', label: '건틀릿', cooldown: 0.22, range: 58, arcDeg: 95, damageMult: 0.82, knockback: 180, color: '#fb7185', description: '짧은 사거리지만 폭발적인 연타를 가합니다.' },
  spellblade: { kind: 'spellblade', label: '마법검', cooldown: 0.35, range: 82, arcDeg: 120, damageMult: 1.08, projectileSpeed: 420, knockback: 140, color: '#e879f9', description: '근접 베기와 함께 전방으로 검기 투사체를 방출합니다.' },
};

export interface EquipmentTemplate {
  id: string;
  name: string;
  slot: EquipSlot;
  weaponKind?: WeaponKind;
  minRarity: Rarity;
  setId?: string;
  baseAttack?: number;
  baseHp?: number;
  baseDef?: number;
  specialEffectId?: string;
  specialEffectDesc?: string;
}

export const EQUIPMENT_SET_DEFS: Record<string, { name: string; bonus2: string; bonus4: string; stats2: StatBonus; stats4: StatBonus }> = {
  abyss_knight: { name: '심연의 기사 세트', bonus2: '2세트: 공격력 +15%, 최대 체력 +25', bonus4: '4세트: 회피 쿨타임 -20%, 치명타 확률 +12%, 스킬 피해 +25%', stats2: { attackPct: 15, maxHp: 25 }, stats4: { dodgeCooldownPct: 20, critChance: 12, skillDamagePct: 25 } },
  arcane_scholar: { name: '고대 현자 세트', bonus2: '2세트: 스킬 피해 +22%, 쿨타임 감소 +10%', bonus4: '4세트: 스킬 피해 +40%, 치명타 피해 +35%', stats2: { skillDamagePct: 22, cooldownReduction: 10 }, stats4: { skillDamagePct: 40, critDamage: 35 } },
  phantom_stalker: { name: '그림자 추적자 세트', bonus2: '2세트: 이동 속도 +12%, 치명타 확률 +8%', bonus4: '4세트: 공격 속도 +22%, 흡혈 +4%', stats2: { speedPct: 12, critChance: 8 }, stats4: { attackSpeedPct: 22, lifesteal: 4 } },
  abyss_witch: { name: '심연 마녀 세트', bonus2: '2세트: 스킬 피해 +18%, 최대 체력 +12', bonus4: '4세트: 쿨타임 감소 +15%, 치명타 피해 +28%', stats2: { skillDamagePct: 18, maxHp: 12 }, stats4: { cooldownReduction: 15, critDamage: 28 } },
  sunforge: { name: '태양강철 세트', bonus2: '2세트: 공격력 +12%, 방어력 +8', bonus4: '4세트: 스킬 피해 +20%, 생명력 흡수 +5%', stats2: { attackPct: 12, defense: 8 }, stats4: { skillDamagePct: 20, lifesteal: 5 } },
};

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
  { id: 'wpn_iron_sword', name: '수호자의 장검', slot: 'weapon', weaponKind: 'sword', minRarity: 'common', baseAttack: 8 },
  { id: 'wpn_abyss_sword', name: '심연의 기사검', slot: 'weapon', weaponKind: 'sword', minRarity: 'rare', setId: 'abyss_knight', baseAttack: 16, specialEffectId: 'kill_explosion', specialEffectDesc: '처치 시 폭발이 일어난다.' },
  { id: 'wpn_titan_greatsword', name: '거인의 대검', slot: 'weapon', weaponKind: 'greatsword', minRarity: 'uncommon', baseAttack: 14, specialEffectId: 'heavy_cleave', specialEffectDesc: '강한 내리치기로 적을 분쇄한다.' },
  { id: 'wpn_shadow_dagger', name: '그림자 쌍단검', slot: 'weapon', weaponKind: 'dagger', minRarity: 'common', baseAttack: 6 },
  { id: 'wpn_phantom_fang', name: '망령의 송곳니', slot: 'weapon', weaponKind: 'dagger', minRarity: 'rare', setId: 'phantom_stalker', baseAttack: 14, specialEffectId: 'crit_bleed', specialEffectDesc: '치명타 시 출혈 효과.' },
  { id: 'wpn_silver_spear', name: '은빛 결계창', slot: 'weapon', weaponKind: 'spear', minRarity: 'common', baseAttack: 9 },
  { id: 'wpn_dragon_lance', name: '용린의 장창', slot: 'weapon', weaponKind: 'spear', minRarity: 'epic', setId: 'abyss_knight', baseAttack: 20, specialEffectId: 'pierce_burn', specialEffectDesc: '관통 시 화염을 남긴다.' },
  { id: 'wpn_heavy_axe', name: '피의 전투도끼', slot: 'weapon', weaponKind: 'axe', minRarity: 'common', baseAttack: 11 },
  { id: 'wpn_arcane_staff', name: '비전의 지팡이', slot: 'weapon', weaponKind: 'staff', minRarity: 'common', baseAttack: 8 },
  { id: 'wpn_void_staff', name: '공허의 대지팡이', slot: 'weapon', weaponKind: 'staff', minRarity: 'rare', setId: 'arcane_scholar', baseAttack: 17, specialEffectId: 'chain_spark', specialEffectDesc: '마법이 연쇄로 번진다.' },
  { id: 'wpn_hunter_bow', name: '추적자의 장궁', slot: 'weapon', weaponKind: 'bow', minRarity: 'common', baseAttack: 8 },
  { id: 'wpn_tempest_bow', name: '폭풍의 활', slot: 'weapon', weaponKind: 'bow', minRarity: 'rare', setId: 'phantom_stalker', baseAttack: 16, specialEffectId: 'split_arrow', specialEffectDesc: '화살이 부서져 추가 피해를 준다.' },
  { id: 'wpn_siege_crossbow', name: '심연 파쇄 석궁', slot: 'weapon', weaponKind: 'crossbow', minRarity: 'uncommon', baseAttack: 13 },
  { id: 'wpn_iron_gauntlet', name: '강철 투혼 건틀릿', slot: 'weapon', weaponKind: 'gauntlet', minRarity: 'common', baseAttack: 7 },
  { id: 'wpn_abyss_spellblade', name: '심연의 마법검', slot: 'weapon', weaponKind: 'spellblade', minRarity: 'rare', setId: 'arcane_scholar', baseAttack: 15, specialEffectId: 'wave_slash', specialEffectDesc: '검기가 전방에 충격파를 만든다.' },
  { id: 'wpn_solar_flare', name: '태양 파열검', slot: 'weapon', weaponKind: 'sword', minRarity: 'epic', setId: 'sunforge', baseAttack: 19 },
  { id: 'wpn_abyss_reaper', name: '심연의 집행자', slot: 'weapon', weaponKind: 'axe', minRarity: 'legendary', setId: 'abyss_knight', baseAttack: 25 },
  { id: 'wpn_starlit_rod', name: '별빛 마법봉', slot: 'weapon', weaponKind: 'staff', minRarity: 'epic', setId: 'abyss_witch', baseAttack: 18 },
  { id: 'arm_leather', name: '모험가의 경갑', slot: 'armor', minRarity: 'common', baseHp: 20, baseDef: 3 },
  { id: 'arm_abyss_plate', name: '심연 기사의 판금갑옷', slot: 'armor', minRarity: 'rare', setId: 'abyss_knight', baseHp: 55, baseDef: 8 },
  { id: 'arm_arcane_robe', name: '고대 현자의 로브', slot: 'armor', minRarity: 'rare', setId: 'arcane_scholar', baseHp: 35, baseDef: 5 },
  { id: 'arm_shadow_cloak', name: '그림자 추적자의 외투', slot: 'armor', minRarity: 'rare', setId: 'phantom_stalker', baseHp: 40, baseDef: 5 },
  { id: 'arm_sunwall_mail', name: '태양 방패 메일', slot: 'armor', minRarity: 'epic', setId: 'sunforge', baseHp: 72, baseDef: 11 },
  { id: 'arm_void_wisp', name: '공허의 위습 가운', slot: 'armor', minRarity: 'epic', setId: 'abyss_witch', baseHp: 60, baseDef: 9 },
  { id: 'rng_iron', name: '결의의 반지', slot: 'ring', minRarity: 'common', baseAttack: 3 },
  { id: 'rng_abyss_seal', name: '심연 기사의 인장 반지', slot: 'ring', minRarity: 'rare', setId: 'abyss_knight', baseAttack: 8 },
  { id: 'rng_arcane_band', name: '고대 현자의 마력 반지', slot: 'ring', minRarity: 'rare', setId: 'arcane_scholar', baseAttack: 7 },
  { id: 'rng_phantom_signet', name: '그림자 추적자의 반지', slot: 'ring', minRarity: 'rare', setId: 'phantom_stalker', baseAttack: 8 },
  { id: 'rng_solstice_ring', name: '솔스티스 결속 반지', slot: 'ring', minRarity: 'epic', setId: 'sunforge', baseAttack: 11 },
  { id: 'rng_moon_tether', name: '달빛 속박 반지', slot: 'ring', minRarity: 'epic', setId: 'abyss_witch', baseAttack: 12 },
  { id: 'nck_bone', name: '고대 뼈 부적', slot: 'necklace', minRarity: 'common', baseHp: 15, baseDef: 2 },
  { id: 'nck_abyss_pendant', name: '심연 기사의 펜던트', slot: 'necklace', minRarity: 'rare', setId: 'abyss_knight', baseHp: 40, baseDef: 5 },
  { id: 'nck_arcane_amulet', name: '고대 현자의 아뮬렛', slot: 'necklace', minRarity: 'rare', setId: 'arcane_scholar', baseHp: 30, baseDef: 4 },
  { id: 'nck_phantom_charm', name: '그림자 추적자의 목걸이', slot: 'necklace', minRarity: 'rare', setId: 'phantom_stalker', baseHp: 35, baseDef: 4 },
  { id: 'nck_solar_crest', name: '태양의 문장 목걸이', slot: 'necklace', minRarity: 'epic', setId: 'sunforge', baseHp: 48, baseDef: 6 },
  { id: 'nck_eclipse_talisman', name: '일식 부적', slot: 'necklace', minRarity: 'epic', setId: 'abyss_witch', baseHp: 46, baseDef: 6 },
];

const AFFIX_POOL: { label: string; key: keyof StatBonus; min: number; max: number; suffix: string }[] = [
  { label: '공격력', key: 'attackPct', min: 5, max: 14, suffix: '%' },
  { label: '치명타 확률', key: 'critChance', min: 3, max: 10, suffix: '%' },
  { label: '치명타 피해', key: 'critDamage', min: 12, max: 32, suffix: '%' },
  { label: '공격 속도', key: 'attackSpeedPct', min: 5, max: 14, suffix: '%' },
  { label: '스킬 피해', key: 'skillDamagePct', min: 8, max: 20, suffix: '%' },
  { label: '최대 체력', key: 'maxHp', min: 15, max: 45, suffix: '' },
  { label: '이동 속도', key: 'speedPct', min: 4, max: 10, suffix: '%' },
  { label: '쿨타임 감소', key: 'cooldownReduction', min: 4, max: 10, suffix: '%' },
  { label: '생명력 흡수', key: 'lifesteal', min: 2, max: 5, suffix: '%' },
  { label: '방어력', key: 'defense', min: 2, max: 6, suffix: '' },
  { label: '골드 획득', key: 'goldGainPct', min: 5, max: 15, suffix: '%' },
  { label: '기본 공격력', key: 'attack', min: 4, max: 16, suffix: '' },
  { label: '경험치 획득', key: 'expGainPct', min: 5, max: 12, suffix: '%' },
  { label: '가시 피해', key: 'thorns', min: 2, max: 8, suffix: '' },
];

const RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.3, rare: 1.65, epic: 2.1, legendary: 2.7, mythic: 3.5 };
const RARITY_PREFIX: Record<Rarity, string> = { common: '', uncommon: '정교한 ', rare: '희귀한 ', epic: '영웅의 ', legendary: '전설의 ', mythic: '신화의 ' };
let uidCounter = 1;
export function nextUid(prefix = 'eq'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export function rollRarity(floor: number, luckBonusPct = 0): Rarity {
  const luck = Math.max(1, 1 + Math.max(0, luckBonusPct) / 100);
  const weights = [
    Math.min(0.06, Math.max(0, (floor - 12) * 0.003) * luck),
    Math.min(0.14, Math.max(0.01, (floor - 4) * 0.006) * luck),
    Math.min(0.24, (0.04 + floor * 0.009) * luck),
    Math.min(0.35, (0.14 + floor * 0.012) * luck),
    0.34,
  ];
  const roll = Math.random();
  let threshold = 0;
  const rarities: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon'];
  for (let i = 0; i < weights.length; i++) {
    threshold += weights[i];
    if (roll < threshold) return rarities[i];
  }
  return 'common';
}

export function createItemFromTemplate(templateId: string, floor: number, forcedRarity?: Rarity, luckBonusPct = 0): EquipmentItem {
  const template = EQUIPMENT_TEMPLATES.find((item) => item.id === templateId) || EQUIPMENT_TEMPLATES[0];
  let rarity = forcedRarity || rollRarity(floor, luckBonusPct);
  if (RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(template.minRarity)) rarity = template.minRarity;
  const rarityIndex = RARITY_ORDER.indexOf(rarity);
  const safeFloor = Math.max(1, Math.floor(floor));
  const multiplier = RARITY_MULT[rarity] * (1 + (safeFloor - 1) * 0.08);
  const baseStats: StatBonus = {};
  if (template.baseAttack) baseStats.attack = Math.round(template.baseAttack * multiplier);
  if (template.baseHp) baseStats.maxHp = Math.round(template.baseHp * multiplier);
  if (template.baseDef) baseStats.defense = Math.round(template.baseDef * (1 + rarityIndex * 0.35 + (safeFloor - 1) * 0.04));
  const affixCount = Math.min(5, Math.max(1, rarityIndex + 1));
  const pool = [...AFFIX_POOL].sort(() => Math.random() - 0.5).slice(0, affixCount);
  const affixes = pool.map((affix) => {
    const value = Math.round((affix.min + Math.random() * (affix.max - affix.min)) * (1 + rarityIndex * 0.2));
    return { label: `${affix.label} +${value}${affix.suffix}`, stats: { [affix.key]: value } as StatBonus };
  });
  const noPrefix = ['심연', '고대', '그림자', '태양', '별빛'].some((word) => template.name.includes(word));
  return {
    uid: nextUid('eq'), templateId: template.id,
    name: `${noPrefix ? '' : RARITY_PREFIX[rarity]}${template.name}`,
    slot: template.slot, weaponKind: template.weaponKind, rarity,
    level: safeFloor, upgradeLevel: 0, setId: template.setId,
    baseStats, affixes, specialEffectId: template.specialEffectId,
    specialEffectDesc: template.specialEffectDesc,
    price: Math.round((25 + safeFloor * 12) * RARITY_MULT[rarity] * 1.2),
  };
}

export function generateRandomEquipment(floor: number, forcedSlot?: EquipSlot, luckBonusPct = 0, minRarity?: Rarity): EquipmentItem {
  const pool = forcedSlot ? EQUIPMENT_TEMPLATES.filter((template) => template.slot === forcedSlot) : EQUIPMENT_TEMPLATES;
  const candidates = pool.length ? pool : EQUIPMENT_TEMPLATES;
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  const item = createItemFromTemplate(template.id, floor, undefined, luckBonusPct);
  return minRarity && RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.indexOf(minRarity)
    ? createItemFromTemplate(template.id, floor, minRarity, luckBonusPct)
    : item;
}
