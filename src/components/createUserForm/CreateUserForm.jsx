import { useState } from "react";
import { createUserAsAdmin } from "../../api/admin.api";

function CreateUserForm({ setMessage }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user", //default
    companyId: "",
    department: "",
    position: "",
  });

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  //   API Post req to /api/admin/create-user
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation
    if (!form.name.trim()) {
      return setMessage({ text: "Name is required", type: "error" });
    }

    if (!form.email.trim()) {
      return setMessage({ text: "Email is required", type: "error" });
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(form.email)) {
      return setMessage({
        text: "Please enter a valid email address",
        type: "error",
      });
    }

    if (!form.password || form.password.length < 6) {
      return setMessage({
        text: "Password must be at least 6 characters",
        type: "error",
      });
    }

    if (!form.companyId.trim()) {
      return setMessage({ text: "Company ID is required", type: "error" });
    }

    if (!form.department) {
      return setMessage({ text: "Please select a department", type: "error" });
    }

    if (!form.position.trim()) {
      return setMessage({ text: "Position is required", type: "error" });
    }

    try {
      const { data } = await createUserAsAdmin(form);

      setMessage({ text: "User Created successfully!", type: "success" });

      setForm({
        name: "",
        email: "",
        password: "",
        role: "user",
        companyId: "",
        department: "",
        position: "",
      });
    } catch (err) {
      console.error(err);

      const errorMessage =
        err?.response?.data?.error || "Failed to create user.";

      setMessage({ text: errorMessage, type: "error" });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        name="name"
        type="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Your Name"
        autoComplete="name"
      />

      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="you@example.com"
        autoComplete="email"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        value={form.password}
        onChange={handleChange}
        placeholder="Password"
        autoComplete="current-password"
      />

      <label htmlFor="role">User Role</label>
      <select id="role" name="role" value={form.role} onChange={handleChange}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      <label htmlFor="companyId">Company ID</label>
      <input
        id="companyId"
        name="companyId"
        type="text"
        value={form.companyId}
        onChange={handleChange}
        placeholder="e.g. H004"
      />

      <label htmlFor="department">Department</label>
      <select
        id="department"
        name="department"
        value={form.department}
        onChange={handleChange}
      >
        <option value="">Select Department</option>
        <option value="Business Development & Sales">
          Business Development & Sales
        </option>
        <option value="Accounting & Finance">Accounting & Finance</option>
        <option value="Human Resource">Human Resource</option>
        <option value="Production & Operations">Production & Operations</option>
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

      <label htmlFor="position">Position</label>
      <input
        id="position"
        name="position"
        type="text"
        value={form.position}
        onChange={handleChange}
        placeholder="e.g. Sales Executive"
      />

      <button type="submit">Create User</button>
    </form>
  );
}

export default CreateUserForm;
