export const pmResearchId='muselab-pm-20261023-v1';
export const pmSections=[
 {id:'decision',label:'01 研究结论',y:0,height:900},
 {id:'comparison',label:'02 竞品对照',y:1040,height:1300},
 {id:'evidence',label:'03 证据拆解',y:2480,height:1300},
 {id:'charts',label:'04 图表策略',y:3920,height:1200},
 {id:'journey',label:'05 方案取舍',y:5260,height:1000},
 {id:'validation',label:'06 优先级与验证',y:6400,height:1200},
] as const;

// Facts below refer to the captured screen, rather than a complete product audit.
export const aiComparisons=[
 {name:'Dropbox Dash',task:'连接资料，发起工作任务',entry:'主输入框 + 5 类任务捷径',context:'Notion 同步提示；附件入口',returning:'Chats / Stacks 导航',tradeoff:'任务更具体；可用性依赖资料同步',lesson:'借鉴任务入口与来源状态'},
 {name:'ClickUp',task:'在项目上下文中调用助手',entry:'Suggested / Featured 任务列表',context:'Connected Apps；All Sources',returning:'左侧历史会话列表',tradeoff:'工作上下文丰富；入口密度较高',lesson:'借鉴结果与任务上下文的关联'},
 {name:'Sana AI',task:'基于资料发起问答与整理',entry:'输入框 + 文档 / 邮件任务示例',context:'Sources / Default 入口',returning:'Workflows / Meetings / Folders',tradeoff:'工作对象明确；本图设置菜单遮挡',lesson:'借鉴来源入口；补测实际引用结果'},
 {name:'Krea AI',task:'输入描述，生成视觉作品',entry:'输入区 + Generate',context:'模型、耗时、积分选项可见',returning:'当前生成结果并列展示',tradeoff:'控制力强；新手需理解模型差异',lesson:'借鉴产物预览与成本预期'},
 {name:'Pi',task:'开始一段个人对话',entry:'欢迎语 + Talk with Pi',context:'本图未展示来源配置',returning:'Threads 历史会话',tradeoff:'开始轻量；工作产物出口未展示',lesson:'借鉴语气；产物管理需另行验证'},
 {name:'Cohere',task:'用模型完成文本任务',entry:'任务示例 + 底部输入框',context:'USE TOOLS / JUST CHAT 切换',returning:'Chats 入口可见',tradeoff:'模式可解释；切换效果需实测',lesson:'借鉴模式边界的明确说明'},
];

export const evidenceNotes=[
 {name:'Dropbox Dash',tag:'任务与等待',fact:'输入框下显示 Notion 正在同步，\n同时保留 Analyze / Write 等任务入口。',judgment:'把等待原因放在行动附近，\n用户有机会判断是否继续当前任务。',proposal:'Muselab：字幕准备中显示进度、失败原因\n与可继续做的事；完成后提示打开文章。',risk:'单张截图不能证明同步提示能减少流失。',region:{x:.32,y:.31,w:.51,h:.13}},
 {name:'ClickUp',tag:'上下文与复用',fact:'Suggested 提供具体任务，输入区显示\nAll Sources，左侧保留历史会话。',judgment:'任务入口与资料范围相邻，\n有助于表达“用什么资料做什么”。',proposal:'Muselab：从某期播客直接整理文章，\n带入节目来源、字幕范围和已有笔记状态。',risk:'本图没有展示文章保存与再次使用流程。',region:{x:.37,y:.31,w:.47,h:.30}},
 {name:'Krea AI',tag:'产物与控制',fact:'模型菜单列出输出数量、耗时和积分，\n生成结果与输入区在同一工作界面。',judgment:'先建立对产物和成本的预期，\n再让用户判断是否继续生成。',proposal:'Muselab：先预览文章结构或 Prompt，\n再编辑、保存或发送；用已有来源说明范围。',risk:'不把模型生成质量或费用从截图中推断出来。',region:{x:.005,y:.09,w:.22,h:.78}},
];

export const chartNotes=[
 {name:'Hex',title:'配置与结果并排',fact:'左侧 Data / Style 与轴字段，\n右侧保留大面积图表。',decision:'适用于有数据建模需求的编辑器。\nMuselab 日常回顾先保留筛选与详情。',region:{x:.075,y:.15,w:.18,h:.59}},
 {name:'Braintrust',title:'在任务内完成轻量配置',fact:'Create chart 弹窗内，预览与\n指标 / 分组配置并排。',decision:'若后续增加自定义统计，可用轻量面板；\n先验证固定视图是否已经够用。',region:{x:.51,y:.16,w:.35,h:.65}},
 {name:'Quicken',title:'让工具服务具体问题',fact:'K 线、成交量、时间范围\n集中在同一个分析视图。',decision:'Muselab 优先回答“今天完成了什么”。\n记录区间不等于持续工时，不累计重叠时长。',region:{x:.08,y:.12,w:.83,h:.15}},
];

export const opportunities=[
 {priority:'P0',title:'让长任务有明确去向',source:'证据 A · Dash 的同步状态',proposal:'围绕“字幕 → 文章”统一状态：\n准备 / 整理 / 已存笔记 / 失败可重试。\n离开播客后仍可找到结果。',tradeoff:'先统一状态与结果入口；\n暂缓增加新的模型选择面板。',cost:'建议成本：中 · 涉及后台任务与笔记状态',test:'任务：发起整理后回首页，再找回文章。\n记录：是否完成、误点、寻找耗时、重试次数。',gate:'通过条件：每种状态都有可执行下一步；\n任务结果不丢失，不重复创建笔记。'},
 {priority:'P1',title:'把生成结果变成可复用资产',source:'证据 B / C · ClickUp、Krea AI',proposal:'在现有笔记与灵感素材上串起来源、\n预览、编辑、再次使用和语雀回执。\n沿用现有存储，减少复制粘贴。',tradeoff:'先做来源与回执的一致性；\n暂缓通用聊天与复杂 Agent 配置。',cost:'建议成本：中 · 跨笔记、素材与导出入口',test:'任务：找回昨天的素材，修改并再次使用。\n记录：来源找回成功、人工复制次数、耗时。',gate:'通过条件：原始来源可打开、用户编辑保留；\n导出成功与失败均有真实回执。'},
 {priority:'P2',title:'让工作回顾可解释',source:'证据 D / E / F · 图表设计对照',proposal:'围绕现有工作时间线提供日期 / 主题筛选，\n点击条目看到证据与覆盖范围。\n先确认用户是否需要聚合统计。',tradeoff:'暂缓任意字段拖拽与十几种图表；\n优先避免把记录区间当成工时。',cost:'建议成本：低至中 · 筛选、详情与统计口径',test:'任务：说明今天完成了什么、还有什么未知。\n记录：能否追溯证据，是否误读时长。',gate:'通过条件：重叠区间不相加为工时；\n无记录、未覆盖、加载失败可区分。'},
];
