export interface Hall {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  faculty: string;
}

export interface SessionOption {
  session: string;
  batch: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string;
  bio: string | null;
  student_id: string;
  registration_no: string;
  hall: Hall;
  department: Department;
  session: string;
  batch: number;
  role: "user" | "admin";
  is_verified: boolean;
  created_at: string;
}
