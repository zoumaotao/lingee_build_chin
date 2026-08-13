export type ComponentId = "employee" | "agent" | "manager" | "approval" | "knowledge";
export type Locale = "zh-CN" | "en-US";

export interface ViewDefinition {
  id: string;
  zh: string;
  en: string;
}

export interface ComponentDefinition {
  id: ComponentId;
  icon: string;
  zh: string;
  en: string;
  subtitleZh: string;
  subtitleEn: string;
  defaultView: string;
  views: ViewDefinition[];
}

export const components: Record<ComponentId, ComponentDefinition> = {
  employee: {
    id: "employee", icon: "✦", zh: "员工服务台", en: "Employee Service Desk",
    subtitleZh: "自助答疑 · 智能提单 · 进度追踪", subtitleEn: "Self-service · Smart tickets · Progress tracking",
    defaultView: "ticket-draft",
    views: [
      { id: "resolution", zh: "解决判定", en: "Resolution" },
      { id: "ticket-draft", zh: "工单草稿", en: "Ticket draft" },
      { id: "ticket-receipt", zh: "提交回执", en: "Receipt" },
      { id: "ticket-list", zh: "我的工单", en: "My tickets" },
      { id: "ticket-detail", zh: "工单详情", en: "Ticket detail" },
      { id: "rating", zh: "服务评价", en: "Rating" },
      { id: "attachments", zh: "附件管理", en: "Attachments" }
    ]
  },
  agent: {
    id: "agent", icon: "◈", zh: "处理人工作台", en: "Agent Workbench",
    subtitleZh: "接单 · 处理 · 答复 · SLA", subtitleEn: "Accept · Resolve · Reply · SLA",
    defaultView: "queue",
    views: [
      { id: "notification", zh: "新单通知", en: "New assignment" },
      { id: "queue", zh: "我的队列", en: "My queue" },
      { id: "ticket-detail", zh: "工单详情", en: "Ticket detail" },
      { id: "reply", zh: "处理答复", en: "Reply" },
      { id: "reassign", zh: "工单转派", en: "Reassign" },
      { id: "sla-alert", zh: "SLA 告警", en: "SLA alerts" }
    ]
  },
  manager: {
    id: "manager", icon: "▦", zh: "经理运营台", en: "Manager Operations",
    subtitleZh: "团队绩效 · SLA · 负载 · 转派", subtitleEn: "Team KPI · SLA · Workload · Routing",
    defaultView: "dashboard",
    views: [
      { id: "dashboard", zh: "运营概览", en: "Overview" },
      { id: "team-tickets", zh: "团队工单", en: "Team tickets" },
      { id: "workload", zh: "工作负载", en: "Workload" },
      { id: "sla", zh: "SLA 分析", en: "SLA analytics" },
      { id: "reassign", zh: "快速转派", en: "Quick reassign" }
    ]
  },
  approval: {
    id: "approval", icon: "✓", zh: "审批中心", en: "Approval Center",
    subtitleZh: "IT 服务申请 · L1/L2 审批", subtitleEn: "IT service requests · L1/L2 approval",
    defaultView: "approval-list",
    views: [
      { id: "approval-list", zh: "审批待办", en: "Approval inbox" },
      { id: "approval-detail", zh: "申请详情", en: "Request detail" },
      { id: "decision", zh: "审批决策", en: "Decision" },
      { id: "timeline", zh: "审批轨迹", en: "Timeline" }
    ]
  },
  knowledge: {
    id: "knowledge", icon: "◇", zh: "知识沉淀中心", en: "Knowledge Contribution",
    subtitleZh: "手工/对话/内驱沉淀 · 治理 · DC 发布", subtitleEn: "Manual/conversational/proactive ingestion · Governance · DC publish",
    defaultView: "knowledge-ingestion",
    views: [
      { id: "knowledge-ingestion", zh: "对话式摄取", en: "Conversational ingestion" },
      { id: "knowledge-candidate", zh: "内驱候选", en: "Proactive candidate" },
      { id: "knowledge-draft", zh: "知识草稿", en: "Knowledge draft" },
      { id: "source-ticket", zh: "来源工单", en: "Source ticket" },
      { id: "review", zh: "发布审核", en: "Publish review" },
      { id: "publish-result", zh: "DC 发布结果", en: "DC publish result" }
    ]
  }
};

