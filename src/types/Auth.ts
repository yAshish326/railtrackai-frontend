export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface ApiMessageResponse {
  message: string;
}
