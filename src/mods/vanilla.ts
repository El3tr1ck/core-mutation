import { modAPI } from '../game/modAPI';
import { Projectile, Enemy } from '../game/entities';

export function loadVanillaMod() {
  modAPI.registerStatAdjective({ name: 'Brutal', namePt: 'Brutal', effect: (s) => { s.damage += 10; }, desc: '+10 Damage', descPt: '+10 Dano', color: '#ef4444' });
  modAPI.registerStatAdjective({ name: 'Swift', namePt: 'Ágil', effect: (s) => { s.speed += 50; }, desc: '+50 Speed', descPt: '+50 Velocidade', color: '#3b82f6' });
  modAPI.registerStatAdjective({ name: 'Tough', namePt: 'Robusto', effect: (s) => { s.maxHp += 50; s.hp += 50; }, desc: '+50 Max HP', descPt: '+50 Vida Max', color: '#22c55e' });
  modAPI.registerStatAdjective({ name: 'Vampiric', namePt: 'Vampírico', effect: (s) => { s.lifesteal += 0.05; }, desc: '+5% Lifesteal', descPt: '+5% Roubo de Vida', color: '#991b1b' });
  modAPI.registerStatAdjective({ name: 'Precise', namePt: 'Preciso', effect: (s) => { s.critChance += 0.15; }, desc: '+15% Crit Chance', descPt: '+15% Chance Crítica', color: '#eab308' });
  modAPI.registerStatAdjective({ name: 'Rapid', namePt: 'Rápido', effect: (s) => { s.attackRate += 2; }, desc: '+2 Fire Rate', descPt: '+2 Taxa de Tiro', color: '#f97316' });
  modAPI.registerStatAdjective({ name: 'Magic', namePt: 'Mágico', effect: (s) => { s.maxMana += 50; }, desc: '+50 Max Mana', descPt: '+50 Mana Max', color: '#a855f7' });
  modAPI.registerStatAdjective({ name: 'Bouncy', namePt: 'Elástico', effect: (s) => { s.jumpForce += 100; }, desc: '+100 Jump Force', descPt: '+100 Força do Pulo', color: '#06b6d4' });
  modAPI.registerStatAdjective({ name: 'Piercing', namePt: 'Perfurante', effect: (s) => { s.pierce += 1; }, desc: '+1 Pierce', descPt: '+1 Perfuração', color: '#64748b' });
  modAPI.registerStatAdjective({ name: 'Split', namePt: 'Dividido', effect: (s) => { s.multishot += 1; }, desc: '+1 Projectile', descPt: '+1 Projétil', color: '#ec4899' });

  modAPI.registerStatNoun({ name: 'Burden', namePt: 'Fardo', effect: (s) => { s.speed -= 20; }, desc: '-20 Speed', descPt: '-20 Velocidade' });
  modAPI.registerStatNoun({ name: 'Fragility', namePt: 'Fragilidade', effect: (s) => { s.maxHp -= 20; }, desc: '-20 Max HP', descPt: '-20 Vida Max' });
  modAPI.registerStatNoun({ name: 'Sluggishness', namePt: 'Lentidão', effect: (s) => { s.attackRate -= 0.5; }, desc: '-0.5 Fire Rate', descPt: '-0.5 Taxa de Tiro' });
  modAPI.registerStatNoun({ name: 'Doubt', namePt: 'Dúvida', effect: (s) => { s.critChance -= 0.05; }, desc: '-5% Crit Chance', descPt: '-5% Chance Crítica' });
  modAPI.registerStatNoun({ name: 'Exhaustion', namePt: 'Exaustão', effect: (s) => { s.maxMana -= 20; }, desc: '-20 Max Mana', descPt: '-20 Mana Max' });
  modAPI.registerStatNoun({ name: 'Weakness', namePt: 'Fraqueza', effect: (s) => { s.damage -= 2; }, desc: '-2 Damage', descPt: '-2 Dano' });
  modAPI.registerStatNoun({ name: 'Heaviness', namePt: 'Peso', effect: (s) => { s.jumpForce -= 50; }, desc: '-50 Jump Force', descPt: '-50 Força do Pulo' });

  modAPI.registerAbilityElement({ name: 'Fire', namePt: 'Fogo', color: '#ef4444', dmgMult: 2.0, effectDesc: 'High Damage', effectDescPt: 'Dano Alto' });
  modAPI.registerAbilityElement({ name: 'Frost', namePt: 'Gelo', color: '#3b82f6', dmgMult: 1.0, effectDesc: 'Standard Damage', effectDescPt: 'Dano Padrão' });
  modAPI.registerAbilityElement({ name: 'Void', namePt: 'Vazio', color: '#a855f7', dmgMult: 1.5, effectDesc: 'Heavy Radius', effectDescPt: 'Grande Raio' });
  modAPI.registerAbilityElement({ name: 'Voltaic', namePt: 'Voltáico', color: '#eab308', dmgMult: 1.2, effectDesc: 'Fast Cast', effectDescPt: 'Conjuração Rápida' });
  modAPI.registerAbilityElement({ name: 'Toxic', namePt: 'Tóxico', color: '#22c55e', dmgMult: 1.5, effectDesc: 'Lingering', effectDescPt: 'Persistente' });

  modAPI.registerAbilityForm({ name: 'Nova', namePt: 'Nova', cooldown: 5, execute: (engine, element) => {
    for(let a=0; a<Math.PI*2; a+=Math.PI/6) {
      engine.projectiles.push(new Projectile(engine.player.x + engine.player.w/2, engine.player.y + engine.player.h/2, Math.cos(a)*500, Math.sin(a)*500, engine.stats.damage * element.dmgMult, element.color, true, 20));
    }
  }});
  modAPI.registerAbilityForm({ name: 'Blast', namePt: 'Rajada', cooldown: 3, execute: (engine, element) => {
    let dx = engine.mouseX - (engine.player.x + engine.player.w/2);
    let dy = engine.mouseY - (engine.player.y + engine.player.h/2);
    for(let i=-2; i<=2; i++) {
      let angle = Math.atan2(dy, dx) + (i * 0.15);
      engine.projectiles.push(new Projectile(engine.player.x + engine.player.w/2, engine.player.y + engine.player.h/2, Math.cos(angle)*800, Math.sin(angle)*800, engine.stats.damage * element.dmgMult * 0.8, element.color, true, 15));
    }
  }});
  modAPI.registerAbilityForm({ name: 'Skybeam', namePt: 'Raio Celeste', cooldown: 8, execute: (engine, element) => {
    for(let i=0; i<5; i++) {
      engine.projectiles.push(new Projectile(engine.mouseX + (Math.random() - 0.5) * 200, engine.player.y - 800 - (Math.random() * 400), 0, 1200, engine.stats.damage * element.dmgMult * 3, element.color, true, 30));
    }
  }});

  modAPI.registerWorldEvent({ name: 'Meteor Shower', namePt: 'Chuva de Meteoros', duration: 15, desc: 'Meteors fall from the sky for 15s', descPt: 'Meteoros caem do céu por 15s', color: '#fb923c', onTick: (engine: any, dt: number) => {
    if(Math.random() < 0.1) engine.projectiles.push(new Projectile(engine.player.x + (Math.random() - 0.5) * 1500, engine.player.y - 1000, Math.random() * 100 - 50, 800, 20, '#fb923c', false, 15));
  }});
  modAPI.registerWorldEvent({ name: 'Enemy Frenzy', namePt: 'Frenesi Inimigo', duration: 10, desc: 'Enemies are 50% faster for 10s', descPt: 'Inimigos ficam 50% mais rápidos por 10s', color: '#dc2626', onStart: (engine: any) => { engine.enemies.forEach((e: Enemy) => e.speed *= 1.5); }, onEnd: (engine: any) => { engine.enemies.forEach((e: Enemy) => e.speed /= 1.5); }});
  modAPI.registerWorldEvent({ name: 'Lunar Gravity', namePt: 'Gravidade Lunar', duration: 20, desc: 'Gravity is reduced for 20s', descPt: 'Gravidade é reduzida por 20s', color: '#94a3b8', onStart: (engine: any) => { engine.stats.gravityModifier *= 0.5; }, onEnd: (engine: any) => { engine.stats.gravityModifier /= 0.5; }});
  modAPI.registerWorldEvent({ name: 'Mana Surplus', namePt: 'Excesso de Mana', duration: 10, desc: 'Infinite mana for 10s', descPt: 'Mana infinita por 10s', color: '#60a5fa', onTick: (engine: any) => { engine.stats.mana = engine.stats.maxMana; }});
}
