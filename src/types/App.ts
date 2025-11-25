export interface Category {
  id: number;
  title: string;
  description?: string | null;
}

export interface ProviderInfo {
  id: number;
  name: string;
  type: string;
  country?: string | null;
}

export interface App {
  id: number;
  title: string;
  description: string;
  price: number;
  releaseDate?: string | null;
  category?: Category | null;
  provider?: ProviderInfo | null;
  imageUrl?: string | null;
}

export interface Order {
  id: number;
  status: string;
  amount: number;
  saleDate: string;
  downloadLink?: string | null;
  app: {
    id: number;
    title: string;
    price: number;
  };
}

export type UserRole = "user" | "admin" | "moderator" | "support" | "analyst";

export interface User {
  id: number;
  username: string;
  email: string;
  regDate?: string;
  role?: UserRole;
}

export interface Employee {
  id: number;
  username: string;
  position: string;
  hireDate?: string;
  role: UserRole;
}

export interface Review {
  id: number;
  appId: number;
  appTitle?: string; // Для модерации
  userId: number;
  userUsername: string;
  evaluation: number;
  comment: string;
  status: "На модерации" | "Проверен" | "Отклонен";
  reviewDate: string;
  moderatedAt?: string | null;
  moderatorId?: number | null;
}

export interface AppReviewsResponse {
  reviews: Review[];
  userReview: Review | null;
}

export interface SupportRequest {
  id: number;
  userId: number;
  userUsername: string;
  userEmail: string;
  subject: string;
  message: string;
  priority: "low" | "normal" | "high";
  status: string;
  createdAt: string;
  employeeId?: number;
  employeeUsername?: string;
  takenAt?: string;
}

export interface SupportMessage {
  id: number;
  requestId: number;
  senderType: "user" | "employee";
  senderId: number;
  senderUsername: string;
  message: string;
  createdAt: string;
}

export interface AnalyticsMetrics {
  ordersCount: number;
  revenue: number;
  newUsers: number;
  returns: number;
  avgCheck: number;
  supportRequests: number;
}
