export type PageAiState = "master_off" | "over_quota" | "off" | "paused" | "on";
export type StatsRange = "today" | "7d" | "30d";
export type PageChannel = "FACEBOOK" | "INSTAGRAM";

export interface PageStatsSummary {
  conversations: number;
  handled_by_ai: number;
  handled_pct: number;
  needed_you: number;
  orders: number;
  revenue: number;
}

export interface PageDailyPoint {
  date: string;
  conversations: number;
  handled_by_ai: number;
}

export interface PageInfo {
  id: string;
  channel: PageChannel;
  account_name: string | null;
  is_active: boolean;
  created_at: string;
  ai_enabled: boolean;
  ai_paused_until: string | null;
  ai_instructions: string | null;
  ai_state: PageAiState;
}

export interface MerchantPage extends PageInfo {
  summary: PageStatsSummary;
  daily: PageDailyPoint[];
}

export type PageOverviewItem = MerchantPage;

export interface DisconnectedPage {
  id: string;
  channel: PageChannel;
  account_name: string | null;
  is_active: false;
  created_at: string;
}

export interface PagesOverviewResponse {
  range: StatsRange;
  merchant_ai_enabled: boolean;
  max_pages: number;
  usage: {
    used: number;
    limit: number;
    by_page: Array<{ id: string; used: number }>;
  };
  pages: MerchantPage[];
  disconnected: DisconnectedPage[];
}

export interface PageDetailResponse extends MerchantPage {
  range: StatsRange;
  merchant_ai_enabled: boolean;
  usage: {
    used: number;
    limit: number;
    page_used: number;
  };
  previous_summary: PageStatsSummary;
}
