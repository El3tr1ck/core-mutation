export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export enum GameState {
  MENU,
  PLAYING,
  UPGRADE, // Card selection
  GAMEOVER,
  VICTORY,
  PAUSED
}

export enum PlatformType {
  SOLID,
  PASSTHROUGH,
  MOVING,
  BREAKABLE,
}

export enum Tag {
  MELEE = 'Melee',
  MAGIC = 'Magic',
  TECH = 'Tech',
  BLOOD = 'Blood',
  CHAOS = 'Chaos',
  MOBILITY = 'Mobility',
  DEFENSE = 'Defense',
  ELEMENTAL = 'Elemental',
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
  maxEnergy: number;
  energy: number;
  speed: number;
  jumpForce: number;
  damage: number;
  attackRate: number;
  critChance: number;
  critMultiplier: number;
  lifesteal: number;
  dashSpeed: number;
  dashCooldown: number;
  gravityModifier: number;
  multishot: number;
  pierce: number;
}

export type ModifierCategory = 'status' | 'ability' | 'world';

export interface AbilityDef {
  id: string;
  name: string;
  namePt?: string;
  cooldown: number;
  currentCooldown: number;
  execute: (engine: any) => void;
  color?: string;
}

export interface WorldEventDef {
  id: string;
  name: string;
  namePt?: string;
  duration: number; // 0 for instant
  currentDuration?: number;
  onStart?: (engine: any) => void;
  onTick?: (engine: any, dt: number) => void;
  onEnd?: (engine: any) => void;
}

export interface Card {
  id: string;
  name: string;
  namePt?: string;
  description: string[];
  descriptionPt?: string[];
  category: ModifierCategory;
  color: string;
  apply?: (stats: PlayerStats, engine: any) => void;
  ability?: AbilityDef;
  worldEvent?: WorldEventDef;
  components?: any; 
}

export interface BuildClass {
  name: string;
  description: string;
  detect: (tags: Partial<Record<Tag, number>>) => boolean;
  color: string;
  particleEffect?: string;
}
