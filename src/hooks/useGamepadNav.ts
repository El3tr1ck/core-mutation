import { useEffect, useRef, useState } from 'react';

export function useGamepadNav(isActive: boolean) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const elementsRef = useRef<HTMLElement[]>([]);
  const lastState = useRef({ up: false, down: false, a: false });

  useEffect(() => {
    setFocusedIndex(0);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    let raf: number;
    const update = () => {
      const gps = navigator.getGamepads();
      let gp: Gamepad | null = null;
      for (let i = 0; i < gps.length; i++) {
        if (gps[i]) { gp = gps[i]; break; }
      }

      if (gp) {
        // Collect all navigable elements
        const navElements = Array.from(document.querySelectorAll('[data-nav="true"]')) as HTMLElement[];
        elementsRef.current = navElements;

        const up = gp.axes[1] < -0.5 || gp.buttons[12]?.pressed;
        const down = gp.axes[1] > 0.5 || gp.buttons[13]?.pressed;
        const a = gp.buttons[0]?.pressed;

        if (up && !lastState.current.up) {
           setFocusedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, navElements.length - 1)));
        }
        if (down && !lastState.current.down) {
           setFocusedIndex(prev => (prev < navElements.length - 1 ? prev + 1 : 0));
        }

        // Apply physical focus
        if (navElements.length > 0) {
            const idx = Math.min(focusedIndex, navElements.length - 1);
            if (document.activeElement !== navElements[idx]) {
                navElements[idx].focus();
            }
        }

        if (a && !lastState.current.a) {
           if (navElements.length > 0) {
              const idx = Math.min(focusedIndex, navElements.length - 1);
              navElements[idx].click();
           }
        }

        lastState.current = { up, down, a };
      }

      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [isActive, focusedIndex]);

  return focusedIndex;
}
