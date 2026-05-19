# Guia Definitivo de Mods para Core Mutation (Estilo Minecraft Java)

Este guia ajudará você a criar e compilar seus mods para o **Core Mutation**. O uso da `ModAPI` não apenas permite modificar partes do jogo — **ela te dá acesso quase absoluto a toda a engine e ecossistema do React do jogo, da mesma forma que os Mods em Java fazem com o Minecraft**.

Diferente de sistemas restritos em outras engines, a **ModAPI te dá poder irrestrito**: você pode instanciar Classes nativas do jogo, adicionar interfaces gráficas e botões no HTML/React, reproduzir aúdios, ler arquivos compactados e sobrescrever o código original do jogo no nível das classes (*Monkey Patching*).

---

## 1. Estrutura Padrão do Mod (.cm / .zip)

Um mod é um arquivo `.zip` renomeado para `.cm` contendo a seguinte estrutura obrigatória. 

```text
MeuMod/
├── mod.json
├── main.js
└── assets/
    ├── sprite.png
    └── som.mp3
```

### O `mod.json`

Este arquivo guarda as informações do seu mod para a interface.

```json
{
  "id": "meumod_legal",
  "name": "Super Inimigos e Sons",
  "version": "1.0.0",
  "author": "Eu",
  "description": "Adiciona chefes, armas nucleares e músicas customizadas!"
}
```

---

## 2. Inicialização e Lendo Arquivos de dentro do ZIP

O arquivo `main.js` sempre recebe globalmente o objeto `ModAPI` e implicitamente um objeto `ModContext` ao iniciar. 
Em JavaScript, você precisa lidar as chamadas de loading (base64) para imagens e as injetar no `ModAPI.playSound` ou etc.

```javascript
// main.js - Exemplo de Inicialização e Lendo Texturas e Áudios do próprio Zip
(async function() {
    // Lendo um som do zip (retorna base64)
    const somBase64 = await ModContext.zipContent.file('assets/som.mp3').async('base64');
    const audioUrl = `data:audio/mp3;base64,${somBase64}`;
    
    // Tocar Som In-game sempre que eu quiser
    ModAPI.registerHook('onLevelStart', (engine, level) => {
        ModAPI.playSound(audioUrl, 0.5); // (link, volume)
    });
})();
```

---

## 3. Sobrescrevendo a GameEngine (Monkey Patching Extremo)

Como em Minecraft, as vezes você quer mudar as leis básicas da física da `GameEngine`. A `ModAPI` expõe tanto a *instância ativa* do jogo quanto a *Classe Definitiva*.

```javascript
const { engineClass } = ModAPI;

// Vamos sobrescrever a forma como o dano é administrado!
const fisicaOriginal = engineClass.prototype.updatePhysics;

engineClass.prototype.updatePhysics = function(dt) {
    // this refere-se ao próprio jogo (this.player, this.enemies, etc)
    
    // Deixar a foma Vanilla rodar
    fisicaOriginal.call(this, dt); 
    
    // Mas Adicionar nosso comportamento MOD
    // Exemplo: O jogador congela tudo no ar se apertar espaço
    if (this.inputManager?.isActionActive('jump_super')) {
        this.enemies.forEach(e => e.speed = 0);
    }
};
```

---

## 4. Criando e Desenhando Interfaces Novas e Botões (React & HTML)

Os mods não ficam só no fundo do motor gráfico Canvas, você tem acesso livre a construir React sem precisar carregar frameworks!

