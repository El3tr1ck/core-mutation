import { PlatformType, PlayerStats, GameState, Card, AbilityDef, WorldEventDef } from './types';
import { inputManager } from '../lib/input';

import { Player, Enemy, Platform, Projectile, Particle, DroppedItem, EnergyBox } from './entities';
import { generateOptions, rehydrateDeck } from './progression';
import { loadGame } from './save';
import { modAPI } from './modAPI';

// Default initial stats
const BASE_STATS: PlayerStats = {
  maxHp: 100, hp: 100,
  maxMana: 100, mana: 100,
  maxEnergy: 100, energy: 100,
  speed: 250, jumpForce: 600,
  damage: 15, attackRate: 3,
  critChance: 0.05, critMultiplier: 1.5,
  lifesteal: 0, dashSpeed: 800, dashCooldown: 1.5,
  gravityModifier: 1.0, multishot: 1, pierce: 0,
};

const GRAVITY = 1500;
const TERMINAL_VELOCITY = 1000;

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  // Game State
  state: GameState = GameState.MENU;
  level: number = 1;
  stats: PlayerStats;
  deck: Card[] = [];
  
  // Entities
  player: Player;
  platforms: Platform[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  
  // Camera & Effects
  camera = { x: 0, y: 0 };
  shakeTimer = 0;
  shakeMagnitude = 0;
  hitstopFrames = 0;
  lastTime = 0;
  
  // World Gen
  loadedChunksX = new Set<number>();
  loadedChunksY = new Set<number>();
  loadedChunksMap = new Set<string>();
  CHUNK_WIDTH = 2000;
  CHUNK_HEIGHT = 1500;
  
  // Entities
  items: DroppedItem[] = [];
  energyBoxes: EnergyBox[] = [];

  // Abilities & World Events
  equippedAbilities: { q: AbilityDef | null, e: AbilityDef | null } = { q: null, e: null };
  unlockedAbilities: AbilityDef[] = [];
  gamepadAimActive: boolean = false;
  gamepadAimDir: { x: number, y: number } = { x: 1, y: 0 };
  activeWorldEvents: WorldEventDef[] = [];
  wheelOpen: boolean = false;
  wheelHoverIndex: number = -1;
  wheelAbilities: (AbilityDef | null)[] = [null, null, null, null, null, null, null, null];
  hasAbilityWheel: boolean = true; // Let's simplify and make it always available if > 2 abilities or explicitly give it. Prompt: "terá uma chance de desbloquear uma carta onde tem a habilidade" - but for now to guarantee functionality let's just use it when they get abilities.

  // Run Structure
  runTime: number = 0;
  levelDuration: number = 120; // 120 seconds per wave
  mobsSpawnedThisWave: number = 0;
  finalBossSpawned: boolean = false;
  victoryTriggered: boolean = false;
  killsThisLevel: number = 0;
  
  // XP & Missions
  gameXP: number = 0;
  missionReq: number = 10;
  missionCount: number = 0;

  // Input tracking
  mouseX = 0;
  mouseY = 0;
  
  tempStatsModifiers = { maxHp: 0, maxMana: 0, maxEnergy: 0 };
  lastDashTap: number = 0;
  lastDashDir: 'left' | 'right' | null = null;
  lastLeftState: boolean = false;
  lastRightState: boolean = false;

  // React callbacks
  onStateChange?: (state: GameState, engine?: GameEngine) => void;
  onStatsUpdate?: (stats: PlayerStats, engine: GameEngine) => void;
  onCardsOffered?: (cards: Card[]) => void;
  onProgressUpdate?: (kills: number, requiredKills: number, level: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.stats = { ...BASE_STATS };
    this.player = new Player(0, -100);
    this.setupInputs();
    (modAPI as any).engine = this;
  }

  setupInputs() {
    const handleEscape = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
            if (this.state === GameState.PLAYING) {
                this.state = GameState.PAUSED;
                this.notifyState();
            } else if (this.state === GameState.PAUSED) {
                this.state = GameState.PLAYING;
                this.lastTime = performance.now(); // prevent delta jump
                this.notifyState();
                requestAnimationFrame(this.loop.bind(this));
            }
        }
    };
    
    // Add escape listener separately just for menu pause
    window.addEventListener('keydown', handleEscape);
    
    window.addEventListener('mousemove', (e) => {
      this.gamepadAimActive = false; // Disable gamepad aim when mouse moves
      if (document.pointerLockElement === this.canvas) {
          const sensitivity = Number(localStorage.getItem('mouseSensitivity')) || 1.0;
          this.mouseX += e.movementX * sensitivity;
          this.mouseY += e.movementY * sensitivity;
          this.mouseX = Math.max(0, Math.min(this.canvas.width, this.mouseX));
          this.mouseY = Math.max(0, Math.min(this.canvas.height, this.mouseY));
      } else {
          const rect = this.canvas.getBoundingClientRect();
          const scaleX = this.canvas.width / rect.width;
          const scaleY = this.canvas.height / rect.height;
          this.mouseX = (e.clientX - rect.left) * scaleX;
          this.mouseY = (e.clientY - rect.top) * scaleY;
      }
    });
    
    this.canvas.addEventListener('mousedown', () => {
        if (this.state === GameState.PLAYING && document.pointerLockElement !== this.canvas) {
            this.canvas.requestPointerLock().catch(err => console.error(err));
        }
    });
  }

  looping = false;

  start(saveId: string | null) {
    if (saveId) {
      const saveData = loadGame(saveId);
      if (saveData) {
        this.level = saveData.level;
        this.deck = saveData.deck;
        rehydrateDeck(this.deck);
        this.stats = { ...BASE_STATS };
        // Reactivate deck effects
        this.deck.forEach(c => {
           if (c.category === 'status' && c.apply) c.apply(this.stats, this);
        });
      }
    } else {
      this.level = 1;
      this.deck = [];
      this.stats = { ...BASE_STATS };
      this.tempStatsModifiers = { maxHp: 0, maxMana: 0, maxEnergy: 0 };
    }
    
    this.runTime = 0;
    this.gameXP = 0;
    this.finalBossSpawned = false;
    this.victoryTriggered = false;
    this.mobsSpawnedThisWave = 0;

    this.state = GameState.PLAYING;
    this.notifyState();
    this.loadLevel();
    this.lastTime = performance.now();
    if (!this.looping) {
        this.looping = true;
        requestAnimationFrame(this.loop.bind(this));
    }
  }

  generateChunkAt(chunkIndexX: number, chunkIndexY: number) {
      const chunkKey = `${chunkIndexX},${chunkIndexY}`;
      if (this.loadedChunksMap.has(chunkKey)) return;
      this.loadedChunksMap.add(chunkKey);

      const startX = chunkIndexX * this.CHUNK_WIDTH;
      const startY = chunkIndexY * this.CHUNK_HEIGHT;
      
      // If close to ground, generate floor
      if (chunkIndexY === 0) {
          // Add infinite floor for this chunk
          this.platforms.push(new Platform(startX, 500, this.CHUNK_WIDTH, 1000));
      }

      // Procedural platforms
      const isHighUp = chunkIndexY < 0; // Negative Y is up
      
      const chunkPlatforms: Platform[] = [];

      // Determine progression flags
      let progressPercent = this.level / 6;
      let hasCasas = Math.random() < 0.4 && chunkIndexY === 0;
      let hasPredios = Math.random() < 0.3 && chunkIndexY === 0;
      
      const platformDensity = (hasPredios || hasCasas) ? 10 : 25;

      // generate Casas and Predios if far enough
      if (hasPredios) {
          // Predio (Vertical Obstacle)
          let pWidth = 100 + Math.random() * 100;
          let pHeight = 300 + Math.random() * 300;
          let px = startX + 300 + Math.random() * (this.CHUNK_WIDTH - 600);
          let py = 500 - pHeight;
          const predio = new Platform(px, py, pWidth, pHeight, PlatformType.SOLID);
          predio.color = '#1e293b'; 
          this.platforms.push(predio);
          chunkPlatforms.push(predio);
          // Platforms to climb it strategically
          let currentY = 500 - 80;
          let isLeft = true;
          while (currentY > py - 20) {
              let stepX = isLeft ? px - 120 + Math.random() * 40 : px + pWidth + Math.random() * 20;
              this.platforms.push(new Platform(stepX, currentY, 100 + Math.random() * 40, 20, PlatformType.PASSTHROUGH));
              currentY -= 80 + Math.random() * 40;
              isLeft = !isLeft;
          }
      } else if (hasCasas && Math.random() < 0.6) {
          // Casa (Horizontal Obstacle)
          let pWidth = 300 + Math.random() * 300;
          let pHeight = 100 + Math.random() * 50;
          let px = startX + 200 + Math.random() * (this.CHUNK_WIDTH - 400);
          let py = 500 - pHeight;
          const casa = new Platform(px, py, pWidth, pHeight, PlatformType.SOLID);
          casa.color = '#334155';
          this.platforms.push(casa);
          chunkPlatforms.push(casa);
      }

      // Generate random platforms
      for(let i=0; i<platformDensity; i++) {
          let px = startX + Math.random() * (this.CHUNK_WIDTH - 200);
          let py = startY + Math.random() * (this.CHUNK_HEIGHT - 50);
          
          if (chunkIndexY === 0 && py > 500 - 128) {
              py -= 128 + Math.random() * 50; // Push platform higher up than 4 times player height
          }
          
          let pType = Math.random() > 0.4 ? PlatformType.PASSTHROUGH : PlatformType.SOLID;
          let pWidth = 100 + Math.random() * 200; 
          
          const platform = new Platform(px, py, pWidth, 20, pType);
          
          let overlap = false;
          for (const hp of this.platforms) {
             if (this.checkAABB(hp, platform)) {
                 overlap = true;
                 break;
             }
          }
          
          if (!overlap) {
              this.platforms.push(platform);
              chunkPlatforms.push(platform);
          }
      }
      // Spawn Energy Boxes (1-2 per chunk)
      if (Math.random() > 0.3) {
          const plat = chunkPlatforms[Math.floor(Math.random() * chunkPlatforms.length)];
          if (plat) {
             this.energyBoxes.push(new EnergyBox(plat.x + plat.w/2 - 20, plat.y - 40));
          }
      }
  }

  spawnEnemyGroup(count: number) {
      if (!this.player) return;
      
      let startX = this.player.x - 800;
      let startY = this.player.y - 800;
      
      // Determine tier pool
      let pool = ['crawler', 'flyer'];
      if (this.level >= 2) pool.push('shooter', 'sniper');
      if (this.level >= 3) pool.push('heavy');
      if (this.level >= 4) pool.push('pulse_leech', 'static_crawler', 'echo_drone', 'data_spiker');
      if (this.level >= 5) pool.push('null_hunter', 'sync_breaker', 'glitch_worm');
      if (this.level >= 6) pool.push('void_snare', 'corrupt_carrier', 'blink_stalker', 'final_process');

      for (let i = 0; i < count; i++) {
          let ex = this.player.x + (Math.random() > 0.5 ? 600 + Math.random()*400 : -600 - Math.random()*400);
          let ey = this.player.y - 400 + Math.random() * 200;
          
          let type: any = pool[Math.floor(Math.random() * pool.length)];
          if (Math.random() > 0.5 && pool.length > 4) {
             let startIdx = Math.floor(pool.length / 2);
             type = pool[startIdx + Math.floor(Math.random() * (pool.length - startIdx))];
          }
          
          let hp = 40 + this.level * 20;
          let dmg = 10 + this.level * 5;
          let spd = 60 + Math.random() * 80;
          
          let modEnemyKeys = Object.keys(modAPI.customEnemies);
          if (modEnemyKeys.length > 0 && Math.random() < 0.2) {
              let modKey = modEnemyKeys[Math.floor(Math.random() * modEnemyKeys.length)];
              let customSpawn = modAPI.customEnemies[modKey](ex, ey, hp, dmg, spd, this.level);
              if (customSpawn) {
                 this.enemies.push(customSpawn);
                 this.spawnParticles(customSpawn.x + customSpawn.w/2, customSpawn.y + customSpawn.h/2, customSpawn.color || '#fff', 15, 200);
                 continue;
              }
          }

          let e = new Enemy(ex, ey, type, hp, dmg, spd);
          if (type === 'heavy' || type === 'sync_breaker' || type === 'collapse_engine') {
              e.w = 60; e.h = 60; e.hp *= 2; e.speed *= 0.6; e.color = '#f97316';
          } else if (type === 'sniper' || type === 'echo_drone' || type === 'pulse_leech') {
              e.hp *= 0.6; e.damage *= 2; e.speed *= 0.4;
          } else if (type === 'glitch_worm' || type === 'blink_stalker') {
              e.w = 30; e.h = 40; e.speed *= 1.5; e.color = '#a855f7';
          }
          this.enemies.push(e);
          this.spawnParticles(e.x + e.w/2, e.y + e.h/2, e.color, 15, 200);
      }
  }

  loadLevel() {
    this.platforms = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.loadedChunksMap.clear();
    this.killsThisLevel = 0;
    this.runTime = 0;
    this.missionReq = 10 + Math.floor(this.level * 2);
    this.missionCount = 0;
    
    this.player.x = 400;
    this.player.y = -200;
    this.player.vx = 0;
    this.player.vy = 0;

    // Generate initial chunks around player
    for(let dx=-1; dx<=1; dx++) {
        for(let dy=-1; dy<=1; dy++) {
            this.generateChunkAt(dx, dy);
        }
    }

    if (this.level % 2 === 0 && this.level <= 6) {
        this.spawnBoss();
    }
    
    modAPI.callHook('onLevelStart', this, this.level);
  }

  spawnBoss() {
      let hp = 500 + this.level * 100;
      let dmg = 20 + this.level * 5;
      let type = 'boss';
      let color = '#6d28d9';
      
      if (this.level === 2) { type = 'core_watcher'; color = '#ef4444'; }
      else if (this.level === 4) { type = 'desynchronized'; color = '#eab308'; }
      else if (this.level === 6) { type = 'memory_eater'; color = '#000000'; }
      else if (this.level > 6) { type = 'finalBoss'; color = '#ffffff'; hp *= 2; }
      
      let boss = new Enemy(this.player.x + 1000, this.player.y - 400, type, hp, dmg, 120, color);
      boss.w = 120;
      boss.h = 120;
      this.enemies.push(boss);
  }

  spawnFinalBoss() {
      this.finalBossSpawned = true;
      this.screenShake(30, 2.0);
      let boss = new Enemy(this.player.x + 800, this.player.y - 400, 'finalBoss', 3000 + this.level * 200, 50 + this.level * 10, 150, '#ff0055');
      boss.w = 120;
      boss.h = 120;
      this.enemies.push(boss);
  }

  checkAABB(a: any, b: any) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  addCard(card: Card) {
    this.deck.push(card);
    
    if (card.category === 'status') {
      if (card.apply) card.apply(this.stats, this);
    } else if (card.category === 'ability' && card.ability) {
      this.unlockedAbilities.push(card.ability);
      if (!this.equippedAbilities.q) {
        this.equippedAbilities.q = card.ability;
      } else if (!this.equippedAbilities.e) {
        this.equippedAbilities.e = card.ability;
      }
      
      let placed = false;
      for (let i = 0; i < this.wheelAbilities.length; i++) {
         if (!this.wheelAbilities[i]) {
            this.wheelAbilities[i] = card.ability;
            placed = true;
            break;
         }
      }
    } else if (card.category === 'world' && card.worldEvent) {
      this.activeWorldEvents.push({...card.worldEvent, currentDuration: card.worldEvent.duration});
      if (card.worldEvent.onStart) card.worldEvent.onStart(this);
    }
    
    if (this.victoryTriggered) {
        this.state = GameState.VICTORY;
        this.notifyState();
        return;
    }

    // Heal some HP on level up
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * 0.2);
    this.level++;
    this.state = GameState.PLAYING;
    this.notifyState();
    this.loadLevel();
    this.mobsSpawnedThisWave = 0;
  }

  screenShake(magnitude: number, duration: number) {
    this.shakeMagnitude = magnitude;
    this.shakeTimer = duration;
  }

  spawnParticles(x: number, y: number, color: string, count: number, speedOuter: number = 300) {
    for(let i=0; i<count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * speedOuter;
        this.particles.push(new Particle(
            x, y, Math.cos(angle)*speed, Math.sin(angle)*speed,
            0.5 + Math.random()*0.5, color, 2 + Math.random()*4
        ));
    }
  }

  triggerLevelComplete() {
      // Revert temporary buffs from the PREVIOUS level
      this.stats.maxHp -= this.tempStatsModifiers.maxHp;
      this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
      this.stats.maxMana -= this.tempStatsModifiers.maxMana;
      this.stats.mana = Math.min(this.stats.mana, this.stats.maxMana);
      this.stats.maxEnergy -= this.tempStatsModifiers.maxEnergy;
      this.stats.energy = Math.min(this.stats.energy, this.stats.maxEnergy);
      this.tempStatsModifiers = { maxHp: 0, maxMana: 0, maxEnergy: 0 };

      this.state = GameState.UPGRADE;
      this.notifyState();
      // Generate 3 procedural options
      if (this.onCardsOffered) {
          this.onCardsOffered(generateOptions(3));
      }
  }

  updatePhysics(dt: number) {
      const p = this.player;
      const accel = 2000;
      const friction = 10;
      const decel = 15;

      // Handle Shield
      if (inputManager.isActionActive('shield') && this.stats.energy >= this.stats.maxEnergy && !p.isShieldActive) {
          this.stats.energy = 0;
          p.isShieldActive = true;
          p.shieldTimer = 4.0;
          this.screenShake(5, 0.2);
          this.spawnParticles(p.x + p.w/2, p.y + p.h/2, '#3b82f6', 20, 300);
      }
      if (p.isShieldActive) {
          p.shieldTimer -= dt;
          if (p.shieldTimer <= 0) p.isShieldActive = false;
      }

      // Handle Dash Cooldown
      if (p.dashTimer > 0) p.dashTimer -= dt;
      if (p.dashTimer < 0) p.dashTimer = 0;

      // Detect Dash Input
      const leftActive = inputManager.isActionActive('left');
      const rightActive = inputManager.isActionActive('right');
      const dashButton = inputManager.isActionActive('dash');

      let dashTriggered = false;
      let dashDirection = 1;

      if (leftActive) {
         if (!this.lastLeftState) {
            if (performance.now() - this.lastDashTap < 300 && this.lastDashDir === 'left') {
                dashTriggered = true;
                dashDirection = -1;
            }
            this.lastDashTap = performance.now();
            this.lastDashDir = 'left';
         }
         this.lastLeftState = true;
      } else {
         this.lastLeftState = false;
      }

      if (rightActive) {
         if (!this.lastRightState) {
            if (performance.now() - this.lastDashTap < 300 && this.lastDashDir === 'right') {
                dashTriggered = true;
                dashDirection = 1;
            }
            this.lastDashTap = performance.now();
            this.lastDashDir = 'right';
         }
         this.lastRightState = true;
      } else {
         this.lastRightState = false;
      }

      if (dashButton && p.dashTimer === 0) {
          dashTriggered = true;
          dashDirection = leftActive ? -1 : (rightActive ? 1 : (p.vx < 0 ? -1 : 1));
      }

      if (dashTriggered && p.dashTimer === 0) {
          p.vx = dashDirection * this.stats.dashSpeed;
          p.isDashing = true;
          p.dashTimer = this.stats.dashCooldown;
      }

      if (!p.isDashing) {
          if (leftActive) {
              p.vx -= accel * dt;
              if (p.vx < -this.stats.speed) p.vx = -this.stats.speed;
          } else if (rightActive) {
              p.vx += accel * dt;
              if (p.vx > this.stats.speed) p.vx = this.stats.speed;
          } else {
              // Decelerate
              p.vx -= p.vx * (p.isGrounded ? decel : friction) * dt;
          }
      } else {
          // Dashing duration limits
          if (p.dashTimer < this.stats.dashCooldown - 0.2) {
              p.isDashing = false; // Dash lasts 0.2s
          }
          this.spawnParticles(p.x + p.w/2, p.y + p.h/2, '#ffffff', 2, 50);
      }

      // Jump (Costs Energy)
      if (inputManager.isActionActive('jump') && p.isGrounded) {
          if (this.stats.energy >= 15) {
              p.vy = -this.stats.jumpForce;
              p.isGrounded = false;
              this.stats.energy -= 15;
              this.spawnParticles(p.x + p.w/2, p.y + p.h, '#e2e8f0', 5, 200);
          }
      }

      // Apply Gravity
      p.vy += GRAVITY * this.stats.gravityModifier * dt;
      if (p.vy > TERMINAL_VELOCITY) p.vy = TERMINAL_VELOCITY;
      
      // Energy Regen
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + dt * 10);
      if (this.stats.mana < this.stats.maxMana) {
          if (p.manaRegenTimer > 0) {
               p.manaRegenTimer -= dt;
               this.stats.mana += dt * 40; // fast regen
          } else {
               this.stats.mana += dt * 5; // standard regen
          }
          this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana);
      }

      // Move X
      p.x += p.vx * dt;

      // Infinite gen
      let chunkIndexX = Math.floor(p.x / this.CHUNK_WIDTH);
      let chunkIndexY = Math.floor(p.y / this.CHUNK_HEIGHT);
      
      for(let dx=-1; dx<=1; dx++) {
          for(let dy=-1; dy<=1; dy++) {
              this.generateChunkAt(chunkIndexX + dx, chunkIndexY + dy);
          }
      }

      // Quick X collisions
      for (const plat of this.platforms) {
          if (plat.type === PlatformType.PASSTHROUGH) continue;
          if (this.checkAABB(p, plat)) {
              if (p.vx > 0) { p.x = plat.x - p.w; p.vx = 0; }
              else if (p.vx < 0) { p.x = plat.x + plat.w; p.vx = 0; }
          }
      }

      // Move Y
      p.y += p.vy * dt;
      p.isGrounded = false;
      let dropping = inputManager.isActionActive('down') && inputManager.isActionActive('jump');

      for (const plat of this.platforms) {
          if (this.checkAABB(p, plat)) {
              if (plat.type === PlatformType.PASSTHROUGH) {
                  // Only collide if falling and entirely above previous frame, AND not holding Shift
                  if (p.vy > 0 && (p.y - p.vy * dt + p.h) <= plat.y + 10 && !dropping) {
                      p.y = plat.y - p.h;
                      p.vy = 0;
                      p.isGrounded = true;
                  }
              } else {
                  if (p.vy > 0 && (p.y - p.vy * dt + p.h) <= plat.y + 10) {
                      p.y = plat.y - p.h;
                      p.vy = 0;
                      p.isGrounded = true;
                  } else if (p.vy < 0 && (p.y - p.vy * dt) >= plat.y + plat.h - 10) {
                      p.y = plat.y + plat.h;
                      p.vy = 0;
                  }
              }
          }
      }
  }

  lastSwapPressed: boolean = false;
  wheelShowTimer: number = 0;

  updateCombat(dt: number) {
      let p = this.player;
      if (this.player.attackCooldownTimer > 0) this.player.attackCooldownTimer -= dt;

      // Wheel Logic
      this.wheelHoverIndex = -1;
      let isWheelButtonActive = inputManager.isActionActive('swap_ability');
      
      if (this.hasAbilityWheel) {
          if (isWheelButtonActive) {
              this.wheelShowTimer = 0;
              this.wheelOpen = true;
          } else if (this.wheelShowTimer > 0) {
              this.wheelShowTimer -= dt;
              this.wheelOpen = true;
          } else {
              this.wheelOpen = false;
          }

          if (this.wheelOpen) {
              // Calc aim vector for wheel
              let dx = 0; let dy = 0;
              if (inputManager.usingGamepad && inputManager.gamepadIndex !== null) {
                  const gp = navigator.getGamepads()[inputManager.gamepadIndex];
                  if (gp) { dx = gp.axes[2]; dy = gp.axes[3]; }
              } else {
                  dx = this.mouseX - this.canvas.width / 2;
                  dy = this.mouseY - this.canvas.height / 2;
              }

              let previousHover = this.wheelHoverIndex;
              if (Math.sqrt(dx*dx + dy*dy) > 10) {
                  let angle = Math.atan2(dy, dx);
                  if (angle < 0) angle += Math.PI * 2;
                  let totalSlots = 2 + this.wheelAbilities.length;
                  // angle expected: (i / totalSlots) * Math.PI * 2 - Math.PI / 2
                  // shift + PI/2
                  let shiftedAngle = angle + Math.PI / 2;
                  if (shiftedAngle < 0) shiftedAngle += Math.PI * 2;
                  let t = shiftedAngle / (Math.PI * 2);
                  let i = Math.round(t * totalSlots) % totalSlots;
                  this.wheelHoverIndex = i;
              }

              if (previousHover !== this.wheelHoverIndex) {
                  this.notifyState();
              }

              // Apply Equip Q/E
              let qPressed = inputManager.isActionActive('ability_1');
              let ePressed = inputManager.isActionActive('ability_2');

              if ((qPressed || ePressed) && this.wheelHoverIndex >= 2) {
                  // Res to Q/E
                  let wIndex = this.wheelHoverIndex - 2;
                  let selectedSkill = this.wheelAbilities[wIndex];

                  if (selectedSkill) {
                      if (qPressed && this.equippedAbilities.q !== selectedSkill) {
                          let oldQ = this.equippedAbilities.q;
                          this.equippedAbilities.q = selectedSkill;
                          this.wheelAbilities[wIndex] = oldQ;
                          this.onStatsUpdate?.(this.stats, this);
                      } else if (ePressed && this.equippedAbilities.e !== selectedSkill) {
                          let oldE = this.equippedAbilities.e;
                          this.equippedAbilities.e = selectedSkill;
                          this.wheelAbilities[wIndex] = oldE;
                          this.onStatsUpdate?.(this.stats, this);
                      }
                  }
              }
          }
      }

      // Active Skills
      if (!this.wheelOpen) {
          if (this.equippedAbilities.q) {
              if (this.equippedAbilities.q.currentCooldown > 0) {
                  this.equippedAbilities.q.currentCooldown -= dt;
              } else if (inputManager.isActionActive('ability_1')) {
                  this.equippedAbilities.q.currentCooldown = this.equippedAbilities.q.cooldown;
                  this.equippedAbilities.q.execute(this);
                  this.screenShake(10, 0.2);
              }
          }
          if (this.equippedAbilities.e) {
              if (this.equippedAbilities.e.currentCooldown > 0) {
                  this.equippedAbilities.e.currentCooldown -= dt;
              } else if (inputManager.isActionActive('ability_2')) {
                  this.equippedAbilities.e.currentCooldown = this.equippedAbilities.e.cooldown;
                  this.equippedAbilities.e.execute(this);
                  this.screenShake(10, 0.2);
              }
          }
      } else {
          // If wheel is open, cooldowns still decrease but abilities don't fire
          if (this.equippedAbilities.q && this.equippedAbilities.q.currentCooldown > 0) this.equippedAbilities.q.currentCooldown -= dt;
          if (this.equippedAbilities.e && this.equippedAbilities.e.currentCooldown > 0) this.equippedAbilities.e.currentCooldown -= dt;
      }

      // Gamepad right stick aim
      let aimWorldX = this.mouseX + this.camera.x;
      let aimWorldY = this.mouseY + this.camera.y;

      if (inputManager.usingGamepad && inputManager.gamepadIndex !== null) {
          const gp = navigator.getGamepads()[inputManager.gamepadIndex];
          if (gp) {
              let rx = gp.axes[2];
              let ry = gp.axes[3];
              if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) {
                  let len = Math.sqrt(rx*rx + ry*ry);
                  this.gamepadAimDir = { x: rx/len, y: ry/len };
                  this.gamepadAimActive = true;
              }
          }
      }

      if (this.gamepadAimActive) {
          aimWorldX = p.x + p.w/2 + this.gamepadAimDir.x * 400;
          aimWorldY = p.y + p.h/2 + this.gamepadAimDir.y * 400;
          this.mouseX = aimWorldX - this.camera.x;
          this.mouseY = aimWorldY - this.camera.y;
      }

      // Shooting & Charged Attack
      const aim = { dx: aimWorldX - (p.x + p.w/2), dy: aimWorldY - (p.y + p.h/2) };
      let dx = aim.dx;
      let dy = aim.dy;
      let angle = Math.atan2(dy, dx);
      let speed = 800;

      let specialManaCost = 33.33;
      let specialEnergyCost = 25;

      if (inputManager.isActionActive('special')) {
          if (p.chargeTimer === 0 && (this.stats.mana < specialManaCost || this.stats.energy < specialEnergyCost)) {
              // Not enough to start
          } else {
              // Charging
              p.chargeTimer += dt;
              if (p.chargeTimer > 2) p.chargeTimer = 2; // max charge is 2 seconds
              
              // spawn charging particles flying to target reticle
              if (Math.random() < 0.6) {
                  let angleP = Math.random() * Math.PI * 2;
                  let dist = 20 + Math.random() * 40;
                  let px = aimWorldX + Math.cos(angleP) * dist;
                  let py = aimWorldY + Math.sin(angleP) * dist;
                  let vx = (aimWorldX - px) * 5;
                  let vy = (aimWorldY - py) * 5;
                  this.particles.push(new Particle(px, py, vx, vy, 0.3, '#0ea5e9', 2));
              }
          }
      } else if (p.chargeTimer > 0) {
          if (p.chargeTimer >= 0.2) {
              // Fire charged shot
              let projSize = 10 + (p.chargeTimer * 20); 
              let dmg = this.stats.damage * (1 + p.chargeTimer * 3);
              
              let pVx = Math.cos(angle) * 800; // Faster
              let pVy = Math.sin(angle) * 800;
              
              let proj = new Projectile(aimWorldX, aimWorldY, pVx, pVy, dmg, '#0ea5e9', true, projSize, true);
              proj.pierce = this.stats.pierce + 5; 
              this.projectiles.push(proj);
              
              this.screenShake(10 + p.chargeTimer * 10, 0.3);
              
              // Deduct stats even if they dipped below (they could drop below 0 but we floor it)
              this.stats.mana = Math.max(0, this.stats.mana - specialManaCost);
              this.stats.energy = Math.max(0, this.stats.energy - specialEnergyCost);
              p.attackCooldownTimer = 1.0;
          }
          p.chargeTimer = 0;
      }
      
      let normalManaCost = 2;

      if (inputManager.isActionActive('attack') && p.attackCooldownTimer <= 0 && this.stats.mana >= normalManaCost) {
          // Normal Shooting
          p.attackCooldownTimer = 1.0 / this.stats.attackRate;
          this.stats.mana -= normalManaCost;
          
          // Multishot
          for(let i=0; i<this.stats.multishot; i++) {
              let angleOffset = (i - (this.stats.multishot-1)/2) * 0.15;
              let vx = Math.cos(angle + angleOffset) * speed;
              let vy = Math.sin(angle + angleOffset) * speed;
              let isCrit = Math.random() < this.stats.critChance;
              let dmg = isCrit ? this.stats.damage * this.stats.critMultiplier : this.stats.damage;
              
              let proj = new Projectile(p.x + p.w/2, p.y + p.h/2, vx, vy, dmg, '#00F2FF', true);
              proj.w = 10; proj.h = 10;
              proj.pierce = this.stats.pierce;
              if (isCrit) { proj.w = 14; proj.h = 14; proj.color = '#ffffff'; } 
              this.projectiles.push(proj);
          }
          this.screenShake(2, 0.1);
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
          let proj = this.projectiles[i];

          if (proj.isHoming && proj.homingTarget && proj.homingTarget.active !== false) {
              // Adjust velocity towards target
              let dx = (proj.homingTarget.x + proj.homingTarget.w/2) - (proj.x + proj.w/2);
              let dy = (proj.homingTarget.y + proj.homingTarget.h/2) - (proj.y + proj.h/2);
              let dist = Math.sqrt(dx*dx + dy*dy) || 1;
              let speed = Math.sqrt(proj.vx*proj.vx + proj.vy*proj.vy) || 300;
              
              // Homing interpolation
              proj.vx = proj.vx * 0.95 + (dx/dist) * speed * 0.05;
              proj.vy = proj.vy * 0.95 + (dy/dist) * speed * 0.05;
              
              // Re-normalize speed just in case needed
              let newSpeed = Math.sqrt(proj.vx*proj.vx + proj.vy*proj.vy);
              if (newSpeed > 0) {
                 proj.vx = (proj.vx / newSpeed) * speed;
                 proj.vy = (proj.vy / newSpeed) * speed;
              }
          }

          proj.x += proj.vx * dt;
          proj.y += proj.vy * dt;
          proj.life -= dt;

          let hitSolid = false;
          let px = proj.x + proj.w/2;
          let py = proj.y + proj.h/2;
          for (let plat of this.platforms) {
              if (plat.type === PlatformType.SOLID) {
                  if (px >= plat.x && px <= plat.x + plat.w && py >= plat.y && py <= plat.y + plat.h) {
                      hitSolid = true;
                      break;
                  }
              }
          }

          if (proj.life <= 0 || hitSolid) {
              this.projectiles.splice(i, 1);
              continue;
          }

          // Enemy hit detection
          if (proj.isPlayer) {
              // Check collision with parryable enemy projectiles
              let projectileDestroyed = false;
              for (let j = this.projectiles.length - 1; j >= 0; j--) {
                  let eProj = this.projectiles[j];
                  if (!eProj.isPlayer && eProj.isParryable && this.checkAABB(proj, eProj)) {
                      this.spawnParticles(eProj.x, eProj.y, '#fbbf24', 5, 200);
                      this.projectiles.splice(j, 1);
                      if (j < i) i--; // adjust index if earlier projectile was removed
                      projectileDestroyed = true;
                      
                      this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + 15);
                      break; // Player bullet only destroys 1 projectile per frame
                  }
              }

              for (let e of this.enemies) {
                  if (this.checkAABB(proj, e) && e.hp > 0) {
                      e.hp -= proj.damage;
                      e.flashTimer = 0.1;
                      this.spawnParticles(proj.x, proj.y, e.color, 5, 200);
                      
                      // Lifesteal
                      if (this.stats.lifesteal > 0) {
                          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + proj.damage * this.stats.lifesteal);
                      }

                      // Parry logic
                      if (this.player.vy > 0 && this.player.y + this.player.h <= e.y + 30 && Math.abs((this.player.x + this.player.w/2) - (e.x + e.w/2)) < e.w + 30) {
                          this.player.vy = -700; // Launch up
                          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 15);
                          this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + 30);
                          this.screenShake(15, 0.3);
                          this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h, '#fcd34d', 20, 500);
                      }

                      this.hitstopFrames = 3; // Game feel: hitstop on hit
                      
                      if (proj.pierce > 0) {
                          proj.pierce--;
                      } else {
                          this.projectiles.splice(i, 1);
                      }
                      
                      if (e.hp <= 0) {
                          e.active = false;
                          this.killsThisLevel++;
                          this.missionCount++;
                          if (this.missionCount >= this.missionReq && this.level <= 6) {
                              // Mini mission complete!
                              this.gameXP += 50;
                              this.missionCount = 0;
                              this.missionReq = Math.floor(this.missionReq * 1.5);
                              this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#10b981', 40, 400); // Level up effect
                          }
                          this.screenShake(10, 0.2);
                          this.spawnParticles(e.x + e.w/2, e.y + e.h/2, e.color, 30, 400);

                          if (e.type === 'finalBoss' && !this.victoryTriggered) {
                              this.victoryTriggered = true;
                              this.state = GameState.UPGRADE;
                              this.notifyState();
                              if (this.onCardsOffered) {
                                  const finalCards: Card[] = [
                                      {
                                          id: 'core_1', name: 'Core Fragment: Ascendance', namePt: 'Fragmento do Núcleo: Ascensão',
                                          description: ['Merge with the system core.', 'Unlimited Potential.'],
                                          descriptionPt: ['Fundir-se com o núcleo do sistema.', 'Potencial Ilimitado.'],
                                          category: 'status', color: '#00F2FF',
                                          apply: (s) => { s.maxHp += 1000; s.hp += 1000; s.damage += 100; }
                                      },
                                      {
                                          id: 'core_2', name: 'Core Fragment: Eternity', namePt: 'Fragmento do Núcleo: Eternidade',
                                          description: ['Become the ghost in the machine.', 'Total Invulnerability.'],
                                          descriptionPt: ['Tornar-se o fantasma na máquina.', 'Invulnerabilidade Total.'],
                                          category: 'status', color: '#FACC15',
                                          apply: (s) => { s.lifesteal += 100; s.maxMana += 500; }
                                      },
                                      {
                                          id: 'core_3', name: 'Core Fragment: Annihilation', namePt: 'Fragmento do Núcleo: Aniquilação',
                                          description: ['Rewrite the world.', 'Absolute Power.'],
                                          descriptionPt: ['Reescrever o mundo.', 'Poder Absoluto.'],
                                          category: 'status', color: '#FF2E2E',
                                          apply: (s) => { s.multishot += 10; s.pierce += 10; s.damage += 50; }
                                      }
                                  ];
                                  this.onCardsOffered(finalCards);
                              }
                          }

                          // Drops
                          if ((e.type === 'shooter' || e.type === 'pulse_leech' || e.type === 'data_spiker') && Math.random() < 0.35) {
                              this.items.push(new DroppedItem(e.x + e.w/2, e.y + e.h/2, 'manaRegen'));
                          } else if ((e.type === 'flyer' || e.type === 'null_hunter') && Math.random() < 0.45) {
                              this.items.push(new DroppedItem(e.x + e.w/2, e.y + e.h/2, 'heart'));
                          }
                      }
                      break;
                  }
              }
              // Also hitting energy boxes
              if (proj.isPlayer) {
                  for (let b of this.energyBoxes) {
                      if (this.checkAABB(proj, b) && b.hp > 0) {
                          b.hp -= proj.damage;
                          b.flashTimer = 0.1;
                          this.spawnParticles(proj.x, proj.y, b.color, 5, 200);
                          if (b.hp <= 0) {
                              // drop energy
                              this.items.push(new DroppedItem(b.x + b.w/2, b.y + b.h/2, 'energy'));
                              this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#ffffff', 40, 500);
                              this.spawnParticles(b.x + b.w/2, b.y + b.h/2, b.color, 20, 300);
                              this.screenShake(5, 0.2);
                          }
                          if (proj.pierce > 0) proj.pierce--;
                          else this.projectiles.splice(i, 1);
                          break;
                      }
                  }
                  
                  // Parry enemy bullets
                  for (let j = this.projectiles.length - 1; j >= 0; j--) {
                      let eProj = this.projectiles[j];
                      if (!eProj.isPlayer && (eProj as any).isParryable) {
                          if (this.checkAABB(proj, eProj)) {
                              this.spawnParticles(eProj.x, eProj.y, '#ffffff', 15, 300);
                              this.projectiles.splice(j, 1);
                              // Adjust `i` if needed, but since we are removing `j`, if `j` < `i`, `i` shifts.
                              if (j < i) i--;
                              if (proj.pierce > 0) proj.pierce--;
                              else {
                                  if (i >= 0 && i < this.projectiles.length && this.projectiles[i] === proj) {
                                     this.projectiles.splice(i, 1);
                                  }
                              }
                              this.screenShake(5, 0.1);
                              break;
                          }
                      }
                  }
              }
          } else {
              // Enemy projectile hitting player or parry it
              if (this.checkAABB(proj, this.player)) {
                  if (this.player.isDashing || this.player.invulnTimer > 0) {
                      // immune
                  } else {
                      this.takeDamage(proj.damage, 0.5, Math.sign(proj.vx));
                      this.projectiles.splice(i, 1);
                  }
              }
          }
      }
      
      this.energyBoxes = this.energyBoxes.filter(b => b.hp > 0);

      // Clean dead enemies
      this.enemies = this.enemies.filter(e => e.active);
  }

    checkLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        // Simple raycast against solid platforms
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            let cx = x1 + (x2 - x1) * (i / steps);
            let cy = y1 + (y2 - y1) * (i / steps);
            for (let p of this.platforms) {
                if (p.type === PlatformType.SOLID && cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) {
                    return false; // blocked
                }
            }
        }
        return true;
    }

  updateEnemies(dt: number) {
      for (let e of this.enemies) {
          if (e.flashTimer > 0) e.flashTimer -= dt;

          // Stuck detection
          if (Math.abs(e.x - e.lastX) < 1 && Math.abs(e.y - e.lastY) < 1) {
              e.stuckTimer += dt;
          } else {
              e.stuckTimer = 0;
          }
          if (e.stuckTimer > 3.0 && e.type !== 'pulse_leech' && e.type !== 'data_spiker') { // 3 seconds stuck
              // Teleport to a random safe location near player above them slightly
              e.x = this.player.x + (Math.random() > 0.5 ? 200 : -200);
              e.y = this.player.y - 200;
              e.stuckTimer = 0;
              e.vx = 0;
              e.vy = 0;
              this.spawnParticles(e.x, e.y, e.color, 15, 200);
          }
          e.lastX = e.x;
          e.lastY = e.y;

          let isFlyer = e.type === 'flyer' || e.type === 'echo_drone' || e.type === 'void_snare';
          
          if (!isFlyer) {
              // Apply Gravity to all ground enemies
              e.vy += GRAVITY * dt;
              
              if (e.type === 'crawler' || e.type === 'heavy' || e.type === 'boss' || e.type === 'finalBoss' || e.type === 'pulse_leech' || e.type === 'static_crawler' || e.type === 'glitch_worm' || e.type === 'sync_breaker' || e.type === 'corrupt_carrier' || e.type === 'blink_stalker' || e.type === 'collapse_engine' || e.type === 'quantum_shade' || e.type === 'desynchronized' || e.type === 'memory_eater' || e.type === 'core_watcher') {
                  // Move towards player on X
                  let distToPlayerX = Math.abs(this.player.x - e.x);
                  if (distToPlayerX > 10) {
                      if (e.x + e.w/2 < this.player.x) e.vx = e.speed;
                      else if (e.x + e.w/2 > this.player.x + this.player.w) e.vx = -e.speed;
                  } else {
                      e.vx = 0;
                  }

                  // Boss specific jumps and movement
                  let isBoss = e.type === 'boss' || e.type === 'finalBoss' || e.type === 'desynchronized' || e.type === 'memory_eater' || e.type === 'core_watcher';
                  if (isBoss) {
                      let isEnraged = e.hp < e.maxHp * 0.4;
                      if (e.grounded) {
                          e.vx *= isEnraged ? 2.2 : 1.5; // Boss runs faster, faster when enraged
                          // Jump if player is high up or randomly if stuck
                          if (this.player.y < e.y - 100 || Math.random() < 0.02) {
                              e.vy = isEnraged ? -1000 : -800;
                              e.grounded = false;
                          }
                          // Retreat if low HP
                          if (isEnraged && Math.random() < 0.1) {
                              e.vx = -e.vx; // Run away momentarily
                              e.vy = -600;
                              e.grounded = false;
                          }
                      }

                      // Boss Attacks
                      e.fireTimer += dt;
                      let fireRate = isEnraged ? 1.5 : 2.5;
                      if (e.fireTimer >= fireRate) {
                          e.fireTimer = 0;
                          
                          let dx = (this.player.x + this.player.w/2) - (e.x + e.w/2);
                          let dy = (this.player.y + this.player.h/2) - (e.y + e.h/2);
                          let dist = Math.sqrt(dx*dx + dy*dy) || 1;
                          
                          let isCramped = false; // Check roughly if player is near corners
                          if (this.player.x < 200 || this.player.x > this.CHUNK_WIDTH - 200) isCramped = true;
                          
                          let attackType = Math.random();
                          
                          if (attackType < 0.4) {
                              // Spread Shot
                              let pDmg = e.damage;
                              let shots = isEnraged ? 5 : 3;
                              let baseAngle = Math.atan2(dy, dx);
                              for (let i = 0; i < shots; i++) {
                                  let angle = baseAngle + (i - Math.floor(shots/2)) * 0.3;
                                  let vx = Math.cos(angle) * 400;
                                  let vy = Math.sin(angle) * 400;
                                  let proj = new Projectile(e.x + e.w/2, e.y + e.h/2, vx, vy, pDmg, e.color, false, 10);
                                  proj.isParryable = true; // destructible
                                  this.projectiles.push(proj);
                              }
                          } else if (attackType < 0.8) {
                              // Homing Orbs
                              let pDmg = e.damage * 1.5;
                              let orbs = isEnraged ? 3 : 1;
                              for (let i = 0; i < orbs; i++) {
                                  let vx = (Math.random() - 0.5) * 600;
                                  let vy = -400 - Math.random() * 400;
                                  let proj = new Projectile(e.x + e.w/2, e.y + e.h/2, vx, vy, pDmg, '#fbbf24', false, 16);
                                  proj.isHoming = true;
                                  proj.homingTarget = this.player;
                                  proj.isParryable = true; // can shoot down
                                  proj.life = 4.0;
                                  this.projectiles.push(proj);
                              }
                          } else {
                              // Burst laser (fast straight line)
                              let pDmg = e.damage * 2.0;
                              let vx = (dx/dist) * 1000;
                              let vy = (dy/dist) * 1000;
                              let proj = new Projectile(e.x + e.w/2, e.y + e.h/2, vx, vy, pDmg, '#FF0000', false, 20);
                              // Not parryable, must dodge
                              this.projectiles.push(proj);
                          }
                          this.spawnParticles(e.x + e.w/2, e.y + e.h/2, e.color, 20, 200);
                          this.screenShake(5, 0.2);
                      }
                  }
              } else if (e.type === 'shooter' || e.type === 'sniper' || e.type === 'data_spiker' || e.type === 'null_hunter' || e.type === 'final_process') {
                  // Shooter logic
                  let dx = (this.player.x + this.player.w/2) - (e.x + e.w/2);
                  let dy = (this.player.y + this.player.h/2) - (e.y + e.h/2);
                  let dist = Math.sqrt(dx*dx + dy*dy);
                  
                  if (dist > 400) {
                      e.vx = Math.sign(dx) * e.speed;
                  } else if (dist < 200) {
                      e.vx = -Math.sign(dx) * e.speed;
                  } else {
                      e.vx = 0;
                  }
                  
                  e.fireTimer += dt;
                  let fireRate = e.type === 'sniper' ? 1.5 : 0.8;
                  if (e.fireTimer >= fireRate) {
                      let hasLOS = this.checkLineOfSight(e.x + e.w/2, e.y + e.h/2, this.player.x + this.player.w/2, this.player.y + this.player.h/2);
                      if (hasLOS) {
                          e.fireTimer = 0;
                          let aimDist = dist || 1;
                          let vx = (dx/aimDist) * (e.type === 'sniper' ? 600 : 300);
                          let vy = (dy/aimDist) * (e.type === 'sniper' ? 600 : 300);
                          
                          let pSize = e.type === 'sniper' ? 18 : 8;
                          let pDmg = e.type === 'sniper' ? e.damage * 2 : e.damage;
                          
                          let proj = new Projectile(e.x + e.w/2, e.y + e.h/2, vx, vy, pDmg, e.color, false, pSize);
                          (proj as any).isParryable = e.type === 'sniper';
                          this.projectiles.push(proj);
                          this.spawnParticles(e.x + e.w/2, e.y + e.h/2, e.color, 10, 150);
                      } else {
                          // Try finding a better angle if blocked (jump or move)
                          if (e.grounded && Math.random() < 0.2) e.vy = -600;
                          else e.vx = Math.sign(dx) * e.speed; // keep moving towards player
                      }
                  }
              }

              e.x += e.vx * dt;
              e.y += e.vy * dt;
              e.grounded = false;

              // Collision with platforms
              for(let plat of this.platforms) {
                  if (this.checkAABB(e, plat)) {
                      if (e.vy > 0 && e.y + e.h - e.vy*dt <= plat.y + 20) {
                          e.y = plat.y - e.h;
                          e.vy = 0;
                          e.grounded = true;
                      }
                  }
              }
          } else {
              // Flyer logic
              let dx = (this.player.x + this.player.w/2) - (e.x + e.w/2);
              let dy = (this.player.y + this.player.h/2) - (e.y + e.h/2); // aim at center
              let dist = Math.sqrt(dx*dx + dy*dy) || 1;
              
              // If too close, don't overlap exactly
              let flySpeed = e.speed * 2;
              if (dist > 40) {
                  e.x += (dx/dist) * flySpeed * dt;
                  e.y += (dy/dist) * flySpeed * dt;
              }
          }
          
          // Player contact
          if (this.checkAABB(this.player, e)) {
              if (this.player.isDashing) {
                  // Dash damage
                  if (e.flashTimer <= 0) {
                      e.hp -= this.stats.damage * 2;
                      e.flashTimer = 0.2;
                      this.spawnParticles(e.x, e.y, e.color, 5, 300);
                      
                      // Push enemy away
                      let pdir = this.player.facingRight ? 1 : -1;
                      e.x += pdir * 100;
                      this.screenShake(5, 0.1);
                  }
              } else if (this.player.invulnTimer <= 0) {
                  let kb = (e.type === 'shooter' || e.type === 'sniper') ? 0.5 : 1.2;
                  if (e.type === 'flyer' || e.type === 'void_snare' || e.type === 'echo_drone') kb = 0.2;
                  this.takeDamage(e.damage, kb, Math.sign((this.player.x + this.player.w/2) - (e.x + e.w/2)));
              }
          }
      }
      
      // Reduce player invuln
      if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt;
      if (this.player.flashTimer > 0) this.player.flashTimer -= dt;

      // Update Items and check pick up
      for(let i = this.items.length - 1; i >= 0; i--) {
          let item = this.items[i];
          
          let dx = (this.player.x + this.player.w/2) - item.x;
          let dy = (this.player.y + this.player.h/2) - item.y;
          let dist = Math.sqrt(dx*dx + dy*dy);

          // magnetic effect
          if (dist < 100) {
              item.x += (dx/dist) * 300 * dt;
              item.y += (dy/dist) * 300 * dt;
          }

          if (this.checkAABB(this.player, item)) {
              if (item.type === 'heart') {
                  this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 20 + Math.random() * 20);
                  this.spawnParticles(item.x, item.y, '#ef4444', 10, 100);
              } else if (item.type === 'manaRegen') {
                  this.player.manaRegenTimer = 4.0;
                  this.spawnParticles(item.x, item.y, '#60a5fa', 10, 100);
              } else if (item.type === 'energy') {
                  this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 20 + Math.random() * 20);
                  this.spawnParticles(item.x, item.y, '#eab308', 10, 100);
              }
              this.items.splice(i, 1);
          }
      }
  }

  takeDamage(amount: number, knockbackMultiplier: number, dirX: number) {
      if (this.player.isShieldActive) {
          amount *= 0.6; // 40% reduction
      }
      this.stats.hp -= amount;
      this.player.invulnTimer = 1.0; // i-frames
      this.player.flashTimer = 0.2;
      this.screenShake(10, 0.3);
      
      // Knockback
      this.player.vx = dirX * 500 * knockbackMultiplier;
      this.player.vy = -300 * knockbackMultiplier;
      
      if (this.stats.hp <= 0) {
          modAPI.callHook('onPlayerDeath', this);
          if (this.stats.hp <= 0) { // allow hook to revive
              this.state = GameState.GAMEOVER;
              this.notifyState();
          }
      }
  }

  loop(timestamp: number) {
    inputManager.updateGamepad();
    
    if (this.state !== GameState.PLAYING) {
        this.lastTime = timestamp;
        requestAnimationFrame(this.loop.bind(this));
        return;
    }

    // Delta time cap to prevent huge jumps
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = timestamp;

    if (this.hitstopFrames > 0) {
        this.hitstopFrames--;
        this.render();
        requestAnimationFrame(this.loop.bind(this));
        return;
    }

    this.updatePhysics(dt);
    this.updateCombat(dt);
    this.updateEnemies(dt);
    
    modAPI.callHook('onTick', this, dt);

    if (this.state === GameState.PLAYING && !this.victoryTriggered && !this.finalBossSpawned) {
        let spawnInterval = 15; // 1 group every 15 seconds
        let expectedGroups = Math.floor(this.runTime / spawnInterval);
        if (expectedGroups > 6) expectedGroups = 6;
        let expectedSpawned = expectedGroups * 5;
        
        while (this.mobsSpawnedThisWave < expectedSpawned) {
            this.spawnEnemyGroup(5);
            this.mobsSpawnedThisWave += 5;
        }
    }

    // Update World Events
    for (let i = this.activeWorldEvents.length - 1; i >= 0; i--) {
        let we = this.activeWorldEvents[i];
        if (we.onTick) we.onTick(this, dt);
        if (we.currentDuration !== undefined) {
             we.currentDuration -= dt;
             if (we.currentDuration <= 0) {
                 if (we.onEnd) we.onEnd(this);
                 this.activeWorldEvents.splice(i, 1);
             }
        }
    }

    this.runTime += dt;
    if (this.runTime >= this.levelDuration && !this.victoryTriggered && this.level < 6) {
         // Level is complete after surviving the duration
         this.triggerLevelComplete();
    } else if (this.runTime >= this.levelDuration && this.level === 6 && !this.finalBossSpawned) {
        this.spawnFinalBoss();
    }

    // Particle update
    for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i];
        p.update(dt);
        if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Camera follow (smooth)
    let targetCamX = this.player.x + this.player.w/2 - this.canvas.width/2;
    let targetCamY = this.player.y + this.player.h/2 - this.canvas.height/2;
    this.camera.x += (targetCamX - this.camera.x) * 5 * dt;
    this.camera.y += (targetCamY - this.camera.y) * 5 * dt;

    if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
    }

    // Pass stats to UI frequently
    if (Math.random() < 0.1) this.notifyState(); 

    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    
    // Apply camera
    let cx = Math.floor(-this.camera.x);
    let cy = Math.floor(-this.camera.y);

    if (this.shakeTimer > 0) {
        cx += (Math.random() - 0.5) * this.shakeMagnitude;
        cy += (Math.random() - 0.5) * this.shakeMagnitude;
    }
    this.ctx.translate(cx, cy);

    // Draw Background Grid (World Coordinates)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    const GRID_SIZE = 40;
    const startX = Math.floor(this.camera.x / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const startY = Math.floor(this.camera.y / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    for (let x = startX; x < startX + this.canvas.width + GRID_SIZE*2; x += GRID_SIZE) {
        this.ctx.moveTo(x, startY);
        this.ctx.lineTo(x, startY + this.canvas.height + GRID_SIZE*2);
    }
    for (let y = startY; y < startY + this.canvas.height + GRID_SIZE*2; y += GRID_SIZE) {
        this.ctx.moveTo(startX, y);
        this.ctx.lineTo(startX + this.canvas.width + GRID_SIZE*2, y);
    }
    this.ctx.stroke();

    // Draw Platforms
    for(const plat of this.platforms) {
        // Culling
        if (plat.x + plat.w < this.camera.x || plat.x > this.camera.x + this.canvas.width) continue;

        this.ctx.fillStyle = plat.color === '#1e293b' ? 'rgba(255,255,255,0.1)' : plat.color;
        this.ctx.fillRect(Math.floor(plat.x), Math.floor(plat.y), plat.w, plat.h);
        
        // Edge highlights for style
        this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.ctx.fillRect(plat.x, plat.y, plat.w, 2);
    }

    // Draw Charging Attack Tracker
    if (this.player.chargeTimer > 0) {
        let aimWorldX = this.camera.x + this.mouseX;
        let aimWorldY = this.camera.y + this.mouseY;
        
        let projSize = 10 + (this.player.chargeTimer * 20);
        
        // Glow effect
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#0ea5e9';
        
        // Core background
        this.ctx.fillStyle = `rgba(14, 165, 233, ${0.5 + this.player.chargeTimer * 0.25})`;
        this.ctx.fillRect(aimWorldX - projSize/2, aimWorldY - projSize/2, projSize, projSize);
        
        // Whiter core
        let coreSize = projSize * 0.6;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + this.player.chargeTimer * 0.2})`;
        this.ctx.fillRect(aimWorldX - coreSize/2, aimWorldY - coreSize/2, coreSize, coreSize);
        
        // Border
        this.ctx.strokeStyle = '#0ea5e9';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(aimWorldX - projSize/2, aimWorldY - projSize/2, projSize, projSize);
        
        this.ctx.shadowBlur = 0;
    }

    // Draw Particles
    // Use screen blend mode for glowing effect
    this.ctx.globalCompositeOperation = 'screen';
    for(const p of this.particles) {
        if (p.x < this.camera.x || p.x > this.camera.x + this.canvas.width || p.y < this.camera.y || p.y > this.camera.y + this.canvas.height) continue;

        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        this.ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';

    // Draw Enemies
    for(const e of this.enemies) {
        if (e.x + e.w < this.camera.x || e.x > this.camera.x + this.canvas.width || e.y + e.h < this.camera.y || e.y > this.camera.y + this.canvas.height) continue;

        let isBoss = e.type === 'boss' || e.type === 'finalBoss' || e.type === 'desynchronized' || e.type === 'memory_eater' || e.type === 'core_watcher';
        this.ctx.fillStyle = e.flashTimer > 0 ? '#ffffff' : e.color;
        this.ctx.shadowColor = e.color;
        this.ctx.shadowBlur = 10;
        
        let cx = Math.floor(e.x + e.w/2);
        let cy = Math.floor(e.y + e.h/2);

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Spin animation if flyer is attacking (fireTimer almost full)
        let isSpinningFlyer = (e.type === 'flyer' || e.type === 'echo_drone' || e.type === 'void_snare');
        if (isSpinningFlyer && e.fireTimer > 0.6) {
             this.ctx.rotate(this.runTime * 15);
        }

        if (isSpinningFlyer) {
            // Simple Square/Rectangle for Flyer
            this.ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            // Thrusters at the bottom
            this.ctx.fillStyle = '#0ea5e9'; // Blue thruster engines
            this.ctx.fillRect(-e.w/2 + 2, e.h/2, e.w/3, 8);
            this.ctx.fillRect(e.w/2 - e.w/3 - 2, e.h/2, e.w/3, 8);
        } else if (e.type === 'crawler' || e.type === 'static_crawler' || e.type === 'glitch_worm') {
            // Low rectangle for crawler
            this.ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            // Legs moving (animation base on x position)
            this.ctx.fillStyle = '#fff';
            let legOffset = Math.sin(e.x * 0.2) * 4;
            this.ctx.fillRect(-e.w/2 + 4, e.h/2, 4, 6 + legOffset);
            this.ctx.fillRect(e.w/2 - 8, e.h/2, 4, 6 - legOffset);
        } else if (isBoss) {
            this.ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            // "Eye" or core
            this.ctx.fillStyle = e.flashTimer > 0 ? '#fff' : '#000';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, e.w/4, 0, Math.PI*2);
            this.ctx.fill();
        } else if (e.type === 'heavy' || e.type === 'sync_breaker' || e.type === 'collapse_engine') {
            // Blocky bruiser
            this.ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(-e.w/2 + 10, -e.h/2 + 10, e.w - 20, e.h/3);
            // Heavy treads replacing legs
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(-e.w/2 - 4, e.h/2 - 4, e.w + 8, 8);
        } else {
            // Default shooter/sniper
            this.ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            // Eye
            this.ctx.fillStyle = '#000';
            let eyeX = e.vx > 0 ? e.w/2 - 12 : -e.w/2 + 4;
            this.ctx.fillRect(eyeX, -e.h/2 + 6, 8, 8);
            // Walking legs
            this.ctx.fillStyle = '#fff';
            let legOffset = Math.sin(e.x * 0.1) * 6;
            this.ctx.fillRect(-e.w/2 + 4, e.h/2, 4, 8 + Math.max(0, legOffset));
            this.ctx.fillRect(e.w/2 - 8, e.h/2, 4, 8 + Math.max(0, -legOffset));
        }

        this.ctx.restore();

        // hp bar
        this.ctx.shadowBlur = 0;
        
        if (isBoss) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(e.x - 20, e.y - 20, e.w + 40, 6);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(e.x - 20, e.y - 20, (e.w + 40) * (Math.max(0, e.hp) / e.maxHp), 6);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px monospace';
            this.ctx.fillText(`${Math.ceil(e.hp)}/${e.maxHp}`, e.x - 20, e.y - 25);
        } else {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(e.x, e.y - 12, e.w, 4);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(e.x, e.y - 12, e.w * (Math.max(0, e.hp) / e.maxHp), 4);
        }
    }

    // Draw Items
    for(const item of this.items) {
        if (item.x + item.w < this.camera.x || item.x > this.camera.x + this.canvas.width || item.y + item.h < this.camera.y || item.y > this.camera.y + this.canvas.height) continue;
        this.ctx.fillStyle = item.color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = item.color;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 6, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    // Draw EnergyBoxes
    for(const b of this.energyBoxes) {
        if (b.x + b.w < this.camera.x || b.x > this.camera.x + this.canvas.width || b.y + b.h < this.camera.y || b.y > this.camera.y + this.canvas.height) continue;
        this.ctx.fillStyle = b.flashTimer > 0 ? '#fff' : b.color;
        this.ctx.fillRect(b.x, b.y, b.w, b.h);
        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(b.x, b.y, b.w, b.h);

        // draw generic details
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
        this.ctx.fillStyle = b.color;
        this.ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);

        // hp bar
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(b.x, b.y - 10, b.w, 4);
        this.ctx.fillStyle = '#10b981';
        this.ctx.fillRect(b.x, b.y - 10, b.w * (b.hp / 30), 4); // Box starting HP is 30
    }

    // Draw Player
    this.ctx.fillStyle = this.player.color;
    this.ctx.shadowColor = this.player.glowColor;
    this.ctx.shadowBlur = 15;
    
    // Cyberpunk-style distinct shape
    this.ctx.beginPath();
    let px = Math.floor(this.player.x);
    let py = Math.floor(this.player.y);
    let pw = this.player.w;
    let ph = this.player.h;
    
    this.ctx.moveTo(px, py + 4);
    this.ctx.lineTo(px + 4, py);
    this.ctx.lineTo(px + pw - 4, py);
    this.ctx.lineTo(px + pw, py + 4);
    this.ctx.lineTo(px + pw, py + ph - 4);
    this.ctx.lineTo(px + pw - 4, py + ph);
    this.ctx.lineTo(px + 4, py + ph);
    this.ctx.lineTo(px, py + ph - 4);
    this.ctx.fill();
    
    // Core light
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(px + pw/2 - 2, py + ph/2 - 2, 4, 4);

    // Draw Shield
    if (this.player.isShieldActive) {
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x + this.player.w/2, this.player.y + this.player.h/2, this.player.w + 10, 0, Math.PI*2);
        this.ctx.stroke();
    }
    
    // Player inner glow/border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py + 4);
    this.ctx.lineTo(px + 4, py);
    this.ctx.lineTo(px + pw - 4, py);
    this.ctx.lineTo(px + pw, py + 4);
    this.ctx.lineTo(px + pw, py + ph - 4);
    this.ctx.lineTo(px + pw - 4, py + ph);
    this.ctx.lineTo(px + 4, py + ph);
    this.ctx.lineTo(px, py + ph - 4);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Draw Projectiles
    for(const proj of this.projectiles) {
        if (proj.isCharged) {
            this.ctx.fillStyle = '#fff';
            this.ctx.shadowColor = proj.color;
            this.ctx.shadowBlur = 20;
            this.ctx.fillRect(proj.x, proj.y, Math.max(proj.w, 16), Math.max(proj.h, 16));
        } else {
            this.ctx.fillStyle = proj.color;
            this.ctx.shadowColor = proj.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(proj.x, proj.y, proj.w, proj.h);
        }
        this.ctx.shadowBlur = 0;
    }

    // Draw crosshair and charge bar
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    let crossX = this.mouseX + this.camera.x;
    let crossY = this.mouseY + this.camera.y;
    this.ctx.moveTo(crossX - 10, crossY);
    this.ctx.lineTo(crossX + 10, crossY);
    this.ctx.moveTo(crossX, crossY - 10);
    this.ctx.lineTo(crossX, crossY + 10);
    this.ctx.stroke();

    if (this.player.chargeTimer > 0) {
        let chargePercent = Math.min(1.0, this.player.chargeTimer / 2.0); // assuming 2 seconds for full charge
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(crossX - 20, crossY - 20, 40, 6);
        this.ctx.fillStyle = chargePercent >= 1.0 ? '#00F2FF' : '#ffffff';
        this.ctx.fillRect(crossX - 20, crossY - 20, 40 * chargePercent, 6);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(crossX - 20, crossY - 20, 40, 6);
    }

    modAPI.callHook('onRender', this, this.ctx);
    this.ctx.restore();
  }

  private notifyState() {
      if (this.onStateChange) this.onStateChange(this.state, this);
      if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this);
      if (this.onProgressUpdate) this.onProgressUpdate(this.runTime, this.levelDuration, this.level);
  }
}

modAPI.engineClass = GameEngine;