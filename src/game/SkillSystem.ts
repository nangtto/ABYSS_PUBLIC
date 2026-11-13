import { CombatSystem } from './CombatSystem';
import { getSkillById, SKILLS } from './data/skills';
import { RELICS } from './data/relics';
import { Enemy } from './Enemy';
import { InventorySystem } from './InventorySystem';
import { Player } from './Player';
import {
  ELEMENT_COLORS,
  LevelUpChoice,
  SaveData,
  StatBonus,
} from './types';

export interface SkillCastResult {
  used: boolean;
  healedHp: number;
  dashDistance?: { dx: number; dy: number };
}

export class SkillSystem {
  public castSkill(
    slotIndex: number,
    player: Player,
    enemies: Enemy[],
    combat: CombatSystem,
    inv: InventorySystem,
    save: SaveData,
    onDamageEnemy: (enemy: Enemy, rawDamage: number, isSkill: boolean, color?: string, freezeSec?: number, burnDps?: number) => void
  ): SkillCastResult {
    const skillId = player.activeSkillSlots[slotIndex];
    if (!skillId || player.skillCooldowns[slotIndex] > 0) {
      return { used: false, healedHp: 0 };
    }

    const owned = player.skills.find((s) => s.id === skillId);
    if (!owned) return { used: false, healedHp: 0 };

    const def = getSkillById(skillId);
    const lv = owned.level;
    const stats = player.getComputedStats(inv, save);
    const synergies = inv.getActiveSynergies(player.skills);

    // Cooldown calculation
    let cd = def.cooldown * (1 - stats.cooldownReduction);
    if (skillId === 'skill_ice_barrier' && lv >= 5) cd *= 0.8;
    if (skillId === 'skill_thunder_dash' && lv >= 4) cd *= 0.85;
    player.skillCooldowns[slotIndex] = Math.max(0.5, cd);

    save && save.codex.skillsUsed.includes(skillId) === false && save.codex.skillsUsed.push(skillId);

    const lvMult = 1 + (lv - 1) * 0.34;
    let synergyMult = 1;
    if (def.element === 'fire' && synergies.includes('syn_inferno_lord')) synergyMult += 0.35;
    if (def.element === 'lightning' && synergies.includes('syn_thunder_judgement')) synergyMult += 0.35;
    if (synergies.includes('syn_elemental_fusion')) synergyMult += 0.2;

    const totalDmg = Math.round(
      (def.baseDamage + stats.attack * 1.45) * lvMult * stats.skillDamageMult * synergyMult
    );
    const radiusMult =
      (1 + (lv - 1) * 0.1) * (synergies.includes('syn_elemental_fusion') ? 1.2 : 1);
    const angle = player.facingAngle;

    let healedHp = 0;
    let dashDistance: { dx: number; dy: number } | undefined;

    // Helper for AoE damage around a point
    const hitAoE = (cx: number, cy: number, rad: number, dmg: number, freeze = 0, burn = 0) => {
      combat.addRing(cx, cy, rad, def.color, 0.32);
      combat.spawnBurst(cx, cy, def.accentColor, 18, 200, 5, 0.4);
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - cx, e.y - cy) <= rad + e.radius) {
          onDamageEnemy(e, dmg, true, def.color, freeze, burn);
        }
      }
    };

    const spawnProj = (
      ang: number,
      speed: number,
      radius: number,
      dmg: number,
      pierce: number,
      explodeRad = 0,
      homing = false,
      isWave = false
    ) => {
      combat.projectiles.push({
        id: `sp_${Date.now()}_${Math.random()}`,
        fromPlayer: true,
        x: player.x + Math.cos(ang) * 16,
        y: player.y + Math.sin(ang) * 16,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        radius,
        damage: dmg,
        life: def.range > 0 ? def.range / speed + 0.15 : 1.0,
        pierce,
        hitIds: new Set(),
        color: def.color,
        accentColor: def.accentColor,
        explodeRadius: explodeRad,
        slowEnemy: def.element === 'ice',
        homing,
        isSwordWave: isWave,
      });
    };

    switch (skillId) {
      case 'skill_fireball': {
        const count = lv >= 5 ? 3 : lv >= 4 ? 2 : 1;
        const spread = 0.22;
        for (let i = 0; i < count; i++) {
          const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
          spawnProj(angle + off, 430, 10, totalDmg, 1, def.radius * radiusMult);
        }
        break;
      }
      case 'skill_fire_explosion':
      case 'skill_ember_ring': {
        if (skillId === 'skill_ember_ring') {
          const count = 4 + lv * 2;
          for (let i = 0; i < count; i++) {
            spawnProj((Math.PI * 2 * i) / count, 360, 8, Math.round(totalDmg * 0.75), lv >= 3 ? 3 : 1, lv >= 5 ? 36 : 0);
          }
        } else {
          hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg, 0, lv >= 4 ? totalDmg * 0.2 : 0);
          if (lv >= 5) hitAoE(player.x, player.y, def.radius * 1.25, Math.round(totalDmg * 0.6), 0, 0);
        }
        break;
      }
      case 'skill_flame_pillar':
      case 'skill_meteor_shower': {
        const count = skillId === 'skill_flame_pillar' ? 2 + lv : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const target = enemies[i % Math.max(1, enemies.length)];
          const tx = target ? target.x + (Math.random() - 0.5) * 40 : player.x + Math.cos(angle) * 160;
          const ty = target ? target.y + (Math.random() - 0.5) * 40 : player.y + Math.sin(angle) * 160;
          hitAoE(tx, ty, def.radius * radiusMult, totalDmg, 0, totalDmg * 0.15);
        }
        break;
      }
      case 'skill_blazing_sword':
      case 'skill_void_slash': {
        const arc = lv >= 5 && skillId === 'skill_blazing_sword' ? Math.PI * 2 : Math.PI * 0.9;
        const rad = def.radius * radiusMult;
        combat.addSlash(player.x, player.y, angle, arc, rad, def.color);
        combat.spawnBurst(player.x + Math.cos(angle) * 50, player.y + Math.sin(angle) * 50, def.accentColor, 16, 190);
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          if (Math.hypot(dx, dy) <= rad + e.radius) {
            onDamageEnemy(e, totalDmg, true, def.color);
          }
        }
        if (lv >= 4) {
          for (let i = -1; i <= 1; i++) {
            spawnProj(angle + i * 0.25, 420, 9, Math.round(totalDmg * 0.55), 2, 0, false, true);
          }
        }
        break;
      }
      case 'skill_ice_lance': {
        const count = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const off = count === 1 ? 0 : (i - (count - 1) / 2) * 0.18;
          spawnProj(angle + off, 540 + lv * 20, 9, totalDmg, 4);
        }
        break;
      }
      case 'skill_frost_nova': {
        const freeze = 1.4 + lv * 0.3;
        hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg, freeze);
        break;
      }
      case 'skill_ice_barrier': {
        const pct = 0.08 + lv * 0.04;
        healedHp = Math.round(player.maxHp * pct);
        player.hp = Math.min(player.maxHp, player.hp + healedHp);
        hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg, lv >= 4 ? 1.4 : 0);
        break;
      }
      case 'skill_frost_storm':
      case 'skill_glacier_spike':
      case 'skill_frozen_orb': {
        if (skillId === 'skill_frozen_orb') {
          const count = lv >= 5 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            spawnProj(angle + (i === 1 ? 0.3 : 0), 300, 14, totalDmg, 6, 85);
          }
        } else {
          const tx = player.x + Math.cos(angle) * 140;
          const ty = player.y + Math.sin(angle) * 140;
          hitAoE(tx, ty, def.radius * radiusMult, totalDmg, 1.5);
        }
        break;
      }
      case 'skill_lightning_strike':
      case 'skill_thunderstorm': {
        const strikes = skillId === 'skill_thunderstorm' ? 3 + lv * 2 : lv + 1;
        const alive = enemies.filter((e) => e.hp > 0);
        for (let i = 0; i < strikes; i++) {
          const target = alive.length > 0 ? alive[i % alive.length] : null;
          const tx = target ? target.x : player.x + Math.cos(angle) * (100 + i * 35);
          const ty = target ? target.y : player.y + Math.sin(angle) * (100 + i * 35);
          combat.addBolt(tx, ty - 160, tx, ty, def.color);
          hitAoE(tx, ty, 65 * radiusMult, Math.round(totalDmg / Math.max(1, strikes * 0.45)), 0.35);
        }
        break;
      }
      case 'skill_chain_lightning': {
        const maxChain = 2 + lv + (lv >= 5 ? 3 : 0);
        let cx = player.x;
        let cy = player.y;
        const hitSet = new Set<string>();
        for (let c = 0; c < maxChain; c++) {
          let best: Enemy | null = null;
          let bestD = 260;
          for (const e of enemies) {
            if (e.hp <= 0 || hitSet.has(e.uid)) continue;
            const d = Math.hypot(e.x - cx, e.y - cy);
            if (d < bestD) {
              bestD = d;
              best = e;
            }
          }
          if (!best) break;
          hitSet.add(best.uid);
          combat.addBolt(cx, cy, best.x, best.y, def.color);
          onDamageEnemy(best, totalDmg, true, def.color, 0.25);
          cx = best.x;
          cy = best.y;
        }
        break;
      }
      case 'skill_thunder_dash': {
        const dist = 190 + lv * 15;
        dashDistance = { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
        player.invulnTimer = 0.4;
        combat.addBolt(player.x, player.y, player.x + dashDistance.dx, player.y + dashDistance.dy, def.color);
        hitAoE(player.x + dashDistance.dx * 0.5, player.y + dashDistance.dy * 0.5, 95, totalDmg, 0.4);
        break;
      }
      case 'skill_spark_nova': {
        hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg, 0.4);
        if (lv >= 3) {
          for (let i = 0; i < 8; i++) {
            spawnProj((Math.PI * 2 * i) / 8, 390, 7, Math.round(totalDmg * 0.45), 1);
          }
        }
        break;
      }
      case 'skill_plasma_spear': {
        const count = lv >= 5 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          spawnProj(angle + (i === 1 ? 0.12 : 0), 680, 10, totalDmg, 8);
        }
        break;
      }
      case 'skill_shadow_blade': {
        const count = 2 + lv + (lv >= 5 ? 1 : 0);
        const spread = 0.16;
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) / 2) * spread;
          spawnProj(angle + off, 510, 8, Math.round(totalDmg * 0.65), lv >= 3 ? 3 : 1, 0, lv >= 5);
        }
        break;
      }
      case 'skill_dark_orb': {
        const count = lv >= 4 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          spawnProj(angle + (i === 1 ? 0.25 : 0), 290, 16, totalDmg, 6, 90 * radiusMult);
        }
        break;
      }
      case 'skill_life_drain': {
        let totalDealt = 0;
        const rad = def.radius * radiusMult;
        combat.addRing(player.x, player.y, rad, def.color, 0.35);
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - player.x, e.y - player.y) <= rad + e.radius) {
            onDamageEnemy(e, totalDmg, true, def.color);
            totalDealt += totalDmg;
          }
        }
        const pct = 0.16 + lv * 0.05;
        healedHp = Math.min(Math.round(player.maxHp * 0.35), Math.round(totalDealt * pct));
        if (healedHp > 0) {
          player.hp = Math.min(player.maxHp, player.hp + healedHp);
        }
        break;
      }
      case 'skill_abyss_grasp':
      case 'skill_curse_wave': {
        const tx = skillId === 'skill_abyss_grasp' ? player.x + Math.cos(angle) * 140 : player.x;
        const ty = skillId === 'skill_abyss_grasp' ? player.y + Math.sin(angle) * 140 : player.y;
        hitAoE(tx, ty, def.radius * radiusMult, totalDmg, 0.6);
        break;
      }
      case 'skill_whirlwind': {
        const hits = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        const rad = def.radius * radiusMult;
        combat.addSlash(player.x, player.y, angle, Math.PI * 2, rad, def.color);
        combat.addRing(player.x, player.y, rad, def.accentColor, 0.25);
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - player.x, e.y - player.y) <= rad + e.radius) {
            onDamageEnemy(e, Math.round(totalDmg * (0.7 + hits * 0.28)), true, def.color);
          }
        }
        break;
      }
      case 'skill_shockwave': {
        hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg, 1.0 + lv * 0.15);
        break;
      }
      case 'skill_sword_aura': {
        const count = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const off = count === 1 ? 0 : (i - (count - 1) / 2) * 0.2;
          spawnProj(angle + off, 540, 24 + lv * 3, totalDmg, 8, 0, false, true);
        }
        break;
      }
      case 'skill_rapid_thrust': {
        const rad = def.range * radiusMult;
        combat.addSlash(player.x, player.y, angle, 0.75, rad, def.color);
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const d = Math.hypot(dx, dy);
          if (d <= rad + e.radius) {
            onDamageEnemy(e, totalDmg, true, def.color);
          }
        }
        break;
      }
      case 'skill_blade_tempest': {
        hitAoE(player.x, player.y, def.radius * radiusMult, totalDmg);
        const count = 4 + lv * 2;
        for (let i = 0; i < count; i++) {
          spawnProj((Math.PI * 2 * i) / count, 420, 10, Math.round(totalDmg * 0.45), 2, 0, false, true);
        }
        break;
      }
      case 'skill_earth_shatter': {
        const count = lv >= 3 ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) / 2) * 0.24;
          spawnProj(angle + off, 380, 14, totalDmg, 3, lv >= 5 ? 55 : 0);
        }
        break;
      }
      default: {
        hitAoE(player.x, player.y, 110, totalDmg);
        break;
      }
    }

    return { used: true, healedHp, dashDistance };
  }

  public generateLevelUpChoices(player: Player, inv: InventorySystem): LevelUpChoice[] {
    const candidates: LevelUpChoice[] = [];

    // 1. Upgradeable owned skills
    for (const owned of player.skills) {
      if (owned.level < 5) {
        const def = getSkillById(owned.id);
        const nextLv = owned.level + 1;
        candidates.push({
          id: `upg_${def.id}`,
          kind: 'upgrade_skill',
          title: `${def.name} Lv.${nextLv} 강화`,
          subtitle: `스킬 진화 · ${def.element.toUpperCase()}`,
          description: def.levelDescriptions[nextLv - 1] || `스킬 피해량 및 범위가 대폭 증가합니다.`,
          color: ELEMENT_COLORS[def.element],
          skillId: def.id,
        });
      }
    }

    // 2. New skills (if open slot or < 4 skills)
    const unownedSkills = SKILLS.filter((s) => !player.skills.some((o) => o.id === s.id));
    if (unownedSkills.length > 0 && player.skills.length < 6) {
      const shuffled = [...unownedSkills].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const s of shuffled) {
        candidates.push({
          id: `new_${s.id}`,
          kind: 'new_skill',
          title: `신규 스킬: ${s.name}`,
          subtitle: s.slotPreference === 'ultimate' ? '궁극기 · R 슬롯 추천' : '액티브 스킬',
          description: `${s.description} (${s.levelDescriptions[0]})`,
          color: ELEMENT_COLORS[s.element],
          skillId: s.id,
        });
      }
    }

    // 3. Stat enhancements with explicit numerical explanation
    const statTemplates: {
      id: string;
      title: string;
      subtitle: string;
      desc: string;
      key: keyof StatBonus;
      val: number;
      color: string;
    }[] = [
      {
        id: 'stat_atk',
        title: '전투 숙련 강화',
        subtitle: '능력치 증폭',
        desc: '기본 공격력이 영구적으로 +15% 증가합니다. (이번 탐험 지속)',
        key: 'attackPct',
        val: 15,
        color: '#f97316',
      },
      {
        id: 'stat_aspd',
        title: '신속한 연격',
        subtitle: '공격 속도 강화',
        desc: '모든 무기의 공격 속도가 +12% 증가합니다.',
        key: 'attackSpeedPct',
        val: 12,
        color: '#34d399',
      },
      {
        id: 'stat_hp',
        title: '강인한 생명력',
        subtitle: '생존력 강화',
        desc: '최대 체력이 +30 증가하고, 즉시 체력을 30 회복합니다.',
        key: 'maxHp',
        val: 30,
        color: '#ef4444',
      },
      {
        id: 'stat_crit',
        title: '치명적 일격',
        subtitle: '치명타 강화',
        desc: '치명타 확률 +6%, 치명타가 더욱 자주 발동합니다.',
        key: 'critChance',
        val: 6,
        color: '#facc15',
      },
      {
        id: 'stat_spd',
        title: '그림자 보법',
        subtitle: '기동력 강화',
        desc: '이동 속도가 +10% 증가합니다.',
        key: 'speedPct',
        val: 10,
        color: '#38bdf8',
      },
      {
        id: 'stat_dodge',
        title: '민첩한 회피',
        subtitle: '회피 강화',
        desc: '회피(SHIFT) 쿨타임이 12% 감소합니다.',
        key: 'dodgeCooldownPct',
        val: 12,
        color: '#67e8f9',
      },
      {
        id: 'stat_skill',
        title: '원소 증폭',
        subtitle: '마력 강화',
        desc: '모든 스킬(Q/E/R)의 피해량이 +22% 증가합니다.',
        key: 'skillDamagePct',
        val: 22,
        color: '#c084fc',
      },
      {
        id: 'stat_exp',
        title: '지식의 탐구자',
        subtitle: '성장 가속',
        desc: '몬스터 처치 시 경험치 획득량이 +20% 증가합니다.',
        key: 'expGainPct',
        val: 20,
        color: '#93c5fd',
      },
    ];

    for (const st of statTemplates) {
      candidates.push({
        id: st.id,
        kind: 'stat_boost',
        title: st.title,
        subtitle: st.subtitle,
        description: st.desc,
        color: st.color,
        statKey: st.key,
        statValue: st.val,
      });
    }

    // Occasional Relic choice on level-up
    const unownedRelics = RELICS.filter((r) => !inv.relics.includes(r.id));
    if (unownedRelics.length > 0 && Math.random() < 0.35) {
      const r = unownedRelics[Math.floor(Math.random() * unownedRelics.length)];
      candidates.push({
        id: `rel_${r.id}`,
        kind: 'relic',
        title: `고대 유물: ${r.name}`,
        subtitle: '희귀 유물 획득',
        description: r.description,
        color: r.color,
        relicId: r.id,
      });
    }

    // Shuffle and pick 3 distinct choices, prioritizing at least 1 skill/relic when possible
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const picked: LevelUpChoice[] = [];
    for (const c of shuffled) {
      if (picked.length >= 3) break;
      if (!picked.some((p) => p.id === c.id)) {
        picked.push(c);
      }
    }
    return picked;
  }

  public applyChoice(choice: LevelUpChoice, player: Player, inv: InventorySystem, save: SaveData): void {
    if (choice.kind === 'upgrade_skill' && choice.skillId) {
      const owned = player.skills.find((s) => s.id === choice.skillId);
      if (owned && owned.level < 5) {
        owned.level += 1;
      }
    } else if (choice.kind === 'new_skill' && choice.skillId) {
      if (!player.skills.some((s) => s.id === choice.skillId)) {
        player.skills.push({ id: choice.skillId, level: 1 });
        // Auto-assign to first empty slot
        const emptyIdx = player.activeSkillSlots.findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          player.activeSkillSlots[emptyIdx] = choice.skillId;
        }
      }
    } else if (choice.kind === 'stat_boost' && choice.statKey && choice.statValue) {
      player.bonusStats[choice.statKey] = (player.bonusStats[choice.statKey] || 0) + choice.statValue;
      if (choice.statKey === 'maxHp') {
        player.syncMaxHp(inv, save);
        player.hp = Math.min(player.maxHp, player.hp + choice.statValue);
      }
    } else if (choice.kind === 'relic' && choice.relicId) {
      inv.addRelic(choice.relicId);
      if (!save.codex.relicsFound.includes(choice.relicId)) {
        save.codex.relicsFound.push(choice.relicId);
      }
      if (choice.relicId === 'rel_immortal_pact') {
        player.revivesLeft += 1;
      }
      player.syncMaxHp(inv, save);
    }
    player.syncMaxHp(inv, save);
  }
}
