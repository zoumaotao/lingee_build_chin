const employeeTickets = [
  { id: "HD-2026-0811-0238", title: "VPN 连接后无法访问内部系统", category: "IT / Network & VPN", status: "处理中", statusKey: "progress", viewGroup: "processing", priority: "High", updated: "12 分钟前", owner: "Alex Tan", team: "IT Infrastructure", sla: "剩余 1小时42分", description: "VPN 已连接，但 ERP 与内部文件服务器仍无法访问。处理人已建议重新导入配置并完成 MFA。", timeline: [["09:18", "工单已创建"], ["09:21", "Alex Tan 已接单"], ["09:46", "处理人已回复，等待你的确认"]] },
  { id: "HD-2026-0811-0215", title: "申请安装 Power BI Desktop", category: "IT / Software Request", status: "处理中", statusKey: "pending", viewGroup: "processing", priority: "Medium", updated: "1 小时前", owner: "审批队列", team: "IT Application", sla: "剩余 6小时20分", description: "软件安装申请已进入 L1 审批，审批结果以后台工单系统返回为准。", timeline: [["08:36", "申请已提交"], ["08:38", "规则检查完成"], ["08:40", "进入 L1 审批"]] },
  { id: "HD-2026-0810-0198", title: "Outlook 邮件同步异常", category: "IT / Email", status: "待提交人确认", statusKey: "pending", viewGroup: "processing", priority: "Medium", updated: "昨天 16:42", owner: "Mei Ling", team: "IT Service Desk", sla: "剩余 18小时", description: "处理人已完成邮箱配置刷新，等待确认邮件是否恢复同步。", timeline: [["昨天 14:10", "工单已创建"], ["昨天 15:26", "处理人更新了邮箱配置"], ["昨天 16:42", "等待你的确认"]] },
  { id: "HD-2026-0809-0174", title: "重置 HR Portal 密码", category: "People GBS / HR Portal", status: "已解决待评价", statusKey: "closed", viewGroup: "rating", priority: "Low", updated: "8月9日", owner: "Sarah Lim", team: "People GBS", sla: "已完成", description: "密码重置已完成，等待员工评价后关闭。", timeline: [["8月9日 10:03", "工单已创建"], ["8月9日 10:18", "密码重置完成"], ["8月9日 10:22", "员工确认已解决，等待评价"]] },
  { id: "HD-2026-0807-0152", title: "办公区打印机驱动安装", category: "IT / Workplace", status: "已关闭", statusKey: "closed", viewGroup: "closed", priority: "Low", updated: "8月7日", owner: "Daniel Wong", team: "IT Workplace", sla: "已完成", description: "打印机驱动已安装并验证，员工已提交五星评价，工单正式关闭。", timeline: [["8月7日 09:12", "工单已创建"], ["8月7日 09:45", "驱动安装并验证"], ["8月7日 10:02", "员工评价后关闭"]] }
];

