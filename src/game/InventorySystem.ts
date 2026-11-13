import { META_UPGRADES } from './data/classes';
import { getRelicById } from './data/relics';
import { SKILL_SYNERGIES } from './data/skills';
import { EQUIPMENT_SET_DEFS } from './data/weapons';
import {
  EquipmentItem,
  EquipSlot,
  OwnedSkill,
  RARITY_ORDER,
  SaveData,
  StatBonus,
} from './types';

export function mergeStats(target: StatBonus, add?: StatBonus): void {
  if (!add) return;
  const keys = Object.keys(add) as (keyof StatBonus)[];
  for (const k of keys) {
    const val = add[k];
    if (typeof val === 'number') {
      target[k] = (target[k] || 0) + val;
    }
  }
}

export function getItemEffectiveStats(item: EquipmentItem): StatBonus {
  const result: StatBonus = {};
  const upgMult = 1 + item.upgradeLevel * 0.14;
  if (item.baseStats.attack) result.attack = Math.round(item.baseStats.attack * upgMult);
  if (item.baseStats.maxHp) result.maxHp = Math.round(item.baseStats.maxHp * upgMult);
  if (item.baseStats.defense) result.defense = Math.round(item.baseStats.defense * (1 + item.upgradeLevel * 0.12));

  for (const af of item.affixes) {
    mergeStats(result, af.stats);
  }
  return result;
}

export function formatItemStats(item: EquipmentItem): string[] {
  const s = getItemEffectiveStats(item);
  const lines: string[] = [];
  if (s.attack) lines.push(`공격력 +${s.attack}`);
  if (s.maxHp) lines.push(`최대 체력 +${s.maxHp}`);
  if (s.defense) lines.push(`방어력 +${s.defense}`);
  for (const af of item.affixes) {
    lines.push(af.label);
  }
  return lines;
}

export class InventorySystem {
  public equipped: Record<EquipSlot, EquipmentItem | null> = {
    weapon: null,
    armor: null,
    ring: null,
    necklace: null,
  };
  public bag: EquipmentItem[] = [];
  public relics: string[] = [];
  public maxBagSize = 24;

  public reset(): void {
    this.equipped = { weapon: null, armor: null, ring: null, necklace: null };
    this.bag = [];
    this.relics = [];
  }

  public addItem(item: EquipmentItem): boolean {
    if (this.bag.length >= this.maxBagSize) {
      return false;
    }
    this.bag.push(item);
    return true;
  }

  public equipFromBag(uid: string): EquipmentItem | null {
    const idx = this.bag.findIndex((i) => i.uid === uid);
    if (idx === -1) return null;
    const item = this.bag[idx];
    const current = this.equipped[item.slot];
    this.bag.splice(idx, 1);
    if (current) {
      this.bag.splice(idx, 0, current);
    }
    this.equipped[item.slot] = item;
    return item;
  }

  public sellFromBag(uid: string): number {
    const idx = this.bag.findIndex((i) => i.uid === uid);
    if (idx === -1) return 0;
    const item = this.bag[idx];
    this.bag.splice(idx, 1);
    return Math.max(8, Math.round(item.price * 0.45));
  }

  public dismantleFromBag(uid: string): { crystals: number; shards: number } {
    const idx = this.bag.findIndex((i) => i.uid === uid);
    if (idx === -1) return { crystals: 0, shards: 0 };
    const item = this.bag[idx];
    this.bag.splice(idx, 1);
    const rIdx = RARITY_ORDER.indexOf(item.rarity);
    return {
      crystals: 2 + rIdx * 2,
      shards: rIdx >= 3 ? rIdx - 1 : 0,
    };
  }

  public getUpgradeCost(item: EquipmentItem): { gold: number; crystals: number; shards: number } {
    const next = item.upgradeLevel + 1;
    return {
      gold: 30 + next * 25,
      crystals: 2 + next * 2,
      shards: next >= 5 ? next - 4 : 0,
    };
  }

