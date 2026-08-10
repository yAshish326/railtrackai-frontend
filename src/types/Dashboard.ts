export interface DashboardSummaryStats {
	trainSearchesCount?: number;
	trainSearches?: number;
	pnrSearchesCount?: number;
	pnrSearches?: number;
	aiRequestsCount?: number;
	aiRequests?: number;
	totalSearches?: number;
	totalSavedSearches?: number;
	savedSearchesCount?: number;
}

export interface DashboardActivityRecord {
	searchType?: string;
	responseSummary?: string;
	timestamp?: string;
	parameters?: Record<string, unknown>;
}

export interface DashboardSummary {
	stats?: DashboardSummaryStats;
	recentActivity?: DashboardActivityRecord[];
}
