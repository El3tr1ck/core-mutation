import React, { useState, useEffect } from 'react';
import { inputManager, ActionType } from '../lib/input';

interface Props {
  onClose: () => void;
  lang: 'en' | 'pt';
}

const ACTION_LABELS: Record<ActionType, { en: string; pt: string }> = {
  up: { en: 'Up', pt: 'Cima' },
  down: { en: 'Down', pt: 'Baixo' },
  left: { en: 'Left', pt: 'Esquerda' },
  right: { en: 'Right', pt: 'Direita' },
  jump: { en: 'Jump', pt: 'Pular' },
  dash: { en: 'Dash', pt: 'Esquivar' },
  attack: { en: 'Attack', pt: 'Atacar' },
  special: { en: 'Special', pt: 'Especial' },
  ability_1: { en: 'Ability 1', pt: 'Habilidade 1' },
  ability_2: { en: 'Ability 2', pt: 'Habilidade 2' },
  shield: { en: 'Shield', pt: 'Escudo' },
  swap_ability: { en: 'Swap Ability', pt: 'Trocar Habilidade' }
};

export const ControlsConfig: React.FC<Props> = ({ onClose, lang }) => {
  const [tab, setTab] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [waitingForInput, setWaitingForInput] = useState<ActionType | null>(null);
  const [mouseSensitivity, setMouseSensitivity] = useState<number>(Number(localStorage.getItem('mouseSensitivity')) || 1.0);
  
  // Force re-render when bindings change
  const [, setRenders] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!waitingForInput || tab !== 'keyboard') return;
      e.preventDefault();
      
      // Update binding
      inputManager.bindings[waitingForInput].keyboard = [e.code];
      inputManager.saveBindings();
      setWaitingForInput(null);
      setRenders(r => r + 1);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!waitingForInput || tab !== 'keyboard') return;
      e.preventDefault();
      
      inputManager.bindings[waitingForInput].keyboard = [`Mouse${e.button}`];
      inputManager.saveBindings();
      setWaitingForInput(null);
      setRenders(r => r + 1);
    };

    if (waitingForInput && tab === 'keyboard') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleMouseDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [waitingForInput, tab]);
  
  useEffect(() => {
      let raf: number;
      const scanGamepad = () => {
          if (waitingForInput && tab === 'gamepad') {
             const gps = navigator.getGamepads();
             for (let gp of gps) {
                if (gp) {
                   for (let i = 0; i < gp.buttons.length; i++) {
                      if (gp.buttons[i].pressed) {
                         inputManager.bindings[waitingForInput].gamepad = [i];
                         inputManager.saveBindings();
                         setWaitingForInput(null);
                         setRenders(r => r+1);
                         return; // exit early
                      }
                   }
                }
             }
          }
          raf = requestAnimationFrame(scanGamepad);
      };
      
      if (waitingForInput && tab === 'gamepad') {
         raf = requestAnimationFrame(scanGamepad);
      }
      
      return () => cancelAnimationFrame(raf);
  }, [waitingForInput, tab]);

  const t = (enMsg: string, ptMsg: string) => lang === 'pt' ? ptMsg : enMsg;

  return (
    <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center backdrop-blur-lg">
      <div className="w-full max-w-2xl bg-white/5 border border-white/20 p-8 rounded-lg flex flex-col">
          <h2 className="text-3xl font-black text-white uppercase tracking-widest text-center mb-8">
             {t('Controls Configuration', 'Configuração de Controles')}
          </h2>
          
          <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
              <button data-nav="true" 
                 onClick={() => setTab('keyboard')}
                 className={`flex-1 py-2 font-bold uppercase tracking-widest text-sm transition-colors ${tab === 'keyboard' ? 'text-[#00F2FF] border-b-2 border-[#00F2FF]' : 'text-white/40 hover:text-white'}`}
              >
                 {t('Keyboard / Mouse', 'Teclado / Mouse')}
              </button>
              <button data-nav="true" 
                 onClick={() => setTab('gamepad')}
                 className={`flex-1 py-2 font-bold uppercase tracking-widest text-sm transition-colors ${tab === 'gamepad' ? 'text-[#00F2FF] border-b-2 border-[#00F2FF]' : 'text-white/40 hover:text-white'}`}
              >
                 {t('Gamepad', 'Controle')}
              </button>
          </div>
          
          {waitingForInput ? (
             <div className="flex-1 flex flex-col items-center justify-center py-20">
                 <div className="text-2xl text-[#fbbf24] animate-pulse uppercase tracking-widest font-black">
                     {t('Waiting for input...', 'Aguardando tecla...')}
                 </div>
                 <div className="text-white/50 mt-4 uppercase">
                     {t(`Press a key or button for: ${ACTION_LABELS[waitingForInput][lang]}`, `Pressione uma tecla/botão para: ${ACTION_LABELS[waitingForInput][lang]}`)}
                 </div>
                 <button data-nav="true" 
                    className="mt-8 text-sm text-white/40 hover:text-white uppercase"
                    onClick={() => setWaitingForInput(null)}
                 >
                    {t('Cancel', 'Cancelar')}
                 </button>
             </div>
          ) : (
             <div className="flex-1 overflow-y-auto pr-4 max-h-[50vh] flex flex-col gap-2">
                {(Object.keys(inputManager.bindings) as ActionType[]).map(action => (
                   <div key={action} className="flex items-center justify-between bg-black/40 p-3 border border-white/5 hover:border-white/20">
                      <span className="text-white/80 uppercase font-bold tracking-widest text-sm">
                         {ACTION_LABELS[action][lang]}
                      </span>
                      <button data-nav="true" 
                         onClick={() => setWaitingForInput(action)}
                         className="bg-[#00F2FF]/10 text-[#00F2FF] hover:bg-[#00F2FF] hover:text-black px-4 py-2 border border-[#00F2FF]/40 transition-colors uppercase font-mono text-sm min-w-[120px]"
                      >
                         {tab === 'keyboard' 
                            ? inputManager.bindings[action].keyboard.join(', ').replace('Mouse0', 'Left Click').replace('Mouse2', 'Right Click')
                            : `Btn ${inputManager.bindings[action].gamepad.join(', ')}`
                         }
                      </button>
                   </div>
                ))}
             </div>
          )}
          
          <div className="mt-8 flex justify-center">
             <button data-nav="true" 
                onClick={onClose}
                className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest hover:bg-white/90 transition-colors"
                disabled={waitingForInput !== null}
             >
                {t('Done', 'Concluído')}
             </button>
          </div>
      </div>
    </div>
  );
};
