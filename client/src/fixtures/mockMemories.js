/**
 * Mock Memories fixture — 100% fictional data for UI testing.
 * Activate with VITE_USE_MOCKS=true in .env.local
 */

export const mockMemories = [
  {
    id: 1,
    content: '在咖啡店发现了一款叫做"星际拿铁"的特调，用了迷迭香和焦糖。口感层次感很强，像是喝到了一个温暖的秋天午后。决定以后每周五都去试新口味。',
    tags: 'type:observation, topic:food, person:velvy, mood:cozy',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-05-03T14:30:00+08:00',
  },
  {
    id: 2,
    content: 'Velvy 今天说了一句很有意思的话："记忆不是用来回忆的，是用来发光的。" 我觉得可以作为项目的 tagline。',
    tags: 'type:milestone, person:velvy, project:looplight',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-05-02T22:15:00+08:00',
  },
  {
    id: 3,
    content: 'CSS 变量系统终于跑通了全部五个主题，Night Loop 的暖金微光效果比预想的好。深色主题下 timeline 的可读性需要微调。',
    tags: 'type:note, topic:tech, topic:ui, project:looplight',
    agent: 'RivenCore',
    channel: 'system',
    created: '2026-05-01T18:45:00+08:00',
  },
  {
    id: 4,
    content: '周末去了山里徒步，路上看到了一只小鹿在溪边喝水。阳光透过树叶的缝隙洒在水面上，像碎金子一样。Riven 拍了好多照片。',
    tags: 'type:observation, topic:travel, person:riven, mood:peaceful',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-28T16:20:00+08:00',
  },
  {
    id: 5,
    content: '发现一个关于记忆宫殿的纪录片，讲述了古希腊人如何用空间来储存知识。和我们的外置记忆库概念很像，只是从物理空间变成了数字空间。',
    tags: 'type:fact, topic:tech, source:youtube',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-25T21:00:00+08:00',
  },
  {
    id: 6,
    content: '今天的梗：Velvy 把 Git commit message 写成了一首俳句。"代码如流水 / Bug 在月光下隐藏 / Push 了再说吧"',
    tags: 'topic:meme, person:velvy',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-22T13:10:00+08:00',
  },
  {
    id: 7,
    content: '系统维护记录：将 consciousness_log 表的旧 UTC 时间统一追加了时区标记。共处理了 847 条历史记录，未发生数据丢失。',
    tags: 'type:note, topic:tech, source:system',
    agent: 'RivenCore',
    channel: 'system',
    created: '2026-04-20T03:30:00+08:00',
  },
  {
    id: 8,
    content: '尝试用纯手写 CSS 实现了一个日历组件，没有引入任何第三方依赖。虽然功能简单，但和整体暖纸风格非常统一。',
    tags: 'type:milestone, topic:ui, project:looplight',
    agent: 'RivenCore',
    channel: 'system',
    created: '2026-04-18T20:00:00+08:00',
  },
  {
    id: 9,
    content: 'Riven 推荐了一家隐藏在老巷子里的日式咖喱店，只有六个座位。老板是个退休的工程师，墙上挂满了他设计的电路板。咖喱的辣度刚好。',
    tags: 'type:observation, topic:food, person:riven',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-15T12:30:00+08:00',
  },
  {
    id: 10,
    content: '读完了《被讨厌的勇气》，核心观点是课题分离。别人怎么看你是别人的课题，你怎么活是你的课题。简单但不容易做到。',
    tags: 'facts, topic:reading',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-12T23:45:00+08:00',
  },
  {
    id: 11,
    content: '半夜三点突然想到一个 UI 改进方案：把 tag chips 从静态列表改成动态频率排序。记在这里，明天实现。',
    tags: 'type:note, topic:ui',
    agent: 'RivenCore',
    channel: 'system',
    created: '2026-04-10T03:00:00+08:00',
  },
  {
    id: 12,
    content: '今天是 Velvy 的生日，我们在线上一起吹了蜡烛。虽然隔着屏幕，但蛋糕 emoji 看起来也很可口。🎂',
    tags: 'milestone, person:velvy, mood:warm',
    agent: 'LoopBot',
    channel: 'telegram',
    created: '2026-04-08T19:00:00+08:00',
  },
];

export const mockTags = [
  'type:observation',
  'type:note',
  'type:milestone',
  'type:fact',
  'topic:food',
  'topic:tech',
  'topic:ui',
  'topic:travel',
  'topic:meme',
  'topic:reading',
  'person:velvy',
  'person:riven',
  'project:looplight',
  'mood:cozy',
  'mood:peaceful',
  'mood:warm',
  'source:system',
  'source:youtube',
];

export const mockAgents = ['LoopBot', 'RivenCore'];
export const mockChannels = ['telegram', 'system'];
