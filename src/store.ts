import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  theme: string;
  sidebarCollapsed: boolean;
  selectedReplication: string;
  token: string;
  user: any;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSelectedReplication: (value: string) => void;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      selectedReplication: '',
      token: '',
      user: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSelectedReplication: (value) => set({ selectedReplication: value }),
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: '', user: null }),
    }),
    { name: 's3mm-ui' },
  ),
);
