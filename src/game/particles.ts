/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle } from './types.ts';
import { SpriteAtlas } from './sprites.ts';

export class ParticleSystem {
  public particles: Particle[] = [];
  private nextId: number = 1;

  public clear() {
    this.particles = [];
  }

  public add(particle: Omit<Particle, 'id'>): Particle {
    const created: Particle = {
      id: this.nextId++,
      ...particle,
    };
    this.particles.push(created);
    return created;
  }

  public update() {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      if (p.rotation !== undefined && p.rotSpeed !== undefined) {
        p.rotation += p.rotSpeed;
      }

      if (p.gravity !== undefined) {
        p.vy += p.gravity;
      } else if (p.type === 'brick_piece') {
        p.vy += 0.38;
      } else if (p.type === 'coin_glint') {
        p.vy += 0.08;
      } else if (p.type === 'smoke' || p.type === 'enemy_poof') {
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else if (p.type === 'dust') {
        p.vx *= 0.88;
        p.vy *= 0.9;
      } else if (p.type === 'bubble') {
        p.x += Math.sin(p.life * 0.22) * 0.2;
        if (p.y <= 26) {
          p.life = p.maxLife;
        }
      } else if (p.type === 'heart') {
        p.x += Math.sin(p.life * 0.18) * 0.22;
        p.vy *= 0.985;
      }
    }

    this.particles = this.particles.filter(p => p.life < p.maxLife);
  }

  // --- EFFECT EMITTERS ---

