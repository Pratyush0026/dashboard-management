// Shared TypeScript interfaces for the application

export interface Admin {
  id: string
  email: string
  created_at?: string
}

export interface Candidate {
  id: string
  admin_id: string
  name: string
  email: string
  phone: string
  position_applied: string
  education: string
  experience_years: number
  skills: string
  salary_expectation: string
  location: string
  status: 'Applied' | 'Interviewing' | 'Offer' | 'Rejected'
  created_at: string
  updated_at: string
}

export interface UploadSession {
  id: string
  admin_id: string
  filename: string
  total_rows: number
  inserted: number
  skipped: number
  created_at: string
}

export interface AIMessage {
  id: string
  admin_id: string
  query: string
  response: string
  created_at: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
}

export interface CandidatesResponse {
  data: Candidate[]
  pagination: PaginationMeta
}

export interface UploadResult {
  message: string
  inserted: number
  skipped: number
  total: number
  session_id: string
}
