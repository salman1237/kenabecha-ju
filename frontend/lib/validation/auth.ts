import { z } from "zod";

export const PHONE_PATTERN = /^(?:\+?880|0)1[3-9]\d{8}$/;

export const juProfileSchema = z.object({
  phone: z.string().regex(PHONE_PATTERN, "Enter a valid Bangladeshi mobile number"),
  student_id: z.string().min(1, "Required").max(30),
  registration_no: z.string().min(1, "Required").max(30),
  hall_id: z.uuid("Select a hall"),
  department_id: z.uuid("Select a department"),
  session: z.string().min(1, "Select a session"),
});

export const signupSchema = juProfileSchema.extend({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters").max(128),
  confirmPassword: z.string(),
  full_name: z.string().min(2, "Enter your full name").max(150),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export type CompleteProfileFormValues = z.infer<typeof juProfileSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const verifyOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