```javascript
/* === EXCEÇÃO: Acessando React e injetando Botões e Painéis === */
const { React, ReactDOM } = ModAPI;

const MeuMenuSecreto = () => {
    return React.createElement('div', { 
        style: { 
            position: 'absolute', top: 50, right: 50, 
            background: 'rgba(50, 0, 50, 0.9)', 
            padding: '20px', border: '2px solid purple',
            pointerEvents: 'auto' // Crucial para o mouse poder clicar!
        } 
    }, 
    [
        React.createElement('h1', { key: 'h', style: {color:'white'} }, "Cheat Menu"),
        React.createElement('button', { 
            key: 'b',
            style: { padding: '10px', background: 'white', color: 'black', cursor: 'pointer' },
            onClick: () => {
                // Ao clicar, o jogador ganha 5000 de vida se a engine existir
                if(ModAPI.engine) ModAPI.engine.stats.hp += 5000;
            }
        }, "Me dê 5000 de Vida!")
    ]);
};

// ModAPI gerencia e pendura no topo do DOM independente do React da aplicação
const uiHandle = ModAPI.mountReactComponent(MeuMenuSecreto);

// Se quiser remover: uiHandle.unmount()
```

---

## 5. Inimigos Customizados por Herança

Use o ecossistema de Entidades (Entity, Player, Enemy, Projectile)!

```javascript
const { classes } = ModAPI;

// Exemplo 2: Criando Inimigo Modificado que solta fogo
class DragaoAncestral extends classes.Enemy {
    constructor(x, y) {
        super(x, y, 'dragao', 10000, 100, 120);
        this.w = 300; this.h = 300; this.color = '#ff4400';
    }
    update(dt, player) {
        super.update(dt, player);
        // Exemplo de Inimigo Lançando Fogo periodicamente
        if (Math.random() < 0.05 && ModAPI.engine) {
             ModAPI.engine.projectiles.push(new classes.Projectile(
                this.x + this.w/2, this.y + this.h/2, 
                -(player.x - this.x), 0, // Tiros horizontais
                50, '#ff0000', false, 30
             ));
        }
    }
}
// Avisar a plataforma para criar Dragoes!
ModAPI.registerEnemy('dragao_ancestral', (x,y) => new DragaoAncestral(x,y));
```

---

## 6. Lista Oficial de Eventos / Hooks

Os seguintes hooks podem ser lidos facilmente com `ModAPI.registerHook(evento, (args) => {})`.

- `onLevelStart` -> Dispara toda vez que a dificuldade e o mundo aumentam. Args: `(engine, levelNum)`.
- `onPlayerDeath` -> Dispara quando a vida chega a `0`. Args: `(engine)`. Útil para reviver e prevenir Game Over subindo a vida novamente antes da transição da Cena.
- `onRender` -> Chamado em 60fps após o frame desenhar tudo! Ideal para desenhar barras de vida, overlays customizados 2D no contexto raw. Args: `(engine, ctx2d)`.
- `onTick` -> Evento mestre chamado em 60fps todo frame iterando lógica sem usar render. Args: `(engine, DeltaTime)`.

---

## Resumão da `ModAPI` Principal

- `ModAPI.classes` - Objeto que contém todas as classes nativas do jogo (`Player`, `Enemy`, `Projectile`, `Particle`, `DroppedItem`, `EnergyBox`).
- `ModAPI.inputManager` - Gerenciador que lida com todos os botões e teclas. Você pode modificar `ModAPI.inputManager.bindings` para alterar suporte a botões.
- `ModAPI.engineClass` - Classe Base da Engine (te permite sobrescritas via Prototype (monkey patching)).
- `ModAPI.engine` - Acesso rápido à instância do `GameEngine` atualmente em execução e estado do mundo.
- `ModAPI.React` e `ModAPI.ReactDOM` - Permite escrever menus elaborados que reagem aos dados.
- `ModAPI.mountReactComponent(Component)` - Componente gráfico React anexado fixo à tela.
- `ModAPI.playSound(urlBase64, volume)` - Para dar vida usando sons.

Vários mods podem ser jogados simultaneamente! Todo mod tem o poder absoluto de fazer QUALQUER COISA. Use esta documentação para começar e explore o núcleo procedural do jogo pela Engine Proxy! Como nos Mods Java Antigos: seu limite é quão fundo na Engine você consegue reescrever!

