import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import ProfileCard from "../../../components/profileCard/ProfileCard";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";
import useEmployeeAssets from "../../../hooks/useEmployeeAssets";

export default function Profile() {
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode, toggleMode } = useTheme();

  // Fetch user and profile data
  const { profile, loading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();

  // Fetch employee assets
  const { assets, loading: assetsLoading } = useEmployeeAssets(employee?.id, {
    setMessage,
  });

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            {loading ? (
              <LoadingIcon />
            ) : profile ? (
              <ProfileCard
                profile={profile}
                employee={employee}
                assets={assets}
              />
            ) : (
              // No Profile UI
              <p>No profile data found.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