const agentTickets = [
  { id: "HD-2026-0811-0249", title: "财务共享盘访问权限异常", category: "IT / Access", status: "处理中", statusKey: "processing", viewGroup: "pending", priority: "High", updated: "8 分钟前", owner: "你", team: "IT Service Desk", sla: "已超时 18分", description: "Finance 团队 4 名成员无法访问共享盘，需要核对权限组与最近一次组织调整。", timeline: [["08:20", "工单已自动分配"], ["08:32", "用户补充影响范围"], ["09:20", "响应 SLA 已超时"]] },
  { id: "HD-2026-0811-0238", title: "VPN 连接后无法访问内部系统", category: "IT / Network & VPN", status: "处理中", statusKey: "progress", viewGroup: "processed", priority: "High", updated: "12 分钟前", owner: "你", team: "IT Infrastructure", sla: "剩余 1小时42分", description: "用户已完成重启但问题仍存在。建议核对 VPN 配置版本、MFA 与 DNS。", timeline: [["09:18", "工单进入队列"], ["09:21", "你已接单"], ["09:46", "已发送排查建议，等待用户反馈"]] },
  { id: "HD-2026-0811-0227", title: "新员工无法登录协作平台", category: "IT / Identity", status: "待分配", statusKey: "pending-assign", viewGroup: "pending", priority: "Medium", updated: "21 分钟前", owner: "待接单", team: "IT Service Desk", sla: "剩余 3小时11分", description: "新员工首次登录提示账号不存在，需要检查身份同步状态。", timeline: [["09:06", "工单已创建"], ["09:07", "按分类分配至共享池"]] },
  { id: "HD-2026-0811-0215", title: "申请安装 Power BI Desktop", category: "IT / Software Request", status: "处理中", statusKey: "pending", viewGroup: "processed", priority: "Medium", updated: "1 小时前", owner: "审批队列", team: "IT Application", sla: "剩余 6小时20分", description: "处理人已完成前置检查并转入 L1 审批，当前无需继续操作。", timeline: [["08:36", "申请已提交"], ["08:38", "处理人完成前置检查"], ["08:40", "进入 L1 审批"]] },
  { id: "HD-2026-0810-0191", title: "会议室显示屏无法投屏", category: "IT / Workplace", status: "已关闭", statusKey: "closed", viewGroup: "closed", priority: "Low", updated: "昨天 15:10", owner: "Daniel Wong", team: "IT Workplace", sla: "已完成", description: "已更换 HDMI 转接器并完成现场验证。", timeline: [["昨天 12:03", "工单已创建"], ["昨天 14:40", "现场更换转接器"], ["昨天 15:10", "用户确认关闭"]] }
];

function restoreSessionDrafts() {
  try {
    const restored = JSON.parse(sessionStorage.getItem("helpdesk-local-drafts") || "[]");
    if (Array.isArray(restored)) {
      restored.filter((item) => item && typeof item === "object" && item.statusKey === "draft").reverse().forEach((item) => employeeTickets.unshift({ ...item, viewGroup: "processing" }));
    }
  } catch {
    sessionStorage.removeItem("helpdesk-local-drafts");
  }
}
restoreSessionDrafts();

const roleConfigs = {
  employee: {
    workspaceTitle: "我的工单",
    workspaceSubtitle: "查看进度、补充信息与确认解决",
    primaryAction: "＋ 新建工单",
    searchPlaceholder: "搜索工单号或标题",
    views: [
      { id: "all", label: "全部" },
      { id: "processing", label: "处理中" },
      { id: "rating", label: "已关闭" },
      { id: "closed", label: "已关闭" }
    ],
    tickets: employeeTickets,
    stats: [["进行中", "3", "含审批与待确认", "warn"], ["已关闭", "1", "服务已解决", "warn"], ["本月已关闭", "12", "+3 较上月", "good"], ["平均满意度", "4.8", "最近 6 次评价", "good"]]
  },
  agent: {
    workspaceTitle: "我的任务",
    workspaceSubtitle: "查看并处理分配给我的工单",
    primaryAction: null,
    searchPlaceholder: "搜索工单、提单人或分类",
    views: [
      { id: "all", label: "全部" },
      { id: "processing", label: "处理中" },
      { id: "pending-confirm", label: "待评价" },
      { id: "closed", label: "已关闭" }
    ],
    tickets: agentTickets,
    stats: [["我的待办", "4", "1 张已超时", "bad"], ["高风险", "3", "未来 4 小时", "warn"], ["今日已解决", "6", "+2 较昨日", "good"], ["SLA 达标率", "94.8%", "+2.4% 本周", "good"]]
  }
};

let currentRole = "employee";
let currentView = "all";
let selectedTicketId = null;
let toastTimer;

const byId = (id) => document.getElementById(id);
const IT_AGENT_SESSION_URL = "https://www.test.lingeeglobal.ai/session/new?skillName=IT%20Knowledge%20Skill";
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const currentConfig = () => roleConfigs[currentRole];
const currentTickets = () => currentConfig().tickets;

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function priorityClass(priority) { return `priority-${priority.toLowerCase()}`; }
function statusClass(statusKey) { return `status-${statusKey}`; }

