import { Card, PlayerStats, ModifierCategory, AbilityDef, WorldEventDef } from './types';
import { Projectile, Enemy } from './entities';
import { modAPI } from './modAPI';
import { loadVanillaMod } from '../mods/vanilla';

// Initialize Vanilla Mod once
if (modAPI.statAdjectives.length === 0) {
    loadVanillaMod();
}

function generateStatusModifier(): Card {
  const adjs = modAPI.statAdjectives;
  const nouns = modAPI.statNouns;
  const adjIdx = Math.floor(Math.random() * adjs.length);
  const nounIdx = Math.floor(Math.random() * nouns.length);
  const adj = adjs[adjIdx];
  const noun = nouns[nounIdx];

  return {
    id: 'stat_' + Math.random().toString(36).substr(2, 9),
    category: 'status',
    name: `${adj.name} ${noun.name}`,
    namePt: `${noun.namePt} ${adj.namePt}`,
    description: [adj.desc, noun.desc],
    descriptionPt: [adj.descPt, noun.descPt],
    color: adj.color,
    components: { type: 'status', adjIdx, nounIdx },
    apply: (stats: PlayerStats) => {
      adj.effect(stats);
      noun.effect(stats);
    }
  };
}

function generateAbilityModifier(): Card {
  const elems = modAPI.abilityElements;
  const forms = modAPI.abilityForms;
  const elemIdx = Math.floor(Math.random() * elems.length);
  const formIdx = Math.floor(Math.random() * forms.length);
  const elem = elems[elemIdx];
  const form = forms[formIdx];

  const abilityDef: AbilityDef = {
    id: `abil_${elemIdx}_${formIdx}`,
    name: `${elem.name} ${form.name}`,
    namePt: `${form.namePt} de ${elem.namePt}`,
    cooldown: form.cooldown,
    currentCooldown: 0,
    color: elem.color,
    execute: (engine) => form.execute(engine, elem)
  };

  return {
    id: 'abil_' + Math.random().toString(36).substr(2, 9),
    category: 'ability',
    name: abilityDef.name,
    namePt: abilityDef.namePt,
    description: [`Grants Active Skill: ${abilityDef.name}`, `Cooldown: ${abilityDef.cooldown}s`, `Damage: ${elem.dmgMult}x`, elem.effectDesc],
    descriptionPt: [`Concede Habilidade Ativa: ${abilityDef.namePt}`, `Tempo de Recarga: ${abilityDef.cooldown}s`, `Dano: ${elem.dmgMult}x`, elem.effectDescPt],
    color: elem.color,
    components: { type: 'ability', elemIdx, formIdx },
    ability: abilityDef,
  };
}

function generateWorldModifier(): Card {
  const events = modAPI.worldEvents;
  const evIdx = Math.floor(Math.random() * events.length);
  const ev = events[evIdx];

  const weDef: WorldEventDef = {
    id: `we_${evIdx}`,
    name: ev.name,
    namePt: ev.namePt,
    duration: ev.duration,
    currentDuration: ev.duration,
    onStart: ev.onStart,
    onTick: ev.onTick,
    onEnd: ev.onEnd,
  };

  return {
    id: 'world_' + Math.random().toString(36).substr(2, 9),
    category: 'world',
    name: ev.name,
    namePt: ev.namePt,
    description: ['World Event Trigger:', ev.desc],
    descriptionPt: ['Desperta Evento de Mundo:', ev.descPt],
    color: ev.color,
    components: { type: 'world', evIdx },
    worldEvent: weDef,
  };
}

export function generateProceduralCard(): Card {
  const roll = Math.random();
  if (roll < 0.6) return generateStatusModifier();
  else if (roll < 0.85) return generateAbilityModifier();
  else return generateWorldModifier();
}

export function generateOptions(count: number = 3): Card[] {
  return Array.from({ length: count }, () => generateProceduralCard());
}

export function rehydrateDeck(deck: Card[]) {
  deck.forEach(card => {
    if (card.components) {
      if (card.components.type === 'status') {
         const adj = modAPI.statAdjectives[card.components.adjIdx];
         const noun = modAPI.statNouns[card.components.nounIdx];
         if (adj && noun) {
           card.apply = (stats: PlayerStats) => {
             adj.effect(stats); noun.effect(stats);
           };
         }
      } else if (card.components.type === 'ability') {
         const elem = modAPI.abilityElements[card.components.elemIdx];
         const form = modAPI.abilityForms[card.components.formIdx];
         if (elem && form && card.ability) {
           card.ability.execute = (engine) => form.execute(engine, elem);
         }
      } else if (card.components.type === 'world') {
         const ev = modAPI.worldEvents[card.components.evIdx];
         if (ev && card.worldEvent) {
           card.worldEvent.onStart = ev.onStart;
           card.worldEvent.onTick = ev.onTick;
           card.worldEvent.onEnd = ev.onEnd;
         }
      }
    }
  });
}



