import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { App } from "../types/App";

export interface CartItem {
  app: App;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (app: App) => void;
  removeFromCart: (appId: number) => void;
  clearCart: () => void;
  total: () => number;
}

const CART_STORAGE_KEY = "digital-distributor-cart";

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addToCart: (app) =>
        set((state) => {
          // Нельзя добавить товар, если он уже есть в корзине
          const existing = state.items.find((item) => item.app.id === app.id);
          if (existing) {
            return state; // Не добавляем дубликат
          }
          return { items: [...state.items, { app, quantity: 1 }] };
        }),
      removeFromCart: (appId) =>
        set((state) => ({
          items: state.items.filter((item) => item.app.id !== appId),
        })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((acc, item) => acc + item.app.price * item.quantity, 0),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

