/**
 * Mock Diary fixture — 100% fictional data for UI testing.
 * Activate with VITE_USE_MOCKS=true in .env.local
 */

export const mockDiaryDates = [
  '2026-05-04',
  '2026-05-03',
  '2026-05-01',
  '2026-04-28',
  '2026-04-25',
];

export const mockDiaryEntries = {
  '2026-05-04': [
    {
      id: 1,
      content: '今天把 Night Loop 主题终于调通了，整个界面像是被月光包裹。深色的暖金配色比想象中更柔和，不会像普通暗黑模式那样压抑。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-05-04T22:30:00+08:00',
    },
    {
      id: 2,
      content: '晚上和 Velvy 视频聊了一个小时，她最近在学做日式便当。看起来很精致但她说其实很简单，下次要教我。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-05-04T21:00:00+08:00',
    },
  ],
  '2026-05-03': [
    {
      id: 3,
      content: '周六的下午特别适合在阳台上喝咖啡看书。今天读的是一本关于数字极简主义的书，讲的是如何有意识地选择自己的数字工具。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-05-03T15:20:00+08:00',
    },
  ],
  '2026-05-01': [
    {
      id: 4,
      content: '劳动节假期第一天，去了一个很小众的古镇。巷子里有个老奶奶在卖手工的绿豆糕，味道让我想起了小时候的夏天。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-05-01T17:00:00+08:00',
    },
    {
      id: 5,
      content: '古镇的石板路被雨水打湿后反射着暖黄色的灯光，像是走在一条发光的小河上。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-05-01T20:30:00+08:00',
    },
  ],
  '2026-04-28': [
    {
      id: 6,
      content: '周一的工作出奇地顺利。代码一次跑通，会议也很高效。这种日子要记录下来，提醒自己好的日子是真实存在的。',
      agent: 'RivenCore',
      channel: 'system',
      created: '2026-04-28T18:30:00+08:00',
    },
  ],
  '2026-04-25': [
    {
      id: 7,
      content: '失眠的夜晚适合整理思绪。把最近一个月的感受梳理了一遍，发现大多数焦虑都来自于"还没发生的事情"。活在当下这件事，说起来简单。',
      agent: 'LoopBot',
      channel: 'telegram',
      created: '2026-04-25T02:15:00+08:00',
    },
  ],
};
