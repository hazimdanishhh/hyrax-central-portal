import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import ProfileCard, {
  ProfileCardLoading,
} from "../../../components/profileCard/ProfileCard";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import UpdateProfileAsAdminForm from "../../../components/updateProfileAsAdminForm/UpdateProfileAsAdminForm";
import { useAuth } from "../../../context/AuthContext";

export default function Profile() {
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isEditing, setIsEditing] = useState(false);
  const { darkMode, toggleMode } = useTheme();

  // Fetch user and profile data
  const { session } = useAuth();
  const { profile, loading } = useUserProfile({ setMessage });

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <h1 className="textRegular textL">Your Profile</h1>

            {loading ? (
              // Loading Card UI
              <ProfileCardLoading />
            ) : profile && session ? (
              // Profile Card UI
              <ProfileCard profile={profile} session={session} />
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
