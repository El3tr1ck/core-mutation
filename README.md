# Neon Core
_
v.1.2_1
_
Neon Core is a fast-paced 2D action roguelike game, architected and developed entirely with the assistance of Artificial Intelligence via the Google AI Studio platform using the Gemini model.

## Overview

In this survival action game, the player controls a highly mobile entity that must defend against escalating waves of dangerous enemies, including stealth snipers, melee creatures, and formidable bosses. The core gameplay revolves around fluid, fast-paced combat focusing on precise evasion, platforming mechanics, and the active management of Energy and Mana resources.

Upon successfully clearing an enemy wave, roguelite progression mechanics allow players to choose passive upgrade cards (Boons) that modify vital attributes or add new abilities to their arsenal, ensuring that every run is unique.

## Key Features & Capabilities

- **Custom Physics Engine**: Fast-paced combat supported by custom collision detection, friction, inertia, and a dynamic gravity system specifically tuned for fluid action.
- **Dynamic Ability System**: Access a wide array of spells and skills via a radial "Ability Wheel". Activating the wheel triggers a slow-motion effect, allowing for strategic decision-making mid-combat.
- **Advanced Survival Tactics**: Players can utilize rapid evasion techniques (Dash), deploy reactive shields to block incoming projectiles, jump to avoid environmental hazards, and charge up devastating special attacks.
- **Continuous Progression**: A robust roguelite upgrade system allows the player to construct unique builds each run. Upgrades include critical hit chance, projectile piercing, area-of-effect damage spread, and life steal.
- **Universal Input Support**: The input manager automatically detects and seamlessly transitions between Keyboard/Mouse and Gamepad controls.
- **High-Performance Canvas Rendering**: The game's visual logic is built entirely on HTML5 Canvas, ensuring high performance. It handles dozens of active entities and complex particle systems simultaneously while maintaining a stable 60 frames per second, perfectly synced with Delta Time calculations.
- **Extensive Modding Support**: A native, sandboxed Mod API allows developers and players to create custom content using JavaScript. This includes designing new bosses, enemies, or entirely new mechanics that can be loaded directly at runtime.

## Built with Gemini

The entire architecture of Neon Core — including the artificial intelligence of the enemies, the core game loop, the physics engine, the canvas rendering system, the reactive React UI overlay, and all bug fixing/refactoring — was generated and designed using the Gemini model in the Google AI Studio platform. This project serves as a showcase of integrating modern front-end design systems with a highly complex, real-time rendering backend purely through AI-assisted engineering.

## Technologies Used

- **TypeScript** & **React**: Used for managing reactive states and building the polished user interface overlay.
- **HTML5 Canvas / Vanilla JS**: The core engine responsible for rendering and physics processing via `requestAnimationFrame`.
- **Tailwind CSS** & **Framer Motion**: Utilized to create a clean, responsive, and animated user interface outside the game canvas.

## Controls

The game features fully remappable controls. The default mappings are:

| Action | Keyboard / Mouse | Gamepad |
| :--- | :--- | :--- |
| **Movement** | WASD / Arrow Keys | D-Pad / Left Analog Stick |
| **Aiming** | Mouse Cursor | Right Analog Stick |
| **Jump** | Space | A / Cross |
| **Dash (Evade)** | Left Shift | B / Circle |
| **Basic Attack**| Left Mouse Button | RT / R2 |
| **Special Attack**| Right Mouse Button | LT / L2 |
| **Ability Wheel** | Hold C | Y / Triangle |
| **Equip Abilities**| Q and E (while wheel is open) | LB / RB (while wheel is open) |
| **Shield** | F | X / Square |
| **Pause** | ESC | Start / Options |

*All key bindings can be customized through the Settings menu and are saved locally.*

## Installation & Local Development

1. Ensure [Node.js](https://nodejs.org/) is installed on your system.
2. Clone the repository or download the source code.
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Start the local Vite development server:
   ```bash
   npm run dev
   ```
5. Open your web browser and navigate to the provided local URL (typically `http://localhost:3000`).

## Modding Guide

Neon Core includes comprehensive support for custom content. If you are interested in programming custom enemies, balancing tweaks, or experimental mechanics, please refer to the `MODS_GUIDE.md` file located in the root directory.

The guide explains how to interface with the game's internal classes and variables using the sandbox `ModAPI`. Custom scripts can be written in JavaScript, packaged into a `.zip` file, and loaded directly through the game's in-built mod manager interface.

