import { apiClient } from "./http";
import { Order } from "../types/App";

export async function getOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>("/orders");
  return data;
}

export async function cancelOrder(orderId: number): Promise<void> {
  await apiClient.patch(`/orders/${orderId}/cancel`);
}

interface CheckoutItem {
  appId: number;
  price: number;
  quantity: number;
}

interface CheckoutPayload {
  items: CheckoutItem[];
  payment: {
    method: "card" | "wallet";
    cardLast4?: string;
  };
}

export async function checkout(payload: CheckoutPayload) {
  const { data } = await apiClient.post("/orders/checkout", payload);
  return data;
}

