// components/UpdateProfileForm.jsx

import "./UpdateProfileAsAdminForm.scss";
import { useState, useEffect } from "react";
import useUpdateProfileAsAdmin from "../../hooks/useUpdateProfileAsAdmin";

export default function UpdateProfileAsAdminForm({
  profile,
  setIsEditing,
  setMessage,
}) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    companyId: "",
    department: "",
    position: "",
    role: "",
  });

  // Update Profile API Handling
  const { handleUpdate, updating } = useUpdateProfileAsAdmin({ setMessage });

  // If profile exists -> set formData to user data
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        email: profile.email || "",
        password: "",
        companyId: profile.companyId || "",
        department: profile.department?.join(", ") || "",
        position: profile.position || "",
        role: profile.role || "",
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

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      setMessage({ text: "Invalid email format.", type: "error" });
      return;
    }

    const updatedFields = {};
    for (const key in formData) {
      if (formData[key] && formData[key] !== profile[key]) {
        updatedFields[key] = formData[key];
      }
    }

    if (updatedFields.department) {
      updatedFields.department = updatedFields.department
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean); // remove empty strings
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

        <div>
          <label>Company ID</label>
          <input
            name="companyId"
            value={formData.companyId}
            onChange={handleChange}
          />
        </div>

        <label htmlFor="department">Department</label>
        <select
          id="department"
          name="department"
          value={formData.department}
          onChange={handleChange}
        >
          <option value="">-- Select Department --</option>
          <option value="Business Development & Sales">
            Business Development & Sales
          </option>
          <option value="Accounting & Finance">Accounting & Finance</option>
          <option value="Human Resource">Human Resource</option>
          <option value="Production & Operations">
            Production & Operations
          </option>
          <option value="Group Executive Chairman's (GEC's) Office">
            Group Executive Chairman's (GEC's) Office
          </option>
          <option value="Strategic Planning & Corporate Affairs">
            Strategic Planning & Corporate Affairs
          </option>
          <option value="Corporate Communications">
            Corporate Communications
          </option>
        </select>

        <div>
          <label>Position</label>
          <input
            name="position"
            value={formData.position}
            onChange={handleChange}
          />
        </div>

        <label htmlFor="role">User Role</label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleChange}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

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
