import { Enemy, TelegraphZone } from './Enemy';
import { DungeonRoom } from './types';

export interface Projectile {
  id: string;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  pierce: number;
  hitIds: Set<string>;
  color: string;
  accentColor?: string;
  explodeRadius?: number;
  slowEnemy?: boolean;
  homing?: boolean;
  isSwordWave?: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface RingEffect {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Afterimage {
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface LightningBolt {
  points: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
}

export class CombatSystem {
  public projectiles: Projectile[] = [];
  public floatingTexts: FloatingText[] = [];
  public slashes: SlashEffect[] = [];
  public rings: RingEffect[] = [];
  public afterimages: Afterimage[] = [];
  public bolts: LightningBolt[] = [];
  public telegraphs: TelegraphZone[] = [];
  public hitstopTimer = 0;

  private particlePool: Particle[] = [];
  private readonly maxParticles = 320;

  constructor() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        color: '#ffffff',
        life: 0,
        maxLife: 1,
      });
    }
  }

  public clearRoomEffects(): void {
    this.projectiles = [];
    this.telegraphs = [];
    this.slashes = [];
    this.rings = [];
    this.bolts = [];
    this.afterimages = [];
  }

  public triggerHitstop(duration: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count = 10,
    speed = 160,
    size = 4,
    life = 0.35
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        const ang = Math.random() * Math.PI * 2;
        const spd = speed * (0.4 + Math.random() * 0.8);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.size = size * (0.7 + Math.random() * 0.6);
        p.color = color;
        p.life = life * (0.7 + Math.random() * 0.5);
        p.maxLife = p.life;
        spawned++;
      }
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    isCrit = false
  ): void {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y - 16,
      vy: isCrit ? -68 : -48,
      text,
      color,
      scale: isCrit ? 1.35 : 1.0,
      life: isCrit ? 0.85 : 0.65,
      maxLife: isCrit ? 0.85 : 0.65,
    });
  }

  public addSlash(x: number, y: number, angle: number, arc: number, radius: number, color: string): void {
    this.slashes.push({
      x,
      y,
      angle,
      arc,
      radius,
      color,
      life: 0.16,
      maxLife: 0.16,
    });
  }

  public addRing(x: number, y: number, maxRadius: number, color: string, duration = 0.28): void {
    this.rings.push({
      x,
      y,
      maxRadius,
      color,
      life: duration,
      maxLife: duration,
    });
  }

  public addAfterimage(x: number, y: number, color: string): void {
    this.afterimages.push({
      x,
      y,
      color,
      life: 0.22,
      maxLife: 0.22,
    });
  }

  public addBolt(x1: number, y1: number, x2: number, y2: number, color = '#facc15'): void {
    const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    const segments = 5;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 26,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 26,
      });
    }
    pts.push({ x: x2, y: y2 });
    this.bolts.push({ points: pts, color, life: 0.18, maxLife: 0.18 });
  }

  public updateVisualEffects(dt: number, room: DungeonRoom, enemies: Enemy[]): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-5 * dt);
      p.vy *= Math.exp(-5 * dt);
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y += f.vy * dt;
      f.vy *= Math.exp(-3 * dt);
      f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }

    // Update projectile positions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;

      if (pr.homing && pr.fromPlayer && enemies.length > 0) {
        let best: Enemy | null = null;
        let bestD = 260;
        for (const e of enemies) {
          if (e.hp <= 0 || pr.hitIds.has(e.uid)) continue;
          const d = Math.hypot(e.x - pr.x, e.y - pr.y);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          const spd = Math.hypot(pr.vx, pr.vy) || 350;
          const targetAng = Math.atan2(best.y - pr.y, best.x - pr.x);
          const curAng = Math.atan2(pr.vy, pr.vx);
          let diff = targetAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAng = curAng + diff * Math.min(1, dt * 6);
          pr.vx = Math.cos(nextAng) * spd;
          pr.vy = Math.sin(nextAng) * spd;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      const wt = 30;
      let hitWall =
        pr.x < wt || pr.x > room.width - wt || pr.y < wt || pr.y > room.height - wt;
      if (!hitWall && !pr.isSwordWave) {
        for (const obs of room.obstacles) {
          if (
            pr.x + pr.radius > obs.x &&
            pr.x - pr.radius < obs.x + obs.w &&
            pr.y + pr.radius > obs.y &&
            pr.y - pr.radius < obs.y + obs.h
          ) {
            hitWall = true;
            break;
          }
        }
      }

      if (hitWall || pr.life <= 0) {
        if (pr.explodeRadius) {
          this.addRing(pr.x, pr.y, pr.explodeRadius, pr.color, 0.25);
          this.spawnBurst(pr.x, pr.y, pr.color, 12, 180, 4);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, showDamageNumbers: boolean): void {
    // Telegraphs on ground
    for (const tg of this.telegraphs) {
      const progress = 1 - tg.timer / Math.max(0.01, tg.duration);
      ctx.save();
      if (tg.kind === 'circle' || tg.kind === 'ring') {
        ctx.strokeStyle = tg.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = tg.color;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, tg.radius * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (tg.kind === 'line' && tg.tx !== undefined && tg.ty !== undefined) {
        ctx.strokeStyle = tg.color;
        ctx.lineWidth = tg.radius * 1.4;
        ctx.globalAlpha = 0.22 + progress * 0.2;
        ctx.beginPath();
        ctx.moveTo(tg.x, tg.y);
        ctx.lineTo(tg.tx, tg.ty);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Afterimages
    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = (a.life / a.maxLife) * 0.45;
      ctx.fillStyle = a.color;
      ctx.fillRect(a.x - 10, a.y - 14, 20, 28);
      ctx.restore();
    }

    // Rings
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxRadius * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Slashes
    for (const s of this.slashes) {
      const alpha = s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 10 * alpha + 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.stroke();
      ctx.restore();
    }

    // Lightning bolts
    for (const b of this.bolts) {
      ctx.save();
      ctx.globalAlpha = b.life / b.maxLife;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      b.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Projectiles
    for (const pr of this.projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      const ang = Math.atan2(pr.vy, pr.vx);
      ctx.rotate(ang);
      if (pr.isSwordWave) {
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(-6, 0, pr.radius, -1.1, 1.1);
        ctx.stroke();
      } else {
        ctx.fillStyle = pr.color;
        ctx.fillRect(-pr.radius, -pr.radius * 0.6, pr.radius * 2, pr.radius * 1.2);
        ctx.fillStyle = pr.accentColor || '#ffffff';
        ctx.fillRect(-pr.radius * 0.4, -pr.radius * 0.3, pr.radius * 0.9, pr.radius * 0.6);
      }
      ctx.restore();
    }

    // Pooled particles
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }

    // Floating damage numbers
    if (showDamageNumbers) {
      ctx.save();
      ctx.textAlign = 'center';
      for (const f of this.floatingTexts) {
        ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 1.4);
        ctx.font = `bold ${Math.round(13 * f.scale)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#000000';
        ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    }
  }
}
