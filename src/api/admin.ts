import { apiClient } from "./http";

export interface Provider {
  id: number;
  name: string;
  type: string;
  country: string | null;
  foundedDate: string | null;
  web: string | null;
}

export interface Category {
  id: number;
  title: string;
  description: string | null;
}

export interface AddProviderData {
  provider_name: string;
  provider_type: "Разработчик" | "Издатель";
  country: string;
  founded_date: string;
  web?: string;
}

export interface AddAppData {
    provider_id: number;
    title: string;
    description: string;
    cost_price: number | string;
    price: number | string;
    release_date: string;
    category_id: number;
}

export async function getProviders(): Promise<Provider[]> {
  const { data } = await apiClient.get<Provider[]>("/admin/providers");
  return data;
}

export async function addProvider(providerData: AddProviderData): Promise<Provider> {
  const { data } = await apiClient.post<Provider>("/admin/providers", providerData);
  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/admin/categories");
  return data;
}

export async function addApp(appData: AddAppData): Promise<any> {
  const { data } = await apiClient.post("/admin/apps", appData);
  return data;
}

