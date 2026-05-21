import { create } from 'zustand';

const LS_KEY = 'tj_settings';

interface SettingsState {
  accountBalance: number;
  currency: 'USD' | 'EUR';
  balanceMode: 'fixed' | 'dynamic';
  favoriteInstruments: string[];
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
}

const DEFAULTS: Omit<SettingsState, 'isLoaded' | 'loadSettings' | 'updateSetting'> = {
  accountBalance: 10000,
  currency: 'USD',
  balanceMode: 'fixed',
  favoriteInstruments: ['EURUSD', 'GBPUSD', 'XAUUSD'],
};

function readFromLS(): Partial<typeof DEFAULTS> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeToLS(state: Partial<typeof DEFAULTS>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  isLoaded: false,

  loadSettings: async () => {
    const saved = readFromLS();
    set({
      accountBalance:
        typeof saved.accountBalance === 'number' ? saved.accountBalance : DEFAULTS.accountBalance,
      currency:
        saved.currency === 'USD' || saved.currency === 'EUR' ? saved.currency : DEFAULTS.currency,
      balanceMode:
        saved.balanceMode === 'fixed' || saved.balanceMode === 'dynamic'
          ? saved.balanceMode
          : DEFAULTS.balanceMode,
      favoriteInstruments: Array.isArray(saved.favoriteInstruments)
        ? saved.favoriteInstruments
        : DEFAULTS.favoriteInstruments,
      isLoaded: true,
    });
  },

  updateSetting: async (key, value) => {
    set((state) => ({ ...state, [key]: value }));
    const { accountBalance, currency, balanceMode, favoriteInstruments } = get();
    writeToLS({ accountBalance, currency, balanceMode, favoriteInstruments });
  },
}));