export const tickets = [
  { id: "HD-2026-0811-0238", titleZh: "VPN 连接后无法访问内部系统", titleEn: "Cannot access internal systems after VPN connection", category: "IT / Network & VPN", statusZh: "处理中", statusEn: "In progress", priority: "High", updatedZh: "12 分钟前", updatedEn: "12 min ago", assignee: "Alex Tan", team: "IT Infrastructure", due: "01:42:18", sla: 72 },
  { id: "HD-2026-0811-0215", titleZh: "申请安装 Power BI Desktop", titleEn: "Request Power BI Desktop installation", category: "IT / Software Request", statusZh: "待审批", statusEn: "Pending approval", priority: "Medium", updatedZh: "1 小时前", updatedEn: "1 hour ago", assignee: "Unassigned", team: "IT Application", due: "06:20:00", sla: 38 },
  { id: "HD-2026-0810-0198", titleZh: "Outlook 邮件同步异常", titleEn: "Outlook email synchronization issue", category: "IT / Email", statusZh: "待确认", statusEn: "Pending confirmation", priority: "Medium", updatedZh: "昨天 16:42", updatedEn: "Yesterday 16:42", assignee: "Mei Ling", team: "IT Service Desk", due: "18:30:00", sla: 20 },
  { id: "HD-2026-0809-0174", titleZh: "重置 HR Portal 密码", titleEn: "Reset HR Portal password", category: "People GBS / HR Portal", statusZh: "已关闭", statusEn: "Closed", priority: "Low", updatedZh: "8月9日", updatedEn: "Aug 9", assignee: "Sarah Lim", team: "People GBS", due: "—", sla: 0 }
];

export const timeline = [
  { time: "09:18", titleZh: "工单已创建", titleEn: "Ticket created", descZh: "系统已自动分配至 IT Infrastructure", descEn: "Automatically routed to IT Infrastructure", kind: "done" },
  { time: "09:21", titleZh: "处理人已接单", titleEn: "Agent accepted", descZh: "Alex Tan 开始处理", descEn: "Alex Tan started working", kind: "done" },
  { time: "09:46", titleZh: "处理人答复", titleEn: "Agent replied", descZh: "请重新导入 VPN 配置文件，并确认 MFA 已通过。", descEn: "Please re-import the VPN profile and confirm MFA succeeds.", kind: "active" },
  { time: "—", titleZh: "等待用户确认", titleEn: "Waiting for confirmation", descZh: "确认解决后将自动关闭并邀请评价", descEn: "The ticket closes after confirmation and requests a rating", kind: "pending" }
];

export const teamMembers = [
  { name: "Alex Tan", initials: "AT", role: "IT Infrastructure", active: 8, overdue: 1, capacity: 92, color: "#6d5ce8" },
  { name: "Mei Ling", initials: "ML", role: "IT Service Desk", active: 5, overdue: 0, capacity: 64, color: "#18a87b" },
  { name: "Daniel Wong", initials: "DW", role: "IT Application", active: 7, overdue: 2, capacity: 84, color: "#e88832" },
  { name: "Sarah Lim", initials: "SL", role: "People GBS", active: 3, overdue: 0, capacity: 42, color: "#3976d8" }
];

export const approvals = [
  { id: "APR-2026-0088", ticket: "HD-2026-0811-0215", titleZh: "安装 Power BI Desktop", titleEn: "Install Power BI Desktop", requester: "Michelle Lee", dept: "Finance", level: "L1", amount: "标准软件", ageZh: "等待 1 小时", ageEn: "Waiting 1 hour", risk: "low" },
  { id: "APR-2026-0085", ticket: "HD-2026-0811-0202", titleZh: "开通生产数据库只读权限", titleEn: "Production DB read-only access", requester: "Jason Ng", dept: "Data Team", level: "L2", amount: "高权限", ageZh: "等待 3 小时", ageEn: "Waiting 3 hours", risk: "high" },
  { id: "APR-2026-0081", ticket: "HD-2026-0810-0189", titleZh: "申请新笔记本电脑", titleEn: "Request a new laptop", requester: "Emily Chen", dept: "Marketing", level: "L1", amount: "RM 5,800", ageZh: "等待 1 天", ageEn: "Waiting 1 day", risk: "medium" }
];

export const attachments = [
  { id: "att-01", name: "vpn-error-screen.png", size: "842 KB", type: "PNG", selected: true },
  { id: "att-02", name: "vpn-diagnostic-log.txt", size: "126 KB", type: "TXT", selected: true }
];

export const replyTemplates = [
  { zh: "需要更多信息", en: "Need more information" },
  { zh: "已提供解决方案", en: "Solution provided" },
  { zh: "请重启后重试", en: "Please restart and retry" }
];

export const dictionary = {
  zh: {
    demo: "演示数据", connected: "已连接灵基", connecting: "等待宿主连接", actionDone: "操作已提交",
    cancel: "取消", confirm: "确认", submit: "提交", save: "保存草稿", viewDetail: "查看详情", back: "返回",
    search: "搜索工单号、标题或提单人", all: "全部", status: "状态", priority: "优先级", category: "分类",
    requester: "提单人", assignee: "处理人", team: "处理团队", createdAt: "创建时间", updatedAt: "更新时间",
    description: "问题描述", attachments: "附件", required: "必填", optional: "选填", loading: "正在处理…"
  },
  en: {
    demo: "Demo data", connected: "Connected to Lingee", connecting: "Waiting for host", actionDone: "Action submitted",
    cancel: "Cancel", confirm: "Confirm", submit: "Submit", save: "Save draft", viewDetail: "View detail", back: "Back",
    search: "Search ID, title, or requester", all: "All", status: "Status", priority: "Priority", category: "Category",
    requester: "Requester", assignee: "Assignee", team: "Team", createdAt: "Created", updatedAt: "Updated",
    description: "Description", attachments: "Attachments", required: "Required", optional: "Optional", loading: "Processing…"
  }
};
