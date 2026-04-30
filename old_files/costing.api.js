// src/api/costing.api.js
import axios from "./axiosConfig";

// Get all costings made and owned by a specific user (for logged-in user)
export const getUserCostings = async (id) => {
  const res = await axios.get(`/costing/users/${id}`);
  return res.data;
};

// Create new costing
export async function createCosting(costingData) {
  const res = await axios.post("/costing", costingData);
  return res.data;
}
