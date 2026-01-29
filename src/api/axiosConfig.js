import axios from "axios";

// BEFORE PUSHING TO HOSTINGER:
// - Comment DEVELOPMENT BASE_URL
// - Uncomment STAGING BASE_URL

// DEVELOPMENT BASE_URL
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// STAGING BASE_URL
// const BASE_URL = "https://www.hyrax-hub-api.rangkaempat.com/api";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Important! Allows sending cookies (access and refresh token) to backend on every request
});

// Response Interceptor: Retry logic for 401s using refresh endpoint
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // List of endpoints NOT to retry on 401 (e.g., /auth/refresh-token and /users/me)
    const noRetryOn401Endpoints = ["/auth/refresh-token", "/users/me"];

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !noRetryOn401Endpoints.includes(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        await axiosInstance.post("/auth/refresh-token"); // get new access token
        return axiosInstance(originalRequest); // retry original request
      } catch (refreshError) {
        // Refresh token failed: logout user and redirect to login page
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // For 401 errors on /auth/refresh-token or /users/me, or after retry, reject directly
    return Promise.reject(error);
  }
);

export default axiosInstance;
