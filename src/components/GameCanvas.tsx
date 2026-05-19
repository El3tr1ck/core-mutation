import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine';
import { Card, GameState, PlayerStats } from '../game/types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getSaves, loadGame, saveGame } from '../game/save';
import { t, Language, setLanguage, getLanguage } from '../lib/i18n';
import { ControlsConfig } from './ControlsConfig';
import { useGamepadNav } from '../hooks/useGamepadNav';
import { ModsMenu } from './ModsMenu';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [cardsOffered, setCardsOffered] = useState<Card[]>([]);
  const [currentLang, setCurrentLang] = useState<Language>(getLanguage());
  const [showSavesList, setShowSavesList] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showMods, setShowMods] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useGamepadNav(gameState !== GameState.PLAYING);

  useEffect(() => {
    const handleGlobalError = (e: ErrorEvent) => {
      setGlobalError(`${e.message} at ${e.filename}:${e.lineno}`);
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  const [runProgress, setRunProgress] = useState({ runTime: 0, duration: 60, level: 1 });

  const handleLangToggle = useCallback(() => {
    const nextLang = currentLang === 'en' ? 'pt' : 'en';
    setLanguage(nextLang);
    setCurrentLang(nextLang);
  }, [currentLang]);

  const [engineState, setEngineState] = useState<{
    q: any, e: any, wheelOpen: boolean, wheelAbilities: any[], wheelHoverIndex: number
  }>({ q: null, e: null, wheelOpen: false, wheelAbilities: Array(8).fill(null), wheelHoverIndex: -1 });

  const [gameXP, setGameXP] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    if (engineRef.current) {
      engineRef.current.canvas = canvasRef.current;
      engineRef.current.ctx = canvasRef.current.getContext('2d')!;
    } else {
      const engine = new GameEngine(canvasRef.current);
      engine.onStateChange = (state, eng) => {
         setGameState(state);
         if (eng) {
           setRunProgress({ runTime: eng.runTime, duration: eng.levelDuration, level: eng.level });
         }
      };
      engine.onStatsUpdate = (s, eng) => {
        setStats({ ...s });
        if (eng) {
           setEngineState({
              q: eng.equippedAbilities.q,
              e: eng.equippedAbilities.e,
              wheelOpen: eng.wheelOpen,
              wheelAbilities: [...eng.wheelAbilities],
              wheelHoverIndex: eng.wheelHoverIndex
           });
           setGameXP(eng.gameXP);
        }
      };
      engine.onCardsOffered = setCardsOffered;
      engine.onProgressUpdate = (rt, dur, l) => setRunProgress({ runTime: rt, duration: dur, level: l });
      engineRef.current = engine;
    }

    // Handle resize robustly
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (canvasRef.current) {
          canvasRef.current.width = entry.contentRect.width;
          canvasRef.current.height = entry.contentRect.height;
        }
      }
    });
    
    if (canvasRef.current.parentElement) {
       resizeObserver.observe(canvasRef.current.parentElement);
    }
    
    // Initial size
    if (canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }

    return () => {
      resizeObserver.disconnect();
      if (engineRef.current) {
        engineRef.current.state = GameState.GAMEOVER; // stop loop
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameState === GameState.PLAYING) {
          engineRef.current!.state = GameState.PAUSED;
          setGameState(GameState.PAUSED);
        } else if (gameState === GameState.PAUSED) {
          engineRef.current!.state = GameState.PLAYING;
          setGameState(GameState.PLAYING);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const [showInstructions, setShowInstructions] = useState(true);
  useEffect(() => {
    if (gameState === GameState.PLAYING && engineRef.current?.level === 1) {
      setShowInstructions(true);
      const timer = setTimeout(() => setShowInstructions(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowInstructions(false);
    }
  }, [gameState]);

  const startGame = () => {
    engineRef.current?.start(null);
  };

  const continueGame = () => {
    setShowSavesList(true);
  };

  const loadSpecificSave = (id: string) => {
    setShowSavesList(false);
    engineRef.current?.start(id);
  };

  const saveAndExit = () => {
    if (engineRef.current) {
      // Create a save file
      saveGame({
        id: `save_${Date.now()}`,
        date: new Date().toISOString(),
        level: engineRef.current.level,
        deck: engineRef.current.deck,
      });
      engineRef.current.state = GameState.MENU;
      setGameState(GameState.MENU);
    }
  };

  const resumeGame = () => {
    if (engineRef.current) {
      engineRef.current.state = GameState.PLAYING;
      setGameState(GameState.PLAYING);
    }
  };

  const selectCard = (card: Card) => {
    engineRef.current?.addCard(card);
    setCardsOffered([]);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050506] text-[#E0E0E6] font-sans tracking-wide">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute bottom-20 left-0 w-full h-[2px] bg-white/20"></div>
        <div className="absolute bottom-40 left-20 w-48 h-4 bg-white/10 rounded-full"></div>
        <div className="absolute bottom-60 right-40 w-64 h-4 bg-white/10 rounded-full"></div>
        <div className="absolute top-1/2 left-1/3 w-32 h-4 bg-white/10 rounded-full"></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, #1A1A2E 0%, #050506 100%)' }}></div>
      </div>

      <canvas ref={canvasRef} className={`absolute inset-0 z-10 block w-full h-full ${gameState === GameState.PLAYING ? 'cursor-none' : ''}`} />

      {globalError && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 text-red-500 font-mono text-xl p-10 text-center pointer-events-none">
          Encountered Fatal Error:<br/>{globalError}
        </div>
      )}

      {/* Main Menu */}
      <AnimatePresence>
        {gameState === GameState.MENU && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <h1 className="text-7xl font-bold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-[#00F2FF] via-[#7000ff] to-[#ff4e00]" style={{ textShadow: '0 0 40px rgba(0, 242, 255, 0.4)' }}>
              CORE <span className="font-light">MUTATION</span>
            </h1>
            <p className="text-xl text-white/50 mb-12 font-mono uppercase tracking-widest text-center max-w-md">
              {t('guideSub')}
            </p>
            {showSavesList ? (
              <div className="flex flex-col gap-4 w-96 max-h-96 overflow-y-auto">
                 <h2 className="text-2xl text-white font-bold mb-4 uppercase tracking-widest text-center">Load Save</h2>
                 {getSaves().map(save => (
                    <button data-nav="true" 
                       key={save.id}
                       onClick={() => loadSpecificSave(save.id)}
                       className="p-4 border border-white/20 bg-white/5 hover:bg-white/10 text-left transition-colors flex justify-between items-center"
                    >
                       <div>
                          <div className="text-lg font-bold text-white mb-1">Level {save.level}</div>
                          <div className="text-xs text-white/50">{new Date(save.date).toLocaleString()}</div>
                       </div>
                       <div className="text-xs text-white/70">{save.deck.length} Cards</div>
                    </button>
                 ))}
                 <button data-nav="true" onClick={() => setShowSavesList(false)} className="mt-4 text-white/50 hover:text-white uppercase text-sm tracking-widest">{t('back')}</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button data-nav="true"
                  onClick={startGame}
                  className="px-8 py-4 text-xl font-bold bg-[#E0E0E6] text-[#050506] hover:bg-white rounded-sm transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-[#E0E0E6]"
                >
                  {t('start')}
                </button>
                {getSaves().length > 0 && (
                  <button data-nav="true"
                    onClick={continueGame}
                    className="px-8 py-4 text-xl font-bold bg-transparent border-2 border-white/40 text-white/80 hover:bg-white/10 hover:border-white transition-all rounded-sm uppercase tracking-widest"
                  >
                    {t('continue')}
                  </button>
                )}
                <button data-nav="true"
                  onClick={() => setShowMods(true)}
                  className="px-8 py-4 text-xl font-bold bg-transparent border border-[#00F2FF]/40 text-[#00F2FF]/80 hover:bg-[#00F2FF]/10 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all rounded-sm uppercase tracking-widest mt-4"
                >
                  {currentLang === 'pt' ? 'MODS' : 'MODS'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMods && (
          <ModsMenu onClose={() => setShowMods(false)} currentLang={currentLang} />
        )}
      </AnimatePresence>

      {/* Pause Menu */}
      <AnimatePresence>
        {gameState === GameState.PAUSED && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
          >
             {showOptions ? (
               <div className="flex flex-col items-center w-64 gap-6">
                  <h2 className="text-4xl font-black text-white/80 tracking-[0.2em]">{t('options')}</h2>
                  
                  <div className="flex flex-col gap-2 w-full">
                     <span className="text-xs uppercase tracking-widest text-[#00F2FF]">{t('language')}</span>
                     <button data-nav="true" onClick={handleLangToggle} className="w-full px-6 py-4 text-lg font-bold bg-white/5 border border-white/20 hover:bg-white/10 uppercase tracking-widest text-white transition-colors">
                       {currentLang === 'en' ? 'ENGLISH (EN)' : 'PORTUGUÊS (PT)'}
                     </button>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                     <button data-nav="true" onClick={() => setShowControls(true)} className="w-full px-6 py-4 text-lg font-bold bg-white/5 border border-white/20 hover:bg-white/10 uppercase tracking-widest text-white transition-colors">
                       {currentLang === 'en' ? 'CONTROLS' : 'CONTROLES'}
                     </button>
                  </div>
                  
                  <button data-nav="true"
                    onClick={() => setShowOptions(false)}
                    className="mt-8 text-white/50 hover:text-white uppercase text-sm tracking-widest"
                  >
                    {t('back')}
                  </button>
               </div>
            ) : (
               <>
                  <h2 className="text-6xl font-black text-white/80 mb-12 tracking-[0.2em]">{t('pauseTitle')}</h2>
                  
                  {stats && (
                     <div className="absolute left-10 top-1/2 -translate-y-1/2 bg-black/50 border border-white/10 p-6 rounded text-white/80 w-64 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                        <h3 className="text-[#00F2FF] font-bold uppercase tracking-widest mb-4 border-b border-white/20 pb-2">Status</h3>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'VIDA MAX' : 'MAX HP'}</span> <span className="text-white">{Math.round(stats.maxHp)}</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'MANA MAX' : 'MAX MANA'}</span> <span className="text-[#0ea5e9]">{Math.round(stats.maxMana)}</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'DANO' : 'DAMAGE'}</span> <span className="text-[#ef4444]">{Math.round(stats.damage)}</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'VELOCIDADE' : 'SPEED'}</span> <span className="text-[#22c55e]">{Math.round(stats.speed)}</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'TAXA DE FOGO' : 'FIRE RATE'}</span> <span className="text-[#fbbf24]">{stats.attackRate.toFixed(1)}/s</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'CRITICO' : 'CRIT'}</span> <span className="text-[#f97316]">{(stats.critChance * 100).toFixed(0)}%</span></div>
                        <div className="flex justify-between font-mono text-sm mb-2"><span>{currentLang === 'pt' ? 'ROUBO DE VIDA' : 'LIFESTEAL'}</span> <span className="text-[#ec4899]">{(stats.lifesteal * 100).toFixed(0)}%</span></div>
                     </div>
                  )}

                  <div className="flex flex-col gap-4 w-64">
                    <button data-nav="true"
                      onClick={resumeGame}
                      className="w-full px-6 py-4 text-lg font-bold bg-transparent border-2 border-[#00F2FF] text-[#00F2FF] hover:bg-[#00F2FF]/20 transition-all rounded-sm uppercase tracking-widest text-center"
                    >
                      {t('resume')}
                    </button>
                    <button data-nav="true"
                      onClick={() => setShowOptions(true)}
                      className="w-full px-6 py-4 text-lg font-bold bg-transparent border-2 border-white/40 text-white/80 hover:bg-white/10 hover:border-white transition-all rounded-sm uppercase tracking-widest text-center"
                    >
                      {t('options')}
                    </button>
                    <button data-nav="true"
                      onClick={saveAndExit}
                      className="w-full px-6 py-4 text-lg font-bold bg-transparent border-2 border-white/40 text-white/80 hover:bg-white/10 hover:border-white transition-all rounded-sm uppercase tracking-widest text-center"
                    >
                      {t('saveExit')}
                    </button>
                  </div>
               </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showControls && (
        <ControlsConfig onClose={() => setShowControls(false)} lang={currentLang} />
      )}

      {/* Game Over */}
      <AnimatePresence>
        {gameState === GameState.GAMEOVER && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <h2 className="text-6xl font-black text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] uppercase">{t('gameOver')}</h2>
            <p className="text-gray-400 mb-8 font-mono text-lg">Your build was corrupted.</p>
            <button data-nav="true"
              onClick={startGame}
              className="px-8 py-4 text-lg font-bold bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-sm uppercase tracking-widest"
            >
              {t('retry')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory */}
      <AnimatePresence>
        {gameState === GameState.VICTORY && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <h2 className="text-6xl font-black text-[#00F2FF] mb-6 drop-shadow-[0_0_20px_rgba(0,242,255,0.8)] uppercase">{t('victory')}</h2>
            <p className="text-gray-400 mb-8 font-mono text-lg">{t('victorySub')}</p>
            <div className="flex gap-4">
               <button data-nav="true"
                 onClick={startGame}
                 className="px-8 py-4 text-lg font-bold bg-[#E0E0E6] text-[#050506] hover:bg-white transition-all rounded-sm uppercase tracking-widest"
               >
                 {t('start')}
               </button>
               <button data-nav="true"
                 onClick={() => {
                   if (engineRef.current) {
                     engineRef.current.state = GameState.MENU;
                     setGameState(GameState.MENU);
                   }
                 }}
                 className="px-8 py-4 text-lg font-bold bg-transparent border-2 border-white/40 text-white/80 hover:bg-white/10 hover:border-white transition-all rounded-sm uppercase tracking-widest"
               >
                 {t('menu')}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <AnimatePresence>
        {gameState === GameState.PLAYING && stats && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-0 left-0 right-0 pointer-events-none z-20 flex flex-col items-center p-6"
          >
            {/* Top Bar: Progress and Missions */}
            <div className="w-full max-w-4xl flex flex-col items-center gap-1 mb-4">
               <div className="flex justify-between w-full text-[10px] items-end mb-1">
                  <div className="flex flex-col">
                     <span className="font-mono text-[#00F2FF] tracking-widest uppercase">
                        {currentLang === 'pt' ? `ONDA ${runProgress.level}: ` : `WAVE ${runProgress.level}: `}
                        {Math.floor((runProgress.runTime / runProgress.duration) * 100)}%
                     </span>
                     <span className="font-mono text-white/50 text-xs">
                        {Math.floor(runProgress.runTime)} / {runProgress.duration}s
                     </span>
                  </div>
                  
                  {/* Mission tracking */}
                  <div className="flex flex-col items-center bg-black/60 px-4 py-1 border border-white/10 rounded">
                     <span className="text-[#10b981] font-bold text-xs uppercase tracking-widest">
                        {currentLang === 'pt' ? 'Missão Atual' : 'Current Mission'}
                     </span>
                     <span className="text-white text-[10px]">
                        {currentLang === 'pt' ? 'Elimine' : 'Kill'} {engineRef.current?.missionReq} {currentLang === 'pt' ? 'inimigos' : 'enemies'}
                     </span>
                     <div className="text-white/80 font-mono text-sm mt-1">
                        {engineRef.current?.missionCount} / {engineRef.current?.missionReq}
                     </div>
                  </div>

                  <div className="flex flex-col text-right">
                     <span className="font-mono text-[#FACC15] tracking-widest uppercase text-xs">
                        {gameXP} XP
                     </span>
                  </div>
               </div>
               <div className="w-full h-3 bg-black/60 border border-white/20 rounded-sm overflow-hidden flex relative">
                  <div className="absolute inset-0 bg-white/5" style={{ backgroundSize: '10px 10px', backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, transparent 75%, transparent)' }}></div>
                  <div 
                     className="h-full bg-gradient-to-r from-[#00F2FF]/50 to-[#00F2FF] shadow-[0_0_10px_rgba(0,242,255,0.5)] transition-all duration-300 ease-out"
                     style={{ width: `${Math.min(100, (runProgress.runTime / runProgress.duration) * 100)}%` }}
                  />
               </div>
            </div>

            <div className="w-full flex justify-between items-start pointer-events-none">
              <div className="flex gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#FF2E2E] flex items-center justify-center border-2 border-white/20 shadow-[0_0_15px_rgba(255,46,46,0.4)] text-[8px] font-bold text-white/50">{t('hp')}</div>
                  <div className="w-64 h-6 bg-black/40 border border-white/10 overflow-hidden rounded-sm">
                    <div
                      className="h-full bg-gradient-to-r from-[#8B0000] to-[#FF2E2E] transition-all duration-200"
                      style={{ width: `${Math.max(0, (stats.hp / stats.maxHp) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono">{Math.floor(stats.hp)}</span>
                </div>
                <div className="flex items-center gap-3 opacity-90">
                  <div className="w-10 h-6 rounded bg-[#00F2FF] flex items-center justify-center border-2 border-white/20 shadow-[0_0_15px_rgba(0,242,255,0.4)] text-[8px] font-bold text-white/50">MP</div>
                  <div className="w-48 h-4 bg-black/40 border border-white/10 overflow-hidden rounded-sm">
                    <div className="h-full bg-[#00F2FF] transition-all duration-100" style={{ width: `${Math.max(0, (stats.mana / stats.maxMana) * 100)}%` }}></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-90">
                  <div className="w-10 h-6 rounded bg-[#FACC15] flex items-center justify-center border-2 border-white/20 shadow-[0_0_15px_rgba(250,204,21,0.4)] text-[8px] font-bold text-white/50 text-black">EN</div>
                  <div className="w-40 h-3 bg-black/40 border border-white/10 overflow-hidden rounded-sm">
                    <div className="h-full bg-[#FACC15] transition-all duration-100" style={{ width: `${Math.max(0, (stats.energy / stats.maxEnergy) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
              
              {/* Active Skills UI */}
              <div className="flex flex-col gap-2 ml-4 mt-1">
                {[
                  { keyName: 'Q', skill: engineState.q },
                  { keyName: 'E', skill: engineState.e }
                ].map(({ keyName, skill }) => {
                  if (!skill) return null;
                  const cooldownPercent = skill.currentCooldown > 0 ? (skill.currentCooldown / skill.cooldown) * 100 : 0;
                  return (
                    <div key={keyName} className="flex flex-col items-center gap-1">
                      <div className="relative w-12 h-12 bg-black/60 border-2 border-white/20 rounded flex items-center justify-center overflow-hidden">
                        {/* Cooldown overlay */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm transition-all duration-100 block" 
                          style={{ height: `${cooldownPercent}%` }}
                        />
                        <span className="relative z-10 font-bold text-white/50">{keyName}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-widest text-white/60 text-center max-w-[60px] truncate">{currentLang === 'pt' && skill.namePt ? skill.namePt : skill.name}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* Shift Wheel Quick UI Overlay */}
              <AnimatePresence>
                {engineState.wheelOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto"
                  >
                     <div className="relative w-96 h-96 flex items-center justify-center">
                        {/* Wheel slots (Q, E, and 8 reserve slots) */}
                        {[engineRef.current?.equippedAbilities.q || null, engineRef.current?.equippedAbilities.e || null, ...engineState.wheelAbilities].map((wSkill, i) => {
                           const totalSlots = 2 + engineState.wheelAbilities.length;
                           const angle = (i / totalSlots) * Math.PI * 2 - Math.PI / 2;
                           const r = 140;
                           const x = Math.cos(angle) * r;
                           const y = Math.sin(angle) * r;
                           const isEquipped = i === 0 || i === 1;
                           const isHovered = engineState.wheelHoverIndex === i;
                           const slotName = i === 0 ? 'Q' : i === 1 ? 'E' : `S${i - 1}`;
                           return (
                              <div key={i} className={`absolute transition-transform duration-200 ${isHovered ? 'scale-125 z-20' : 'scale-100 z-10'}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
                                 <button data-nav="true"
                                   onClick={() => {
                                      // Quick swap logic
                                      if (!isEquipped && wSkill && engineRef.current) {
                                         // Default: swap with E
                                         const oldE = engineRef.current.equippedAbilities.e;
                                         engineRef.current.equippedAbilities.e = wSkill;
                                         engineRef.current.wheelAbilities[i - 2] = oldE;
                                         engineRef.current.onStatsUpdate?.(engineRef.current.stats, engineRef.current);
                                      }
                                   }}
                                   className={cn(
                                     "w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center p-1 transition-all relative overflow-visible",
                                     wSkill ? (isEquipped ? "bg-[#FACC15]/20 border-[#FACC15]" : "bg-[#00F2FF]/10 border-[#00F2FF]") : "bg-black/40 border-white/10 border-dashed",
                                     isHovered && "ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.5)] border-white"
                                   )}
                                 >
                                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-black border border-white/30 rounded-full flex items-center justify-center text-[8px] font-bold text-white z-10">{slotName}</div>
                                    {wSkill ? (
                                      <>
                                        <span className="text-[10px] font-bold text-white text-center leading-tight truncate w-full">{currentLang === 'pt' && wSkill.namePt ? wSkill.namePt : wSkill.name}</span>
                                      </>
                                    ) : (
                                      <span className="text-white/20 text-[9px]">Empty</span>
                                    )}
                                 </button>
                              </div>
                           );
                        })}
                        <div className="absolute text-center bg-black/50 p-4 rounded-full backdrop-blur-sm border border-white/10 pointer-events-none">
                           <div className="text-[#00F2FF] tracking-widest font-bold uppercase">{t('swapAbility') || 'SELECIONAR'}</div>
                           <div className="text-white/50 text-xs mt-1">{currentLang === 'pt' ? 'Mire e pressione Q ou E' : 'Aim and press Q or E'}</div>
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Selection */}
      <AnimatePresence>
        {gameState === GameState.UPGRADE && cardsOffered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
            className="absolute inset-0 z-40 bg-[#050506]/80 flex flex-col items-center justify-center p-8 gap-8"
          >
            <div className="text-center">
              <h2 className="text-[11px] tracking-[0.4em] uppercase text-[#00F2FF] mb-2">Build Evolution Sequence</h2>
              <p className="font-serif text-3xl italic text-[#E0E0E6]">Select Your Mutation</p>
            </div>
            
            {/* Card Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl md:h-[400px]">
              {cardsOffered.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => selectCard(card)}
                  className="bg-[#0F0F12] border border-white/10 rounded-xl p-6 flex flex-col justify-between hover:border-white/40 transition-colors relative group overflow-hidden cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                >
                  <div className="absolute top-0 right-0 p-2 text-[10px] font-bold tracking-widest opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: card.color }}>
                    {(card.category || 'SPECIAL').toUpperCase()}
                  </div>
                  <div className="space-y-4 relative z-10 w-full">
                    <h3 className="text-xl font-serif italic border-b pb-2" style={{ color: card.color, borderColor: `${card.color}40` }}>
                      {currentLang === 'pt' && card.namePt ? card.namePt : card.name}
                    </h3>
                    <div className="space-y-3 font-mono">
                      {(currentLang === 'pt' && card.descriptionPt ? card.descriptionPt : card.description).map((desc, idx) => {
                        const isNegative = desc.includes('-') || desc.toLowerCase().includes('weaker') || desc.toLowerCase().includes('slower') || desc.toLowerCase().includes('lose') || desc.toLowerCase().includes('perda') || desc.toLowerCase().includes('perde') || desc.toLowerCase().includes('lento');
                        
                        if (card.category !== 'status') {
                           return (
                             <div key={idx} className="p-2 bg-white/5 rounded border border-white/10">
                               <p className="text-xs text-[#E0E0E6]/90">{desc}</p>
                             </div>
                           )
                        }

                        return (
                          <div key={idx} className={`p-2 rounded ${isNegative ? 'bg-[#FF2E2E]/10' : 'bg-[#00F2FF]/10'}`}>
                            <div className={`text-[10px] font-bold uppercase mb-1 ${isNegative ? 'text-[#FF2E2E]' : 'text-[#00F2FF]'}`}>
                              {isNegative ? (currentLang === 'pt' ? 'Desvantagem' : 'Disadvantage') : (currentLang === 'pt' ? 'Vantagem' : 'Advantage')}
                            </div>
                            <p className="text-xs text-[#E0E0E6]/90 font-bold">{desc}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="mt-4 border-t border-white/5 pt-4 relative z-10">
                    <div className="text-[9px] uppercase text-white/30 mb-2 flex gap-1 flex-wrap">Category: {card.category}</div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: '100%', backgroundColor: card.color }}></div>
                    </div>
                  </div>
                  <div 
                    className="absolute inset-x-0 -bottom-10 h-32 blur-3xl opacity-10 group-hover:opacity-20 transition duration-500 pointer-events-none"
                    style={{ backgroundColor: card.color }}
                  ></div>
                </motion.div>
              ))}
            </div>

            {/* Permanent Next Match Buffs */}
            <div className="w-full max-w-5xl mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[#FACC15] uppercase tracking-widest font-bold text-sm">
                     {currentLang === 'pt' ? 'Vantagens da Próxima Partida' : 'Next Match Advantages'}
                  </h3>
                  <div className="text-[#FACC15] font-mono font-bold">{gameXP} XP</div>
                </div>
                <div className="flex gap-4">
                   <button data-nav="true" 
                      onClick={() => {
                        if (engineRef.current && engineRef.current.gameXP >= 100) {
                           engineRef.current.gameXP -= 100;
                           setGameXP(engineRef.current.gameXP);
                           engineRef.current.stats.maxHp += 50;
                           engineRef.current.stats.hp += 50;
                           engineRef.current.tempStatsModifiers.maxHp += 50;
                           engineRef.current.onStatsUpdate?.(engineRef.current.stats, engineRef.current);
                        }
                      }}
                      className={cn(
                        "flex-1 p-4 border rounded hover:bg-white/10 transition-colors flex flex-col items-center gap-2",
                        gameXP >= 100 ? "border-[#FF2E2E] text-white cursor-pointer" : "border-white/10 text-white/30 cursor-not-allowed"
                      )}
                      disabled={gameXP < 100}
                   >
                      <div className="font-bold text-[#FF2E2E]">+50 {currentLang === 'pt' ? 'Vida Máxima' : 'Max HP'}</div>
                      <div className="text-xs font-mono uppercase">100 XP</div>
                   </button>
                   <button data-nav="true" 
                      onClick={() => {
                        if (engineRef.current && engineRef.current.gameXP >= 100) {
                           engineRef.current.gameXP -= 100;
                           setGameXP(engineRef.current.gameXP);
                           engineRef.current.stats.maxMana += 25;
                           engineRef.current.stats.mana += 25;
                           engineRef.current.tempStatsModifiers.maxMana += 25;
                           engineRef.current.onStatsUpdate?.(engineRef.current.stats, engineRef.current);
                        }
                      }}
                      className={cn(
                        "flex-1 p-4 border rounded hover:bg-white/10 transition-colors flex flex-col items-center gap-2",
                        gameXP >= 100 ? "border-[#00F2FF] text-white cursor-pointer" : "border-white/10 text-white/30 cursor-not-allowed"
                      )}
                      disabled={gameXP < 100}
                   >
                      <div className="font-bold text-[#00F2FF]">+25 {currentLang === 'pt' ? 'Mana Máxima' : 'Max Mana'}</div>
                      <div className="text-xs font-mono uppercase">100 XP</div>
                   </button>
                   <button data-nav="true" 
                      onClick={() => {
                        if (engineRef.current && engineRef.current.gameXP >= 100) {
                           engineRef.current.gameXP -= 100;
                           setGameXP(engineRef.current.gameXP);
                           engineRef.current.stats.maxEnergy += 25;
                           engineRef.current.stats.energy += 25;
                           engineRef.current.tempStatsModifiers.maxEnergy += 25;
                           engineRef.current.onStatsUpdate?.(engineRef.current.stats, engineRef.current);
                        }
                      }}
                      className={cn(
                        "flex-1 p-4 border rounded hover:bg-white/10 transition-colors flex flex-col items-center gap-2",
                        gameXP >= 100 ? "border-[#FACC15] text-white cursor-pointer" : "border-white/10 text-white/30 cursor-not-allowed"
                      )}
                      disabled={gameXP < 100}
                   >
                      <div className="font-bold text-[#FACC15]">+25 {currentLang === 'pt' ? 'Energia Máxima' : 'Max Energy'}</div>
                      <div className="text-xs font-mono uppercase">100 XP</div>
                   </button>
                </div>
                <div className="text-xs text-white/40 mt-2 text-center uppercase tracking-widest">
                   {currentLang === 'pt' ? '*Bônus são mantidos apenas para o próximo nível e então removidos' : '*Buffs apply to the next level only'}
                </div>
            </div>


          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-white/50 font-mono text-sm pointer-events-none z-20"
          >
            <p className="mb-2">{t('controlsDef')}</p>
            <p className="mb-2">{t('controlsAtk')}</p>
            <p className="mb-2">{t('controlsDash')}</p>
            <p>{t('controlsCharge')}</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
