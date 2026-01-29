import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Home() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (session) {
        // User is logged in, go to app dashboard
        navigate("/app", { replace: true });
      } else {
        // User not logged in, go to login
        navigate("/login", { replace: true });
      }
    }
  }, [session, loading, navigate]);

  return <div>Loading...</div>; // Simple placeholder while we check session
}

export default Home;
