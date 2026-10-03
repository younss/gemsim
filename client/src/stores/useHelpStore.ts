// ============================================================================
// GEMSIM: HELP SURFACES STATE
// Glossary panel, commented demo and guided tutorial visibility.
// ============================================================================

import { create } from 'zustand';

const TUTORIAL_SEEN_KEY = 'gemsim_tutorial_seen';

interface HelpState {
  glossaryOpen: boolean;
  demoOpen: boolean;
  tutorialActive: boolean;
  setGlossaryOpen: (open: boolean) => void;
  setDemoOpen: (open: boolean) => void;
  startTutorial: () => void;
  endTutorial: () => void;
  tutorialSeen: () => boolean;
}

export const useHelpStore = create<HelpState>(set => ({
  glossaryOpen: false,
  demoOpen: false,
  tutorialActive: false,
  setGlossaryOpen: open => set({ glossaryOpen: open }),
  setDemoOpen: open => set({ demoOpen: open }),
  startTutorial: () => set({ tutorialActive: true }),
  endTutorial: () => {
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    } catch {
      // storage unavailable: the tutorial may show again
    }
    set({ tutorialActive: false });
  },
  tutorialSeen: () => {
    try {
      return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
    } catch {
      return false;
    }
  },
}));
