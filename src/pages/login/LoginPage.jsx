import { GoogleLogoIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/buttons/button/Button";
import { useAuth } from "../../context/AuthContext";
import { fadeInWithEase, staggerContainer } from "../../functions/motionUtils";
import { supabase } from "../../lib/supabaseClient";
import "./LoginPage.scss";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useAuth();

  const from = location.state?.from?.pathname || "/app";

  useEffect(() => {
    if (!loading && session) {
      // If user is logged in, redirect to intended page or /app
      navigate(from, { replace: true });
    }
  }, [session, loading, from, navigate]);

  // Google Login Function
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
        scopes: "https://www.googleapis.com/auth/drive.readonly",
      },
    });

    if (error) {
      console.error("Google login error:", error.message);
    }
  };

  return (
    <>
      <section className="sectionDark">
        <motion.div
          className="sectionWrapper loginCardWrapper"
          initial="hidden"
          animate="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div className="loginCardContainer" variants={fadeInWithEase}>
            <div className="loginCardHeader">
              <img src="./favicon.svg" alt="Logo" className="loginCardLogo" />
              <h2 className="textM textRegular">Hyrax Central Portal</h2>
              <p className="textXXS textLight">Welcome back!</p>
            </div>

            <Button
              name="Log in with Google"
              onClick={handleGoogleLogin}
              style="button buttonType2"
              icon={GoogleLogoIcon}
            />
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}
