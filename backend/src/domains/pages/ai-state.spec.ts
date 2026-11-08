import { describe, expect, it } from 'vitest';
import { pageAiState } from './ai-state.js';

describe('pageAiState', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const future = new Date('2026-11-08T14:00:00Z');
  const past = new Date('2026-11-08T10:00:00Z');

  it('orders precedence: master_off > over_quota > off > paused > on', () => {
    expect(pageAiState({ merchantAiEnabled: false, overQuota: true, page: { aiEnabled: false, aiPausedUntil: future }, now })).toBe('master_off');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: true, page: { aiEnabled: false, aiPausedUntil: future }, now })).toBe('over_quota');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: false, page: { aiEnabled: false, aiPausedUntil: future }, now })).toBe('off');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: false, page: { aiEnabled: true, aiPausedUntil: future }, now })).toBe('paused');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: false, page: { aiEnabled: true, aiPausedUntil: past }, now })).toBe('on');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: false, page: { aiEnabled: true, aiPausedUntil: null }, now })).toBe('on');
  });

  it('treats null page connection as on when merchant AI is enabled and under quota', () => {
    expect(pageAiState({ merchantAiEnabled: true, overQuota: false, page: null, now })).toBe('on');
    expect(pageAiState({ merchantAiEnabled: false, overQuota: false, page: null, now })).toBe('master_off');
    expect(pageAiState({ merchantAiEnabled: true, overQuota: true, page: null, now })).toBe('over_quota');
  });
});

