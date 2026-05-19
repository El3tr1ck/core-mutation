import { PlayerStats, AbilityDef, WorldEventDef } from './types';
import JSZip from 'jszip';
import * as Entities from './entities';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { inputManager, InputManager } from '../lib/input';

export interface StatAdjective {
  name: string; namePt: string; effect: (s: PlayerStats) => void; desc: string; descPt: string; color: string;
}
export interface StatNoun {
  name: string; namePt: string; effect: (s: PlayerStats) => void; desc: string; descPt: string;
}
export interface AbilityElement {
  name: string; namePt: string; color: string; dmgMult: number; effectDesc: string; effectDescPt: string;
}
export interface AbilityForm {
  name: string; namePt: string; cooldown: number; execute: (engine: any, element: any) => void;
}
export interface WorldEvent {
  name: string; namePt: string; duration: number; desc: string; descPt: string; color: string;
  onStart?: (engine: any) => void; onTick?: (engine: any, dt: number) => void; onEnd?: (engine: any) => void;
}

export interface ModMeta {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
}

export interface LoadedMod {
  meta: ModMeta;
  enabled: boolean;
}

class ModRegistry {
  public statAdjectives: StatAdjective[] = [];
  public statNouns: StatNoun[] = [];
  public abilityElements: AbilityElement[] = [];
  public abilityForms: AbilityForm[] = [];
  public worldEvents: WorldEvent[] = [];
  public textrues: Record<string, HTMLImageElement> = {};
  public customEnemies: Record<string, any> = {};
  public hooks: Record<string, Function[]> = {};

  public loadedMods: LoadedMod[] = [];
  
  // Advanced integrations
  public classes = Entities;
  public inputManager = inputManager;
  public InputManagerClass = InputManager;
  public engineClass: any = null;
  public React = React;
  public ReactDOM = ReactDOM;
  public uiContainer: HTMLDivElement | null = null;
  public audioCache: Record<string, HTMLAudioElement> = {};

  registerStatAdjective(adj: StatAdjective) { this.statAdjectives.push(adj); }
  registerStatNoun(noun: StatNoun) { this.statNouns.push(noun); }
  registerAbilityElement(elem: AbilityElement) { this.abilityElements.push(elem); }
  registerAbilityForm(form: AbilityForm) { this.abilityForms.push(form); }
  registerWorldEvent(event: WorldEvent) { this.worldEvents.push(event); }

  registerTexture(id: string, src: string) {
    const img = new Image();
    img.src = src;
    this.textrues[id] = img;
  }

  registerEnemy(id: string, enemyClass: any) {
    this.customEnemies[id] = enemyClass;
  }

  registerHook(event: string, callback: Function) {
    if (!this.hooks[event]) this.hooks[event] = [];
    this.hooks[event].push(callback);
  }

  callHook(event: string, ...args: any[]) {
    if (this.hooks[event]) {
      this.hooks[event].forEach(cb => cb(...args));
    }
  }

  playSound(base64Url: string, volume = 1.0) {
      if (!this.audioCache[base64Url]) {
          this.audioCache[base64Url] = new Audio(base64Url);
      }
      const audio = this.audioCache[base64Url].cloneNode() as HTMLAudioElement;
      audio.volume = volume;
      audio.play().catch(e => console.warn('Mod Audio Failed:', e));
  }

  addUIContainer() {
      if (!this.uiContainer) {
          const div = document.createElement('div');
          div.id = 'mod-ui-container';
          div.style.position = 'absolute';
          div.style.top = '0';
          div.style.left = '0';
          div.style.width = '100%';
          div.style.height = '100%';
          div.style.pointerEvents = 'none'; // let clicks pass through unless a child overrides this
          div.style.zIndex = '50';
          document.body.appendChild(div);
          this.uiContainer = div;
      }
      return this.uiContainer;
  }

  mountReactComponent(Component: any, props: any = {}) {
      const container = this.addUIContainer();
      const wrapper = document.createElement('div');
      wrapper.style.pointerEvents = 'auto'; // allow interaction
      container.appendChild(wrapper);
      const root = ReactDOM.createRoot(wrapper);
      root.render(React.createElement(Component, props));
      return {
          unmount: () => {
              root.unmount();
              wrapper.remove();
          }
      };
  }

  async loadModFromZip(file: File): Promise<LoadedMod | null> {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      // Look for mod.json meta
      if (!content.file('mod.json')) {
        throw new Error('Mod is missing mod.json metadata file.');
      }
      
      const metaStr = await content.file('mod.json')!.async('string');
      const meta = JSON.parse(metaStr) as ModMeta;
      
      // Look for main.js entry
      if (!content.file('main.js')) {
        throw new Error('Mod is missing main.js entry file.');
      }
      
      const code = await content.file('main.js')!.async('string');
      
      // Execute mod code in a safe context (or basic eval for now, since it's client side mods)
      // Pass the api as a local variable
      const modFunc = new Function('ModAPI', 'require', 'ModContext', code);
      modFunc(this, (moduleName: string) => {
        // mock require if mods try to require something
        if (moduleName === 'react') return React;
        if (moduleName === 'react-dom/client' || moduleName === 'react-dom') return ReactDOM;
        return null;
      }, {
        zipContent: content
      });

      const loaded: LoadedMod = { meta, enabled: true };
      this.loadedMods.push(loaded);
      
      // Save mod info to localstorage to remember it's enabled (ideally we store the files in IndexedDB, but for now just load per session or provide the file system)
      return loaded;
    } catch (e) {
      console.error("Failed to load mod:", e);
      return null;
    }
  }
}

export const modAPI = new ModRegistry();
if (typeof window !== 'undefined') {
  (window as any).ModAPI = modAPI;
  // Initialize the mod UI container element so it exists in DOM
  modAPI.addUIContainer();
}

