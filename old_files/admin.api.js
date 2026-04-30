import axios from "./axiosConfig"; // Assuming baseURL + interceptors set here

// Create New User
export const createUserAsAdmin = async (userData) => {
  const res = await axios.post("/admin/create-user", userData);
  return res.data;
};

// Get All Users
export const fetchAllUsers = async () => {
  const res = await axios.get("/users");
  return res.data.data; // returns users array
};

// Update User by ID
export const updateUserByIdAsAdmin = async (id, payload) => {
  const res = await axios.patch(`/admin/users/${id}`, payload);
  return res.data;
};