  /** Classic 4-shard tumbling brick break + expanding dust puffs */
  public emitBrickBreak(x: number, y: number, theme: 'overworld' | 'underground' | 'castle' | 'underwater' = 'overworld') {
    const velocities = [
      { vx: -2.3, vy: -5.3, rot: -0.18 },
      { vx: 2.3, vy: -5.3, rot: 0.18 },
      { vx: -1.45, vy: -3.2, rot: -0.12 },
      { vx: 1.45, vy: -3.2, rot: 0.12 },
    ];

    velocities.forEach(v => {
      this.add({
        type: 'brick_piece',
        x: x + 4,
        y: y + 4,
        vx: v.vx,
        vy: v.vy,
        life: 0,
        maxLife: 44,
        rotation: 0,
        rotSpeed: v.rot,
        gravity: 0.38,
      });
    });

    const dustColor = theme === 'underground' ? '#70b8c8' : '#e09060';
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
      const speed = 1.1 + (i % 2) * 0.55;
      this.add({
        type: 'dust',
        x: x + 6,
        y: y + 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.35,
        life: 0,
        maxLife: 18 + (i % 3) * 3,
        size: 3 + (i % 2),
        color: i % 2 === 0 ? '#f8f8f8' : dustColor,
      });
    }
  }

  /** Glittering sparkles on coin pickup or ? block coin pop */
  public emitCoinSparkles(x: number, y: number) {
    const colors = ['#ffffff', '#fce078', '#fc9838', '#f8d838'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() * 0.35 - 0.175);
      const speed = 1.4 + Math.random() * 1.7;
      this.add({
        type: 'coin_glint',
        x: x + 6,
        y: y + 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        life: 0,
        maxLife: 24 + Math.floor(Math.random() * 10),
        color: colors[i % colors.length],
        size: 2 + (i % 2),
        gravity: 0.12,
      });
    }

    // Two crisp upward glints at the coin center
    for (let j = 0; j < 2; j++) {
      this.add({
        type: 'sparkle',
        x: x + 4 + j * 6,
        y: y + 3,
        vx: (j === 0 ? -0.4 : 0.4),
        vy: -1.4,
        life: 0,
        maxLife: 16,
        color: '#ffffff',
        size: 2,
      });
    }
  }

  /** Jumping dust cloud kicked up from under the player's feet */
  public emitJumpDust(centerX: number, footY: number, moveVx: number) {
    const pushBias = Math.max(-0.8, Math.min(0.8, -moveVx * 0.25));
    const puffs = [
      { ox: -5, vx: -1.1 + pushBias, vy: -0.45, size: 3, maxLife: 15 },
      { ox: 5, vx: 1.1 + pushBias, vy: -0.45, size: 3, maxLife: 15 },
      { ox: -2, vx: -0.5 + pushBias * 1.2, vy: -0.85, size: 4, maxLife: 18 },
      { ox: 2, vx: 0.5 + pushBias * 1.2, vy: -0.75, size: 2, maxLife: 14 },
    ];

    puffs.forEach((pf, idx) => {
      this.add({
        type: 'dust',
        x: centerX + pf.ox,
        y: footY - 2,
        vx: pf.vx,
        vy: pf.vy,
        life: 0,
        maxLife: pf.maxLife,
        size: pf.size,
        color: idx % 2 === 0 ? '#f4f4f4' : '#d8d0c8',
      });
    });
  }

  /** Landing dust cloud (subtle on normal hops, dramatic burst on high falls/statue slams) */
  public emitLandingDust(centerX: number, footY: number, heavy: boolean = false) {
    const count = heavy ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const spread = heavy ? 1.0 + Math.floor(i / 2) * 0.55 : 0.8 + i * 0.25;
      this.add({
        type: 'dust',
        x: centerX + side * (heavy ? 6 : 4),
        y: footY - 3,
        vx: side * spread,
        vy: heavy ? -0.55 - (i % 2) * 0.35 : -0.35,
        life: 0,
        maxLife: heavy ? 18 : 13,
        size: heavy ? 4 : 3,
        color: i % 2 === 0 ? '#ffffff' : '#d8d0c8',
      });
    }
  }

  /** Skid braking dust puff kicked up while reversing direction at speed */
  public emitSkidDust(footX: number, footY: number, moveVx: number) {
    const dir = moveVx >= 0 ? 1 : -1;
    this.add({
      type: 'dust',
      x: footX,
      y: footY - 3,
      vx: dir * 0.65,
      vy: -0.45,
      life: 0,
      maxLife: 12,
      size: 3,
      color: '#e8e4dc',
    });
  }

  /** Colorful 8-way sparkles on collecting a power-up */
  public emitPowerUpSparkles(x: number, y: number) {
    const colors = ['#ffffff', '#fc5454', '#fce078', '#5c94fc'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.add({
        type: 'sparkle',
        x: x + 8,
        y: y + 16,
        vx: Math.cos(angle) * 1.6,
        vy: Math.sin(angle) * 1.6 - 0.5,
        life: 0,
        maxLife: 26,
        color: colors[i % colors.length],
        size: 3,
      });
    }
  }

  /** Impact stars and smoke poofs on defeating an enemy */
  public emitEnemyDefeat(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const speed = 1.8 + Math.random() * 1.6;
      this.add({
        type: 'star_burst',
        x: x + 8,
        y: y + 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 0,
        maxLife: 18 + Math.floor(Math.random() * 8),
        color: i % 2 === 0 ? '#fffa50' : '#ffffff',
        size: 3,
        rotation: 0,
        rotSpeed: 0.2,
      });
    }

    for (let i = 0; i < 4; i++) {
      this.add({
        type: 'smoke',
        x: x + 4 + (i % 2) * 8,
        y: y + 4 + Math.floor(i / 2) * 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.6 - Math.random() * 0.8,
        life: 0,
        maxLife: 20,
        size: 4 + Math.floor(Math.random() * 3),
      });
    }
  }

  public emitHeart(x: number, y: number) {
    this.add({
      type: 'heart',
      x,
      y,
      vx: 0,
      vy: -0.95,
      life: 0,
      maxLife: 46,
      color: '#ff4d94',
    });
  }

  public emitBubble(x: number, y: number, size: number = 3, vy: number = -0.6) {
    this.add({
      type: 'bubble',
      x,
      y,
      vx: 0,
      vy,
      life: 0,
      maxLife: 85,
      size,
    });
  }

  public emitScoreText(
    text: string,
    x: number,
    y: number,
    options?: { maxLife?: number; vy?: number; color?: string }
  ) {
    this.add({
      type: 'score_text',
      text,
      x,
      y,
      vx: 0,
      vy: options?.vy ?? -0.8,
      life: 0,
      maxLife: options?.maxLife ?? 30,
      color: options?.color,
    });
  }

  // --- RENDERING ---

  public render(ctx: CanvasRenderingContext2D, cameraX: number, nesWidth: number, atlas: SpriteAtlas) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const px = p.x - cameraX;
      if (px < -30 || px > nesWidth + 30) continue;

      if (p.type === 'brick_piece') {
        if (p.rotation !== undefined) {
          ctx.save();
          ctx.translate(px + 4, p.y + 4);
          ctx.rotate(p.rotation);
          ctx.drawImage(atlas.brickDebris, -4, -4);
          ctx.restore();
        } else {
          ctx.drawImage(atlas.brickDebris, px, p.y);
        }
      } else if (p.type === 'coin_glint') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color || '#fce078';
        const sz = p.size || 2;
        ctx.fillRect(px - sz, p.y, sz * 2 + 1, 1);
        ctx.fillRect(px, p.y - sz, 1, sz * 2 + 1);
        ctx.fillRect(px - 1, p.y - 1, 3, 3);
        ctx.restore();
      } else if (p.type === 'star_burst') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(px, p.y);
        if (p.rotation !== undefined) {
          ctx.rotate(p.rotation);
        }
        ctx.fillStyle = p.color || '#fffa50';
        const sz = p.size || 3;
        ctx.fillRect(-sz * 1.8, -1, sz * 3.6, 2);
        ctx.fillRect(-1, -sz * 1.8, 2, sz * 3.6);
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      } else if (p.type === 'dust') {
        const progress = p.life / p.maxLife;
        const alpha = Math.max(0, 1 - progress);
        const sz = Math.max(2, (p.size || 3) + progress * 2.5);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = p.color || '#e8e4dc';
        ctx.fillRect(Math.round(px - sz / 2), Math.round(p.y - sz / 2), Math.round(sz), Math.round(sz));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(px - sz / 4), Math.round(p.y - sz / 4), Math.max(1, Math.round(sz / 2)), Math.max(1, Math.round(sz / 2)));
        ctx.restore();
      } else if (p.type === 'smoke' || p.type === 'enemy_poof') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        const sz = (p.size || 4) + (p.life / p.maxLife) * 3;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = p.color || '#f8f8f8';
        ctx.fillRect(px - sz / 2, p.y - sz / 2, sz, sz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - sz / 4, p.y - sz / 4, sz / 2, sz / 2);
        ctx.restore();
      } else if (p.type === 'sparkle') {
        const alpha = Math.max(0, 1 - (p.life / p.maxLife) * 0.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color || '#fce078';
        const sz = p.size || 4;
        ctx.fillRect(px, p.y, sz, sz);
        ctx.restore();
      } else if (p.type === 'bubble') {
        const sz = p.size || 3;
        ctx.fillStyle = '#88e8ff';
        ctx.fillRect(px, p.y, sz, sz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, p.y, 1, 1);
      } else if (p.type === 'heart') {
        const alpha = p.life > p.maxLife * 0.65
          ? Math.max(0, 1 - (p.life - p.maxLife * 0.65) / (p.maxLife * 0.35))
          : 1;
        const hx = Math.round(px) - 4;
        const hy = Math.round(p.y) - 4;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#4a0020';
        ctx.fillRect(hx + 1, hy - 1, 2, 1);
        ctx.fillRect(hx + 6, hy - 1, 2, 1);
        ctx.fillRect(hx, hy, 4, 1);
        ctx.fillRect(hx + 5, hy, 4, 1);
        ctx.fillRect(hx - 1, hy + 1, 11, 3);
        ctx.fillRect(hx, hy + 4, 9, 1);
        ctx.fillRect(hx + 1, hy + 5, 7, 1);
        ctx.fillRect(hx + 2, hy + 6, 5, 1);
        ctx.fillRect(hx + 3, hy + 7, 3, 1);
        ctx.fillRect(hx + 4, hy + 8, 1, 1);

        ctx.fillStyle = p.color || '#ff4d94';
        ctx.fillRect(hx + 1, hy, 2, 1);
        ctx.fillRect(hx + 6, hy, 2, 1);
        ctx.fillRect(hx, hy + 1, 4, 1);
        ctx.fillRect(hx + 5, hy + 1, 4, 1);
        ctx.fillRect(hx, hy + 2, 9, 2);
        ctx.fillRect(hx + 1, hy + 4, 7, 1);
        ctx.fillRect(hx + 2, hy + 5, 5, 1);
        ctx.fillRect(hx + 3, hy + 6, 3, 1);
        ctx.fillRect(hx + 4, hy + 7, 1, 1);

        ctx.fillStyle = '#ffd6eb';
        ctx.fillRect(hx + 1, hy + 1, 1, 2);
        ctx.restore();
      } else if (p.type === 'score_text' && p.text) {
        const alpha = Math.max(0, 1 - (p.life / p.maxLife) * 0.5);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText(p.text, px + 1, p.y + 1);
        ctx.fillStyle = p.color || '#ffffff';
        ctx.fillText(p.text, px, p.y);
        ctx.restore();
      }
    }
  }
}
