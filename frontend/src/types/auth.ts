export interface RegisterData {
  Fullname: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  access_token?: string;
  user?: {
    id: string;
    email: string;
    Fullname: string;
  };
}

