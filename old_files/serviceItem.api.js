import axios from "./axiosConfig";

// Get all service items
export const getAllServiceItems = async () => {
  const res = await axios.get("/services");
  return res.data;
};
