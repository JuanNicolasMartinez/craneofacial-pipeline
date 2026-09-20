import axios from "axios";
import { API_URL } from "./origin";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Send the HttpOnly session cookie with every request.
  withCredentials: true,
});
