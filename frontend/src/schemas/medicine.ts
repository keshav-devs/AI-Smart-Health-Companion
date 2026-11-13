/**
 * TypeScript definitions and schemas for medicines, dose tracking, and adherence.
 */

export interface MedicineScheduleItem {
  id: string;
  medicine_id: string;
  user_id: string;
  frequency: "daily" | "twice_daily" | "custom" | "as_needed";
  times_per_day: number;
  specific_times: string[]; // ["08:00", "20:00"]
  days_of_week?: number[] | null; // 0=Mon, 6=Sun
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineScheduleCreate {
  frequency: "daily" | "twice_daily" | "custom" | "as_needed";
  times_per_day: number;
  specific_times: string[];
  days_of_week?: number[] | null;
  timezone?: string;
}

export interface Medicine {
  id: string;
  user_id: string;
  name: string;
  strength?: string | null;
  form?: string | null;
  instructions?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  expiry_date?: string | null;
  current_quantity?: number | null;
  refill_threshold?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  schedules: MedicineScheduleItem[];
}

export interface MedicineCreatePayload {
  name: string;
  strength?: string | null;
  form?: string | null;
  instructions?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  expiry_date?: string | null;
  current_quantity?: number | null;
  refill_threshold?: number | null;
  is_active?: boolean;
  schedule?: MedicineScheduleCreate | null;
}

export interface MedicineListResponse {
  medicines: Medicine[];
  total: number;
}

export interface TodayDoseItem {
  medicine_id: string;
  medicine_name: string;
  strength?: string | null;
  form?: string | null;
  instructions?: string | null;
  scheduled_time: string; // ISO datetime
  time_str: string; // "08:00"
  status: "pending" | "due" | "taken" | "skipped" | "missed";
  dose_log_id?: string | null;
  logged_at?: string | null;
  notes?: string | null;
}

export interface TodayDosesResponse {
  date: string; // YYYY-MM-DD
  timezone: string;
  doses: TodayDoseItem[];
  total_doses: number;
  taken_count: number;
  skipped_count: number;
  pending_count: number;
  missed_count: number;
}

export interface DoseLogPayload {
  scheduled_time: string; // ISO datetime
  actual_time?: string | null;
  status: "taken" | "skipped";
  notes?: string | null;
}

export interface DoseLogResponse {
  id: string;
  medicine_id: string;
  schedule_id?: string | null;
  user_id: string;
  scheduled_time: string;
  actual_time?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdherenceSummary {
  days: number;
  total_scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  adherence_rate_percent: number;
}

export interface MedicineAlertsResponse {
  low_refill: Medicine[];
  expiring_soon: Medicine[];
  expired: Medicine[];
}

export interface ReminderProviderStatusResponse {
  in_app_enabled: boolean;
  external_delivery_available: boolean;
  provider_name: string;
  message: string;
}