function renderStats() {
  byId("statsGrid").innerHTML = currentConfig().stats.map(([label, value, note, tone]) => `
    <article class="stat-card"><span>${escapeHtml(label)}</span><div><strong>${escapeHtml(value)}</strong><small class="${tone}">${escapeHtml(note)}</small></div></article>`).join("");
}

function renderViewTabs() {
  const tabs = byId("viewTabs");
  tabs.innerHTML = currentConfig().views.map((view) => {
    const active = view.id === currentView;
    return `<button class="${active ? "active" : ""}" id="view-tab-${escapeHtml(currentRole)}-${escapeHtml(view.id)}" type="button" role="tab" aria-selected="${String(active)}" aria-controls="ticketBoard" tabindex="${active ? "0" : "-1"}" data-view="${escapeHtml(view.id)}">${escapeHtml(view.label)}</button>`;
  }).join("");
  const buttons = [...tabs.querySelectorAll("[data-view]")];
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      selectedTicketId = null;
      renderViewTabs();
      renderTickets();
    });
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[nextIndex].click();
      byId("viewTabs").querySelectorAll("[data-view]")[nextIndex].focus();
    });
  });
}

function populateStatusFilter() {
  const select = byId("statusFilter");
  const previous = select.value;
  const statuses = [...new Set(currentTickets().map((ticket) => ticket.status))];
  select.innerHTML = `<option value="all">全部状态</option>${statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}`;
  select.value = statuses.includes(previous) ? previous : "all";
}

function filteredTickets() {
  const query = byId("ticketSearch").value.trim().toLowerCase();
  const status = byId("statusFilter").value;
  return currentTickets().filter((ticket) => {
    const matchesView = currentView === "all" || ticket.viewGroup === currentView;
    const matchesStatus = status === "all" || ticket.status === status;
    const haystack = `${ticket.id} ${ticket.title} ${ticket.category} ${ticket.owner}`.toLowerCase();
    return matchesView && matchesStatus && (!query || haystack.includes(query));
  });
}

function renderTickets() {
  const tickets = filteredTickets();
  if (selectedTicketId && !tickets.some((ticket) => ticket.id === selectedTicketId)) selectedTicketId = null;
  byId("resultCount").textContent = `共 ${tickets.length} 张，数据仅用于原型展示`;
  byId("ticketList").innerHTML = tickets.length ? tickets.map((ticket) => `
    <button class="ticket-item ${selectedTicketId === ticket.id ? "active" : ""}" type="button" data-ticket-id="${escapeHtml(ticket.id)}">
      <span class="ticket-main"><span class="ticket-meta"><code>${escapeHtml(ticket.id)}</code><span class="priority-tag ${priorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</span><span class="status-tag ${statusClass(ticket.statusKey)}">${escapeHtml(ticket.status)}</span></span><strong>${escapeHtml(ticket.title)}</strong><small>${escapeHtml(ticket.category)} · ${escapeHtml(ticket.team)}</small></span>
      <span class="ticket-side"><small>${escapeHtml(ticket.updated)}</small><b>${escapeHtml(ticket.sla)}</b></span>
    </button>`).join("") : `<div class="empty-list"><strong>没有符合条件的工单</strong><p>请调整搜索词、状态或视图。</p></div>`;
  byId("ticketList").querySelectorAll("[data-ticket-id]").forEach((button) => button.addEventListener("click", () => {
    selectedTicketId = button.dataset.ticketId;
    renderTickets();
  }));
  renderDetail();
}

