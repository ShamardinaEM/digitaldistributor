import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AppPage from "./pages/AppPage";
import ProfilePage from "./pages/ProfilePage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import SupportPage from "./pages/SupportPage";
import ModerationPage from "./pages/ModerationPage";
import EmployeeSupportPage from "./pages/EmployeeSupportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProviderPage from "./pages/ProviderPage";
import MainLayout from "./components/layout/MainLayout";
import AuthModal from "./components/auth/AuthModal";
import Notification from "./components/Notification";
import { useNotificationStore } from "./store/notificationStore";

export default function App() {
  const { message, type, hide } = useNotificationStore();

  return (
    <>
      <AuthModal />
      {message && <Notification message={message} type={type} onClose={hide} />}
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="apps/:id" element={<AppPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="moderation" element={<ModerationPage />} />
          <Route path="employee-support" element={<EmployeeSupportPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="providers/:id" element={<ProviderPage />} />
        </Route>
      </Routes>
    </>
  );
}
