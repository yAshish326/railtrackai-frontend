const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  // At least 8 chars, one letter and one number
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

export function isValidFullName(fullName: string): boolean {
  return fullName.trim().length >= 2;
}

export function isValidOtp(otp: string): boolean {
  return /^\d{4,6}$/.test(otp.trim());
}

export function isValidPnr(pnr: string): boolean {
  return /^\d{10}$/.test(pnr.trim());
}