function renderDetail() {
  const ticket = currentTickets().find((item) => item.id === selectedTicketId);
  if (!ticket) {
    byId("detailPanel").innerHTML = `<div class="empty-detail"><span>▤</span><strong>选择一张工单</strong><p>在左侧列表中选择工单后查看详情和可执行操作。</p></div>`;
    return;
  }
  const openAgentAction = `<a class="secondary-button session-launch-button" href="${IT_AGENT_SESSION_URL}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="打开 IT 智能体新会话；不会携带工单 ${escapeHtml(ticket.id)} 的上下文">打开 IT 智能体 ↗</a>`;
  const employeeActions = `${openAgentAction}<button class="secondary-button" type="button" data-backend-action="补充信息">补充信息</button><button class="primary-button" type="button" data-backend-action="确认解决">确认解决</button>`;
  const agentActions = `${openAgentAction}<button class="secondary-button" type="button" data-backend-action="转派工单">转派</button><button class="primary-button" type="button" data-backend-action="发送答复">编辑并发送答复</button>`;
  byId("detailPanel").innerHTML = `
    <div class="detail-head"><div class="ticket-meta"><code>${escapeHtml(ticket.id)}</code><span class="priority-tag ${priorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</span><span class="status-tag ${statusClass(ticket.statusKey)}">${escapeHtml(ticket.status)}</span></div><h3>${escapeHtml(ticket.title)}</h3><p>${escapeHtml(ticket.description)}</p></div>
    <div class="detail-grid"><div class="detail-field"><span>分类</span><strong>${escapeHtml(ticket.category)}</strong></div><div class="detail-field"><span>${currentRole === "employee" ? "处理人" : "当前归属"}</span><strong>${escapeHtml(ticket.owner)}</strong></div><div class="detail-field"><span>处理团队</span><strong>${escapeHtml(ticket.team)}</strong></div><div class="detail-field"><span>SLA</span><strong>${escapeHtml(ticket.sla)}</strong></div></div>
    <div class="timeline"><h4>最新进展</h4>${ticket.timeline.map(([time, title]) => `<div class="timeline-item"><i></i><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(time)}</small></div></div>`).join("")}</div>
    <div class="detail-actions">${currentRole === "employee" ? employeeActions : agentActions}</div>
    <div class="session-launch-note"><strong>新会话边界</strong><span>当前仅打开 IT Knowledge Skill 通用新会话，不会携带该工单的编号、描述或处理上下文。</span></div>
    <div class="integration-note">工单查询与写操作需真实 MCP Tool、权限与审计。</div>`;
  byId("detailPanel").querySelectorAll("[data-backend-action]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.backendAction}失败关闭：未连接获准的工单 MCP Tool，未执行任何真实写操作。`)));
}

