// components/ProfileCard.jsx

import { motion } from "framer-motion";
import "./ProfileCard.scss";
import { CircleNotch } from "phosphor-react";

export default function ProfileCard({ profile, session }) {
  if (!profile && !session) return null;

  console.log(profile);

  return (
    <div className="profileCard">
      <div className="profilePhoto">
        <img src={profile?.avatar_url} alt={profile?.name} />
      </div>

      <div className="profileSection">
        <h2 className="textRegular textS">Google Workspace User</h2>

        <div className="profileDetails">
          <p className="profileLabel textRegular textXXS">
            <strong>Name: </strong>
            {profile?.full_name}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Email: </strong> {profile?.email}
          </p>
        </div>
      </div>

      <hr />

      <div className="profileSection">
        <h2 className="textRegular textS">System Settings</h2>

        <div className="profileDetails">
          <p className="profileLabel textRegular textXXS">
            <strong>Role: </strong>
            {profile?.role}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Module Access: </strong>
            {profile?.department} ({profile?.departmentSub})
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>User ID: </strong>
            {profile?.id}
          </p>
        </div>
      </div>

      <hr />

      <div className="profileSection">
        <h2 className="textRegular textS">Employee Details</h2>

        <div className="profileDetails">
          <p className="profileLabel textRegular textXXS">
            <strong>Employee ID: </strong>
            {/* {profile.companyId} */}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Department: </strong>
            {profile?.department}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Position: </strong>
            {/* {profile.position} */}
          </p>
        </div>
      </div>
    </div>
  );
}

// Loading Card UI
export function ProfileCardLoading() {
  return (
    <div className="loadingIcon">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: 1,
        }}
        className="loadingIcon"
      >
        <CircleNotch size={40} />
      </motion.div>
    </div>
  );
}
