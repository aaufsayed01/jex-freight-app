import { create } from "zustand";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/roleRoutes";
import { ENDPOINTS } from "@/lib/endpoints";

export type User = {
  id: string;
  email: string;
  fullName?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
};

type LoginResponse = {
  token: string;
  user: User;
};

type AuthState = {
  token: string | null;
  user: User | null;

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;

  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,

  setAuth: (token, user) => set({ token, user }),
  clearAuth: () => set({ token: null, user: null }),

  login: async (email, password) => {
    const res = await api.post<LoginResponse>(
      "http://localhost:3001/auth/login",
      { email, password }
    );
    const { token, user } = res.data;
    
    set({ token, user });
    return { token, user };
  },

  logout: () => {
    // optional: call backend logout if you have it
    set({ token: null, user: null });
  },
}));

