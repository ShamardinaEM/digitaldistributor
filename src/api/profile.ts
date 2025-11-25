import { apiClient } from "./http";
import { User } from "../types/App";

export interface UpdateUsernamePayload {
  username: string;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export async function updateUsername(payload: UpdateUsernamePayload): Promise<User> {
  const { data } = await apiClient.patch<User>("/profile/username", payload);
  return data;
}

export async function updatePassword(payload: UpdatePasswordPayload): Promise<void> {
  await apiClient.patch("/profile/password", payload);
}

