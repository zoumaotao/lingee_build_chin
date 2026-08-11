import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { App as McpApp } from "@modelcontextprotocol/ext-apps/react";
import {
  approvals,
  attachments as seedAttachments,
  components,
  replyTemplates,
  teamMembers,
  tickets,
  timeline,
  type ComponentId,
  type Locale
} from "./model";

type DataMap = Record<string, unknown>;
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "purple";
type FeedbackTone = "info" | "success" | "error";
type Emit = (action: string, payload: DataMap) => Promise<boolean>;
interface ViewProps { view: string; locale: Locale; data: DataMap; emit: Emit; previewMode: boolean; }

type AttachmentItem = typeof seedAttachments[number];

const actionTools: Record<string, string> = {
  submit_ticket: "Create_Ticket",
  open_ticket: "Get_Ticket_Detail",
  list_tickets: "List_My_Tickets",
  upload_attachments: "Upload_Ticket_Attachment",
  close_ticket: "Close_Ticket",
  submit_rating: "Rate_Ticket",
  submit_reply: "Reply_Ticket",
  reassign_ticket: "Reassign_Ticket",
  list_team_tickets: "List_Team_Tickets",
  load_metrics: "Get_Helpdesk_Metrics",
  list_approvals: "List_My_Approvals",
  approval_detail: "Get_Approval_Detail",
  approve_request: "Approve_Ticket_Request",
  reject_request: "Reject_Ticket_Request",
  create_knowledge_draft: "Create_Knowledge_Draft",
  check_conflict: "Check_Knowledge_Conflict",
  publish_knowledge: "Publish_Knowledge"
};

