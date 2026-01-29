import "../button/Button.scss";
import { useNavigate } from "react-router";
import { useState } from "react";
import { SignOut } from "phosphor-react";
import { useAuth } from "../../../context/AuthContext";

function LogoutButton({ setMessage, navIsOpen, style }) {
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoading(true);
    setMessage({ text: "Logging out...", type: "loading" });

    try {
      await logout(); // Supabase logout
      setMessage({ text: "Logged out successfully", type: "success" });

      setTimeout(() => navigate("/login"), 500); // redirect to login
    } catch (err) {
      console.error("Logout error:", err);
      setMessage({ text: "Failed to logout", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} className={style} disabled={loading}>
      {navIsOpen ? "Logout" : null}
      <SignOut size={navIsOpen ? "20" : "24"} />
    </button>
  );
}

export default LogoutButton;
