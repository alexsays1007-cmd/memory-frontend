import { fetchApi } from './client.js';

export const mockUsage = {
  ok: true,
  updatedAt: new Date().toISOString(),
  providers: [
    {
      id: 'claude',
      name: 'Claude Code',
      available: true,
      stale: false,
      session: {
        usedPercent: null,
        resetsAt: null,
        resetsInSeconds: null,
        label: 'Current session',
      },
      weekly: {
        usedPercent: 73,
        resetsAt: '2026-05-26T18:00:00.000Z',
        resetsInSeconds: 120938,
        dailyPacePercent: 14.2857,
        pace: {
          cycleDay: 6,
          cumulativePacePercent: 85.7142,
          status: 'quiet',
        },
        events: [
          {
            type: 'quota_refresh_in_cycle',
            cycleDay: 6,
            at: '2026-05-25T08:00:00.000Z',
            fromUsedPercent: 92,
            toUsedPercent: 4,
            source: 'live',
          },
        ],
        paceHistory: [
          { cycleDay: 1, date: '2026-05-20', usedPercent: 18, cumulativePacePercent: 14.2857, status: 'over_pace' },
          { cycleDay: 2, date: '2026-05-21', usedPercent: 31, cumulativePacePercent: 28.5714, status: 'over_pace' },
          { cycleDay: 3, date: '2026-05-22', usedPercent: 39, cumulativePacePercent: 42.8571, status: 'watch' },
          { cycleDay: 4, date: '2026-05-23', usedPercent: 50, cumulativePacePercent: 57.1428, status: 'quiet' },
          { cycleDay: 5, date: '2026-05-24', usedPercent: 64, cumulativePacePercent: 71.4285, status: 'watch' },
          { cycleDay: 6, date: '2026-05-25', usedPercent: 73, cumulativePacePercent: 85.7142, status: 'quiet' },
        ],
      },
      warning: false,
      error: null,
    },
    {
      id: 'codex',
      name: 'Codex',
      available: true,
      stale: false,
      session: {
        usedPercent: 21,
        resetsAt: '2026-05-25T09:23:34.000Z',
        resetsInSeconds: 3551,
        label: 'Current session',
      },
      weekly: {
        usedPercent: 10,
        resetsAt: '2026-05-30T20:45:12.000Z',
        resetsInSeconds: 476449,
        dailyPacePercent: 14.2857,
        pace: {
          cycleDay: 2,
          cumulativePacePercent: 28.5714,
          status: 'quiet',
        },
        paceHistory: [
          { cycleDay: 1, date: '2026-05-24', usedPercent: 4, cumulativePacePercent: 14.2857, status: 'quiet' },
          { cycleDay: 2, date: '2026-05-25', usedPercent: 10, cumulativePacePercent: 28.5714, status: 'quiet' },
        ],
      },
      warning: false,
      error: null,
    },
  ],
};

export async function getUsage({ allowMock = import.meta.env.DEV } = {}) {
  try {
    return await fetchApi('/usage');
  } catch (error) {
    if (allowMock) {
      return {
        ...mockUsage,
        mock: true,
        mockReason: error.message,
        updatedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}
