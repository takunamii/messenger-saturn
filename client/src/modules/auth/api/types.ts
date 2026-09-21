export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    username: string;
    displayName: string;
    password: string;
    publicKey: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        nickname: string;
    };
}

export interface ApiError {
    message: string;
}