import { create } from "zustand";
import { login as loginRequest, register as registerRequest } from "../api/auth";
import { setAuthToken } from "../api/http";
import { User } from "../types/App";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isEmployee: boolean;
  login: (payload: { username: string; password: string }) => Promise<void>;
  register: (payload: { email: string; username: string; password: string }) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const TOKEN_KEY = "digital-distributor-token";
const USER_KEY = "digital-distributor-user";
const IS_EMPLOYEE_KEY = "digital-distributor-is-employee";

function readStoredAuth() {
  if (typeof window === "undefined") {
    return { token: null, user: null, isEmployee: false };
  }
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  const isEmployeeRaw = localStorage.getItem(IS_EMPLOYEE_KEY);
  const user = userRaw ? (JSON.parse(userRaw) as User) : null;
  // isEmployee определяется из localStorage или по роли пользователя
  const isEmployee = isEmployeeRaw === "true" || (user?.role ? user.role !== "user" : false);
  return {
    token,
    user,
    isEmployee,
  };
}

const initial = readStoredAuth();
if (initial.token) {
  setAuthToken(initial.token);
}

export const authStore = create<AuthState>((set, get) => ({
  user: initial.user,
  token: initial.token,
  isLoading: false,
  error: null,
  isEmployee: initial.isEmployee,
  isAuthenticated: Boolean(initial.token && initial.user),
  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user, isEmployee } = await loginRequest(payload);
      setAuthToken(token);
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(IS_EMPLOYEE_KEY, String(isEmployee || false));
      }
      set({ token, user, isAuthenticated: true, isLoading: false, isEmployee: isEmployee || false });
    } catch (error: any) {
      console.error(error);
      const message = error?.response?.data?.message || "Не удалось войти. Попробуйте снова.";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user, isEmployee } = await registerRequest(payload);
      setAuthToken(token);
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(IS_EMPLOYEE_KEY, String(isEmployee || false));
      }
      set({ token, user, isAuthenticated: true, isLoading: false, isEmployee: isEmployee || false });
    } catch (error: any) {
      console.error(error);
      const message = error?.response?.data?.message || "Не удалось зарегистрироваться. Попробуйте снова.";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
  setUser: (user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ user });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(IS_EMPLOYEE_KEY);
    }
    setAuthToken(null);
    set({ user: null, token: null, isAuthenticated: false, isEmployee: false });
  },
}));

