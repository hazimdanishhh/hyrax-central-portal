import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import ProfileCard from "../../../components/profileCard/ProfileCard";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";

export default function Profile() {
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode, toggleMode } = useTheme();

  // Fetch user and profile data
  const { profile, loading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <h1 className="textRegular textL">Your Profile</h1>

            {loading ? (
              <LoadingIcon />
            ) : profile ? (
              <ProfileCard profile={profile} employee={employee} />
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
