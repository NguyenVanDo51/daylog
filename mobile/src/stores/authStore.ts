import { create } from 'zustand';

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (partial: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
  clearAuth: () => set({ token: null, user: null }),
}));
