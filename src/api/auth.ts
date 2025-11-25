import { apiClient } from "./http";
import { User } from "../types/App";

interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

interface LoginPayload {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: User;
  isEmployee?: boolean;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const { data } = await apiClient.get<{ available: boolean }>(`/auth/check-username?username=${encodeURIComponent(username)}`);
  return data;
}

