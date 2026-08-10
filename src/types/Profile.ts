export interface ProfileStats {
  totalSearches: number;
  aiUsage: number;
  pnrSearches: number;
  trainSearches: number;
  savedSearches?: number;
}

export interface ProfileActivity {
  label: string;
  timestamp: string;
  detail: string;
}

export interface ProfileData {
  id?: number;
  avatarUrl?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  role: string;
  memberSince?: string;
  accountStatus?: string;
  lastLogin?: string | null;
  lastSearch?: string | null;
  lastAiConversation?: string | null;
  stats?: ProfileStats;
  recentActivity?: ProfileActivity[];
}

export interface ProfileResponse {
  success: boolean;
  data: ProfileData;
}