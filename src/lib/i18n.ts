export type Language = 'en' | 'pt';

export const translations = {
  en: {
    start: 'New Protocol',
    continue: 'Resume Protocol',
    level: 'Wave',
    hp: 'HP',
    energy: 'MP',
    damage: 'DMG',
    speed: 'SPD',
    pauseTitle: 'SYSTEM PAUSED',
    resume: 'Resume Combat',
    saveExit: 'Save & Exit',
    gameOver: 'SYSTEM FATAL ERROR',
    retry: 'Reboot Core',
    menu: 'Return to Menu',
    chooseCard: 'Select Upgrade Protocol',
    build: 'Current Build:',
    controlsDef: 'Move: WASD | Jump: Space | Shield: F',
    controlsAtk: 'Attack: Left Click | Aim: Mouse / Right Stick',
    controlsDash: 'Dash: Double tap A/D or Shift / B Button',
    controlsCharge: 'Hold Right Click to Charge Attack (Requires Mana)',
    guideTitle: 'NEURAL LINK ESTABLISHED',
    guideSub: 'Adaptive hostility detected. Survive the waves.',
    victory: 'SYSTEM PURGED',
    victorySub: 'Core integration complete. Threat eliminated.',
    options: 'Settings',
    back: 'Return',
    language: 'Language',
    coreRecovery: 'RUN PROGRESS',
    swapAbility: 'SWAP ABILITY'
  },
  pt: {
    start: 'Novo Protocolo',
    continue: 'Continuar',
    level: 'Onda',
    hp: 'HP',
    energy: 'MP',
    damage: 'ATQ',
    speed: 'VEL',
    pauseTitle: 'SISTEMA PAUSADO',
    resume: 'Retomar',
    saveExit: 'Salvar e Sair',
    gameOver: 'ERRO FATAL',
    retry: 'Reiniciar Núcleo',
    menu: 'Menu Principal',
    chooseCard: 'Selecione Protocolo',
    build: 'Build Atual:',
    controlsDef: 'Mover: WASD | Pulo: Espaço | Escudo: F',
    controlsAtk: 'Ataque: Botão Esq | Mirar: Mouse / Analógico',
    controlsDash: 'Esquiva: Shift ou Duplo A/D / Botão B',
    controlsCharge: 'Segure Botão Dir p/ Carregar Tiro (Usa 2 MP)',
    guideTitle: 'CONEXÃO ESTABELECIDA',
    guideSub: 'Ameaça detectada. Sobreviva.',
    victory: 'SISTEMA LIMPO',
    victorySub: 'Ameaça eliminada.',
    options: 'Configurações',
    back: 'voltar',
    language: 'Idioma',
    coreRecovery: 'PROGRESSO',
    swapAbility: 'HABILIDADE'
  }
};

let currentLang: Language = 'pt';

export function setLanguage(lang: Language) {
  currentLang = lang;
}

export function getLanguage() {
  return currentLang;
}

export function t(key: keyof typeof translations['en']): string {
  return translations[currentLang][key] || translations['en'][key] || key;
}
