import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'tj_theme_preference';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  initialize: () => void;
}

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }
  return pref;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    // Update meta theme-color for mobile status bar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'light' ? '#FFFFFF' : 'var(--bg-app)');
    }
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolved: 'dark',

  setPreference: (p) => {
    const resolved = resolveTheme(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {}
    applyTheme(resolved);
    set({ preference: p, resolved });
  },

  initialize: () => {
    const pref = readPreference();
    const resolved = resolveTheme(pref);
    applyTheme(resolved);
    set({ preference: pref, resolved });

    // Subscribe to system changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const onChange = () => {
        if (get().preference === 'system') {
          const next = resolveTheme('system');
          applyTheme(next);
          set({ resolved: next });
        }
      };
      mq.addEventListener('change', onChange);
    }
  },
}));
