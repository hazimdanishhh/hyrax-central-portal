// hooks/useUpdateProfile.js

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateUserById } from "../api/user.api";

export default function useUpdateProfile({ setMessage }) {
  const { user, updateUser } = useAuth(); // update global state
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async (updatedFields) => {
    if (!user?.id) {
      setMessage({ text: "User ID not found.", type: "error" });
      return;
    }

    setMessage({
      text: "Updating profile",
      type: "loading",
    });

    setUpdating(true);
    try {
      const res = await updateUserById(user.id, updatedFields);
      setMessage({
        text: "Profile updated successfully!",
        type: "success",
      });

      // Optionally update context with new user data
      updateUser?.(res.data);

      return res.data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Update failed.";
      setMessage({ text: errorMsg, type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  return { handleUpdate, updating };
}
