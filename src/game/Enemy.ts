import { getBossById, getMonsterById } from './data/monsters';
import {
  BossDef,
  DungeonRoom,
  EliteAffix,
  MonsterDef,
} from './types';

export interface TelegraphZone {
  id: string;
  kind: 'circle' | 'line' | 'ring';
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  radius: number;
  timer: number;
  duration: number;
  damage: number;
  color: string;
  sourceEnemyId: string;
}

export interface EnemyAttackEvent {
  type: 'melee_hit' | 'projectile' | 'summon' | 'nova';
  x: number;
  y: number;
  angle?: number;
  speed?: number;
  damage: number;
  radius?: number;
  color?: string;
  count?: number;
  spread?: number;
  summonId?: string;
}

let enemyUid = 1;

export class Enemy {
  public uid: string;
  public defId: string;
  public name: string;
  public title = '';
  public isBoss = false;
  public isElite = false;
  public affixes: EliteAffix[] = [];

  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public radius: number;

  public hp: number;
  public maxHp: number;
  public shield = 0;
  public attack: number;
  public speed: number;
  public expValue: number;
  public goldValue: number;

  public primaryColor: string;
  public secondaryColor: string;
  public eyeColor: string;
  public spriteShape: string;

  public hitFlash = 0;
  public staggerTimer = 0;
  public slowTimer = 0;
  public freezeTimer = 0;
  public burnTimer = 0;
  public burnDps = 0;

  public aiCooldown = 0.8;
  public windupTimer = 0;
  public pendingPattern: string | null = null;
  public targetX = 0;
  public targetY = 0;
  public dashTimer = 0;
  public dashVx = 0;
  public dashVy = 0;
  public flipX = false;

  // Elite / Boss phase tracking
  public phase2 = false;
  public affixTimer = 3.0;

  private monsterDef?: MonsterDef;
  private bossDef?: BossDef;

  constructor(
    defId: string,
    x: number,
    y: number,
    floor: number,
    isBoss = false,
    isElite = false
  ) {
    this.uid = `en_${enemyUid++}`;
    this.defId = defId;
    this.x = x;
    this.y = y;
    this.isBoss = isBoss;
    this.isElite = isElite;

    // Balanced progression curve: player scales with levels/gear/skills, enemies ramp smoothly
    const floorScale = 1 + (floor - 1) * 0.19;
    const atkScale = 1 + (floor - 1) * 0.12;

    if (isBoss) {
      const b = getBossById(defId);
      this.bossDef = b;
      this.name = b.name;
      this.title = b.title;
      this.radius = b.radius;
      this.maxHp = Math.round(b.hp * (1 + Math.max(0, floor - 3) * 0.08));
      this.hp = this.maxHp;
      this.attack = Math.round(b.attack * (1 + Math.max(0, floor - 3) * 0.05));
      this.speed = b.speed;
      this.expValue = Math.round(b.expValue * (1 + floor * 0.06));
      this.goldValue = Math.round(b.goldValue * (1 + floor * 0.07));
      this.primaryColor = b.primaryColor;
      this.secondaryColor = b.secondaryColor;
      this.eyeColor = b.eyeColor;
      this.spriteShape = b.biomeIndex % 2 === 0 ? 'knight' : 'golem';
      this.aiCooldown = 1.2;
    } else {
      const m = getMonsterById(defId);
      this.monsterDef = m;
      this.name = isElite ? `정예 ${m.name}` : m.name;
      this.radius = isElite ? Math.round(m.radius * 1.25) : m.radius;
      const eliteHpMult = isElite ? 2.4 : 1;
      const eliteAtkMult = isElite ? 1.35 : 1;
      this.maxHp = Math.round(m.hp * floorScale * eliteHpMult);
      this.hp = this.maxHp;
      this.attack = Math.round(m.attack * atkScale * eliteAtkMult);
      this.speed = m.speed * (isElite ? 1.08 : 1);
      this.expValue = Math.round(m.expValue * (1 + (floor - 1) * 0.1) * (isElite ? 2.6 : 1));
      this.goldValue = Math.round(m.goldValue * (1 + (floor - 1) * 0.1) * (isElite ? 2.8 : 1));
      this.primaryColor = m.primaryColor;
      this.secondaryColor = m.secondaryColor;
      this.eyeColor = m.eyeColor;
      this.spriteShape = m.spriteShape;
      this.aiCooldown = 0.5 + Math.random() * 0.6;

      if (isElite) {
        const pool: EliteAffix[] = ['regen', 'teleport', 'nova', 'summon', 'shield', 'frenzy'];
        const picked = pool[Math.floor(Math.random() * pool.length)];
        this.affixes.push(picked);
        if (floor >= 8) {
          const second = pool.filter((a) => a !== picked)[Math.floor(Math.random() * (pool.length - 1))];
          this.affixes.push(second);
        }
        if (this.affixes.includes('shield')) {
          this.shield = Math.round(this.maxHp * 0.35);
        }
      }
    }
  }

