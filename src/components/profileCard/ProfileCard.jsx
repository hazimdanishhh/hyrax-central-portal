// components/ProfileCard.jsx

import "./ProfileCard.scss";

export default function ProfileCard({ profile, employee }) {
  if (!profile || !employee) return null;

  console.log(profile);
  console.log(employee);

  return (
    <div className="profileCard">
      <div className="profilePhoto">
        <img
          src={profile?.avatar_url || `/profilePhoto/default.webp`}
          alt={profile?.name}
        />
      </div>

      {/* PROFILE SYSTEM SETTINGS */}

      <div className="profileSection">
        <h2 className="textRegular textS">System Settings</h2>

        <div className="profileDetails">
          <p className="profileLabel textRegular textXXS">
            <strong>Display Name: </strong>
            {profile?.full_name}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>System Email: </strong> {profile?.email}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>System Role: </strong>
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

      {/* EMPLOYEE DETAILS */}

      <div className="profileSection">
        <h2 className="textRegular textS">Personal Information</h2>

        <div className="profileDetails">
          {/* =============================== */}
          {/* IDENTITY & PERSONAL INFORMATION */}
          {/* =============================== */}
          <p className="profileLabel textRegular textXXS">
            <strong>Employee ID: </strong>
            {employee?.employee_id}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Full Name: </strong>
            {employee?.managerName}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Preferred Name: </strong>
            {employee?.preferred_name}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Date of Birth: </strong>
            {employee?.date_of_birth}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Gender: </strong>
            {employee?.gender}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Nationality: </strong>
            {employee?.nationality}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Identification Type: </strong>
            {employee?.identification_type}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Identification Number: </strong>
            {employee?.identification_number}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Marital Status: </strong>
            {employee?.marital_status}
          </p>
        </div>
      </div>

      <hr />

      <div className="profileSection">
        <h2 className="textRegular textS">Contact Information</h2>

        <div className="profileDetails">
          {/* =============================== */}
          {/* CONTACT INFORMATION */}
          {/* =============================== */}
          <p className="profileLabel textRegular textXXS">
            <strong>Email (Personal): </strong>
            {employee?.email_personal}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Email (Work): </strong>
            {employee?.email_work}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Phone (Personal): </strong>
            {employee?.phone_personal}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Phone (Work): </strong>
            {employee?.phone_work}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Emergency Contact Name: </strong>
            {employee?.emergency_contact_name}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Emergency Contact Relationship: </strong>
            {employee?.emergency_contact_relationship}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Emergency Contact Phone: </strong>
            {employee?.emergency_contact_phone}
          </p>
        </div>
      </div>

      <hr />

      <div className="profileSection">
        <h2 className="textRegular textS">Employment Details</h2>

        <div className="profileDetails">
          {/* =============================== */}
          {/* EMPLOYMENT DETAILS */}
          {/* =============================== */}
          <p className="profileLabel textRegular textXXS">
            <strong>Department: </strong>
            {employee?.department_name}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Position: </strong>
            {employee?.position}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Reporting Manager: </strong>
            {employee?.managerName}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Employment Status: </strong>
            {employee?.employment_status}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Employment Type: </strong>
            {employee?.employment_type}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Join Date: </strong>
            {employee?.join_date}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Confirmation Date: </strong>
            {employee?.confirmation_date}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>End Date: </strong>
            {employee?.end_date}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Resignation Date: </strong>
            {employee?.resignation_date}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Termination Reason: </strong>
            {employee?.termination_reason}
          </p>
        </div>
      </div>

      <hr />

      <div className="profileSection">
        <h2 className="textRegular textS">Address Information</h2>

        <div className="profileDetails">
          {/* ADDRESS */}
          <p className="profileLabel textRegular textXXS">
            <strong>Address (Work): </strong>
            {employee?.address_work}
          </p>
          <p className="profileLabel textRegular textXXS">
            <strong>Address (Home): </strong>
            {employee?.address_home}
          </p>
        </div>
      </div>

      <hr />
    </div>
  );
}
