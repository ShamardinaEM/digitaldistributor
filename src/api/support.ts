import { apiClient } from "./http";
import { SupportRequest, SupportMessage } from "../types/App";

interface SupportPayload {
  subject: string;
  message: string;
  priority: "low" | "normal" | "high";
  orderId: number;
}

interface SupportResponse {
  id: number;
  status: string;
  createdAt: string;
}

export async function sendSupportRequest(payload: SupportPayload): Promise<SupportResponse> {
  const { data } = await apiClient.post<SupportResponse>("/support", payload);
  return data;
}

export async function getSupportRequests(): Promise<SupportRequest[]> {
  const { data } = await apiClient.get<SupportRequest[]>("/support");
  return data;
}

export async function getSupportMessages(requestId: number): Promise<SupportMessage[]> {
  const { data } = await apiClient.get<SupportMessage[]>(`/support/${requestId}/messages`);
  return data;
}

export async function sendSupportMessage(requestId: number, message: string): Promise<SupportMessage> {
  const { data } = await apiClient.post<SupportMessage>(`/support/${requestId}/messages`, { message });
  return data;
}