  public upgradeItem(item: EquipmentItem): boolean {
    if (item.upgradeLevel >= 10) return false;
    item.upgradeLevel += 1;
    return true;
  }

  public addRelic(relicId: string): boolean {
    if (this.relics.includes(relicId)) return false;
    this.relics.push(relicId);
    return true;
  }

  public hasRelicTag(tag: string): boolean {
    return this.relics.some((id) => getRelicById(id).specialTag === tag);
  }

  public getActiveSetBonuses(): { setId: string; name: string; count: number; bonus2: boolean; bonus4: boolean }[] {
    const counts: Record<string, number> = {};
    for (const slot of ['weapon', 'armor', 'ring', 'necklace'] as EquipSlot[]) {
      const item = this.equipped[slot];
      if (item?.setId) {
        counts[item.setId] = (counts[item.setId] || 0) + 1;
      }
    }
    const list: { setId: string; name: string; count: number; bonus2: boolean; bonus4: boolean }[] = [];
    for (const [setId, count] of Object.entries(counts)) {
      const def = EQUIPMENT_SET_DEFS[setId];
      if (!def) continue;
      if (count >= 2) {
        list.push({
          setId,
          name: def.name,
          count,
          bonus2: count >= 2,
          bonus4: count >= 4,
        });
      }
    }
    return list;
  }

  public getActiveSynergies(skills: OwnedSkill[]): string[] {
    const active: string[] = [];
    for (const syn of SKILL_SYNERGIES) {
      const minLv = syn.minLevel || 1;
      const met = syn.reqSkills.every((reqId) => {
        const owned = skills.find((s) => s.id === reqId);
        return owned && owned.level >= minLv;
      });
      if (met) active.push(syn.id);
    }
    return active;
  }

  public computeTotalBonuses(
    bonusStats: StatBonus,
    save: SaveData,
    skills: OwnedSkill[]
  ): StatBonus {
    const total: StatBonus = {};
    mergeStats(total, bonusStats);

    // Equipped items
    for (const slot of ['weapon', 'armor', 'ring', 'necklace'] as EquipSlot[]) {
      const item = this.equipped[slot];
      if (item) {
        mergeStats(total, getItemEffectiveStats(item));
      }
    }

    // Set bonuses
    for (const setInfo of this.getActiveSetBonuses()) {
      const def = EQUIPMENT_SET_DEFS[setInfo.setId];
      if (setInfo.bonus2) mergeStats(total, def.stats2);
      if (setInfo.bonus4) mergeStats(total, def.stats4);
    }

    // Relics
    for (const rid of this.relics) {
      mergeStats(total, getRelicById(rid).stats);
    }

    // Skill synergies
    const synergies = this.getActiveSynergies(skills);
    if (synergies.includes('syn_elemental_fusion')) {
      mergeStats(total, { skillDamagePct: 30 });
    }
    if (synergies.includes('syn_thunder_judgement')) {
      mergeStats(total, { critChance: 15, skillDamagePct: 35 });
    }
    if (synergies.includes('syn_abyss_devourer')) {
      mergeStats(total, { lifesteal: 6 });
    }
    if (synergies.includes('syn_sword_saint')) {
      mergeStats(total, { attackPct: 25, attackSpeedPct: 15 });
    }
    if (synergies.includes('syn_inferno_lord')) {
      mergeStats(total, { cooldownReduction: 15, skillDamagePct: 35 });
    }

    // Meta upgrades
    for (const upg of META_UPGRADES) {
      const lv = save.metaUpgrades[upg.id] || 0;
      if (lv <= 0) continue;
      if (upg.id === 'meta_attack') mergeStats(total, { attackPct: lv * upg.perLevelValue });
      if (upg.id === 'meta_hp') mergeStats(total, { maxHp: lv * upg.perLevelValue });
      if (upg.id === 'meta_gold') mergeStats(total, { goldGainPct: lv * 10 });
      if (upg.id === 'meta_crit') mergeStats(total, { critChance: lv * upg.perLevelValue });
    }

    return total;
  }
}
