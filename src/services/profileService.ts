import api from "./api";
import type { ProfileResponse } from "../types/Profile";

const profileService = {
  getProfile() {
    return api.get<ProfileResponse>("/users/profile");
  },

  updateProfile(payload: { fullName: string; email: string }) {
    return api.put<ProfileResponse>("/users/profile", payload);
  },

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return api.put<{ message: string }>("/users/password", payload);
  },

  logoutAllDevices() {
    return api.post<{ message: string }>("/users/logout-all-devices");
  },

  deleteAccount() {
    return api.delete<{ message: string }>("/users/account");
  },
};

export default profileService;