import { getClassById } from './data/classes';
import { WEAPON_PROFILES } from './data/weapons';
import { InventorySystem } from './InventorySystem';
import {
  AnimState,
  ClassDef,
  DungeonRoom,
  OwnedSkill,
  SaveData,
  StatBonus,
  WeaponKind,
} from './types';

export class Player {
  public x = 360;
  public y = 260;
  public radius = 15;
  public facingAngle = 0;

  public classDef: ClassDef;
  public level = 1;
  public exp = 0;
  public expToNext = 55;
  public hp = 130;
  public maxHp = 130;
  public gold = 0;
  public potions = 2;
  public skillStones = 0;
  public revivesLeft = 0;

  public bonusStats: StatBonus = {};
  public skills: OwnedSkill[] = [];
  public activeSkillSlots: [string | null, string | null, string | null] = [null, null, null];
  public skillCooldowns: [number, number, number] = [0, 0, 0];

  public attackTimer = 0;
  public attackAnimTimer = 0;
  public attackAnimDuration = 0.22;
  public dodgeTimer = 0;
  public dodgeCooldown = 0;
  public dodgeDirX = 1;
  public dodgeDirY = 0;
  public invulnTimer = 0;
  public hitFlash = 0;
  public animState: AnimState = 'idle';
  public animTimer = 0;
  public victoryTimer = 0;
  public shieldBonus = 0;

  constructor(classId: string) {
    this.classDef = getClassById(classId);
    this.hp = this.classDef.baseHp;
    this.maxHp = this.classDef.baseHp;
  }

  public getWeaponKind(inv: InventorySystem): WeaponKind {
    return inv.equipped.weapon?.weaponKind || 'sword';
  }

  public getComputedStats(inv: InventorySystem, save: SaveData): {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    attackSpeedMult: number;
    critChance: number;
    critDamage: number;
    cooldownReduction: number;
    dodgeCooldown: number;
    skillDamageMult: number;
    expGainMult: number;
    goldGainMult: number;
    lifesteal: number;
    thorns: number;
  } {
    const b = inv.computeTotalBonuses(this.bonusStats, save, this.skills);

    // Berserker blood relic bonus
    let lowHpAtkBonus = 0;
    if (inv.hasRelicTag('low_hp_atk') && this.maxHp > 0) {
      const missingRatio = Math.max(0, 1 - this.hp / this.maxHp);
      lowHpAtkBonus = Math.round(missingRatio * 60);
    }

    const levelHpBonus = (this.level - 1) * 8;
    const levelAtkBonus = (this.level - 1) * 2.5;

    const rawMaxHp = this.classDef.baseHp + levelHpBonus + (b.maxHp || 0);
    const maxHp = Math.max(40, Math.round(rawMaxHp * (1 + (b.maxHpPct || 0) / 100)));

    const rawAtk = this.classDef.baseAttack + levelAtkBonus + (b.attack || 0);
    const attack = Math.max(
      5,
      Math.round(rawAtk * (1 + ((b.attackPct || 0) + lowHpAtkBonus) / 100))
    );

    const defense = Math.max(0, Math.round(this.classDef.baseDefense + (b.defense || 0)));
    const speed = Math.round(this.classDef.baseSpeed * (1 + (b.speedPct || 0) / 100));
    const attackSpeedMult = Math.max(0.5, 1 + (b.attackSpeedPct || 0) / 100);
    const critChance = Math.min(0.85, this.classDef.baseCrit + (b.critChance || 0) / 100);
    const critDamage = 1.65 + (b.critDamage || 0) / 100;
    const cooldownReduction = Math.min(0.6, (b.cooldownReduction || 0) / 100);
    const dodgeCooldown = Math.max(0.38, 1.05 * (1 - Math.min(0.65, (b.dodgeCooldownPct || 0) / 100)));
    const skillDamageMult = 1 + (b.skillDamagePct || 0) / 100;
    const expGainMult = 1 + (b.expGainPct || 0) / 100;
    const goldGainMult = 1 + (b.goldGainPct || 0) / 100;
    const lifesteal = (b.lifesteal || 0) / 100;
    const thorns = b.thorns || 0;

    return {
      maxHp,
      attack,
      defense,
      speed,
      attackSpeedMult,
      critChance,
      critDamage,
      cooldownReduction,
      dodgeCooldown,
      skillDamageMult,
      expGainMult,
      goldGainMult,
      lifesteal,
      thorns,
    };
  }

  public syncMaxHp(inv: InventorySystem, save: SaveData): void {
    const prevMax = this.maxHp;
    const stats = this.getComputedStats(inv, save);
    this.maxHp = stats.maxHp;
    if (this.maxHp > prevMax) {
      this.hp += this.maxHp - prevMax;
    }
    this.hp = Math.min(this.hp, this.maxHp);
  }

  public update(
    dt: number,
    moveX: number,
    moveY: number,
    room: DungeonRoom,
    inv: InventorySystem,
    save: SaveData
  ): void {
    this.animTimer += dt;
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.victoryTimer > 0) this.victoryTimer = Math.max(0, this.victoryTimer - dt);

