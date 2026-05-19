import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { modAPI, LoadedMod } from '../game/modAPI';
import { t, Language } from '../lib/i18n';

export function ModsMenu({ onClose, currentLang }: { onClose: () => void, currentLang: Language }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mods, setMods] = useState<LoadedMod[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMods([...modAPI.loadedMods]);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loaded = await modAPI.loadModFromZip(file);
      if (loaded) {
        setMods([...modAPI.loadedMods]);
        setError(null);
      } else {
        setError('Failed to load mod. Make sure it contains mod.json and main.js.');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading mod.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
    >
      <h2 className="text-4xl font-bold mb-8 uppercase tracking-widest text-[#00F2FF]">
        {currentLang === 'pt' ? 'Sistema de Mods' : 'Mod System'}
      </h2>

      <div className="w-full max-w-2xl bg-white/5 border border-white/20 p-6 flex flex-col items-center min-h-[400px]">
        {error && <div className="text-red-500 mb-4 bg-red-500/10 p-2 border border-red-500/20 w-full text-center">{error}</div>}

        <p className="text-white/50 text-center mb-6 max-w-lg">
          {currentLang === 'pt' 
            ? 'Crie arquivos .zip ou .cm com um "mod.json" e um "main.js" usando nosso ModAPI global.'
            : 'Create .zip or .cm archives containing a "mod.json" and "main.js" using our global ModAPI.'}
        </p>

        <div className="flex gap-4 mb-4">
            <button 
                data-nav="true"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-[#00F2FF]/20 border border-[#00F2FF] hover:bg-[#00F2FF]/30 text-[#00F2FF] font-bold uppercase tracking-widest transition-colors"
            >
                {currentLang === 'pt' ? 'Importar Mod (.zip / .cm)' : 'Import Mod (.zip / .cm)'}
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                accept=".zip,.cm" 
                onChange={handleFileUpload} 
                className="hidden" 
            />
        </div>

        <div className="w-full mt-4 flex flex-col gap-2 overflow-y-auto">
          {mods.length === 0 ? (
            <div className="text-white/30 text-center mt-10">
              {currentLang === 'pt' ? 'Nenhum mod carregado.' : 'No mods loaded.'}
            </div>
          ) : (
            mods.map((mod, i) => (
              <div key={i} className="flex justify-between items-center bg-white/10 p-4 border border-white/10">
                <div>
                  <h3 className="font-bold text-lg text-white">{mod.meta.name} <span className="text-white/50 text-sm">v{mod.meta.version}</span></h3>
                  <p className="text-white/70 text-sm">{mod.meta.description}</p>
                  <p className="text-white/40 text-xs mt-1">por {mod.meta.author}</p>
                </div>
                <div className="text-green-400 border border-green-400 px-2 py-1 text-xs uppercase tracking-widest">
                  Ativo
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        data-nav="true"
        onClick={onClose}
        className="mt-8 px-8 py-3 border border-white/20 hover:bg-white/10 text-white font-bold uppercase tracking-widest transition-colors"
      >
        {t('back')}
      </button>
    </motion.div>
  );
}
