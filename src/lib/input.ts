export type ActionType = 'up' | 'down' | 'left' | 'right' | 'jump' | 'dash' | 'attack' | 'special' | 'ability_1' | 'ability_2' | 'shield' | 'swap_ability';

export interface KeyBinding {
  keyboard: string[];
  gamepad: number[]; // Button indices or axes masks
}

export const defaultBindings: Record<ActionType, KeyBinding> = {
  up: { keyboard: ['KeyW', 'ArrowUp'], gamepad: [12] },
  down: { keyboard: ['KeyS', 'ArrowDown'], gamepad: [13] },
  left: { keyboard: ['KeyA', 'ArrowLeft'], gamepad: [14] },
  right: { keyboard: ['KeyD', 'ArrowRight'], gamepad: [15] },
  jump: { keyboard: ['Space'], gamepad: [0] },      // A/Cross
  dash: { keyboard: ['ShiftLeft'], gamepad: [1] },  // B/Circle
  attack: { keyboard: ['Mouse0'], gamepad: [7] },   // R2 or Right Trigger
  special: { keyboard: ['Mouse2'], gamepad: [6] },  // L2 or Left Trigger
  ability_1: { keyboard: ['KeyQ'], gamepad: [4] },  // L1 or LB
  ability_2: { keyboard: ['KeyE'], gamepad: [5] },  // R1 or RB
  shield: { keyboard: ['KeyF'], gamepad: [2] },     // X/Square
  swap_ability: { keyboard: ['KeyC'], gamepad: [3] } // Y/Triangle
};

export class InputManager {
  bindings: Record<ActionType, KeyBinding> = { ...defaultBindings };
  keys: Record<string, boolean> = {};
  mouseButtons: Record<number, boolean> = {};
  mouseX: number = 0;
  mouseY: number = 0;
  gamepadIndex: number | null = null;
  usingGamepad: boolean = false;
  
  constructor() {
    this.loadBindings();
    
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      this.usingGamepad = false;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.usingGamepad = false;
    });
    window.addEventListener('mousedown', (e) => {
      this.mouseButtons[e.button] = true;
      this.usingGamepad = false;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseButtons[e.button] = false;
      this.usingGamepad = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
    
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.usingGamepad = true;
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.usingGamepad = false;
      }
    });
  }

  loadBindings() {
    const saved = localStorage.getItem('keyBindings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.bindings = { ...defaultBindings, ...parsed };
      } catch(e) {
        this.bindings = JSON.parse(JSON.stringify(defaultBindings));
      }
    } else {
      this.bindings = JSON.parse(JSON.stringify(defaultBindings));
    }
  }

  saveBindings() {
    localStorage.setItem('keyBindings', JSON.stringify(this.bindings));
  }
  
  updateGamepad() {
    if (this.gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      // Check axes for movement
      if (gp) {
         if (Math.abs(gp.axes[0]) > 0.2 || Math.abs(gp.axes[1]) > 0.2 || gp.buttons.some(b => b.pressed)) {
            this.usingGamepad = true;
         }
      }
    } else {
      // Auto-detect if connected but event was missed
      for (let gp of navigator.getGamepads()) {
         if (gp && gp.connected) {
             this.gamepadIndex = gp.index;
             this.usingGamepad = true;
             break;
         }
      }
    }
  }

  isActionActive(action: ActionType): boolean {
    const b = this.bindings[action];
    if (!b) return false;
    
    // Keyboard check
    for (let code of b.keyboard) {
      if (code.startsWith('Mouse')) {
        let btn = parseInt(code.replace('Mouse', ''));
        if (this.mouseButtons[btn]) return true;
      } else {
        if (this.keys[code]) return true;
      }
    }
    
    if (this.gamepadIndex !== null) {
       const gp = navigator.getGamepads()[this.gamepadIndex];
       if (gp) {
          for (let btnIdx of b.gamepad) {
             if (gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed) return true;
          }
          // specific axii mapping for dpad
          if (action === 'left' && gp.axes[0] < -0.4) return true;
          if (action === 'right' && gp.axes[0] > 0.4) return true;
          if (action === 'up' && gp.axes[1] < -0.4) return true;
          if (action === 'down' && gp.axes[1] > 0.4) return true;
       }
    }

    return false;
  }
  
  // Gets aim vector based on screen crosshair
  getAim(playerX: number, playerY: number, cameraX: number, cameraY: number, mouseX: number, mouseY: number): { dx: number, dy: number, active: boolean } {
    return { 
      dx: (mouseX + cameraX) - playerX, 
      dy: (mouseY + cameraY) - playerY,
      active: true
    };
  }
}

export const inputManager = new InputManager();
