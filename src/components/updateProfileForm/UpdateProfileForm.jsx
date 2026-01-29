// components/UpdateProfileForm.jsx

import { useState, useEffect } from "react";
import useUpdateProfile from "../../hooks/useUpdateProfile";

export default function UpdateProfileForm({
  profile,
  setIsEditing,
  setMessage,
}) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "", // Optional: only change if user wants
  });

  // Update Profile API Handling
  const { handleUpdate, updating } = useUpdateProfile({ setMessage });

  // If profile exists -> set formData to user data
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        email: profile.email || "",
        password: "",
      });
    }
  }, [profile]);

  // Handle changes in input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // SUBMIT UPDATES
  const handleSubmit = async (e) => {
    e.preventDefault();

    const updatedFields = {};
    for (const key in formData) {
      if (formData[key] && formData[key] !== profile[key]) {
        updatedFields[key] = formData[key];
      }
    }

    if (Object.keys(updatedFields).length === 0) {
      setMessage({ text: "No changes made.", type: "info" });
      return;
    }

    await handleUpdate(updatedFields);
    setIsEditing(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="formContainer">
        <div>
          <label>Name</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Username</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            type="email"
            required
          />
        </div>

        <div>
          <label>New Password</label>
          <input
            name="password"
            value={formData.password}
            onChange={handleChange}
            type="password"
            placeholder="Leave blank to keep current"
          />
        </div>

        <button type="submit" disabled={updating}>
          {updating ? "Updating..." : "Update Profile"}
        </button>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setIsEditing(false);
          }}
        >
          Cancel
        </button>
      </form>
    </>
  );
}
