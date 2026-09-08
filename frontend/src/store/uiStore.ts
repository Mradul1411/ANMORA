import { create } from 'zustand';
import type { ModelId } from '@/types/domain';

type RangeKey = '15m' | '1h' | '6h' | '24h';

interface UiState {
  theme: 'dark' | 'light';
  model: ModelId;
  range: RangeKey;
  showForecast: boolean;
  showBands: boolean;
  showFrames: boolean; // request JPEG frames over the socket
  frameRateHz: number;
  sidebarCollapsed: boolean;
  toastsEnabled: boolean;
  toggleTheme: () => void;
  setModel: (m: ModelId) => void;
  setRange: (r: RangeKey) => void;
  toggle: (key: 'showForecast' | 'showBands' | 'showFrames' | 'sidebarCollapsed' | 'toastsEnabled') => void;
  setFrameRateHz: (n: number) => void;
}

export const RANGE_MS: Record<RangeKey, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

function initialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('theme');
  return saved === 'light' ? 'light' : 'dark';
}

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme(),
  model: 'prophet',
  range: '1h',
  showForecast: true,
  showBands: true,
  showFrames: true,
  frameRateHz: 3,
  sidebarCollapsed: false,
  toastsEnabled: true,

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('theme', next);
        document.documentElement.dataset.theme = next;
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),
  setModel: (model) => set({ model }),
  setRange: (range) => set({ range }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<UiState>),
  setFrameRateHz: (n) => set({ frameRateHz: Math.min(5, Math.max(1, Math.round(n))) }),
}));

/** Apply the persisted theme before first paint to avoid a flash. */
export function applyTheme() {
  const t = initialTheme();
  document.documentElement.dataset.theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
}
