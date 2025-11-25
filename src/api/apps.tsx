import { apiClient } from "./http";
import { App, Category } from "../types/App";

interface GetAppsParams {
  search?: string;
  categoryId?: number | null;
}

export async function getApps(params: GetAppsParams = {}): Promise<App[]> {
  const { data } = await apiClient.get<App[]>("/apps", { params });
  return data;
}

export async function getApp(id: number): Promise<App> {
  const { data } = await apiClient.get<App>(`/apps/${id}`);
  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/apps/categories");
  return data;
}

export async function checkOwnership(appId: number): Promise<boolean> {
  const { data } = await apiClient.get<{ owned: boolean }>(`/apps/${appId}/owned`);
  return data.owned;
}

export async function getOwnedApps(): Promise<App[]> {
  const { data } = await apiClient.get<App[]>("/apps/owned");
  return data;
}
