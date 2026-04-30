// src/api/auth.api.js
// Auth Routes
import axios from "./axiosConfig";

// ========================
// Login User
// ========================
export const loginUser = async (email, password) => {
  const res = await axios.post("/auth/login", { email, password });
  return res.data;
};

// ========================
// Logout User
// ========================
// This functionality is to inform the backend that the user has logged out and cleared token from client

export const logoutUser = async () => {
  const res = await axios.post("/auth/logout");

  return res.data;
};