function l(locale: Locale, zh: string, en: string) { return locale === "en-US" ? en : zh; }
function cx(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }
function asRecord(value: unknown): DataMap { return value && typeof value === "object" && !Array.isArray(value) ? value as DataMap : {}; }
function asBoolean(value: unknown, fallback = false) { return typeof value === "boolean" ? value : fallback; }
function asNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function asString(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value : fallback; }
function toolFailure(result: unknown): string | null {
  const root = asRecord(result);
  const body = asRecord(root.responseBody);
  if (root.isError === true || root.success === false || body.success === false) {
    return asString(root.error) || asString(root.message) || asString(body.errorMessage) || "Tool returned an unsuccessful result";
  }
  return null;
}
function attachmentsFromData(value: unknown, previewMode: boolean): AttachmentItem[] {
  if (!Array.isArray(value)) return previewMode ? seedAttachments : [];
  return value.map((item, index) => {
    const record = asRecord(item);
    const name = asString(record.name, `file-${index + 1}`);
    return {
      id: asString(record.id, `input-${index}`),
      name,
      size: asString(record.size, "—"),
      type: asString(record.type, name.split(".").pop()?.toUpperCase() || "FILE"),
      selected: record.selected !== false
    };
  });
}
function ticketsFromData(data: DataMap, previewMode: boolean): typeof tickets {
  if (!Array.isArray(data.tickets)) return previewMode ? tickets : [];
  return data.tickets.map((item, index) => {
    const record = asRecord(item);
    const title = asString(record.title, asString(record.titleZh, asString(record.titleEn, `Ticket ${index + 1}`)));
    return {
      id: asString(record.id, asString(record.ticketId, `ticket-${index + 1}`)),
      titleZh: asString(record.titleZh, title),
      titleEn: asString(record.titleEn, title),
      category: asString(record.category, "—"),
      statusZh: asString(record.statusZh, asString(record.status, "—")),
      statusEn: asString(record.statusEn, asString(record.status, "—")),
      priority: asString(record.priority, "—"),
      updatedZh: asString(record.updatedZh, asString(record.updatedAt, "—")),
      updatedEn: asString(record.updatedEn, asString(record.updatedAt, "—")),
      assignee: asString(record.assignee, "—"),
      team: asString(record.team, "—"),
      due: asString(record.due, "—"),
      sla: asNumber(record.sla, 0)
    };
  });
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Avatar({ name, color = "#6d5ce8" }: { name: string; color?: string }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className="avatar" style={{ background: color }}>{initials}</span>;
}

function Card({ children, tone, className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <section className={cx("mcp-card", tone && `card-${tone}`, className)}>{children}</section>;
}

function CardHeader({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle?: string; badge?: ReactNode }) {
  return <header className="card-header"><span className="card-icon" aria-hidden="true">{icon}</span><div className="card-heading"><h2>{title}</h2>{subtitle && <small>{subtitle}</small>}</div>{badge}</header>;
}

function EmptyState({ locale, title, description }: { locale: Locale; title?: string; description?: string }) {
  return <div className="empty-state" role="status"><strong>{title ?? l(locale, "暂无可展示数据", "No data to display")}</strong><span>{description ?? l(locale, "请由智能体提供当前业务数据后重试。", "Ask the agent to provide current business data and try again.")}</span></div>;
}

function DemoBanner({ locale }: { locale: Locale }) {
  return <div className="demo-banner" role="note"><Badge tone="warning">{l(locale, "演示数据", "Demo data")}</Badge><span>{l(locale, "本地预览不会调用后台 Tool，操作仅用于体验交互。", "Local preview never calls backend tools; actions only demonstrate the interaction.")}</span></div>;
}

function Field({ label, children, required, hint, className }: { label: string; children: ReactNode; required?: boolean; hint?: string; className?: string }) {
  return <label className={cx("field", className)}><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Actions({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "stretch" }) {
  return <div className={`actions actions-${align}`}>{children}</div>;
}

function TicketRow({ ticket, locale, onOpen, requester }: { ticket: typeof tickets[number]; locale: Locale; onOpen?: () => void; requester?: string }) {
  const urgent = ticket.sla > 65;
  return <button type="button" className="ticket-row" onClick={onOpen}>
    <span className="ticket-main"><code>{ticket.id}</code><strong>{l(locale, ticket.titleZh, ticket.titleEn)}</strong><small>{requester ? `${requester} · ` : ""}{ticket.category}</small></span>
    <span className="ticket-side"><Badge tone={urgent ? "warning" : ticket.sla === 0 ? "neutral" : "purple"}>{l(locale, ticket.statusZh, ticket.statusEn)}</Badge><small className={urgent ? "danger-text" : ""}>{ticket.due}</small></span>
  </button>;
}

function KeyValues({ items }: { items: Array<[string, ReactNode]> }) {
  return <div className="key-values">{items.map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>;
}

function TimelineCompact({ locale, approval = false }: { locale: Locale; approval?: boolean }) {
  const source = approval ? [
    ["10:12", l(locale, "申请已提交", "Request submitted")],
    ["10:13", l(locale, "规则校验完成", "Policy check completed")],
    ["10:15", l(locale, "L1 审批中", "L1 review in progress")]
  ] : timeline.slice(-3).map((item) => [item.time, l(locale, item.titleZh, item.titleEn)]);
  return <div className="timeline-compact">{source.map(([time, title], index) => <div key={`${time}-${title}`} className={index === source.length - 1 ? "active" : ""}><time>{time}</time><i /><span>{title}</span></div>)}</div>;
}

function AttachmentList({ locale, files, onRemove }: { locale: Locale; files: typeof seedAttachments; onRemove?: (id: string) => void }) {
  return <div className="attachment-list">{files.slice(0, 3).map((file) => <div className="attachment" key={file.id}><span>{file.type}</span><div><strong>{file.name}</strong><small>{file.size}</small></div>{onRemove && <button type="button" onClick={() => onRemove(file.id)} aria-label={l(locale, "删除附件", "Remove attachment")}>×</button>}</div>)}</div>;
}

function EmployeeCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const [draft, setDraft] = useState({
    requesterName: asString(data.requesterName, previewMode ? "Michelle Lee" : ""),
    requesterEmail: asString(data.requesterEmail, previewMode ? "michelle.lee@zenxin.example" : ""),
    title: asString(data.title, previewMode ? l(locale, "VPN 连接后无法访问内部系统", "Cannot access internal systems after VPN connection") : ""),
    category: asString(data.category, previewMode ? "IT / Network & VPN" : ""),
    priority: asString(data.priority, previewMode ? "High" : "Medium"),
    description: asString(data.description, previewMode ? l(locale, "连接 VPN 成功后，ERP 和内部文件服务器仍无法访问。已重启并重新登录。", "VPN connects, but ERP and internal file servers remain unavailable after restart and sign-in.") : "")
  });
  const ticketData = asRecord(data.ticket);
  const ticketId = asString(data.ticketId, asString(ticketData.id, previewMode ? tickets[0].id : ""));
  const [confirmed, setConfirmed] = useState(false);
  const [files, setFiles] = useState<AttachmentItem[]>(() => attachmentsFromData(data.attachments, previewMode));
  const [fileError, setFileError] = useState("");
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const change = (key: keyof typeof draft, value: string) => { setDraft((current) => ({ ...current, [key]: value })); setConfirmed(false); };
  const addFiles = (selected: FileList | null) => {
    const incoming = Array.from(selected ?? []);
    const allowed = new Set(["png", "jpg", "jpeg", "pdf", "txt", "log"]);
    const invalid = incoming.find((file) => file.size > 10 * 1024 * 1024 || !allowed.has(file.name.split(".").pop()?.toLowerCase() ?? ""));
    if (invalid) {
      setFileError(l(locale, `${invalid.name} 不符合格式要求或超过 10 MB`, `${invalid.name} is unsupported or exceeds 10 MB`));
      return;
    }
    if (files.length + incoming.length > 5) {
      setFileError(l(locale, "最多只能添加 5 个附件", "You can attach up to 5 files"));
      return;
    }
    const added = incoming.map((file, index) => ({ id: `new-${Date.now()}-${index}`, name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.name.split(".").pop()?.toUpperCase() || "FILE", selected: true }));
    setFiles((current) => [...current, ...added]);
    setFileError("");
    setConfirmed(false);
  };

  if (view === "resolution") return <Card>
    <CardHeader icon="✓" title={l(locale, "找到一个可能的解决方案", "A possible solution was found")} subtitle={l(locale, "来源：远程访问与 VPN 使用指南 · 4.2", "Source: Remote Access & VPN Guide · 4.2")} badge={<Badge tone="success">KB</Badge>} />
    <div className="answer"><strong>{l(locale, "重新导入最新 VPN 配置", "Re-import the latest VPN profile")}</strong><ol><li>{l(locale, "删除当前 VPN 配置", "Remove the current VPN profile")}</li><li>{l(locale, "从 IT Portal 导入最新配置", "Import the latest profile from IT Portal")}</li><li>{l(locale, "完成 MFA 后重新连接", "Complete MFA and reconnect")}</li></ol></div>
    <p className="question">{l(locale, "这个方案解决了问题吗？", "Did this solve the issue?")}</p>
    <Actions><button className="btn secondary" onClick={() => void emit("answer_resolved", { resolved: true })}>{l(locale, "已解决", "Solved")}</button><button className="btn primary" onClick={() => void emit("create_ticket_draft", { resolved: false, source: "knowledge" })}>{l(locale, "仍未解决，创建工单", "Still unresolved")}</button></Actions>
  </Card>;

  if (view === "ticket-draft") return <Card>
    <CardHeader icon="✦" title={l(locale, "请确认工单信息", "Confirm ticket details")} subtitle={l(locale, "AI 已根据对话生成草稿", "AI generated this draft from the conversation")} badge={<Badge tone="info">AI</Badge>} />
    <div className="requester"><Avatar name={draft.requesterName} /><div><strong>{draft.requesterName}</strong><small>{draft.requesterEmail} · Finance</small></div><Badge tone="neutral">{l(locale, "身份只读", "Read only")}</Badge></div>
    <Field label={l(locale, "工单标题", "Ticket title")} required><input value={draft.title} onChange={(e) => change("title", e.target.value)} /></Field>
    <div className="field-grid"><Field label={l(locale, "分类", "Category")} required><select value={draft.category} onChange={(e) => change("category", e.target.value)}><option>IT / Network & VPN</option><option>IT / Email</option><option>IT / Software Request</option></select></Field><Field label={l(locale, "优先级", "Priority")} required><select value={draft.priority} onChange={(e) => change("priority", e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field></div>
    <Field label={l(locale, "问题描述", "Description")} required><textarea rows={3} value={draft.description} onChange={(e) => change("description", e.target.value)} /></Field>
    <details className="details"><summary>{l(locale, `附件 (${files.length})`, `Attachments (${files.length})`)}</summary><AttachmentList locale={locale} files={files} onRemove={(id) => { setFiles((current) => current.filter((file) => file.id !== id)); setConfirmed(false); }} /><label className="upload-link">＋ {l(locale, "添加附件", "Add files")}<input type="file" multiple accept=".png,.jpg,.jpeg,.pdf,.txt,.log" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} /></label>{fileError && <p className="field-error" role="alert">{fileError}</p>}</details>
    <label className="confirm-line"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>{l(locale, "我已核对以上信息", "I have reviewed these details")}</span></label>
    <Actions><button className="btn secondary" onClick={() => void emit("save_ticket_draft", { draft, attachments: files })}>{l(locale, "保存草稿", "Save draft")}</button><button className="btn primary" disabled={!confirmed || !draft.title.trim() || !draft.description.trim()} onClick={() => void emit("submit_ticket", { ...draft, attachments: files, confirmed: true })}>{l(locale, "确认提交", "Submit")}</button></Actions>
  </Card>;

  if (view === "ticket-receipt") {
    const status = asString(data.status, previewMode ? "success" : "unknown").toLowerCase();
    const failed = status === "failed" || status === "error";
    const pendingReceipt = status === "pending" || status === "processing";
    const successful = status === "success" || status === "created";
    const displayTicketId = asString(data.ticketId, previewMode ? tickets[0].id : "");
    if (!successful && !failed && !pendingReceipt) return <Card><CardHeader icon="?" title={l(locale, "尚未收到提交结果", "Submission result unavailable")} subtitle={l(locale, "不能将缺失状态解释为创建成功", "A missing status is not treated as success")} /><EmptyState locale={locale} description={l(locale, "请等待创建 Tool 返回明确的状态与工单编号。", "Wait for the create tool to return an explicit status and ticket ID.")} /></Card>;
    return <Card tone={failed ? "danger" : successful ? "success" : "info"}><CardHeader icon={failed ? "!" : successful ? "✓" : "…"} title={failed ? l(locale, "工单提交失败", "Ticket submission failed") : successful ? l(locale, "工单已创建", "Ticket created") : l(locale, "工单正在提交", "Ticket submission pending")} subtitle={failed ? asString(data.errorMessage, l(locale, "请检查信息后重试", "Review the information and retry")) : successful ? l(locale, "问题已交给处理团队", "The issue was routed to support") : l(locale, "后台尚未返回最终结果", "The backend has not returned a final result")} /><KeyValues items={[[l(locale, "工单编号", "Ticket ID"), displayTicketId || "—"], [l(locale, "处理团队", "Team"), asString(data.assignedTeam, "—")], [l(locale, "当前状态", "Status"), <Badge tone={failed ? "danger" : successful ? "success" : "warning"}>{failed ? l(locale, "失败", "Failed") : successful ? l(locale, "已创建", "Created") : l(locale, "处理中", "Pending")}</Badge>]]} /><Actions align="start">{failed ? <button className="btn primary" onClick={() => void emit("retry_ticket", { view: "ticket-draft" })}>{l(locale, "返回修改", "Edit and retry")}</button> : successful && displayTicketId ? <button className="btn primary" onClick={() => void emit("open_ticket", { ticketId: displayTicketId })}>{l(locale, "查看进度", "View progress")}</button> : null}</Actions></Card>;
  }

  if (view === "ticket-list") return <Card><CardHeader icon="▤" title={l(locale, "我的工单", "My tickets")} subtitle={l(locale, "最近更新的 3 个工单", "3 most recently updated tickets")} badge={<Badge tone="neutral">4</Badge>} /><div className="row-list">{tickets.slice(0, 3).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div><Actions align="start"><button className="link-btn" onClick={() => void emit("list_tickets", { offset: 3 })}>{l(locale, "继续查看其他工单", "Show more tickets")} →</button></Actions></Card>;

  if (view === "ticket-detail") return <Card><CardHeader icon="◈" title={l(locale, tickets[0].titleZh, tickets[0].titleEn)} subtitle={tickets[0].id} badge={<Badge tone="purple">{l(locale, "处理中", "In progress")}</Badge>} /><KeyValues items={[[l(locale, "处理人", "Assignee"), "Alex Tan · IT Infrastructure"], ["SLA", <span className="danger-text">01:42:18</span>]]} /><div className="latest-reply"><Avatar name="Alex Tan" /><p><strong>Alex Tan · 09:46</strong><span>{l(locale, "请重新导入 VPN 配置并确认 MFA 已通过；若仍失败，请上传诊断日志。", "Re-import the VPN profile and confirm MFA. If it still fails, upload the diagnostic log.")}</span></p></div><details className="details"><summary>{l(locale, "查看处理轨迹", "View activity")}</summary><TimelineCompact locale={locale} /></details><p className="question">{l(locale, "问题是否已经解决？", "Has the issue been resolved?")}</p><Actions><button className="btn secondary" onClick={() => void emit("continue_followup", { ticketId: tickets[0].id })}>{l(locale, "仍有问题", "Still an issue")}</button><button className="btn primary" onClick={() => void emit("close_ticket", { ticketId: tickets[0].id, resolved: true })}>{l(locale, "确认解决", "Confirm resolved")}</button></Actions></Card>;

  if (view === "rating") {
    const tags = [l(locale, "响应及时", "Quick"), l(locale, "解释清楚", "Clear"), l(locale, "专业友好", "Professional")];
    return <Card><CardHeader icon="★" title={l(locale, "评价本次服务", "Rate this support experience")} subtitle={`${ticketId || "—"} · ${asString(data.assignee, previewMode ? "Alex Tan" : "—")}`} /><div className="stars" role="group" aria-label={l(locale, "服务评分", "Service rating")}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= rating ? "active" : ""} aria-label={l(locale, `${star} 星`, `${star} star${star > 1 ? "s" : ""}`)} aria-pressed={star === rating} onClick={() => setRating(star)}>★</button>)}</div><div className="chips" role="group" aria-label={l(locale, "评价标签", "Rating tags")}>{tags.map((tag) => <button type="button" key={tag} className={selectedTags.includes(tag) ? "selected" : ""} aria-pressed={selectedTags.includes(tag)} onClick={() => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{tag}</button>)}</div><Field label={l(locale, "补充意见（选填）", "Comment (optional)")}><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!ticketId || rating === 0} onClick={() => void emit("submit_rating", { ticketId, rating, tags: selectedTags, comment })}>{l(locale, "提交评价", "Submit rating")}</button></Actions></Card>;
  }

  return <Card><CardHeader icon="↥" title={l(locale, "选择随工单提交的附件", "Select ticket attachments")} subtitle={l(locale, "最多 5 个文件，每个不超过 10 MB", "Up to 5 files, 10 MB each")} /><AttachmentList locale={locale} files={files} onRemove={(id) => setFiles((current) => current.filter((file) => file.id !== id))} /><label className="upload-box">＋ {l(locale, "选择文件", "Choose files")}<input type="file" multiple accept=".png,.jpg,.jpeg,.pdf,.txt,.log" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} /></label>{fileError && <p className="field-error" role="alert">{fileError}</p>}<Actions><button className="btn primary" disabled={!ticketId || files.length === 0} onClick={() => void emit("upload_attachments", { ticketId, attachments: files })}>{l(locale, "确认附件", "Confirm files")}</button></Actions></Card>;
}

function AgentCard({ view, locale, emit }: ViewProps) {
  const [reply, setReply] = useState(l(locale, "你好 Michelle，请重新导入最新 VPN 配置并完成 MFA。若仍有问题，请附上诊断日志。", "Hi Michelle, please import the latest VPN profile and complete MFA. If the issue remains, attach the diagnostic log."));
  const [reason, setReason] = useState("");
  const [team, setTeam] = useState("IT Infrastructure");
  const [assignee, setAssignee] = useState("Daniel Wong");

  if (view === "notification") return <Card tone="purple"><CardHeader icon="↘" title={l(locale, "新工单分配给你", "New ticket assigned to you")} subtitle={tickets[0].id} badge={<Badge tone="danger">HIGH</Badge>} /><h3>{l(locale, tickets[0].titleZh, tickets[0].titleEn)}</h3><p className="summary-text">{l(locale, "用户连接 VPN 后无法访问 ERP 与文件服务器，已完成重启和重新登录。", "The requester cannot access ERP or file servers after connecting to VPN and already restarted and signed in again.")}</p><KeyValues items={[[l(locale, "提单人", "Requester"), "Michelle Lee"], ["SLA", <span className="danger-text">01:42:18</span>]]} /><Actions><button className="btn secondary" onClick={() => void emit("reassign_ticket", { ticketId: tickets[0].id, intent: "reassign" })}>{l(locale, "转派", "Reassign")}</button><button className="btn primary" onClick={() => void emit("accept_ticket", { ticketId: tickets[0].id })}>{l(locale, "接单处理", "Accept")}</button></Actions></Card>;

  if (view === "queue") return <Card><CardHeader icon="▤" title={l(locale, "我的待办", "My queue")} subtitle={l(locale, "按 SLA 紧急程度排序", "Sorted by SLA urgency")} badge={<Badge tone="warning">8</Badge>} /><div className="mini-stats"><span><b>3</b>{l(locale, "临近", "At risk")}</span><span><b className="danger-text">1</b>{l(locale, "超时", "Overdue")}</span><span><b>6</b>{l(locale, "今日解决", "Resolved")}</span></div><div className="row-list">{tickets.slice(0, 3).map((ticket, index) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} requester={["Michelle Lee", "Jason Ng", "Emily Chen"][index]} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div></Card>;

  if (view === "ticket-detail") return <Card><CardHeader icon="◈" title={l(locale, tickets[0].titleZh, tickets[0].titleEn)} subtitle={`${tickets[0].id} · Michelle Lee`} badge={<Badge tone="danger">SLA 01:42</Badge>} /><p className="summary-text">{l(locale, "VPN 显示连接成功，但 ERP、文件服务器和内部 Wiki 均不可访问。重启、切换网络和重新登录无效。", "VPN connects, but ERP, file servers, and the internal Wiki are unreachable. Restarting, changing networks, and signing in again did not help.")}</p><KeyValues items={[[l(locale, "处理组", "Team"), "IT Infrastructure"], [l(locale, "附件", "Attachments"), "2"], [l(locale, "知识尝试", "Knowledge tried"), l(locale, "已尝试，未解决", "Tried, unresolved")]]} /><details className="details"><summary>{l(locale, "查看处理记录", "View activity")}</summary><TimelineCompact locale={locale} /></details><Actions><button className="btn secondary" onClick={() => void emit("reassign_ticket", { ticketId: tickets[0].id, intent: "reassign" })}>{l(locale, "转派", "Reassign")}</button><button className="btn primary" onClick={() => void emit("compose_reply", { ticketId: tickets[0].id })}>{l(locale, "编写答复", "Reply")}</button></Actions></Card>;

  if (view === "reply") return <Card><CardHeader icon="↗" title={l(locale, "确认发送答复", "Confirm reply")} subtitle={`${tickets[0].id} · ${l(locale, "将通知 Michelle Lee", "Michelle Lee will be notified")}`} /> <div className="chips buttons">{replyTemplates.map((template) => <button key={template.en} onClick={() => setReply(l(locale, template.zh, template.en))}>{l(locale, template.zh, template.en)}</button>)}</div><Field label={l(locale, "答复内容", "Reply")} required><textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field><details className="details"><summary>{l(locale, "添加内部备注或附件", "Add internal note or attachment")}</summary><textarea rows={2} placeholder={l(locale, "内部备注对提单人不可见", "Internal notes are hidden from the requester")} /></details><Actions><button className="btn secondary" onClick={() => void emit("save_reply_draft", { ticketId: tickets[0].id, reply })}>{l(locale, "保存草稿", "Save")}</button><button className="btn primary" disabled={!reply.trim()} onClick={() => void emit("submit_reply", { ticketId: tickets[0].id, content: reply, nextStatus: "pending_confirmation" })}>{l(locale, "发送答复", "Send")}</button></Actions></Card>;

  if (view === "reassign") return <Card><CardHeader icon="↗" title={l(locale, "转派工单", "Reassign ticket")} subtitle={`${tickets[0].id} · ${l(locale, tickets[0].titleZh, tickets[0].titleEn)}`} /><div className="field-grid"><Field label={l(locale, "目标工作组", "Target team")} required><select value={team} onChange={(e) => setTeam(e.target.value)}><option>IT Infrastructure</option><option>IT Application</option><option>IT Service Desk</option></select></Field><Field label={l(locale, "目标处理人", "Assignee")} required><select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option>Daniel Wong</option><option>Mei Ling</option><option>Sarah Lim</option></select></Field></div><Field label={l(locale, "转派原因", "Reason")} required><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!reason.trim()} onClick={() => void emit("reassign_ticket", { ticketId: tickets[0].id, team, assignee, reason })}>{l(locale, "确认转派", "Confirm")}</button></Actions></Card>;

  return <Card tone="danger"><CardHeader icon="!" title={l(locale, "SLA 需要立即关注", "SLA needs immediate attention")} subtitle={l(locale, "1 个已超时，2 个将在 2 小时内到期", "1 overdue, 2 due within 2 hours")} /><div className="row-list">{tickets.slice(0, 3).map((ticket, index) => <TicketRow key={ticket.id} ticket={{ ...ticket, sla: index === 0 ? 100 : ticket.sla }} locale={locale} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div></Card>;
}

function ManagerCard({ view, locale, emit }: ViewProps) {
  const [ticketId, setTicketId] = useState(tickets[0].id);
  const [assignee, setAssignee] = useState("Mei Ling");
  const [reason, setReason] = useState("");

  if (view === "dashboard") return <Card><CardHeader icon="▦" title={l(locale, "Tech GBS 服务摘要", "Tech GBS service summary")} subtitle={l(locale, "2026 年 8 月 · 较上月", "August 2026 · vs last month")} /><div className="kpi-grid"><span><small>{l(locale, "本月工单", "Tickets")}</small><strong>248</strong><em>+12.6%</em></span><span><small>{l(locale, "SLA 达标", "SLA met")}</small><strong>94.8%</strong><em>+2.4%</em></span><span><small>{l(locale, "已解决", "Resolved")}</small><strong>216</strong><em>87.1%</em></span><span><small>{l(locale, "满意度", "Rating")}</small><strong>4.62</strong><em>+0.18</em></span></div><div className="callout warning"><b>!</b><p><strong>Network & VPN</strong><span>{l(locale, "本周增长 38%，有 4 个 SLA 风险工单", "Volume is up 38%, with 4 SLA-risk tickets")}</span></p></div><Actions align="start"><button className="link-btn" onClick={() => void emit("load_metrics", { scope: "attention" })}>{l(locale, "查看风险摘要", "View risks")} →</button></Actions></Card>;

  if (view === "team-tickets") return <Card><CardHeader icon="▤" title={l(locale, "需要关注的团队工单", "Team tickets needing attention")} subtitle={l(locale, "优先展示超时和高风险工单", "Overdue and high-risk tickets first")} badge={<Badge tone="danger">4</Badge>} /><div className="row-list">{tickets.slice(0, 3).map((ticket, index) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} requester={["Michelle Lee", "Jason Ng", "Emily Chen"][index]} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div><Actions align="start"><button className="link-btn" onClick={() => void emit("list_team_tickets", { scope: "all" })}>{l(locale, "继续在对话中查看", "Show more in chat")} →</button></Actions></Card>;

  if (view === "workload") return <Card><CardHeader icon="◎" title={l(locale, "团队负载建议", "Team workload recommendation")} subtitle={l(locale, "建议将新工单优先分配给 Mei Ling", "Route new tickets to Mei Ling")} badge={<Badge tone="warning">72%</Badge>} /><div className="member-list">{teamMembers.map((member) => <button key={member.name} onClick={() => void emit("select_reassign_agent", { assignee: member.name })}><Avatar name={member.name} color={member.color} /><span><strong>{member.name}</strong><small>{member.role} · {member.active} {l(locale, "个处理中", "active")}</small></span><div className="capacity"><i style={{ width: `${member.capacity}%` }} /><small>{member.capacity}%</small></div></button>)}</div></Card>;

  if (view === "sla") return <Card><CardHeader icon="◷" title={l(locale, "团队 SLA 摘要", "Team SLA summary")} subtitle={l(locale, "解决 SLA 较上月提升 2.4%", "Resolution SLA improved 2.4%")} /><div className="kpi-grid compact"><span><small>{l(locale, "响应 SLA", "Response")}</small><strong>98.4%</strong></span><span><small>{l(locale, "解决 SLA", "Resolution")}</small><strong>94.8%</strong></span></div><div className="category-list">{[["Network & VPN", 86, "danger"], ["Email & Collaboration", 95, "success"], ["Software Request", 92, "warning"]].map(([name, value, tone]) => <div key={String(name)}><span>{name}</span><i><b className={`fill-${tone}`} style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>)}</div><Actions align="start"><button className="link-btn" onClick={() => void emit("load_metrics", { scope: "sla-risk" })}>{l(locale, "查看风险工单", "View at-risk tickets")} →</button></Actions></Card>;

  return <Card><CardHeader icon="↗" title={l(locale, "经理快速转派", "Manager reassignment")} subtitle={l(locale, "操作将写入审计记录并通知新处理人", "The action is audited and notifies the new assignee")} /><Field label={l(locale, "工单", "Ticket")} required><select value={ticketId} onChange={(e) => setTicketId(e.target.value)}>{tickets.slice(0, 3).map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.id} · {l(locale, ticket.titleZh, ticket.titleEn)}</option>)}</select></Field><Field label={l(locale, "转派给", "Reassign to")} required><select value={assignee} onChange={(e) => setAssignee(e.target.value)}>{teamMembers.map((member) => <option key={member.name}>{member.name}</option>)}</select></Field><Field label={l(locale, "原因", "Reason")} required><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!reason.trim()} onClick={() => void emit("reassign_ticket", { ticketId, assignee, reason, actorRole: "manager" })}>{l(locale, "确认并通知", "Confirm and notify")}</button></Actions></Card>;
}

function ApprovalCard({ view, locale, emit }: ViewProps) {
  const item = approvals[0];
  const [comment, setComment] = useState("");
  const [security, setSecurity] = useState(false);

  if (view === "approval-list") return <Card><CardHeader icon="✓" title={l(locale, "我的待审批", "My approvals")} subtitle={l(locale, "按审批 SLA 排序", "Sorted by approval SLA")} badge={<Badge tone="warning">3</Badge>} /><div className="approval-list">{approvals.map((approval) => <button key={approval.id} onClick={() => void emit("approval_detail", { approvalId: approval.id, ticketId: approval.ticket })}><span className={`risk risk-${approval.risk}`}>{approval.level}</span><span><code>{approval.id}</code><strong>{l(locale, approval.titleZh, approval.titleEn)}</strong><small>{approval.requester} · {approval.dept} · {l(locale, approval.ageZh, approval.ageEn)}</small></span><b>›</b></button>)}</div></Card>;

  if (view === "approval-detail") return <Card><CardHeader icon="✓" title={l(locale, item.titleZh, item.titleEn)} subtitle={`${item.id} · ${item.ticket}`} badge={<Badge tone="purple">L1</Badge>} /><p className="summary-text">{l(locale, "因月度经营分析需要，申请安装 Power BI Desktop，连接财务数据集并制作内部管理报表。", "Power BI Desktop is needed for monthly operations analysis and internal finance reporting.")}</p><KeyValues items={[[l(locale, "申请人", "Requester"), "Michelle Lee · Finance"], [l(locale, "授权费用", "License cost"), l(locale, "标准授权 · 无新增费用", "Standard · no added cost")], [l(locale, "风险", "Risk"), <Badge tone="success">LOW</Badge>], [l(locale, "剩余时间", "Time left"), "06:42:18"]]} /><details className="details"><summary>{l(locale, "查看审批路径", "View approval path")}</summary><TimelineCompact locale={locale} approval /></details><Actions><button className="btn primary" onClick={() => void emit("open_decision", { approvalId: item.id })}>{l(locale, "进行审批", "Review request")}</button></Actions></Card>;

  if (view === "decision") return <Card><CardHeader icon="✓" title={l(locale, "审批决策", "Approval decision")} subtitle={`${item.id} · ${l(locale, item.titleZh, item.titleEn)}`} /><div className="check-list"><label><input type="checkbox" defaultChecked /><span>{l(locale, "符合软件与采购政策", "Complies with policy")}</span></label><label><input type="checkbox" defaultChecked /><span>{l(locale, "业务必要性已确认", "Business need confirmed")}</span></label><label><input type="checkbox" checked={security} onChange={(e) => setSecurity(e.target.checked)} /><span>{l(locale, "提交 L2 安全评审", "Route to L2 security review")}</span></label></div><Field label={l(locale, "审批意见", "Comment")} hint={l(locale, "驳回时必须填写", "Required when rejecting")}><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Actions><button className="btn danger" disabled={!comment.trim()} onClick={() => void emit("reject_request", { approvalId: item.id, comment })}>{l(locale, "驳回", "Reject")}</button><button className="btn primary" onClick={() => void emit("approve_request", { approvalId: item.id, comment, requiresL2: security })}>{security ? l(locale, "同意并提交 L2", "Approve to L2") : l(locale, "同意", "Approve")}</button></Actions></Card>;

  return <Card><CardHeader icon="⌁" title={l(locale, "审批轨迹", "Approval timeline")} subtitle={`${item.id} · ${l(locale, "审计记录已启用", "Audit trail enabled")}`} /><TimelineCompact locale={locale} approval /><p className="hint-line">{l(locale, "每次查看、评论和决策均记录操作者与时间。", "Every view, comment, and decision records the actor and time.")}</p></Card>;
}

function KnowledgeCard({ view, locale, emit }: ViewProps) {
  const [draft, setDraft] = useState({ title: l(locale, "VPN 已连接但无法访问内部系统的处理方法", "Internal access failure after VPN connects"), answer: l(locale, "删除旧配置，从 IT Portal 导入最新 VPN 配置，完成 MFA 并重新连接。如仍失败，请收集诊断日志交给 IT Infrastructure。", "Remove the old profile, import the latest VPN profile from IT Portal, complete MFA, and reconnect. If it still fails, collect the diagnostic log for IT Infrastructure."), tags: "VPN, Remote Access, DNS" });
  const [checks, setChecks] = useState({ pii: true, reusable: true, accurate: true });

  if (view === "knowledge-draft") return <Card><CardHeader icon="◇" title={l(locale, "确认知识草稿", "Confirm knowledge draft")} subtitle={`${tickets[0].id} · ${l(locale, "AI 已去除个人信息", "AI removed personal information")}`} badge={<Badge tone="info">AI</Badge>} /><Field label={l(locale, "标题", "Title")} required><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label={l(locale, "标准处理方法", "Standard resolution")} required><textarea rows={4} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></Field><Field label={l(locale, "标签", "Tags")}><input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field><Actions><button className="btn secondary" onClick={() => void emit("save_knowledge_draft", { draft, sourceTicket: tickets[0].id })}>{l(locale, "保存草稿", "Save")}</button><button className="btn primary" onClick={() => void emit("create_knowledge_draft", { ...draft, sourceTicket: tickets[0].id })}>{l(locale, "提交审核", "Submit review")}</button></Actions></Card>;

  if (view === "source-ticket") return <Card><CardHeader icon="◈" title={l(locale, "知识来源工单", "Knowledge source ticket")} subtitle={tickets[0].id} badge={<Badge tone="success">★★★★★</Badge>} /><p className="summary-text">{l(locale, "员工连接 VPN 后无法访问内部系统。经确认，本地配置版本过旧。", "An employee could not access internal systems through VPN because the local profile was outdated.")}</p><div className="steps"><span>1<b>{l(locale, "确认配置版本过旧", "Profile was outdated")}</b></span><span>2<b>{l(locale, "导入最新配置", "Imported latest profile")}</b></span><span>3<b>{l(locale, "刷新 DNS 后恢复", "Access restored after DNS flush")}</b></span></div><KeyValues items={[[l(locale, "近 30 天相似工单", "Similar tickets, 30d"), "18"], [l(locale, "预计每月自助分流", "Estimated monthly deflection"), "12–15"]]} /><Actions><button className="btn primary" onClick={() => void emit("create_knowledge_draft", { sourceTicket: tickets[0].id })}>{l(locale, "生成草稿", "Generate draft")}</button></Actions></Card>;

  if (view === "review") return <Card><CardHeader icon="◇" title={l(locale, "知识发布检查", "Knowledge publishing review")} subtitle={l(locale, "质量评分 92/100 · 建议发布", "Quality score 92/100 · Ready to publish")} badge={<Badge tone="success">92</Badge>} /><div className="check-list">{([["pii", l(locale, "已移除个人与敏感信息", "Personal information removed")], ["reusable", l(locale, "内容具有通用复用价值", "Content is reusable")], ["accurate", l(locale, "处理步骤已经验证", "Resolution steps verified")]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} /><span>{label}</span></label>)}</div><div className="callout warning"><b>≈</b><p><strong>{l(locale, "发现 78% 相似知识", "78% similar article found")}</strong><span>{l(locale, "建议更新“VPN 常见连接故障排查”，避免重复。", "Update the existing VPN troubleshooting article to avoid duplication.")}</span></p></div><Actions><button className="btn secondary" onClick={() => void emit("check_conflict", { sourceTicket: tickets[0].id })}>{l(locale, "对比内容", "Compare")}</button><button className="btn primary" disabled={!Object.values(checks).every(Boolean)} onClick={() => void emit("publish_knowledge", { sourceTicket: tickets[0].id, mode: "update-existing", checks })}>{l(locale, "确认更新并发布", "Update and publish")}</button></Actions></Card>;

  return <Card tone="success"><CardHeader icon="✓" title={l(locale, "知识已发布", "Knowledge published")} subtitle={l(locale, "后续相似问题将优先命中该知识", "Future similar questions will prioritize this article")} /><KeyValues items={[[l(locale, "知识编号", "Knowledge ID"), "KB-IT-2026-0186"], [l(locale, "版本", "Version"), "v2.0"], [l(locale, "来源工单", "Source ticket"), tickets[0].id], [l(locale, "可见范围", "Audience"), "All Employees"]]} /><Actions align="start"><button className="btn primary" onClick={() => void emit("open_knowledge", { knowledgeId: "KB-IT-2026-0186" })}>{l(locale, "查看知识", "Open article")}</button></Actions></Card>;
}

export function HelpdeskApp() {
  const componentId = __COMPONENT_ID__ as ComponentId;
  const view = __VIEW_ID__;
  const [toolInput, setToolInput] = useState<DataMap | null>(null);
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [hostContext, setHostContext] = useState<DataMap | null>(null);
  const [locale, setLocale] = useState<Locale>(new URLSearchParams(window.location.search).get("locale") === "en-US" ? "en-US" : "zh-CN");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const contextCache = useRef("");

  const updateHostContext = (appInstance: McpApp) => {
    const next = appInstance.getHostContext() as DataMap | null;
    const serialized = JSON.stringify(next ?? null);
    if (serialized !== contextCache.current) { contextCache.current = serialized; setHostContext(next); }
  };

  const { app, isConnected } = useApp({
    appInfo: { name: `Helpdesk-${componentId}-${view}`, version: "2.0.0" },
    capabilities: { tools: { listChanged: true } },
    onAppCreated: (appInstance: McpApp) => {
      appInstance.ontoolinput = (params) => setToolInput((params.arguments ?? {}) as DataMap);
      appInstance.ontoolinputpartial = (params) => setToolInput((params.arguments ?? {}) as DataMap);
      appInstance.ontoolresult = (params) => setToolResult(params);
      appInstance.ontoolcancelled = (params) => setFeedback({ ok: false, message: params.reason ?? l(locale, "操作已取消", "Action cancelled") });
      appInstance.onhostcontextchanged = () => updateHostContext(appInstance);
    }
  });

  useEffect(() => { if (app && isConnected) updateHostContext(app); }, [app, isConnected]);
  const requestBody = useMemo(() => {
    const raw = toolInput?.requestBody;
    return (raw && typeof raw === "object" ? raw : toolInput ?? {}) as DataMap;
  }, [toolInput]);
  const inputData = useMemo(() => (requestBody.data && typeof requestBody.data === "object" ? requestBody.data : requestBody) as DataMap, [requestBody]);

  useEffect(() => {
    if (requestBody.locale === "en-US" || requestBody.locale === "zh-CN") setLocale(requestBody.locale);
  }, [requestBody]);

  const emit: Emit = async (action, payload) => {
    setPending(true); setFeedback(null);
    try {
      const toolName = actionTools[action];
      let result: unknown = null;
      if (app && isConnected && toolName) result = await app.callServerTool({ name: toolName, arguments: payload });
      const responseBody = { action, view, payload, success: true, component: componentId, toolResult: result, timestamp: new Date().toISOString() };
      if (app && isConnected) await app.sendMessage({ role: "user", content: [{ type: "text", text: `[HelpDesk Card Action]\n${JSON.stringify({ responseBody })}` }] });
      setToolResult(result);
      setFeedback({ ok: true, message: l(locale, "操作已提交，智能体将继续处理", "Submitted. The agent will continue") });
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setFeedback({ ok: false, message: l(locale, `操作失败：${message}`, `Action failed: ${message}`) });
      return false;
    } finally { setPending(false); }
  };

  const props = { view, locale, data: inputData, emit };
  const content = componentId === "agent" ? <AgentCard {...props} /> : componentId === "manager" ? <ManagerCard {...props} /> : componentId === "approval" ? <ApprovalCard {...props} /> : componentId === "knowledge" ? <KnowledgeCard {...props} /> : <EmployeeCard {...props} />;
  const dark = hostContext?.theme === "dark";

  return <main className={cx("card-host", dark && "theme-dark")}>
    {content}
    {pending && <div className="pending"><span /><b>{l(locale, "正在处理…", "Processing…")}</b></div>}
    {feedback && <div className={cx("inline-feedback", feedback.ok ? "success" : "error")}><b>{feedback.ok ? "✓" : "!"}</b><span>{feedback.message}</span></div>}
    {toolResult != null && <span className="sr-only" aria-live="polite">Tool result received</span>}
  </main>;
}
