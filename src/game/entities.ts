import { PlatformType, Rect, Vector2 } from './types';

// Utility for ID generation
let nextId = 1;
function genId() { return (nextId++).toString(); }

export class Entity implements Rect {
  id: string = genId();
  x: number = 0;
  y: number = 0;
  w: number = 0;
  h: number = 0;
  vx: number = 0;
  vy: number = 0;
  color: string = '#fff';
  active: boolean = true;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

export class Player extends Entity {
  facingRight: boolean = true;
  isGrounded: boolean = false;
  dashTimer: number = 0;
  dashCooldownTimer: number = 0;
  attackCooldownTimer: number = 0;
  invulnTimer: number = 0;
  flashTimer: number = 0;
  isDashing: boolean = false;
  shieldTimer: number = 0;
  isShieldActive: boolean = false;
  chargeTimer: number = 0;
  manaRegenTimer: number = 0;
  
  // Computed aesthetic stats
  glowColor: string = 'rgba(0, 210, 255, 0.5)';
  
  constructor(x: number, y: number) {
    super(x, y, 24, 24);
    this.color = '#00d2ff'; // Default cyan vibe
  }
}

export class Enemy extends Entity {
  maxHp: number;
  hp: number;
  damage: number;
  speed: number;
  type: string;
  flashTimer: number = 0; // for hit feedback
  active: boolean = true;
  fireTimer: number = 0;
  grounded: boolean = false;
  stuckTimer: number = 0;
  lastX: number = 0;
  lastY: number = 0;

  constructor(x: number, y: number, type: string, hp: number, dmg: number, speed: number, customColor?: string) {
    super(x, y, type === 'boss' ? 100 : (type === 'shooter' ? 35 : 30), type === 'boss' ? 100 : (type === 'shooter' ? 45 : 30));
    this.type = type;
    this.maxHp = hp;
    this.hp = hp;
    this.damage = dmg;
    this.speed = speed;
    
    if (type === 'crawler') this.color = '#ef4444';
    else if (type === 'flyer') this.color = '#f59e0b';
    else if (type === 'boss') this.color = '#6d28d9';
    else if (type === 'shooter') this.color = '#a855f7';
    else if (type === 'sniper') this.color = '#14b8a6'; // teal
    
    if (customColor) {
      this.color = customColor;
    }
  }
}

export class Platform extends Entity {
  type: PlatformType;
  
  constructor(x: number, y: number, w: number, h: number, type: PlatformType = PlatformType.SOLID) {
    super(x, y, w, h);
    this.type = type;
    this.color = type === PlatformType.PASSTHROUGH ? '#334155' : '#1e293b';
  }
}

export class Projectile extends Entity {
  damage: number;
  pierce: number = 0;
  life: number = 2.0; // seconds before vanishing
  isPlayer: boolean;
  isCharged: boolean;
  isHoming: boolean = false;
  isParryable: boolean = false;
  homingTarget?: Entity;

  constructor(x: number, y: number, vx: number, vy: number, damage: number, color: string, isPlayer: boolean, size: number = 8, isCharged: boolean = false) {
    super(x - size/2, y - size/2, size, size);
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.isPlayer = isPlayer;
    this.isCharged = isCharged;
    this.color = color;
  }
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  friction: number = 0.95;

  constructor(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(this.friction, dt * 60);
    this.vy *= Math.pow(this.friction, dt * 60);
    this.life -= dt;
  }
}

export class DroppedItem extends Entity {
  type: string;
  constructor(x: number, y: number, type: string) {
    super(x, y, 16, 16);
    this.type = type;
    this.color = type === 'heart' ? '#ef4444' : '#60a5fa';
  }
}

export class EnergyBox extends Entity {
  hp: number = 30;
  flashTimer: number = 0;
  constructor(x: number, y: number) {
    super(x, y, 32, 32);
    this.color = '#eab308'; // yellow
  }
}
