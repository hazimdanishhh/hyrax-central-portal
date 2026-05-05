import "../button/Button.scss";
import { useNavigate } from "react-router";
import { useState } from "react";
import { SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "../../../context/AuthContext";
import { useMessage } from "../../../context/MessageContext";

function LogoutButton({ navIsOpen, style }) {
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { showMessage } = useMessage();

  const handleLogout = async () => {
    setLoading(true);
    showMessage("Logging out...", "loading");

    try {
      await logout(); // Supabase logout
      setTimeout(() => navigate("/login"), 500); // redirect to login
      showMessage("Logged out successfully", "success");
    } catch (err) {
      console.error("Logout error:", err);
      showMessage("Failed to logout", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} className={style} disabled={loading}>
      {navIsOpen ? "Logout" : null}
      <SignOutIcon size={navIsOpen ? "20" : "24"} />
    </button>
  );
}

export default LogoutButton;