    for (let i = 0; i < 3; i++) {
      if (this.skillCooldowns[i] > 0) {
        this.skillCooldowns[i] = Math.max(0, this.skillCooldowns[i] - dt);
      }
    }

    if (this.hp <= 0) {
      this.animState = 'death';
      return;
    }

    const stats = this.getComputedStats(inv, save);
    this.maxHp = stats.maxHp;
    if (this.hp > this.maxHp) this.hp = this.maxHp;

    let vx = 0;
    let vy = 0;

    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      const dodgeSpeed = stats.speed * 2.55;
      vx = this.dodgeDirX * dodgeSpeed;
      vy = this.dodgeDirY * dodgeSpeed;
      this.animState = 'dodge';
    } else {
      const mag = Math.hypot(moveX, moveY);
      if (mag > 0.05) {
        const nx = moveX / Math.max(1, mag);
        const ny = moveY / Math.max(1, mag);
        vx = nx * stats.speed;
        vy = ny * stats.speed;
        this.facingAngle = Math.atan2(ny, nx);
        this.animState = stats.speed >= 235 ? 'run' : 'walk';
      } else {
        this.animState = 'idle';
      }
    }

    if (this.attackAnimTimer > 0 && this.dodgeTimer <= 0) {
      this.animState = 'attack';
    } else if (this.hitFlash > 0) {
      this.animState = 'hit';
    } else if (this.victoryTimer > 0) {
      this.animState = 'victory';
    }

    // Move & resolve collisions smoothly (separate X/Y axis)
    this.moveWithCollision(vx * dt, vy * dt, room);
  }

  private moveWithCollision(dx: number, dy: number, room: DungeonRoom): void {
    const wt = 32;
    const minX = wt + this.radius;
    const maxX = room.width - wt - this.radius;
    const minY = wt + this.radius;
    const maxY = room.height - wt - this.radius;

    // Allow stepping into open door thresholds cleanly without getting stuck
    const doorHalf = 44;
    const inHorizDoorBand = Math.abs(this.y - room.height / 2) < doorHalf;
    const inVertDoorBand = Math.abs(this.x - room.width / 2) < doorHalf;

    this.x += dx;
    if (!(room.cleared && inHorizDoorBand && ((room.doors.left && this.x < minX) || (room.doors.right && this.x > maxX)))) {
      this.x = Math.max(minX, Math.min(maxX, this.x));
    }
    for (const obs of room.obstacles) {
      if (this.circleRectOverlap(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h)) {
        if (dx > 0) this.x = obs.x - this.radius;
        else if (dx < 0) this.x = obs.x + obs.w + this.radius;
      }
    }

    this.y += dy;
    if (!(room.cleared && inVertDoorBand && ((room.doors.up && this.y < minY) || (room.doors.down && this.y > maxY)))) {
      this.y = Math.max(minY, Math.min(maxY, this.y));
    }
    for (const obs of room.obstacles) {
      if (this.circleRectOverlap(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h)) {
        if (dy > 0) this.y = obs.y - this.radius;
        else if (dy < 0) this.y = obs.y + obs.h + this.radius;
      }
    }
  }

  private circleRectOverlap(
    cx: number,
    cy: number,
    cr: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): boolean {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  }

  public tryDodge(moveX: number, moveY: number, inv: InventorySystem, save: SaveData): boolean {
    if (this.dodgeCooldown > 0 || this.dodgeTimer > 0 || this.hp <= 0) return false;
    const stats = this.getComputedStats(inv, save);
    const mag = Math.hypot(moveX, moveY);
    if (mag > 0.1) {
      this.dodgeDirX = moveX / mag;
      this.dodgeDirY = moveY / mag;
    } else {
      this.dodgeDirX = Math.cos(this.facingAngle);
      this.dodgeDirY = Math.sin(this.facingAngle);
    }
    this.dodgeTimer = 0.2;
    this.invulnTimer = 0.28;
    this.dodgeCooldown = stats.dodgeCooldown;
    return true;
  }

  public startBasicAttack(inv: InventorySystem, save: SaveData): boolean {
    if (this.attackTimer > 0 || this.dodgeTimer > 0 || this.hp <= 0) return false;
    const stats = this.getComputedStats(inv, save);
    const kind = this.getWeaponKind(inv);
    const profile = WEAPON_PROFILES[kind];
    const cd = Math.max(0.11, profile.cooldown / stats.attackSpeedMult);
    this.attackTimer = cd;
    this.attackAnimDuration = Math.min(0.26, cd * 0.85);
    this.attackAnimTimer = this.attackAnimDuration;
    return true;
  }

  public getAttackAnimProgress(): number {
    if (this.attackAnimTimer <= 0 || this.attackAnimDuration <= 0) return 0;
    return 1 - this.attackAnimTimer / this.attackAnimDuration;
  }
}
