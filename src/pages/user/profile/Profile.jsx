import { useState } from "react";
import ProfileCard from "../../../components/profileCard/ProfileCard";
import { useTheme } from "../../../context/ThemeContext";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployeeAssets from "../../../hooks/useEmployeeAssets";
import CardSection from "../../../components/cardSection/CardSection";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UserCircleIcon } from "@phosphor-icons/react";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import { useProfile } from "../../../context/ProfileContext";
import { useEmployee } from "../../../context/EmployeeContext";
import useEmployeePublic from "../../../features/hr/employees/public/hooks/useEmployeePublic";

export default function Profile() {
  const { darkMode } = useTheme();

  // Fetch Current User Profile Data
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    role,
    isSuperAdmin,
    isManager,
    isStaff,
  } = useProfile();

  // Fetch Current Employee Data
  const {
    employee,
    loading: employeeLoading,
    error: employeeError,
  } = useEmployee();

  // Fetch Current Employee Public Manager Data
  const {
    data: employeePublic,
    isLoading: employeePublicLoading,
    error: employeePublicError,
  } = useEmployeePublic(employee?.id);

  // Fetch Current Employee Assets
  const { assets, loading: assetsLoading } = useEmployeeAssets(employee?.id);

  const loading =
    profileLoading || employeeLoading || employeePublicLoading || assetsLoading;

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UserCircleIcon} current="My Profile" />

            <CardWrapper>
              {loading ? (
                <LoadingIcon />
              ) : profile ? (
                <ProfileCard
                  profile={profile}
                  employee={employee}
                  employeePublic={employeePublic}
                  assets={assets}
                  role={role}
                />
              ) : (
                // No Profile UI
                <p>No profile data found.</p>
              )}
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
