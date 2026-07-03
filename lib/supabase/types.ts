export type BeltColor = 'white' | 'blue' | 'purple' | 'brown' | 'black' | 'coral'
export type UserRole = 'admin' | 'student'
export type CalendarItemType = 'class' | 'graduation' | 'seminar' | 'competition'
export type AttendanceStatus = 'confirmed' | 'cancelled' | 'attended' | 'absent'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  belt_color: BeltColor
  belt_stripes: number
  admin_notes: string | null
  created_at: string
}

export interface CalendarItem {
  id: string
  type: CalendarItemType
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_rule: string | null
  created_by: string | null
  created_at: string
}

export interface Attendance {
  id: string
  calendar_item_id: string
  student_id: string
  status: AttendanceStatus
  confirmed_at: string
  verified_by: string | null
  verified_at: string | null
}

export interface AttendanceWithProfile extends Attendance {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'belt_color' | 'belt_stripes'>
}

// Minimal Database shape for typed Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
      }
      calendar_items: {
        Row: CalendarItem
        Insert: Omit<CalendarItem, 'id' | 'created_at'>
        Update: Partial<Omit<CalendarItem, 'id' | 'created_at'>>
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'id' | 'confirmed_at'>
        Update: Partial<Omit<Attendance, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      belt_color_enum: BeltColor
      calendar_item_type: CalendarItemType
      attendance_status: AttendanceStatus
    }
  }
}
