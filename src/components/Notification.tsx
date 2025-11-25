import { useEffect, type CSSProperties } from "react";

interface NotificationProps {
  message: string;
  onClose: () => void;
  type?: "success" | "error";
}

export default function Notification({ message, onClose, type = "success" }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: type === "success" ? "#2d5a3d" : "#5a2d2d",
        color: "white",
        padding: "16px 20px",
        borderRadius: 12,
        border: `1px solid ${type === "success" ? "#4a7c5a" : "#7c4a4a"}`,
        zIndex: 1000,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        animation: "slideIn 0.3s ease-out",
      }}
    >
      {message}
    </div>
  );
}

