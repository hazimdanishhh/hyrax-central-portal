// src/api/user.api.js
import axios from "./axiosConfig";

// Get Current Authenticated User (/users/me)
export const getCurrentUser = async () => {
  const res = await axios.get("/users/me");
  return res.data;
};

// Get User by ID
export const getUserById = async (id) => {
  const res = await axios.get(`/users/${id}`);
  return res.data;
};

// Update User by ID
export const updateUserById = async (id, payload) => {
  const res = await axios.patch(`/users/${id}`, payload);
  return res.data;
};