  public applyDamage(amount: number, knockVx = 0, knockVy = 0, stagger = 0.1): number {
    let remaining = Math.max(1, Math.round(amount));
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    this.hp = Math.max(0, this.hp - remaining);
    this.hitFlash = 0.11;
    if (!this.isBoss) {
      this.staggerTimer = Math.max(this.staggerTimer, stagger);
      this.vx += knockVx;
      this.vy += knockVy;
    } else {
      this.vx += knockVx * 0.15;
      this.vy += knockVy * 0.15;
    }
    return remaining;
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    room: DungeonRoom,
    telegraphs: TelegraphZone[],
    events: EnemyAttackEvent[]
  ): void {
    if (this.hp <= 0) return;

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.staggerTimer > 0) this.staggerTimer = Math.max(0, this.staggerTimer - dt);
    if (this.slowTimer > 0) this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      return;
    }

    if (this.burnTimer > 0) {
      this.burnTimer = Math.max(0, this.burnTimer - dt);
      this.hp = Math.max(1, this.hp - this.burnDps * dt);
    }

    // Knockback friction
    this.vx *= Math.exp(-10 * dt);
    this.vy *= Math.exp(-10 * dt);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.flipX = dx < 0;

    // Boss phase 2 transition
    if (this.isBoss && !this.phase2 && this.hp <= this.maxHp * 0.5) {
      this.phase2 = true;
      events.push({
        type: 'nova',
        x: this.x,
        y: this.y,
        damage: Math.round(this.attack * 0.8),
        radius: 150,
        color: this.primaryColor,
      });
    }

    // Elite affixes
    if (this.isElite) {
      if (this.affixes.includes('regen') && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.025 * dt);
      }
      this.affixTimer -= dt;
      if (this.affixTimer <= 0) {
        this.affixTimer = 4.5;
        if (this.affixes.includes('teleport') && dist > 160) {
          const ang = Math.random() * Math.PI * 2;
          this.x = Math.max(64, Math.min(room.width - 64, playerX + Math.cos(ang) * 110));
          this.y = Math.max(64, Math.min(room.height - 64, playerY + Math.sin(ang) * 110));
        } else if (this.affixes.includes('nova')) {
          events.push({
            type: 'projectile',
            x: this.x,
            y: this.y,
            angle: 0,
            speed: 220,
            damage: Math.round(this.attack * 0.8),
            count: 8,
            spread: Math.PI * 2,
            color: '#f97316',
          });
        } else if (this.affixes.includes('summon')) {
          events.push({
            type: 'summon',
            x: this.x + (Math.random() - 0.5) * 60,
            y: this.y + (Math.random() - 0.5) * 60,
            damage: 0,
            summonId: 'bat_swarm',
          });
        }
      }
    }

    // Dash motion
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.moveWithBounds(this.dashVx * dt, this.dashVy * dt, room);
      if (dist < this.radius + 18) {
        events.push({
          type: 'melee_hit',
          x: this.x,
          y: this.y,
          damage: this.attack,
        });
      }
      return;
    }

    // Windup telegraphing
    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - dt);
      if (this.windupTimer === 0 && this.pendingPattern) {
        this.executePendingPattern(playerX, playerY, events);
      }
      this.moveWithBounds(this.vx * dt, this.vy * dt, room);
      return;
    }

    if (this.staggerTimer > 0) {
      this.moveWithBounds(this.vx * dt, this.vy * dt, room);
      return;
    }

    this.aiCooldown = Math.max(0, this.aiCooldown - dt);
    let moveSpeed = this.speed * (this.slowTimer > 0 ? 0.55 : 1);
    if (this.isElite && this.affixes.includes('frenzy') && this.hp < this.maxHp * 0.5) {
      moveSpeed *= 1.35;
    }
    if (this.isBoss && this.phase2) {
      moveSpeed *= 1.2;
    }

    if (this.isBoss && this.bossDef) {
      this.updateBossAI(dt, dx, dy, dist, moveSpeed, playerX, playerY, room, telegraphs);
    } else if (this.monsterDef) {
      this.updateMonsterAI(dt, dx, dy, dist, moveSpeed, playerX, playerY, room, telegraphs);
    }
  }

  private updateMonsterAI(
    dt: number,
    dx: number,
    dy: number,
    dist: number,
    moveSpeed: number,
    playerX: number,
    playerY: number,
    room: DungeonRoom,
    telegraphs: TelegraphZone[]
  ): void {
    const m = this.monsterDef!;
    const nx = dx / dist;
    const ny = dy / dist;

    let mx = 0;
    let my = 0;

    if (m.archetype === 'ranged' || m.archetype === 'caster') {
      if (dist > m.attackRange * 0.85) {
        mx = nx * moveSpeed;
        my = ny * moveSpeed;
      } else if (dist < 130) {
        mx = -nx * moveSpeed * 0.75;
        my = -ny * moveSpeed * 0.75;
      } else {
        // Strafe
        mx = -ny * moveSpeed * 0.5;
        my = nx * moveSpeed * 0.5;
      }
    } else if (m.archetype === 'swarm') {
      const wobble = Math.sin(performance.now() * 0.008 + this.x * 0.03);
      mx = (nx - ny * wobble * 0.6) * moveSpeed;
      my = (ny + nx * wobble * 0.6) * moveSpeed;
    } else {
      if (dist > m.attackRange * 0.75) {
        mx = nx * moveSpeed;
        my = ny * moveSpeed;
      }
    }

    this.moveWithBounds((mx + this.vx) * dt, (my + this.vy) * dt, room);

    if (this.aiCooldown <= 0 && dist <= m.attackRange + 16) {
      this.targetX = playerX;
      this.targetY = playerY;
      this.windupTimer = m.windupTime;
      this.pendingPattern = m.archetype;

      if (m.archetype === 'charger' || m.archetype === 'assassin') {
        telegraphs.push({
          id: `tg_${this.uid}_${Math.random()}`,
          kind: 'line',
          x: this.x,
          y: this.y,
          tx: this.x + nx * 170,
          ty: this.y + ny * 170,
          radius: this.radius,
          timer: m.windupTime,
          duration: m.windupTime,
          damage: 0,
          color: '#ef4444',
          sourceEnemyId: this.uid,
        });
      } else if (m.archetype === 'tank' || m.archetype === 'melee') {
        telegraphs.push({
          id: `tg_${this.uid}_${Math.random()}`,
          kind: 'circle',
          x: this.x + nx * 24,
          y: this.y + ny * 24,
          radius: m.attackRange,
          timer: m.windupTime,
          duration: m.windupTime,
          damage: 0,
          color: '#f97316',
          sourceEnemyId: this.uid,
        });
      }
    }
  }

  private updateBossAI(
    dt: number,
    dx: number,
    dy: number,
    dist: number,
    moveSpeed: number,
    playerX: number,
    playerY: number,
    room: DungeonRoom,
    telegraphs: TelegraphZone[]
  ): void {
    const b = this.bossDef!;
    const nx = dx / dist;
    const ny = dy / dist;

    if (dist > 90) {
      this.moveWithBounds((nx * moveSpeed + this.vx) * dt, (ny * moveSpeed + this.vy) * dt, room);
    } else {
      this.moveWithBounds(this.vx * dt, this.vy * dt, room);
    }

    if (this.aiCooldown <= 0) {
      const pattern = b.patterns[Math.floor(Math.random() * b.patterns.length)];
      this.pendingPattern = `boss_${pattern}`;
      this.targetX = playerX;
      this.targetY = playerY;
      const windup = this.phase2 ? 0.65 : 0.85;
      this.windupTimer = windup;

      if (pattern === 'slam') {
        telegraphs.push({
          id: `tg_${this.uid}_${Math.random()}`,
          kind: 'circle',
          x: this.x,
          y: this.y,
          radius: 155,
          timer: windup,
          duration: windup,
          damage: Math.round(this.attack * 1.35),
          color: '#ef4444',
          sourceEnemyId: this.uid,
        });
      } else if (pattern === 'dash') {
        telegraphs.push({
          id: `tg_${this.uid}_${Math.random()}`,
          kind: 'line',
          x: this.x,
          y: this.y,
          tx: this.x + nx * 310,
          ty: this.y + ny * 310,
          radius: this.radius + 8,
          timer: windup,
          duration: windup,
          damage: 0,
          color: '#f97316',
          sourceEnemyId: this.uid,
        });
      } else if (pattern === 'meteor') {
        const count = this.phase2 ? 4 : 3;
        for (let i = 0; i < count; i++) {
          const mx = Math.max(80, Math.min(room.width - 80, playerX + (Math.random() - 0.5) * 200));
          const my = Math.max(80, Math.min(room.height - 80, playerY + (Math.random() - 0.5) * 200));
          telegraphs.push({
            id: `tg_${this.uid}_${i}_${Math.random()}`,
            kind: 'circle',
            x: mx,
            y: my,
            radius: 75,
            timer: windup + 0.3,
            duration: windup + 0.3,
            damage: Math.round(this.attack * 1.25),
            color: '#f59e0b',
            sourceEnemyId: this.uid,
          });
        }
      } else if (pattern === 'laser_ring') {
        telegraphs.push({
          id: `tg_${this.uid}_ring_${Math.random()}`,
          kind: 'ring',
          x: this.x,
          y: this.y,
          radius: 220,
          timer: windup,
          duration: windup,
          damage: Math.round(this.attack * 1.15),
          color: '#c084fc',
          sourceEnemyId: this.uid,
        });
      }
    }
  }

  private executePendingPattern(
    playerX: number,
    playerY: number,
    events: EnemyAttackEvent[]
  ): void {
    const p = this.pendingPattern;
    this.pendingPattern = null;

    if (this.isBoss && this.bossDef) {
      this.aiCooldown = this.phase2 ? 1.25 : 1.75;
      const angle = Math.atan2(playerY - this.y, playerX - this.x);

      if (p === 'boss_slam') {
        events.push({
          type: 'nova',
          x: this.x,
          y: this.y,
          damage: Math.round(this.attack * 1.35),
          radius: 155,
          color: this.primaryColor,
        });
      } else if (p === 'boss_barrage') {
        const count = this.phase2 ? 12 : 8;
        events.push({
          type: 'projectile',
          x: this.x,
          y: this.y,
          angle,
          speed: 260,
          damage: this.attack,
          count,
          spread: Math.PI * 1.2,
          color: this.eyeColor,
        });
      } else if (p === 'boss_dash') {
        const da = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        this.dashVx = Math.cos(da) * 560;
        this.dashVy = Math.sin(da) * 560;
        this.dashTimer = 0.42;
      } else if (p === 'boss_summon') {
        const count = this.phase2 ? 3 : 2;
        for (let i = 0; i < count; i++) {
          events.push({
            type: 'summon',
            x: this.x + (Math.random() - 0.5) * 120,
            y: this.y + (Math.random() - 0.5) * 120,
            damage: 0,
            summonId: i % 2 === 0 ? 'skeleton_warrior' : 'bat_swarm',
          });
        }
      } else if (p === 'boss_laser_ring') {
        events.push({
          type: 'projectile',
          x: this.x,
          y: this.y,
          angle: 0,
          speed: 230,
          damage: this.attack,
          count: this.phase2 ? 16 : 12,
          spread: Math.PI * 2,
          color: '#c084fc',
        });
      }
      return;
    }

    if (this.monsterDef) {
      const m = this.monsterDef;
      this.aiCooldown = m.attackCooldown * (this.isElite && this.affixes.includes('frenzy') ? 0.78 : 1);
      const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);

      if (p === 'ranged') {
        events.push({
          type: 'projectile',
          x: this.x,
          y: this.y,
          angle,
          speed: 280,
          damage: this.attack,
          count: 1,
          spread: 0,
          color: this.eyeColor,
        });
      } else if (p === 'caster') {
        events.push({
          type: 'projectile',
          x: this.x,
          y: this.y,
          angle,
          speed: 230,
          damage: this.attack,
          count: 3,
          spread: 0.55,
          color: this.primaryColor,
        });
      } else if (p === 'charger' || p === 'assassin') {
        this.dashVx = Math.cos(angle) * 430;
        this.dashVy = Math.sin(angle) * 430;
        this.dashTimer = 0.28;
      } else if (p === 'tank') {
        events.push({
          type: 'nova',
          x: this.x,
          y: this.y,
          damage: Math.round(this.attack * 1.15),
          radius: m.attackRange + 18,
          color: '#f97316',
        });
      } else {
        events.push({
          type: 'melee_hit',
          x: this.x,
          y: this.y,
          damage: this.attack,
          radius: m.attackRange + 14,
        });
      }
    }
  }

  private moveWithBounds(dx: number, dy: number, room: DungeonRoom): void {
    const wt = 34 + this.radius;
    this.x = Math.max(wt, Math.min(room.width - wt, this.x + dx));
    this.y = Math.max(wt, Math.min(room.height - wt, this.y + dy));

    for (const obs of room.obstacles) {
      const closestX = Math.max(obs.x, Math.min(this.x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(this.y, obs.y + obs.h));
      const ox = this.x - closestX;
      const oy = this.y - closestY;
      const d = Math.hypot(ox, oy);
      if (d < this.radius && d > 0.001) {
        const push = this.radius - d;
        this.x += (ox / d) * push;
        this.y += (oy / d) * push;
      }
    }
  }
}
