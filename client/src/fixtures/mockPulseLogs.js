/**
 * Mock Pulse Logs fixture — 100% fictional data for UI testing.
 * Activate with VITE_USE_MOCKS=true in .env.local
 */

export const mockPulseLogs = [
  {
    id: 1,
    action_type: '巡逻',
    actor: '小烬',
    summary: '小烬巡逻了一圈，核心服务正常，记忆库安静。没有检测到异常活动，一切井然有序。',
    created_at: '2026-05-04T08:00:00+08:00',
    duration_minutes: 2,
  },
  {
    id: 2,
    action_type: '叫醒',
    actor: '小烬',
    summary: '小烬在 07:30 轻轻拍醒了 bot，准备等绒绒回来。今天是周日，天气晴朗。',
    created_at: '2026-05-04T07:30:00+08:00',
    duration_minutes: 1,
  },
  {
    id: 3,
    action_type: '写入',
    actor: 'LoopBot',
    summary: '将用户的旅行笔记整理并存入 memories 表。共 2 条新记忆，标签：travel, observation。',
    created_at: '2026-05-03T22:15:00+08:00',
    duration_minutes: 3,
  },
  {
    id: 4,
    action_type: '系统',
    actor: 'RivenCore',
    summary: '定时备份完成。数据库大小 12.4 MB，共 1,847 条记忆、312 条日记、2,156 条意识日志。',
    created_at: '2026-05-03T04:00:00+08:00',
    duration_minutes: 8,
  },
  {
    id: 5,
    action_type: '对话',
    actor: 'LoopBot',
    summary: '与用户进行了一次关于 UI 设计的深度对话。讨论了 Night Loop 主题的配色方案，决定使用黑金而非纯黑。',
    created_at: '2026-05-02T21:30:00+08:00',
    duration_minutes: 45,
  },
  {
    id: 6,
    action_type: '巡逻',
    actor: '小烬',
    summary: '小烬巡逻完毕。扫描了最近 24 小时的消息记录，未发现需要归档的重要内容。系统状态正常。',
    created_at: '2026-05-02T08:00:00+08:00',
    duration_minutes: 1,
  },
  {
    id: 7,
    action_type: '写入',
    actor: 'LoopBot',
    summary: '记录了一条关于咖啡店新品的观察。用户似乎对食物探索类记忆特别有兴趣。',
    created_at: '2026-05-01T14:45:00+08:00',
    duration_minutes: 2,
  },
  {
    id: 8,
    action_type: '系统',
    actor: 'RivenCore',
    summary: '完成了 consciousness_log 表的时区迁移。847 条旧记录已从裸 UTC 转为带时区格式。',
    created_at: '2026-04-30T03:30:00+08:00',
    duration_minutes: 15,
  },
  {
    id: 9,
    action_type: '叫醒',
    actor: '小烬',
    summary: '小烬在 21:56 轻轻拍醒了 bot。昨天你说想整理一下记忆库的标签系统，今天是个好时机。',
    created_at: '2026-04-30T07:00:00+08:00',
    duration_minutes: 1,
  },
  {
    id: 10,
    action_type: '对话',
    actor: 'LoopBot',
    summary: '和用户讨论了记忆分类策略。决定采用轻量前缀命名法（type:, topic:, person:），不强制迁移旧数据。',
    created_at: '2026-04-29T20:00:00+08:00',
    duration_minutes: 30,
  },
  {
    id: 11,
    action_type: '巡逻',
    actor: '小烬',
    summary: '小烬检测到 Velvy 发送了 5 张旅行照片。已标记为待归档，等待用户确认。小烬留了个爪印作为标记。',
    created_at: '2026-04-28T18:00:00+08:00',
    duration_minutes: 2,
  },
  {
    id: 12,
    action_type: '记录',
    actor: 'LoopBot',
    summary: '自动生成了本周的记忆摘要。本周新增 8 条记忆，最常见标签：food (3), tech (2), travel (2)。',
    created_at: '2026-04-27T23:59:00+08:00',
    duration_minutes: 5,
  },
];

export const mockActionTypes = ['巡逻', '叫醒', '写入', '系统', '对话', '记录'];