function setRole(role) {
  if (!roleConfigs[role]) return;
  currentRole = role;
  currentView = "all";
  selectedTicketId = null;
  const config = currentConfig();
  byId("workspaceTitle").textContent = config.workspaceTitle;
  byId("workspaceSubtitle").textContent = config.workspaceSubtitle;
  const primaryAction = byId("primaryAction");
  primaryAction.hidden = !config.primaryAction;
  primaryAction.textContent = config.primaryAction || "";
  byId("ticketSearch").placeholder = config.searchPlaceholder;
  byId("ticketSearch").value = "";
  byId("statusFilter").value = "all";
  document.querySelectorAll("[data-role-select]").forEach((button) => {
    const active = button.dataset.roleSelect === role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderViewTabs();
  renderStats();
  populateStatusFilter();
  renderTickets();
}

function saveLocalDraft(form) {
  const data = new FormData(form);
  const id = `LOCAL-${String(Date.now()).slice(-6)}`;
  const draft = { id, title: data.get("title"), category: data.get("category"), status: "本地草稿", statusKey: "draft", viewGroup: "processing", priority: data.get("priority"), updated: "刚刚", owner: "未提交", team: "待确定", sla: "未开始", description: data.get("description"), timeline: [["刚刚", "草稿仅保存在当前浏览器会话"]] };
  employeeTickets.unshift(draft);
  sessionStorage.setItem("helpdesk-local-drafts", JSON.stringify(employeeTickets.filter((ticket) => ticket.statusKey === "draft")));
  byId("ticketDialog").close();
  form.reset();
  currentView = "processing";
  selectedTicketId = id;
  byId("statusFilter").value = "all";
  renderViewTabs();
  populateStatusFilter();
  renderStats();
  renderTickets();
  showToast("仅保存本地草稿；真实建单写操作未获授权并已失败关闭。");
}

const agentConversationScripts = {
  employee: {
    type: "员工智能体",
    name: "Helpdesk Assistant",
    subtitle: "知识问询与对话式建单",
    icon: "员",
    initial: [
      { kind: "system", text: "演示说明：以下知识答案与工单信息均为预设剧情，不代表实时 DC 检索或后台结果。" },
      { kind: "assistant", text: "你好，我是 Helpdesk Assistant。你可以先描述遇到的 IT 问题；如果知识建议无法解决，我会继续补齐信息并生成待确认的工单草稿。" }
    ],
    turns: [
      { user: "VPN 已经连接成功，但 ERP 和内部文件服务器都打不开，怎么处理？", replies: [{ kind: "knowledge-solution", title: "找到一个可能的解决方案", source: "远程访问与 VPN 使用指南 · 4.2", badge: "KB", solutionTitle: "重新导入最新 VPN 配置", steps: ["删除当前 VPN 配置", "从 IT Portal 导入最新配置", "完成 MFA 后重新连接并刷新本机 DNS"], question: "这个方案解决了问题吗？", meta: "预设知识结果 · 非实时 DC 检索" }] },
      { user: "已经重新导入配置、完成 MFA 并重启电脑，还是不行。", replies: [{ kind: "iframe", component: "employee/ticket-draft", title: "工单草稿确认" }] },
      { user: "确认提交", replies: [{ kind: "assistant", text: "工单已创建成功。" }, { kind: "iframe", component: "employee/ticket-detail", title: "工单回执", params: "scene=receipt" }] },
      { user: "查一下我的工单", replies: [{ kind: "iframe", component: "employee/ticket-list", title: "我的工单列表" }] },
      { user: "看一下 VPN 那个工单的进度", replies: [{ kind: "iframe", component: "employee/ticket-detail", title: "工单进度", params: "scene=progress" }] },
      { user: "HR Portal 密码重置那个工单已经解决了，我来评价一下", replies: [{ kind: "iframe", component: "employee/ticket-detail", title: "确认解决并评价", params: "scene=confirm&step=rate" }] }
    ]
  },
  agent: {
    type: "处理人智能体",
    name: "Agent Workbench",
    subtitle: "工单诊断与答复辅助",
    icon: "处",
    initial: [
      { kind: "system", text: "演示说明：以下任务、工单详情和建议均为预设剧情，不代表实时查询、真实权限校验或跨角色同步。" },
      { kind: "assistant", text: "你好，我是 Agent Workbench。我可以基于你有权查看的工单形成摘要、排查建议和答复草稿；任何发送或转派都必须由处理人确认。" }
    ],
    turns: [
      { user: "分析工单 HD-2026-0811-0238，先不要发送任何回复。", replies: [{ kind: "assistant", text: "好的，我来看一下这张工单：\n\n员工已重新导入 VPN 配置、完成 MFA 并重启电脑，但 ERP 和内部文件服务器仍无法访问，当前影响财务月结。\n\n建议优先核对 VPN 客户端配置版本、分割路由和 DNS 设置。如果只有该员工受影响，再检查账号对应的访问策略。\n\n需要我帮你草拟答复吗？" }] },
      { user: "生成一版给员工的排查回复，我确认后再发送。", replies: [{ kind: "iframe", component: "agent/ticket-detail", title: "工单详情与答复" }] },
      { user: "HD-0811-0227 新员工登录问题转派给 Mei Ling 处理。", replies: [{ kind: "iframe", component: "agent/reassign", title: "工单转派确认" }] },
      { user: "VPN 工单处理完毕后帮我总结一下解决方法，生成知识产物。", replies: [{ kind: "assistant", text: "好的，已根据工单处理记录生成知识产物文件《VPN 连接后无法访问内部系统的排查步骤》。\n\n产物已出现在右侧面板，你可以悬停文件图标点击「上传智能体知识」将其写入 Console 知识管理并同步至智能体知识库。" }] }
    ]
  }
};

let currentConversationAgent = "employee";
const completedConversationTurns = { employee: 0, agent: 0 };
const conversationUserInputs = { employee: [], agent: [] };
const conversationOutcomes = { employee: null, agent: null };

function conversationMessageHtml(message, script) {
  if (message.kind === "system") return `<div class="conversation-system"><span>边界提示</span><p>${escapeHtml(message.text)}</p></div>`;
  if (message.kind === "knowledge-solution") return `<div class="conversation-message assistant"><span class="message-avatar">${escapeHtml(script.icon)}</span><div><div class="conversation-card-iframe"><iframe allowtransparency="true" src="http://localhost:5173/employee/resolution/dist/index.html?preview=1&t=${Date.now()}" title="知识检索卡"></iframe></div></div></div>`;
  if (message.kind === "iframe") return `<div class="conversation-message assistant"><span class="message-avatar">${escapeHtml(script.icon)}</span><div><div class="conversation-card-iframe"><iframe allowtransparency="true" src="http://localhost:5173/${message.component}/dist/index.html?preview=1${message.params ? '&' + message.params : ''}&t=${Date.now()}" title="${escapeHtml(message.title)}"></iframe></div></div></div>`;
  if (message.kind === "card") {
    const iframeMap = { "工单草稿确认": "employee/ticket-draft", "答复草稿": "agent/reply", "工单转派确认": "agent/reassign", "知识产物确认": "knowledge/knowledge-draft", "员工工单列表": "employee/ticket-list", "服务评价": "employee/rating" };
    const componentPath = iframeMap[message.title];
    if (componentPath) {
      return `<div class="conversation-card-iframe"><iframe allowtransparency="true" src="http://localhost:5173/${componentPath}/dist/index.html?preview=1&t=${Date.now()}" title="${escapeHtml(message.title)}"></iframe></div>`;
    }
    return `<article class="conversation-card"><header><div><span>交互式确认卡 · 演示</span><h4>${escapeHtml(message.title)}</h4></div><b>${escapeHtml(message.badge)}</b></header><div class="conversation-card-fields">${message.fields.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div><p>${escapeHtml(message.draft)}</p><footer><code>${escapeHtml(message.tool)}</code><button class="primary-button" type="button" data-scripted-tool="${escapeHtml(message.tool)}">${escapeHtml(message.action)}</button></footer></article>`;
  }
  const isUser = message.kind === "user";
  return `<div class="conversation-message ${isUser ? "user" : "assistant"}"><span class="message-avatar">${isUser ? "你" : escapeHtml(script.icon)}</span><div><small>${isUser ? "演示用户" : escapeHtml(script.name)}</small><p>${escapeHtml(message.text)}</p>${message.meta ? `<em>${escapeHtml(message.meta)}</em>` : ""}</div></div>`;
}

function renderAgentConversation() {
  const script = agentConversationScripts[currentConversationAgent];
  const completed = completedConversationTurns[currentConversationAgent];
  const messages = [...script.initial];
  script.turns.slice(0, completed).forEach((turn, index) => {
    messages.push({ kind: "user", text: conversationUserInputs[currentConversationAgent][index] || turn.user }, ...turn.replies);
  });
  if (currentConversationAgent === "employee" && conversationOutcomes.employee === "resolved") {
    messages.push({ kind: "assistant", text: "很好，这次问题已通过知识方案解决，不需要创建工单。演示不会写入后台或生成解决记录。" });
  }
  ["conversationAvatar", "conversationHeaderAvatar"].forEach((id) => {
    byId(id).textContent = script.icon;
    byId(id).className = `conversation-avatar ${currentConversationAgent}`;
  });
  byId("agentProfileName").textContent = script.name;
  byId("agentProfileType").textContent = script.type;
  byId("agentDemoTitle").textContent = `${script.type}会话`;
  byId("conversationAgentType").textContent = script.type;
  byId("conversationAgentName").textContent = script.name;
  byId("conversationAgentSubtitle").textContent = script.subtitle;
  byId("conversationProgress").textContent = `${completed} / ${script.turns.length} 轮`;
  byId("agentConversationMessages").innerHTML = messages.map((message) => conversationMessageHtml(message, script)).join("");
  const nextTurn = currentConversationAgent === "employee" && conversationOutcomes.employee === "resolved" ? null : script.turns[completed];
  byId("conversationSuggestions").innerHTML = nextTurn ? `<button type="button" data-conversation-suggestion="${escapeHtml(nextTurn.user)}"><span>建议输入</span>${escapeHtml(nextTurn.user)}</button>` : `<span class="conversation-complete">本段对话已到确认节点，可在演示控制台重置后重新体验。</span>`;
  byId("conversationInput").disabled = !nextTurn;
  byId("conversationSend").disabled = !nextTurn;
  byId("conversationInput").placeholder = nextTurn ? "输入消息，或点击上方建议继续演示" : "本段演示已完成";
  byId("agentConversationMessages").querySelectorAll("[data-scripted-tool]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.scriptedTool} 失败关闭：脚本化演示未连接获准的 MCP Tool，未执行后台写操作。`)));
  byId("agentConversationMessages").querySelectorAll("[data-knowledge-action]").forEach((button) => button.addEventListener("click", () => handleKnowledgeAction(button.dataset.knowledgeAction)));
  byId("conversationSuggestions").querySelectorAll("[data-conversation-suggestion]").forEach((button) => button.addEventListener("click", () => advanceAgentConversation(button.dataset.conversationSuggestion)));
  const list = byId("agentConversationMessages");
  list.scrollTop = list.scrollHeight;
}

function handleKnowledgeAction(action) {
  if (currentConversationAgent !== "employee" || completedConversationTurns.employee !== 1) {
    showToast("当前演示已进入后续提单流程，请重置场景后重新选择知识解决分支。");
    return;
  }
  if (action === "resolved") {
    conversationOutcomes.employee = "resolved";
    renderAgentConversation();
    showToast("已进入知识自助解决分支；未创建工单，也未写入后台解决记录。");
    return;
  }
  conversationOutcomes.employee = "unresolved";
  renderAgentConversation();
  const nextTurn = agentConversationScripts.employee.turns[completedConversationTurns.employee];
  byId("conversationInput").value = nextTurn?.user || "";
  byId("conversationInput").focus();
  showToast("已进入继续提单分支，请补充已尝试操作后发送。 ");
}

function advanceAgentConversation(input) {
  const script = agentConversationScripts[currentConversationAgent];
  const completed = completedConversationTurns[currentConversationAgent];
  if (!script.turns[completed]) return;
  if (currentConversationAgent === "employee" && completed === 1) conversationOutcomes.employee = "unresolved";
  conversationUserInputs[currentConversationAgent][completed] = input.trim() || script.turns[completed].user;
  completedConversationTurns[currentConversationAgent] += 1;
  byId("conversationInput").value = "";
  renderAgentConversation();
}

function setConversationAgent(agent) {
  if (!agentConversationScripts[agent]) return;
  currentConversationAgent = agent;
  renderAgentConversation();
}

function resetAgentConversation(agent = currentConversationAgent) {
  completedConversationTurns[agent] = 0;
  conversationUserInputs[agent] = [];
  conversationOutcomes[agent] = null;
  renderAgentConversation();
}

function initAgentConversation() {
  byId("conversationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = byId("conversationInput").value.trim();
    if (input) advanceAgentConversation(input);
  });
  renderAgentConversation();
}

const demoScenes = {
  "employee-agent": { surface: "agent", role: "employee", type: "平台智能体", title: "员工智能体对话", description: "员工在灵基会话中先问知识；未解决时由智能体补齐信息并生成待确认工单草稿。", boundary: "脚本化演示，不代表实时 DC 检索；Create_Ticket 未连接并失败关闭。" },
  "employee-workspace": { surface: "workspace", role: "employee", type: "外部工单应用", title: "我的工单", description: "员工在外部应用中查看本人可见的工单、处理进展和待评价事项。", boundary: "只展示获准 API/MCP 的应用边界；打开 IT 智能体不会自动携带当前工单上下文。" },
  "agent-agent": { surface: "agent", role: "agent", type: "平台智能体", title: "处理人智能体对话", description: "处理人在独立灵基会话中查询授权工单、获得诊断建议并生成待确认答复草稿。", boundary: "脚本化演示，不代表实时 Get_Ticket_Detail；Reply_Ticket 未连接并失败关闭。" },
  "agent-workspace": { surface: "workspace", role: "agent", type: "外部工单应用", title: "我的任务", description: "处理人在外部应用中查看分配给自己的待处理、已处理和已关闭任务。", boundary: "队列和统计为原型数据；刷新、答复和转派未连接真实后台，不能显示伪成功。" },
  "dashboard": { surface: "dashboard", role: "manager", type: "运营管理", title: "仪表盘", description: "经理查看团队 SLA 达标率、满意度分布、处理人负载和工单趋势。", boundary: "原型数据；未连接真实统计 API。" }
};

const demoSceneOrder = ["employee-agent", "employee-workspace", "agent-agent", "agent-workspace", "dashboard"];
let currentDemoScene = "employee-agent";

function renderDemoScene() {
  const scene = demoScenes[currentDemoScene];
  const isAgentSurface = scene.surface === "agent";
  const isDashboard = scene.surface === "dashboard";
  byId("agentDemoStage").hidden = !isAgentSurface;
  byId("workspaceDemoStage").hidden = isAgentSurface || isDashboard;
  if (document.getElementById("dashboardDemoStage")) byId("dashboardDemoStage").hidden = !isDashboard;
  byId("demoSceneType").textContent = scene.type;
  byId("demoSceneIndex").textContent = `场景 ${demoSceneOrder.indexOf(currentDemoScene) + 1} / ${demoSceneOrder.length}`;
  byId("demoSceneTitle").textContent = scene.title;
  byId("demoSceneDescription").textContent = scene.description;
  byId("demoSceneBoundary").textContent = scene.boundary;
  document.querySelectorAll("[data-demo-scene]").forEach((button) => {
    const active = button.dataset.demoScene === currentDemoScene;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  if (isAgentSurface) setConversationAgent(scene.role);
  else if (!isDashboard) setRole(scene.role);
}

function setDemoScene(sceneId) {
  if (!demoScenes[sceneId]) return;
  currentDemoScene = sceneId;
  renderDemoScene();
}

function resetCurrentDemoScene() {
  const scene = demoScenes[currentDemoScene];
  if (scene.surface === "agent") resetAgentConversation(scene.role);
  else setRole(scene.role);
  showToast(`${scene.title}已重置为演示初始状态。`);
}

function initDemoScenes() {
  const buttons = [...document.querySelectorAll("[data-demo-scene]")];
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => setDemoScene(button.dataset.demoScene));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[nextIndex].click();
      buttons[nextIndex].focus();
    });
  });
  byId("resetCurrentScene").addEventListener("click", resetCurrentDemoScene);
  renderDemoScene();
}

document.querySelectorAll("[data-role-select]").forEach((button) => button.addEventListener("click", () => setDemoScene(button.dataset.roleSelect === "employee" ? "employee-workspace" : "agent-workspace")));
byId("ticketSearch").addEventListener("input", renderTickets);
byId("statusFilter").addEventListener("change", renderTickets);
byId("refreshTickets").addEventListener("click", () => showToast("刷新失败关闭：未连接获准的工单查询 API/MCP，当前数据未变更。"));
byId("primaryAction").addEventListener("click", () => byId("ticketDialog").showModal());
byId("ticketForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    byId("ticketDialog").close();
    event.currentTarget.reset();
    return;
  }
  if (!event.currentTarget.reportValidity()) return;
  saveLocalDraft(event.currentTarget);
});

initAgentConversation();
initDemoScenes();
