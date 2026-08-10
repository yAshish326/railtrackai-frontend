import api from "./api";

export interface LoginRequest{

    email:string;

    password:string;

}

export interface RegisterOtpRequest{

    fullName?:string;

    email:string;

}

export interface VerifyOtpRequest {
  email: string;
  otpCode: string; // Key name is 'otpCode'
  fullName: string;
  password: string;
}

export interface ForgotPasswordRequest{

    email:string;

}

export interface VerifyPasswordOtpRequest {
  email: string;
  otpCode: string;
}

export interface ResetPasswordRequest{

    email: string;

    otpCode: string;

    newPassword: string;

}

class AuthService{

    login(data:LoginRequest){

        return api.post("/auth/login",data);

    }

    sendRegistrationOtp(data:RegisterOtpRequest){

        return api.post("/auth/register/send-otp",data);

    }

    verifyRegistrationOtp(data:VerifyOtpRequest){

        return api.post("/auth/register/verify",data);

    }

    forgotPassword(data:ForgotPasswordRequest){

        return api.post("/auth/password/forgot",data);

    }

    verifyPasswordOtp(data: VerifyPasswordOtpRequest) {
        return api.post("/auth/password/verify", data);
    }

    resetPassword(data: ResetPasswordRequest) {
        return api.post("/auth/password/reset", {
            email: data.email,
            otpCode: data.otpCode,
            newPassword: data.newPassword,
        });
    }

}

export default new AuthService();