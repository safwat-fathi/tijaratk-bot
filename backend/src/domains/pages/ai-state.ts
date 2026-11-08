export type PageAiState = 'master_off' | 'over_quota' | 'off' | 'paused' | 'on';

export function pageAiState(p: {
  merchantAiEnabled: boolean;
  overQuota: boolean;
  page: { aiEnabled: boolean; aiPausedUntil: Date | null } | null;
  now?: Date;
}): PageAiState {
  if (!p.merchantAiEnabled) return 'master_off';
  if (p.overQuota) return 'over_quota';
  if (!p.page) return 'on';
  if (!p.page.aiEnabled) return 'off';
  const now = p.now ?? new Date();
  if (p.page.aiPausedUntil && p.page.aiPausedUntil.getTime() > now.getTime()) return 'paused';
  return 'on';
}

