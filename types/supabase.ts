/**
 * Supabase Database Types for LinkedInDM
 */

export interface ProfileRow {
  id: string; // references auth.users(id)
  name: string | null;
  email: string | null;
  experience: string | null;
  skills: string[] | null;
  target_roles: string[] | null;
  location: string | null;
  work_preference: string | null;
  agency_info: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export type ConnectionStatus = 'new' | 'contacted' | 'skipped';

export interface ConnectionRow {
  id: string;
  user_id: string;
  linkedin_url: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  score: number | null;
  connected_on: string | null; // YYYY-MM-DD
  status: ConnectionStatus;
  contacted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  location?: string | null;
  notes?: string | null;
  headline?: string | null;
  raw_data?: Record<string, any> | null;
}

export type OutreachEventType = 'initial' | 'follow_up';

export interface OutreachEventRow {
  id: string;
  user_id: string;
  connection_id: string;
  type: OutreachEventType;
  sequence_number: number;
  message: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ImportRow {
  id: string;
  user_id: string;
  archive_requested_at: string | null;
  archive_received_at: string | null;
  imported_at: string;
  total_rows: number;
  candidate_rows: number;
  new_connections: number;
  created_at: string;
}

export interface DueFollowUp {
  id: string;
  user_id: string;
  connection_id: string;
  type: 'follow_up';
  sequence_number: number;
  message: string | null;
  scheduled_for: string;
  completed_at: string | null;
  created_at: string;
  // Joined connection fields
  name: string;
  company: string;
  position: string;
  linkedin_url: string;
}
