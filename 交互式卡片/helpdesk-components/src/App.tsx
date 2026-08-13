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
  reject_ticket: "Reject_Ticket",
  resolve_ticket: "Resolve_Ticket",
  submit_rating: "Rate_Ticket",
  submit_reply: "Reply_Ticket",
  reassign_ticket: "Reassign_Ticket",
  list_team_tickets: "List_Team_Tickets",
  load_metrics: "Get_Helpdesk_Metrics",
  list_approvals: "List_My_Approvals",
  approval_detail: "Get_Approval_Detail",
  approve_request: "Approve_Ticket_Request",
  reject_request: "Reject_Ticket_Request",
  create_knowledge_ingestion: "Create_Knowledge_Ingestion",
  create_knowledge_draft: "Create_Knowledge_Draft",
  check_conflict: "Check_Knowledge_Conflict",
  publish_knowledge: "Publish_Knowledge"
};

const mutatingActions = new Set([
  "submit_ticket", "upload_attachments", "close_ticket", "reject_ticket", "resolve_ticket", "submit_rating", "submit_reply", "reassign_ticket",
  "approve_request", "reject_request", "create_knowledge_ingestion", "create_knowledge_draft", "publish_knowledge"
]);

function l(locale: Locale, zh: string, en: string) { return locale === "en-US" ? en : zh; }
function cx(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }
function asRecord(value: unknown): DataMap { return value && typeof value === "object" && !Array.isArray(value) ? value as DataMap : {}; }
function asBoolean(value: unknown, fallback = false) { return typeof value === "boolean" ? value : fallback; }
function asNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function asString(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value : fallback; }
function toolResponseBodies(result: unknown): DataMap[] {
  const root = asRecord(result);
  const structured = asRecord(root.structuredContent);
  return [root, asRecord(root.responseBody), structured, asRecord(structured.responseBody)];
}
function toolFailure(result: unknown): string | null {
  for (const body of toolResponseBodies(result)) {
    if (body.isError === true || body.success === false) {
      return asString(body.error) || asString(body.message) || asString(body.errorMessage) || "Tool returned an unsuccessful result";
    }
  }
  return null;
}
function toolSuccessConfirmed(result: unknown): boolean {
  return toolResponseBodies(result).some((body) => body.success === true || body.status === "success" || body.status === "completed");
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
  const source = Array.isArray(data.tickets) ? data.tickets : Object.keys(asRecord(data.ticket)).length ? [data.ticket] : [];
  if (!source.length) return previewMode ? tickets : [];
  return source.map((item, index) => {
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

function optionsFromData(value: unknown, fallback: string[]): Array<{ id: string; label: string }> {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((item, index) => {
    if (typeof item === "string") return { id: item, label: item };
    const record = asRecord(item);
    const label = asString(record.name, asString(record.label, `Option ${index + 1}`));
    return { id: asString(record.id, asString(record.code, asString(record.value, label))), label };
  }).filter((item) => item.id && item.label);
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

function TimelineCompact({ locale, approval = false, items, previewMode = false }: { locale: Locale; approval?: boolean; items?: unknown; previewMode?: boolean }) {
  const provided = Array.isArray(items) ? items.map((item) => { const record = asRecord(item); return [asString(record.time, "—"), asString(record.title, asString(record.titleZh, asString(record.titleEn, "—")))] as [string, string]; }) : [];
  const source = provided.length ? provided : previewMode ? approval ? [
    ["10:12", l(locale, "申请已提交", "Request submitted")],
    ["10:13", l(locale, "规则校验完成", "Policy check completed")],
    ["10:15", l(locale, "L1 审批中", "L1 review in progress")]
  ] : timeline.slice(-3).map((item) => [item.time, l(locale, item.titleZh, item.titleEn)]) : [];
  if (!source.length) return <EmptyState locale={locale} description={l(locale, "尚未收到轨迹数据。", "No timeline data received.")} />;
  return <div className="timeline-compact">{source.map(([time, title], index) => <div key={`${time}-${title}`} className={index === source.length - 1 ? "active" : ""}><time>{time}</time><i /><span>{title}</span></div>)}</div>;
}

function AttachmentList({ locale, files, onToggle }: { locale: Locale; files: typeof seedAttachments; onToggle?: (id: string) => void }) {
  return <div className="attachment-list">{files.slice(0, 5).map((file) => <div className="attachment" key={file.id}><input type="checkbox" checked={file.selected !== false} onChange={() => onToggle?.(file.id)} aria-label={l(locale, "选择附件", "Select attachment")} /><span>{file.type}</span><div><strong>{file.name}</strong><small>{file.size}</small></div></div>)}</div>;
}

function EmployeeCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const [draft, setDraft] = useState({
    requesterName: asString(data.requesterName, previewMode ? "Michelle Lee" : ""),
    requesterEmail: asString(data.requesterEmail, previewMode ? "michelle.lee@zenxin.example" : ""),
    title: asString(data.title, previewMode ? l(locale, "VPN 连接后无法访问内部系统", "Cannot access internal systems after VPN connection") : ""),
    category: asString(data.category, previewMode ? "IT / Network Connectivity Issues" : ""),
    priority: asString(data.priority, previewMode ? "High" : "Medium"),
    description: asString(data.description, previewMode ? l(locale, "连接 VPN 成功后，ERP 和内部文件服务器仍无法访问。已重启并重新登录。", "VPN connects, but ERP and internal file servers remain unavailable after restart and sign-in.") : "")
  });
  const ticketData = asRecord(data.ticket);
  const ticketItems = ticketsFromData(data, previewMode);
  const primaryTicket = ticketItems[0];
  const ticketId = asString(data.ticketId, asString(ticketData.id, primaryTicket?.id ?? (previewMode ? tickets[0].id : "")));
  const [confirmed, setConfirmed] = useState(false);
  const [resolveStep, setResolveStep] = useState<"decide" | "rate" | "reject">(asString(data.step) === "rate" ? "rate" : asString(data.step) === "reject" ? "reject" : "decide");
  const [rejectReason, setRejectReason] = useState("");
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

  if (view === "resolution") {
    const solutionTitle = asString(data.solutionTitle, previewMode ? l(locale, "重新导入最新 VPN 配置", "Re-import the latest VPN profile") : "");
    const solutionSource = asString(data.source, previewMode ? l(locale, "远程访问与 VPN 使用指南 · 4.2", "Remote Access & VPN Guide · 4.2") : "");
    const solutionSteps = Array.isArray(data.solutionSteps) ? data.solutionSteps.map((step) => asString(step)).filter(Boolean) : previewMode ? [l(locale, "删除当前 VPN 配置", "Remove the current VPN profile"), l(locale, "从 IT Portal 导入最新配置", "Import the latest profile from IT Portal"), l(locale, "完成 MFA 后重新连接", "Complete MFA and reconnect")] : [];
    const completeSolution = Boolean(solutionTitle && solutionSource && solutionSteps.length);
    return <Card><CardHeader icon="✓" title={l(locale, "找到一个可能的解决方案", "A possible solution was found")} subtitle={solutionSource || l(locale, "来源待确认", "Source not provided")} badge={<Badge tone="success">KB</Badge>} />{completeSolution ? <div className="answer"><strong>{solutionTitle}</strong><ol>{solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol></div> : <EmptyState locale={locale} description={l(locale, "请提供知识来源、方案标题和解决步骤。", "Provide a knowledge source, title, and resolution steps.")} />}<p className="question">{l(locale, "这个方案解决了问题吗？", "Did this solve the issue?")}</p><Actions><button className="btn secondary" disabled={!completeSolution} onClick={() => void emit("answer_resolved", { resolved: true, knowledgeId: data.knowledgeId ?? null })}>{l(locale, "已解决", "Solved")}</button><button className="btn primary" onClick={() => void emit("create_ticket_draft", { resolved: false, source: "knowledge", knowledgeId: data.knowledgeId ?? null })}>{l(locale, "仍未解决，创建工单", "Still unresolved")}</button></Actions></Card>;
  }

  if (view === "ticket-draft") return <Card>
    <CardHeader icon="✦" title={l(locale, "请确认工单信息", "Confirm ticket details")} subtitle={l(locale, "AI 已根据对话生成草稿", "AI generated this draft from the conversation")} badge={<Badge tone="info">AI</Badge>} />
    <div className="requester"><Avatar name={draft.requesterName} /><div><strong>{draft.requesterName}</strong><small>{draft.requesterEmail} · Finance</small></div></div>
    <Field label={l(locale, "工单标题", "Ticket title")} required><input value={draft.title} onChange={(e) => change("title", e.target.value)} /></Field>
    <div className="field-grid"><Field label={l(locale, "一级分类（AI 识别）", "Category (AI detected)")} required><select value={draft.category} onChange={(e) => change("category", e.target.value)}><option>IT / Network Connectivity Issues</option><option>IT / Password Reset/ Password issue</option><option>IT / Hardware Malfunctions</option><option>IT / Email Issues</option><option>IT / Application/ Software Errors</option><option>IT / Shared Folder/ SharePoint Access Problems</option><option>IT / Security Incident Reporting</option><option>IT / New Software Installation</option><option>IT / Hardware Request</option><option>IT / Access and Permissions</option><option>IT / Email Setup and Management</option><option>IT / Password Management</option><option>IT / Remote Access</option><option>IT / IT Equipment Loan</option><option>IT / Network Services</option><option>IT / Backup and Recovery Services</option><option>IT / Email Distribution Lists</option><option>IT / Others</option><option>HR / Payroll Issues</option><option>HR / HR System Access Issues</option><option>HR / Leave System Errors</option><option>HR / Employee Benefits</option><option>HR / HR Policies & Documentation</option></select></Field><Field label={l(locale, "优先级（AI 判断）", "Priority (AI detected)")} required><select value={draft.priority} onChange={(e) => change("priority", e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field></div>
    <Field label={l(locale, "问题描述", "Description")} required><textarea rows={3} value={draft.description} onChange={(e) => change("description", e.target.value)} /></Field>
    <details className="details"><summary>{l(locale, `附件 (${files.length})`, `Attachments (${files.length})`)}</summary><AttachmentList locale={locale} files={files} onToggle={(id) => { setFiles((current) => current.map((f) => f.id === id ? { ...f, selected: !f.selected } : f)); }} /><label className="upload-link">＋ {l(locale, "添加附件", "Add files")}<input type="file" multiple accept=".png,.jpg,.jpeg,.pdf,.txt,.log" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} /></label>{fileError && <p className="field-error" role="alert">{fileError}</p>}</details>
    <Actions><button className="btn secondary" onClick={() => void emit("save_ticket_draft", { draft, attachments: files.filter(f => f.selected !== false) })}>{l(locale, "保存草稿", "Save draft")}</button><button className="btn primary" disabled={!draft.title.trim() || !draft.description.trim()} onClick={() => void emit("submit_ticket", { ...draft, attachments: files.filter(f => f.selected !== false), confirmed: true })}>{l(locale, "确认提交", "Submit")}</button></Actions>
  </Card>;

  if (view === "ticket-receipt" || view === "ticket-detail") {
    // Unified: both receipt and detail use the same card
    const status = asString(data.status, "").toLowerCase();
    const isReceipt = view === "ticket-receipt" || status === "success" || status === "created";
    const failed = status === "failed" || status === "error";
    const pendingReceipt = status === "pending" || status === "processing";

    if (isReceipt && !failed && !pendingReceipt) {
      // Show as created confirmation or detail
      const displayTicketId = asString(data.ticketId, primaryTicket?.id ?? (previewMode ? tickets[0].id : ""));
      const team = asString(data.assignedTeam, primaryTicket?.team ?? (previewMode ? "IT Infrastructure" : "—"));
      if (!displayTicketId && !previewMode) return <Card><CardHeader icon="?" title={l(locale, "工单详情", "Ticket detail")} /><EmptyState locale={locale} /></Card>;
      const showCreatedBanner = status === "success" || status === "created";
      return <Card tone={showCreatedBanner ? "success" : undefined}><CardHeader icon={showCreatedBanner ? "✓" : "◈"} title={showCreatedBanner ? l(locale, "工单已创建", "Ticket created") : l(locale, primaryTicket?.titleZh ?? "", primaryTicket?.titleEn ?? "")} subtitle={displayTicketId} badge={<Badge tone={showCreatedBanner ? "success" : "purple"}>{showCreatedBanner ? l(locale, "已创建", "Created") : l(locale, primaryTicket?.statusZh ?? "", primaryTicket?.statusEn ?? "")}</Badge>} /><KeyValues items={[[l(locale, "处理团队", "Team"), team], [l(locale, "处理人", "Assignee"), showCreatedBanner ? l(locale, "待分配", "Pending assignment") : (primaryTicket?.assignee ?? "—")], ["SLA", showCreatedBanner ? l(locale, "1 小时内响应", "Response within 1 hour") : (primaryTicket?.due ?? "—")]]} /><Actions align="start"><button className="btn primary" onClick={() => void emit("open_ticket", { ticketId: displayTicketId })}>{l(locale, "查看详情", "View details")}</button></Actions></Card>;
    }
    if (failed) return <Card tone="danger"><CardHeader icon="!" title={l(locale, "工单提交失败", "Ticket submission failed")} subtitle={asString(data.errorMessage, l(locale, "请检查信息后重试", "Review and retry"))} /><Actions><button className="btn primary" onClick={() => void emit("retry_ticket", { view: "ticket-draft" })}>{l(locale, "返回修改", "Edit and retry")}</button></Actions></Card>;
    if (pendingReceipt) return <Card tone="info"><CardHeader icon="…" title={l(locale, "工单正在提交", "Submitting ticket")} subtitle={l(locale, "后台尚未返回最终结果", "Awaiting final result")} /></Card>;
    // Default detail view
    if (!primaryTicket) return <Card><CardHeader icon="◈" title={l(locale, "工单详情", "Ticket detail")} /><EmptyState locale={locale} /></Card>;
    const hasReply = Boolean(asString(data.latestReply));
    const description = asString(data.description, previewMode ? l(locale, "VPN 连接成功后，ERP 和内部文件服务器仍无法访问。已尝试重新导入配置、完成 MFA 并重启电脑。", "VPN connects but ERP and internal file servers remain unreachable. Tried re-importing profile, completing MFA, and restarting.") : "");
    const tags = [l(locale, "响应及时", "Quick"), l(locale, "解释清楚", "Clear"), l(locale, "专业友好", "Professional")];
    const bottomSection = hasReply
      ? (resolveStep === "rate"
        ? <><p className="question">{l(locale, "✓ 已确认解决，请评价本次服务", "✓ Confirmed — please rate")}</p><div className="stars" role="group">{[1,2,3,4,5].map((star) => <button type="button" key={star} className={star <= rating ? "active" : ""} onClick={() => setRating(star)}>{"★"}</button>)}</div><div className="chips" role="group">{tags.map((tag) => <button type="button" key={tag} className={selectedTags.includes(tag) ? "selected" : ""} onClick={() => setSelectedTags((c) => c.includes(tag) ? c.filter((x) => x !== tag) : [...c, tag])}>{tag}</button>)}</div><Actions><button className="btn primary" disabled={rating === 0} onClick={() => void emit("close_ticket", { ticketId: primaryTicket.id, resolved: true, rating, tags: selectedTags, comment })}>{l(locale, "提交评价", "Submit")}</button></Actions></>
        : resolveStep === "reject"
        ? <><p className="question">{l(locale, "请说明未解决的原因", "Please describe why it's not resolved")}</p><Field label={l(locale, "驳回原因", "Reason")} required><textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={l(locale, "说明哪里没解决、还需要什么帮助...", "Explain what's still unresolved...")} /></Field><Actions><button className="btn secondary" onClick={() => setResolveStep("decide")}>{l(locale, "取消", "Cancel")}</button><button className="btn primary" disabled={!rejectReason.trim()} onClick={() => void emit("reject_ticket", { ticketId: primaryTicket.id, reason: rejectReason })}>{l(locale, "提交驳回", "Submit rejection")}</button></Actions></>
        : <><p className="question">{l(locale, "问题是否已经解决？", "Has the issue been resolved?")}</p><Actions><button className="btn secondary" onClick={() => setResolveStep("reject")}>{l(locale, "未解决/驳回", "Not resolved")}</button><button className="btn primary" onClick={() => setResolveStep("rate")}>{l(locale, "已解决", "Resolved")}</button></Actions></>)
      : <Actions align="start"><button className="btn primary" onClick={() => void emit("open_ticket", { ticketId: primaryTicket.id })}>{l(locale, "查看详情", "View details")}</button></Actions>;
    return <Card><CardHeader icon="◈" title={l(locale, primaryTicket.titleZh, primaryTicket.titleEn)} subtitle={primaryTicket.id} badge={<Badge tone="purple">{l(locale, primaryTicket.statusZh, primaryTicket.statusEn)}</Badge>} />{description && <p className="summary-text">{description}</p>}<KeyValues items={[[l(locale, "处理人", "Assignee"), `${primaryTicket.assignee} · ${primaryTicket.team}`], ["SLA", <span className="danger-text">{primaryTicket.due}</span>]]} />{hasReply && <div className="latest-reply"><Avatar name={asString(data.latestReplyAuthor, primaryTicket.assignee)} /><p><strong>{asString(data.latestReplyAuthor, primaryTicket.assignee)} · {asString(data.latestReplyTime, "—")}</strong><span>{asString(data.latestReply)}</span></p></div>}{hasReply ? <details className="details"><summary>{l(locale, "处理轨迹", "Activity")}</summary><TimelineCompact locale={locale} items={data.timeline} previewMode={previewMode} /></details> : <><h3>{l(locale, "处理轨迹", "Activity")}</h3><TimelineCompact locale={locale} items={data.timeline} previewMode={previewMode} /></>}{bottomSection}</Card>;
  }

  if (view === "rating") {
    return <Card><CardHeader icon="★" title={l(locale, "评价已合并", "Rating merged")} /><EmptyState locale={locale} description={l(locale, "评价功能已整合到工单详情卡的确认解决流程中。", "Rating is now part of the resolve flow in ticket detail.")} /></Card>;
  }

  if (view === "ticket-list") return <Card><CardHeader icon="▤" title={l(locale, "我的工单", "My tickets")} subtitle={l(locale, "最近更新的工单", "Recently updated tickets")} badge={<Badge tone="neutral">{ticketItems.length}</Badge>} />{ticketItems.length ? <div className="row-list">{ticketItems.slice(0, 3).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div> : <EmptyState locale={locale} />}{ticketItems.length > 3 && <Actions align="start"><button className="link-btn" onClick={() => void emit("list_tickets", { offset: 3 })}>{l(locale, "继续查看其他工单", "Show more tickets")} →</button></Actions>}</Card>;

  if (view === "rating") {
    const tags = [l(locale, "响应及时", "Quick"), l(locale, "解释清楚", "Clear"), l(locale, "专业友好", "Professional")];
    return <Card><CardHeader icon="★" title={l(locale, "评价本次服务", "Rate this support experience")} subtitle={`${ticketId || "—"} · ${asString(data.assignee, previewMode ? "Alex Tan" : "—")}`} /><div className="stars" role="group" aria-label={l(locale, "服务评分", "Service rating")}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= rating ? "active" : ""} aria-label={l(locale, `${star} 星`, `${star} star${star > 1 ? "s" : ""}`)} aria-pressed={star === rating} onClick={() => setRating(star)}>★</button>)}</div><div className="chips" role="group" aria-label={l(locale, "评价标签", "Rating tags")}>{tags.map((tag) => <button type="button" key={tag} className={selectedTags.includes(tag) ? "selected" : ""} aria-pressed={selectedTags.includes(tag)} onClick={() => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{tag}</button>)}</div><Field label={l(locale, "补充意见（选填）", "Comment (optional)")}><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!ticketId || rating === 0} onClick={() => void emit("submit_rating", { ticketId, rating, tags: selectedTags, comment })}>{l(locale, "提交评价", "Submit rating")}</button></Actions></Card>;
  }

  // attachments view deprecated - attachment selection is part of ticket-draft, supplemental upload via ticket-detail
  return <Card><CardHeader icon="◈" title={l(locale, "工单详情", "Ticket detail")} /><EmptyState locale={locale} description={l(locale, "附件功能已合并到工单草稿卡和工单详情卡中。", "Attachment selection is now part of the ticket draft and detail cards.")} /></Card>;
}

function AgentCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const ticketItems = ticketsFromData(data, previewMode);
  const ticket = ticketItems[0];
  const [reply, setReply] = useState(asString(data.reply, previewMode ? l(locale, "你好 Michelle，请重新导入最新 VPN 配置并完成 MFA。若仍有问题，请附上诊断日志。", "Hi Michelle, please import the latest VPN profile and complete MFA. If the issue remains, attach the diagnostic log.") : ""));
  const [internalNote, setInternalNote] = useState(asString(data.internalNote));
  const [reason, setReason] = useState("");
  const teamOptions = optionsFromData(data.teams, previewMode ? ["IT Infrastructure", "IT Application", "IT Service Desk"] : []);
  const assigneeOptions = optionsFromData(data.assignees, previewMode ? ["Daniel Wong", "Mei Ling", "Sarah Lim"] : []);
  const requestedTeamId = asString(data.teamId, asString(data.team));
  const requestedAssigneeId = asString(data.assigneeId, asString(data.assignee));
  const [teamId, setTeamId] = useState(teamOptions.some((option) => option.id === requestedTeamId) ? requestedTeamId : previewMode ? teamOptions[0]?.id ?? "" : "");
  const [assigneeId, setAssigneeId] = useState(assigneeOptions.some((option) => option.id === requestedAssigneeId) ? requestedAssigneeId : previewMode ? assigneeOptions[0]?.id ?? "" : "");

  if (!ticket && view !== "queue" && view !== "sla-alert") return <Card><CardHeader icon="◈" title={l(locale, "处理人工单", "Agent ticket")} /><EmptyState locale={locale} /></Card>;

  if (view === "notification") return <Card tone="purple"><CardHeader icon="↘" title={l(locale, "新工单分配给你", "New ticket assigned to you")} subtitle={ticket.id} badge={<Badge tone="danger">{ticket.priority}</Badge>} /><h3>{l(locale, ticket.titleZh, ticket.titleEn)}</h3><p className="summary-text">{asString(data.description, l(locale, "请查看完整工单信息后开始处理。", "Review the full ticket before starting work."))}</p><KeyValues items={[[l(locale, "提单人", "Requester"), asString(data.requester, "—")], ["SLA", <span className="danger-text">{ticket.due}</span>]]} /><Actions><button className="btn secondary" onClick={() => void emit("reassign_ticket", { ticketId: ticket.id, intent: "reassign" })}>{l(locale, "转派", "Reassign")}</button><button className="btn primary" onClick={() => void emit("open_ticket", { ticketId: ticket.id, intent: "handle" })}>{l(locale, "查看并处理", "View and handle")}</button></Actions></Card>;

  if (view === "queue") return <Card><CardHeader icon="▤" title={l(locale, "我的待办", "My queue")} subtitle={l(locale, "按 SLA 紧急程度排序", "Sorted by SLA urgency")} badge={<Badge tone="warning">{ticketItems.length}</Badge>} />{ticketItems.length ? <><div className="mini-stats"><span><b>{ticketItems.filter((item) => item.sla >= 65 && item.sla < 100).length}</b>{l(locale, "临近", "At risk")}</span><span><b className="danger-text">{ticketItems.filter((item) => item.sla >= 100).length}</b>{l(locale, "超时", "Overdue")}</span><span><b>{asNumber(data.resolvedToday, 0)}</b>{l(locale, "今日解决", "Resolved")}</span></div><div className="row-list">{ticketItems.slice(0, 3).map((item, index) => <TicketRow key={item.id} ticket={item} locale={locale} requester={Array.isArray(data.requesters) ? asString(data.requesters[index], "—") : undefined} onOpen={() => void emit("open_ticket", { ticketId: item.id })} />)}</div></> : <EmptyState locale={locale} />}</Card>;

  if (view === "ticket-detail") {
    const description = asString(data.description, previewMode ? l(locale, "VPN 连接成功后，ERP 和内部文件服务器仍无法访问。已尝试重新导入配置、完成 MFA 并重启电脑。", "VPN connects but ERP and internal file servers remain unreachable. Tried re-importing profile, completing MFA, and restarting.") : "");
    const requester = asString(data.requester, previewMode ? "Michelle Lee · Finance · michelle.lee@zenxin.example" : "");
    const hasReply = Boolean(asString(data.latestReply, previewMode ? l(locale, "请重新导入最新 VPN 配置并完成 MFA。若仍有问题请附上诊断日志。", "Please re-import the latest VPN profile and complete MFA. Attach diagnostic log if issue persists.") : ""));
    const latestReply = asString(data.latestReply, previewMode ? l(locale, "请重新导入最新 VPN 配置并完成 MFA。若仍有问题请附上诊断日志。", "Please re-import the latest VPN profile and complete MFA. Attach diagnostic log if issue persists.") : "");
    const replyAuthor = asString(data.latestReplyAuthor, previewMode ? "Alex Tan" : "");
    const replyTime = asString(data.latestReplyTime, previewMode ? "09:46" : "");
    return <Card><CardHeader icon="◈" title={l(locale, ticket.titleZh, ticket.titleEn)} subtitle={ticket.id} badge={<Badge tone="danger">SLA {ticket.due}</Badge>} />{requester && <div className="requester"><Avatar name={requester.split(" ")[0]} /><div><strong>{requester.split(" · ")[0]}</strong><small>{requester.split(" · ").slice(1).join(" · ")}</small></div></div>}{description && <p className="summary-text">{description}</p>}<KeyValues items={[[l(locale, "处理人", "Assignee"), `${ticket.assignee} · ${ticket.team}`], ["SLA", <span className="danger-text">{ticket.due}</span>]]} />{hasReply && <div className="latest-reply"><Avatar name={replyAuthor} /><p><strong>{replyAuthor} · {replyTime}</strong><span>{latestReply}</span></p></div>}<h3>{l(locale, "处理轨迹", "Activity")}</h3><TimelineCompact locale={locale} items={data.timeline} previewMode={previewMode} /><Actions><button className="btn secondary" onClick={() => void emit("reassign_ticket", { ticketId: ticket.id })}>{l(locale, "转派", "Reassign")}</button><button className="btn secondary" onClick={() => void emit("update_category", { ticketId: ticket.id })}>{l(locale, "修改分类", "Change category")}</button><button className="btn secondary" onClick={() => void emit("compose_reply", { ticketId: ticket.id })}>{l(locale, "答复", "Reply")}</button><button className="btn primary" onClick={() => void emit("resolve_ticket", { ticketId: ticket.id })}>{l(locale, "提交已解决", "Mark resolved")}</button></Actions></Card>;
  }

  if (view === "reply") return <Card><CardHeader icon="↗" title={l(locale, "确认发送答复", "Confirm reply")} subtitle={`${ticket.id} · ${l(locale, "发送后将通知提单人", "The requester will be notified")}`} /> <div className="chips buttons">{replyTemplates.map((template) => <button type="button" key={template.en} onClick={() => setReply(l(locale, template.zh, template.en))}>{l(locale, template.zh, template.en)}</button>)}</div><Field label={l(locale, "答复内容", "Reply")} required><textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field><details className="details"><summary>{l(locale, "添加内部备注", "Add internal note")}</summary><textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder={l(locale, "内部备注对提单人不可见", "Internal notes are hidden from the requester")} /></details><Actions><button className="btn secondary" onClick={() => void emit("save_reply_draft", { ticketId: ticket.id, reply, internalNote })}>{l(locale, "保存草稿", "Save")}</button><button className="btn primary" disabled={!reply.trim()} onClick={() => void emit("submit_reply", { ticketId: ticket.id, content: reply, internalNote })}>{l(locale, "发送答复", "Send")}</button></Actions></Card>;

  if (view === "reassign") {
    const selectedTeam = teamOptions.find((option) => option.id === teamId);
    const selectedAssignee = assigneeOptions.find((option) => option.id === assigneeId);
    const validSelection = Boolean(selectedTeam && selectedAssignee);
    return <Card><CardHeader icon="↗" title={l(locale, "转派工单", "Reassign ticket")} subtitle={`${ticket.id} · ${l(locale, ticket.titleZh, ticket.titleEn)}`} /><div className="field-grid"><Field label={l(locale, "目标工作组", "Target team")} required><select value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="" disabled>{l(locale, "请选择", "Select")}</option>{teamOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field><Field label={l(locale, "目标处理人", "Assignee")} required><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="" disabled>{l(locale, "请选择", "Select")}</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field></div><Field label={l(locale, "转派原因", "Reason")} required><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!validSelection || !reason.trim()} onClick={() => void emit("reassign_ticket", { ticketId: ticket.id, teamId, team: selectedTeam?.label, assigneeId, assignee: selectedAssignee?.label, reason })}>{l(locale, "确认转派", "Confirm")}</button></Actions></Card>;
  }

  return <Card tone="danger"><CardHeader icon="!" title={l(locale, "SLA 需要立即关注", "SLA needs immediate attention")} subtitle={l(locale, `${ticketItems.filter((item) => item.sla >= 100).length} 个已超时，${ticketItems.filter((item) => item.sla >= 65 && item.sla < 100).length} 个临近到期`, `${ticketItems.filter((item) => item.sla >= 100).length} overdue, ${ticketItems.filter((item) => item.sla >= 65 && item.sla < 100).length} at risk`)} />{ticketItems.length ? <div className="row-list">{ticketItems.slice(0, 3).map((item) => <TicketRow key={item.id} ticket={item} locale={locale} onOpen={() => void emit("open_ticket", { ticketId: item.id })} />)}</div> : <EmptyState locale={locale} />}</Card>;
}

function ManagerCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const ticketItems = ticketsFromData(data, previewMode);
  const memberSource: unknown[] = Array.isArray(data.members) ? data.members : previewMode ? teamMembers : [];
  const members = memberSource.map((item, index) => {
    const record = asRecord(item);
    const name = asString(record.name, `Member ${index + 1}`);
    return {
      id: asString(record.id, asString(record.assigneeId, name)),
      name,
      initials: asString(record.initials, "—"),
      role: asString(record.role, "—"),
      active: asNumber(record.active, 0),
      overdue: asNumber(record.overdue, 0),
      capacity: Math.min(100, Math.max(0, asNumber(record.capacity, 0))),
      color: asString(record.color, "#635bff")
    };
  });
  const [ticketId, setTicketId] = useState(asString(data.ticketId, ticketItems[0]?.id ?? ""));
  const requestedAssignee = asString(data.assigneeId, asString(data.assignee));
  const initialAssigneeId = members.find((member) => member.id === requestedAssignee || member.name === requestedAssignee)?.id ?? (previewMode ? members[1]?.id ?? members[0]?.id ?? "" : "");
  const recommendedAssignee = asString(data.recommendedAssigneeId, asString(data.recommendedAssignee));
  const initialRecommendedId = members.find((member) => member.id === recommendedAssignee || member.name === recommendedAssignee)?.id ?? (previewMode ? members[1]?.id ?? members[0]?.id ?? "" : "");
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [selectedMemberId, setSelectedMemberId] = useState(initialRecommendedId);
  const [reason, setReason] = useState("");
  const metrics = asRecord(data.metrics);
  const metricValue = (key: string, demo: string) => {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return asString(value, previewMode ? demo : "—");
  };

  if (view === "dashboard") return <Card><CardHeader icon="▦" title={asString(data.teamName, l(locale, "团队服务摘要", "Team service summary"))} subtitle={asString(data.period, previewMode ? l(locale, "2026 年 8 月 · 演示", "August 2026 · demo") : l(locale, "统计周期待提供", "Reporting period required"))} /><div className="kpi-grid"><span><small>{l(locale, "本期工单", "Tickets")}</small><strong>{metricValue("ticketCount", "248")}</strong><em>{metricValue("ticketTrend", "+12.6%")}</em></span><span><small>{l(locale, "SLA 达标", "SLA met")}</small><strong>{metricValue("slaMet", "94.8%")}</strong><em>{metricValue("slaTrend", "+2.4%")}</em></span><span><small>{l(locale, "已解决", "Resolved")}</small><strong>{metricValue("resolved", "216")}</strong><em>{metricValue("resolutionRate", "87.1%")}</em></span><span><small>{l(locale, "满意度", "Rating")}</small><strong>{metricValue("rating", "4.62")}</strong><em>{metricValue("ratingTrend", "+0.18")}</em></span></div>{asString(data.riskSummary) && <div className="callout warning"><b>!</b><p><strong>{asString(data.riskCategory, l(locale, "风险提示", "Risk alert"))}</strong><span>{asString(data.riskSummary)}</span></p></div>}<Actions align="start"><button className="link-btn" onClick={() => void emit("load_metrics", { scope: "attention" })}>{l(locale, "查看风险摘要", "View risks")} →</button></Actions></Card>;

  if (view === "team-tickets") return <Card><CardHeader icon="▤" title={l(locale, "需要关注的团队工单", "Team tickets needing attention")} subtitle={l(locale, "优先展示超时和高风险工单", "Overdue and high-risk tickets first")} badge={<Badge tone="danger">{ticketItems.length}</Badge>} />{ticketItems.length ? <div className="row-list">{ticketItems.slice(0, 3).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} onOpen={() => void emit("open_ticket", { ticketId: ticket.id })} />)}</div> : <EmptyState locale={locale} />}<Actions align="start"><button className="link-btn" onClick={() => void emit("list_team_tickets", { scope: "all" })}>{l(locale, "继续在对话中查看", "Show more in chat")} →</button></Actions></Card>;

  if (view === "workload") {
    const selectedMember = members.find((member) => member.id === selectedMemberId);
    return <Card><CardHeader icon="◎" title={l(locale, "团队负载建议", "Team workload recommendation")} subtitle={selectedMember ? l(locale, `当前建议：${selectedMember.name}`, `Current recommendation: ${selectedMember.name}`) : l(locale, "请选择候选处理人", "Select a candidate assignee")} badge={typeof data.confidence === "number" ? <Badge tone="warning">{Math.round(data.confidence)}%</Badge> : undefined} />{members.length ? <div className="member-list">{members.map((member) => <button type="button" key={member.id} className={selectedMemberId === member.id ? "selected" : ""} aria-pressed={selectedMemberId === member.id} onClick={() => setSelectedMemberId(member.id)}><Avatar name={member.name} color={member.color} /><span><strong>{member.name}</strong><small>{member.role} · {member.active} {l(locale, "个处理中", "active")}</small></span><div className="capacity" aria-label={l(locale, `负载 ${member.capacity}%`, `Capacity ${member.capacity}%`)}><i style={{ width: `${member.capacity}%` }} /><small>{member.capacity}%</small></div></button>)}</div> : <EmptyState locale={locale} />}{typeof data.confidence === "number" && <p className="hint-line">{asString(data.recommendationReason, l(locale, "置信度由后台调度模型返回；请结合技能与在岗状态确认。", "Confidence is supplied by the routing model; confirm skills and availability."))}</p>}<Actions><button className="btn primary" disabled={!selectedMember} onClick={() => void emit("select_reassign_agent", { assigneeId: selectedMember?.id, assignee: selectedMember?.name, confidence: data.confidence ?? null })}>{l(locale, "确认选择", "Confirm selection")}</button></Actions></Card>;
  }

  if (view === "sla") {
    const categories = Array.isArray(data.categories) ? data.categories.map((raw, index) => { const record = asRecord(raw); return { name: asString(record.name, `Category ${index + 1}`), value: Math.min(100, Math.max(0, asNumber(record.value, 0))), tone: asString(record.tone, "warning") }; }) : previewMode ? [{ name: "Network & VPN", value: 86, tone: "danger" }, { name: "Email & Collaboration", value: 95, tone: "success" }, { name: "Software Request", value: 92, tone: "warning" }] : [];
    return <Card><CardHeader icon="◷" title={l(locale, "团队 SLA 摘要", "Team SLA summary")} subtitle={asString(data.summary, l(locale, "指标以后台统计结果为准", "Metrics are based on backend results"))} /><div className="kpi-grid compact"><span><small>{l(locale, "响应 SLA", "Response")}</small><strong>{metricValue("responseSla", "98.4%")}</strong></span><span><small>{l(locale, "解决 SLA", "Resolution")}</small><strong>{metricValue("resolutionSla", "94.8%")}</strong></span></div>{categories.length ? <div className="category-list">{categories.map(({ name, value, tone }) => <div key={name}><span>{name}</span><i><b className={`fill-${tone}`} style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>)}</div> : <EmptyState locale={locale} />}<Actions align="start"><button className="link-btn" onClick={() => void emit("load_metrics", { scope: "sla-risk" })}>{l(locale, "查看风险工单", "View at-risk tickets")} →</button></Actions></Card>;
  }

  const selectedAssignee = members.find((member) => member.id === assigneeId);
  const validTicket = ticketItems.some((ticket) => ticket.id === ticketId);
  return <Card><CardHeader icon="↗" title={l(locale, "经理快速转派", "Manager reassignment")} subtitle={l(locale, "实际审计和通知由 Reassign_Ticket Tool 返回结果确认", "Audit and notification must be confirmed by the Reassign_Ticket tool")} />{ticketItems.length ? <><Field label={l(locale, "工单", "Ticket")} required><select value={ticketId} onChange={(e) => setTicketId(e.target.value)}>{ticketItems.slice(0, 20).map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.id} · {l(locale, ticket.titleZh, ticket.titleEn)}</option>)}</select></Field><Field label={l(locale, "转派给", "Reassign to")} required><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="" disabled>{l(locale, "请选择", "Select")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={l(locale, "原因", "Reason")} required><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Actions><button className="btn primary" disabled={!validTicket || !selectedAssignee || !reason.trim()} onClick={() => void emit("reassign_ticket", { ticketId, assigneeId, assignee: selectedAssignee?.name, reason, actorRole: "manager" })}>{l(locale, "确认并通知", "Confirm and notify")}</button></Actions></> : <EmptyState locale={locale} />}</Card>;
}

function ApprovalCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const approvalData = asRecord(data.approval);
  const item = previewMode ? { ...approvals[0], ...approvalData } : {
    id: asString(approvalData.id, asString(data.approvalId)),
    ticket: asString(approvalData.ticket, asString(data.ticketId)),
    titleZh: asString(approvalData.titleZh, asString(approvalData.title, l(locale, "未命名申请", "Untitled request"))),
    titleEn: asString(approvalData.titleEn, asString(approvalData.title, l(locale, "未命名申请", "Untitled request"))),
    requester: asString(approvalData.requester, "—"), dept: asString(approvalData.dept, "—"), level: asString(approvalData.level, "—"), amount: asString(approvalData.amount, "—"), ageZh: asString(approvalData.ageZh, "—"), ageEn: asString(approvalData.ageEn, "—"), risk: asString(approvalData.risk, "low")
  };
  const [comment, setComment] = useState("");
  const approvalItems = Array.isArray(data.approvals) ? data.approvals.map((raw, index) => {
    const record = asRecord(raw);
    const title = asString(record.title, `Request ${index + 1}`);
    return { id: asString(record.id, `approval-${index + 1}`), ticket: asString(record.ticket, asString(record.ticketId)), titleZh: asString(record.titleZh, title), titleEn: asString(record.titleEn, title), requester: asString(record.requester, "—"), dept: asString(record.dept, "—"), level: asString(record.level, "—"), amount: asString(record.amount, "—"), ageZh: asString(record.ageZh, asString(record.age, "—")), ageEn: asString(record.ageEn, asString(record.age, "—")), risk: asString(record.risk, "low") };
  }) : previewMode ? approvals : item.id ? [item] : [];
  const initialChecks = asRecord(data.checks);
  const [policyConfirmed, setPolicyConfirmed] = useState(asBoolean(initialChecks.policy));
  const [businessConfirmed, setBusinessConfirmed] = useState(asBoolean(initialChecks.businessNeed));
  const [security, setSecurity] = useState(asBoolean(initialChecks.requiresL2));

  if (view === "approval-list") return <Card><CardHeader icon="✓" title={l(locale, "我的待审批", "My approvals")} subtitle={l(locale, "按审批 SLA 排序", "Sorted by approval SLA")} badge={<Badge tone="warning">{approvalItems.length}</Badge>} />{approvalItems.length ? <div className="approval-list">{approvalItems.map((approval) => <button type="button" key={approval.id} onClick={() => void emit("approval_detail", { approvalId: approval.id, ticketId: approval.ticket })}><span className={`risk risk-${approval.risk}`}>{approval.level}</span><span><code>{approval.id}</code><strong>{l(locale, approval.titleZh, approval.titleEn)}</strong><small>{approval.requester} · {approval.dept} · {l(locale, approval.ageZh, approval.ageEn)}</small></span><b aria-hidden="true">›</b></button>)}</div> : <EmptyState locale={locale} />}</Card>;

  if (view === "approval-detail") return <Card><CardHeader icon="✓" title={l(locale, item.titleZh, item.titleEn)} subtitle={`${item.id || "—"} · ${item.ticket || "—"}`} badge={<Badge tone="purple">{item.level}</Badge>} /><p className="summary-text">{asString(data.description, l(locale, "暂无申请说明", "No request description provided"))}</p><KeyValues items={[[l(locale, "申请人", "Requester"), `${item.requester} · ${item.dept}`], [l(locale, "费用/授权", "Cost / license"), item.amount], [l(locale, "风险", "Risk"), <Badge tone={item.risk === "high" ? "danger" : item.risk === "medium" ? "warning" : "success"}>{item.risk.toUpperCase()}</Badge>], [l(locale, "剩余时间", "Time left"), asString(data.timeLeft, "—")]]} /><details className="details"><summary>{l(locale, "查看审批路径", "View approval path")}</summary><TimelineCompact locale={locale} approval items={data.timeline} previewMode={previewMode} /></details><Actions><button className="btn primary" disabled={!item.id} onClick={() => void emit("open_decision", { approvalId: item.id })}>{l(locale, "进行审批", "Review request")}</button></Actions></Card>;

  if (view === "decision") return <Card><CardHeader icon="✓" title={l(locale, "审批决策", "Approval decision")} subtitle={`${item.id || "—"} · ${l(locale, item.titleZh, item.titleEn)}`} /><div className="check-list"><label><input type="checkbox" checked={policyConfirmed} onChange={(e) => setPolicyConfirmed(e.target.checked)} /><span>{l(locale, "符合软件与采购政策", "Complies with policy")}</span></label><label><input type="checkbox" checked={businessConfirmed} onChange={(e) => setBusinessConfirmed(e.target.checked)} /><span>{l(locale, "业务必要性已确认", "Business need confirmed")}</span></label><label><input type="checkbox" checked={security} onChange={(e) => setSecurity(e.target.checked)} /><span>{l(locale, "提交 L2 安全评审", "Route to L2 security review")}</span></label></div><Field label={l(locale, "审批意见", "Comment")} hint={l(locale, "驳回时必须填写", "Required when rejecting")}><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Actions><button className="btn danger" disabled={!item.id || !comment.trim()} onClick={() => void emit("reject_request", { approvalId: item.id, comment, checks: { policy: policyConfirmed, businessNeed: businessConfirmed, requiresL2: security } })}>{l(locale, "驳回", "Reject")}</button><button className="btn primary" disabled={!item.id || !policyConfirmed || !businessConfirmed} onClick={() => void emit("approve_request", { approvalId: item.id, comment, checks: { policy: policyConfirmed, businessNeed: businessConfirmed, requiresL2: security } })}>{security ? l(locale, "同意并提交 L2", "Approve to L2") : l(locale, "同意", "Approve")}</button></Actions></Card>;

  return <Card><CardHeader icon="⌁" title={l(locale, "审批轨迹", "Approval timeline")} subtitle={`${item.id || "—"} · ${l(locale, "以后台审计记录为准", "Based on backend audit records")}`} /><TimelineCompact locale={locale} approval items={data.timeline} previewMode={previewMode} /><p className="hint-line">{l(locale, "卡片仅展示收到的轨迹；审计完整性由服务端保证。", "The card only displays received events; audit integrity is enforced server-side.")}</p></Card>;
}

function KnowledgeCard({ view, locale, data, emit, previewMode }: ViewProps) {
  const ticketData = asRecord(data.ticket);
  const sourceTicketId = asString(data.sourceTicket, asString(data.ticketId, asString(ticketData.id, previewMode ? tickets[0].id : "")));
  const [draft, setDraft] = useState({ title: asString(data.title, previewMode ? l(locale, "VPN 已连接但无法访问内部系统的处理方法", "Internal access failure after VPN connects") : ""), answer: asString(data.answer, previewMode ? l(locale, "删除旧配置，从 IT Portal 导入最新 VPN 配置，完成 MFA 并重新连接。如仍失败，请收集诊断日志交给 IT Infrastructure。", "Remove the old profile, import the latest VPN profile from IT Portal, complete MFA, and reconnect. If it still fails, collect the diagnostic log for IT Infrastructure.") : ""), tags: asString(data.tags, previewMode ? "VPN, Remote Access, DNS" : "") });
  const initialChecks = asRecord(data.checks);
  const [checks, setChecks] = useState({ pii: asBoolean(initialChecks.pii), reusable: asBoolean(initialChecks.reusable), accurate: asBoolean(initialChecks.accurate) });
  const qualityScore = typeof data.qualityScore === "number" ? Math.round(data.qualityScore) : null;
  const similarity = typeof data.similarity === "number" ? Math.round(data.similarity) : null;
  const [targetAgentId, setTargetAgentId] = useState(asString(data.targetAgentId, previewMode ? "agent-helpdesk-assistant" : ""));
  const [knowledgeSpaceId, setKnowledgeSpaceId] = useState(asString(data.knowledgeSpaceId, previewMode ? "dc://enterprise/helpdesk" : ""));
  const [audience, setAudience] = useState(asString(data.audience, previewMode ? "IT Service Desk" : ""));
  const [ingestionFiles, setIngestionFiles] = useState<AttachmentItem[]>(() => {
    const supplied = attachmentsFromData(data.attachments, false);
    return supplied.length ? supplied : previewMode ? [{ id: "knowledge-file-demo", name: "documents.zip", size: "79.1 MB", type: "ZIP", selected: true }] : [];
  });
  const [ingestionConfirmed, setIngestionConfirmed] = useState(false);

  if (view === "knowledge-ingestion") {
    const targetAgentName = asString(data.targetAgentName, previewMode ? "HelpDesk Assistant" : targetAgentId);
    const sourceType = asString(data.sourceType, previewMode ? "conversation" : "file");
    const conversationId = asString(data.conversationId, previewMode ? "CONV-DEMO-20260812" : "");
    const ready = Boolean(targetAgentId && knowledgeSpaceId && audience && ingestionFiles.length && ingestionConfirmed);
    const addKnowledgeFiles = (selected: FileList | null) => {
      const added = Array.from(selected ?? []).map((file, index) => ({ id: `knowledge-${Date.now()}-${index}`, name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.name.split(".").pop()?.toUpperCase() || "FILE", selected: true }));
      setIngestionFiles((current) => [...current, ...added].slice(0, 10));
      setIngestionConfirmed(false);
    };
    return <Card><CardHeader icon="↥" title={l(locale, "确认写入智能体知识", "Confirm agent knowledge ingestion")} subtitle={l(locale, "自然语言请求已识别；确认后仅创建待审核任务", "Natural-language intent detected; confirmation creates a review task only")} badge={<Badge tone="warning">DC</Badge>} /><div className="callout warning"><b>!</b><p><strong>{l(locale, "不会直接发布", "No direct publishing")}</strong><span>{l(locale, "附件将先经过安全解析、脱敏、权限和冲突检查。必须以 DC 返回的知识编号与版本作为发布成功依据。", "Files require security, PII, ACL, and conflict checks. Publishing succeeds only with a DC knowledge ID and version.")}</span></p></div><div className="field-grid"><Field label={l(locale, "目标智能体", "Target agent")} required><input value={targetAgentId} onChange={(event) => { setTargetAgentId(event.target.value); setIngestionConfirmed(false); }} /></Field><Field label={l(locale, "企业级 DC 知识域", "Enterprise DC space")} required><input value={knowledgeSpaceId} onChange={(event) => { setKnowledgeSpaceId(event.target.value); setIngestionConfirmed(false); }} /></Field></div><Field label={l(locale, "可见范围", "Audience")} required hint={l(locale, "最终范围取目标策略与来源 ACL 的更严格交集", "Final scope is the stricter intersection of target policy and source ACL")}><input value={audience} onChange={(event) => { setAudience(event.target.value); setIngestionConfirmed(false); }} /></Field><KeyValues items={[[l(locale, "智能体", "Agent"), targetAgentName || "—"], [l(locale, "来源", "Source"), `${sourceType}${conversationId ? ` · ${conversationId}` : ""}`], [l(locale, "审核策略", "Review"), l(locale, "人工审核", "Manual review")], [l(locale, "治理状态", "Governance"), l(locale, "待解析/脱敏/去重", "Pending parse/PII/dedup")]]} /><details className="details" open><summary>{l(locale, `来源附件 (${ingestionFiles.length})`, `Source files (${ingestionFiles.length})`)}</summary><AttachmentList locale={locale} files={ingestionFiles} onToggle={(id: string) => { setIngestionFiles((current) => current.map((f) => f.id === id ? { ...f, selected: !f.selected } : f)); setIngestionConfirmed(false); }} /><label className="upload-link">＋ {l(locale, "添加知识文件", "Add knowledge files")}<input type="file" multiple accept=".txt,.md,.yaml,.yml,.doc,.docx,.html,.pdf,.zip" onChange={(event) => { addKnowledgeFiles(event.target.files); event.target.value = ""; }} /></label></details><label className="confirm-line"><input type="checkbox" checked={ingestionConfirmed} onChange={(event) => setIngestionConfirmed(event.target.checked)} /><span>{l(locale, "我已确认目标智能体、来源和可见范围，并同意进入人工审核", "I confirm the target, sources, and audience and agree to manual review")}</span></label><Actions><button className="btn secondary" onClick={() => void emit("save_knowledge_draft", { targetAgentId, knowledgeSpaceId, audience, attachments: ingestionFiles, sourceType, conversationId })}>{l(locale, "保存摄取草稿", "Save ingestion draft")}</button><button className="btn primary" disabled={!ready} onClick={() => void emit("create_knowledge_ingestion", { requestId: `knowledge-ingestion-${Date.now()}`, targetAgentId, targetAgentName, knowledgeSpaceId, audience, attachments: ingestionFiles, source: { type: sourceType, conversationId }, governance: { reviewMode: "manual", conflictMode: "update-existing", piiReviewed: false }, trigger: "natural_language" })}>{l(locale, "确认并提交审核", "Confirm and submit for review")}</button></Actions></Card>;
  }

  if (view === "knowledge-candidate") {
    const candidateId = asString(data.candidateId, previewMode ? "KC-DEMO-0812-01" : "");
    const triggerReason = asString(data.triggerReason, previewMode ? l(locale, "近 30 天出现 12 张相似 VPN 工单，其中 9 张使用同一方案并由用户确认解决。", "12 similar VPN tickets appeared in 30 days; 9 used the same resolution and were user-confirmed.") : "");
    const evidenceRefs = Array.isArray(data.evidenceRefs) ? data.evidenceRefs.map((item) => asString(item)).filter(Boolean) : previewMode ? ["HD-2026-0811-0238", "HD-2026-0808-0152", "CONV-DEMO-20260812"] : [];
    return <Card tone="purple"><CardHeader icon="✦" title={l(locale, "智能体发现知识候选", "Agent-discovered knowledge candidate")} subtitle={candidateId || l(locale, "等待候选编号", "Waiting for candidate ID")} badge={<Badge tone="purple">{l(locale, "内驱", "Proactive")}</Badge>} /><p className="summary-text">{triggerReason || l(locale, "尚未提供可解释的触发原因。", "No explainable trigger reason was provided.")}</p><KeyValues items={[[l(locale, "触发规则", "Trigger"), asString(data.trigger, l(locale, "高频且已验证解决", "Frequent and verified"))], [l(locale, "近 30 天相似工单", "Similar tickets, 30d"), String(data.similarTickets30d ?? (previewMode ? 12 : "—"))], [l(locale, "候选质量分", "Candidate quality"), data.qualityScore == null ? (previewMode ? "86/100" : "—") : `${String(data.qualityScore)}/100`], [l(locale, "目标智能体", "Target agent"), asString(data.targetAgentId, previewMode ? "HelpDesk Assistant" : "—")]]} /><details className="details"><summary>{l(locale, `查看证据 (${evidenceRefs.length})`, `View evidence (${evidenceRefs.length})`)}</summary>{evidenceRefs.length ? <div className="chips">{evidenceRefs.map((ref) => <span key={ref}>{ref}</span>)}</div> : <EmptyState locale={locale} description={l(locale, "没有来源证据时不得生成知识。", "Knowledge cannot be generated without evidence.")} />}</details><div className="callout warning"><b>i</b><p><strong>{l(locale, "默认不自动发布", "Not auto-published by default")}</strong><span>{l(locale, "智能体仅提出候选；脱敏、准确性、冲突和权限仍需审核。", "The agent only proposes a candidate; PII, accuracy, conflict, and access still require review.")}</span></p></div><Actions><button className="btn secondary" onClick={() => void emit("reject_knowledge_candidate", { candidateId, reason: "not_reusable" })}>{l(locale, "忽略候选", "Dismiss")}</button><button className="btn primary" disabled={!candidateId || !triggerReason || evidenceRefs.length === 0} onClick={() => void emit("create_knowledge_draft", { candidateId, trigger: data.trigger, triggerReason, evidenceRefs, targetAgentId: data.targetAgentId, sourceType: "agent_generated" })}>{l(locale, "生成待审核草稿", "Create review draft")}</button></Actions></Card>;
  }

  if (view === "knowledge-draft") return <Card><CardHeader icon="◇" title={l(locale, "确认知识草稿", "Confirm knowledge draft")} subtitle={`${sourceTicketId || "—"} · ${asBoolean(data.piiRemoved) ? l(locale, "脱敏检查已通过", "PII check passed") : l(locale, "需人工完成脱敏核对", "Manual PII review required")}`} badge={<Badge tone="info">AI</Badge>} /><Field label={l(locale, "标题", "Title")} required><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label={l(locale, "标准处理方法", "Standard resolution")} required><textarea rows={4} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></Field><Field label={l(locale, "标签", "Tags")}><input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field><Actions><button className="btn secondary" onClick={() => void emit("save_knowledge_draft", { draft, sourceTicket: sourceTicketId })}>{l(locale, "保存草稿", "Save")}</button><button className="btn primary" disabled={!sourceTicketId || !draft.title.trim() || !draft.answer.trim() || !asBoolean(data.piiRemoved)} onClick={() => void emit("create_knowledge_draft", { ...draft, sourceTicket: sourceTicketId, piiReviewed: true })}>{l(locale, "提交审核", "Submit review")}</button></Actions></Card>;

  if (view === "source-ticket") {
    const steps = Array.isArray(data.steps) ? data.steps.map((step) => asString(step)).filter(Boolean).slice(0, 3) : previewMode ? [l(locale, "确认配置版本过旧", "Profile was outdated"), l(locale, "导入最新配置", "Imported latest profile"), l(locale, "刷新 DNS 后恢复", "Access restored after DNS flush")] : [];
    return <Card><CardHeader icon="◈" title={l(locale, "知识来源工单", "Knowledge source ticket")} subtitle={sourceTicketId || "—"} badge={data.rating ? <Badge tone="success">{String(data.rating)}★</Badge> : undefined} /><p className="summary-text">{asString(data.summary, l(locale, "暂无来源摘要", "No source summary provided"))}</p>{steps.length ? <div className="steps">{steps.map((step, index) => <span key={step}>{index + 1}<b>{step}</b></span>)}</div> : <EmptyState locale={locale} description={l(locale, "请提供已验证的解决步骤。", "Provide verified resolution steps.")} />}<KeyValues items={[[l(locale, "近 30 天相似工单", "Similar tickets, 30d"), String(data.similarTickets30d ?? "—")], [l(locale, "预计每月自助分流", "Estimated monthly deflection"), String(data.estimatedDeflection ?? "—")]]} /><Actions><button className="btn primary" disabled={!sourceTicketId || steps.length === 0} onClick={() => void emit("create_knowledge_draft", { sourceTicket: sourceTicketId, steps })}>{l(locale, "生成草稿", "Generate draft")}</button></Actions></Card>;
  }

  if (view === "review") return <Card><CardHeader icon="◇" title={l(locale, "知识发布检查", "Knowledge publishing review")} subtitle={qualityScore == null ? l(locale, "等待质量检查结果", "Waiting for quality check") : l(locale, `质量评分 ${qualityScore}/100`, `Quality score ${qualityScore}/100`)} badge={qualityScore == null ? <Badge tone="neutral">—</Badge> : <Badge tone={qualityScore >= 80 ? "success" : "warning"}>{qualityScore}</Badge>} /><div className="check-list">{([["pii", l(locale, "已人工确认无个人与敏感信息", "No personal information confirmed")], ["reusable", l(locale, "内容具有通用复用价值", "Content is reusable")], ["accurate", l(locale, "处理步骤已经验证", "Resolution steps verified")]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} /><span>{label}</span></label>)}</div>{similarity != null && <div className="callout warning"><b>≈</b><p><strong>{l(locale, `发现 ${similarity}% 相似知识`, `${similarity}% similar article found`)}</strong><span>{asString(data.conflictSuggestion, l(locale, "请先对比已有知识，避免重复发布。", "Compare the existing article before publishing."))}</span></p></div>}<Actions><button className="btn secondary" onClick={() => void emit("check_conflict", { sourceTicket: sourceTicketId })}>{l(locale, "对比内容", "Compare")}</button><button className="btn primary" disabled={!sourceTicketId || qualityScore == null || !Object.values(checks).every(Boolean)} onClick={() => void emit("publish_knowledge", { sourceTicket: sourceTicketId, mode: asString(data.publishMode, "update-existing"), checks, qualityScore, similarity })}>{l(locale, "确认更新并发布", "Update and publish")}</button></Actions></Card>;

  const publishStatus = asString(data.status, previewMode ? "success" : "unknown").toLowerCase();
  const knowledgeId = asString(data.knowledgeId, previewMode ? "KB-DEMO-0186" : "");
  const published = publishStatus === "success" || publishStatus === "published";
  if (published && !knowledgeId) return <Card tone="danger"><CardHeader icon="!" title={l(locale, "知识发布回执不完整", "Incomplete publish receipt")} subtitle={l(locale, "后台返回成功状态，但缺少知识编号", "The backend returned success without a knowledge ID")} /><EmptyState locale={locale} description={l(locale, "该结果不视为发布成功，请检查 Tool 输出协议。", "This is not treated as published; check the tool output contract.")} /></Card>;
  if (!published) return <Card><CardHeader icon="?" title={l(locale, "尚未确认发布结果", "Publish result unavailable")} subtitle={l(locale, "必须以发布 Tool 的明确结果为准", "An explicit publish-tool result is required")} /><EmptyState locale={locale} /></Card>;
  return <Card tone="success"><CardHeader icon="✓" title={l(locale, "知识已发布", "Knowledge published")} subtitle={l(locale, "发布结果已由后台确认", "The backend confirmed publication")} /><KeyValues items={[[l(locale, "知识编号", "Knowledge ID"), knowledgeId || "—"], [l(locale, "版本", "Version"), asString(data.version, "—")], [l(locale, "来源工单", "Source ticket"), sourceTicketId || "—"], [l(locale, "可见范围", "Audience"), asString(data.audience, "—")]]} /><Actions align="start">{knowledgeId && <button className="btn primary" onClick={() => void emit("open_knowledge", { knowledgeId })}>{l(locale, "查看知识", "Open article")}</button>}</Actions></Card>;
}

export function HelpdeskApp() {
  const componentId = __COMPONENT_ID__ as ComponentId;
  const view = __VIEW_ID__;
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const previewMode = searchParams.get("preview") === "1";

  if (previewMode) return <HelpdeskPreview componentId={componentId} view={view} searchParams={searchParams} />;
  return <HelpdeskConnected componentId={componentId} view={view} searchParams={searchParams} />;
}

function HelpdeskPreview({ componentId, view, searchParams }: { componentId: ComponentId; view: string; searchParams: URLSearchParams }) {
  const [locale, setLocale] = useState<Locale>(searchParams.get("locale") === "en-US" ? "en-US" : "zh-CN");
  const [feedback, setFeedback] = useState("");
  const scene = searchParams.get("scene") || "";
  const emit: Emit = async (action) => { setFeedback(l(locale, `预览模式：${action}`, `Preview: ${action}`)); setTimeout(() => setFeedback(""), 2500); return false; };
  const data: DataMap = scene === "receipt" ? { status: "created", ticketId: "HD-2026-0811-0256", assignedTeam: "IT Infrastructure" } : scene === "progress" || scene === "confirm" || scene === "" ? { ticket: tickets[0], description: tickets[0].descZh || "", latestReply: "核实为 DNS 缓存问题，已远程清除并验证恢复正常。", latestReplyAuthor: "Alex Tan", latestReplyTime: "11:30", step: searchParams.get("step") || "" } : {};
  const props = { view, locale, data, emit, previewMode: true };
  const content = componentId === "agent" ? <AgentCard {...props} /> : componentId === "manager" ? <ManagerCard {...props} /> : componentId === "approval" ? <ApprovalCard {...props} /> : <EmployeeCard {...props} />;
  return <main className="card-host">{content}{feedback && <div className="inline-feedback info"><b>{"i"}</b><span>{feedback}</span></div>}</main>;
}

function HelpdeskConnected({ componentId, view, searchParams }: { componentId: ComponentId; view: string; searchParams: URLSearchParams }) {
  const previewMode = false;
  const [toolInput, setToolInput] = useState<DataMap | null>(null);
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [hostContext, setHostContext] = useState<DataMap | null>(null);
  const [locale, setLocale] = useState<Locale>(searchParams.get("locale") === "en-US" ? "en-US" : "zh-CN");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);
  const contextCache = useRef("");

  const updateHostContext = (appInstance: McpApp) => {
    const next = appInstance.getHostContext() as DataMap | null;
    const serialized = JSON.stringify(next ?? null);
    if (serialized !== contextCache.current) { contextCache.current = serialized; setHostContext(next); }
  };

  const { app, isConnected } = useApp({
    appInfo: { name: `Helpdesk-${componentId}-${view}`, version: "2.1.0" },
    capabilities: { tools: { listChanged: true } },
    onAppCreated: (appInstance: McpApp) => {
      appInstance.ontoolinput = (params) => setToolInput((params.arguments ?? {}) as DataMap);
      appInstance.ontoolinputpartial = (params) => setToolInput((params.arguments ?? {}) as DataMap);
      appInstance.ontoolresult = (params) => setToolResult(params);
      appInstance.ontoolcancelled = (params) => setFeedback({ tone: "error", message: params.reason ?? l(locale, "操作已取消", "Action cancelled") });
      appInstance.onhostcontextchanged = () => updateHostContext(appInstance);
    }
  });

  useEffect(() => { if (app && isConnected) updateHostContext(app); }, [app, isConnected]);
  const requestBody = useMemo(() => {
    const raw = toolInput?.requestBody;
    return (raw && typeof raw === "object" ? raw : toolInput ?? {}) as DataMap;
  }, [toolInput]);
  const inputData = useMemo(() => (requestBody.data && typeof requestBody.data === "object" ? requestBody.data : requestBody) as DataMap, [requestBody]);
  const hasBusinessData = toolInput !== null && Object.keys(inputData).some((key) => key !== "locale");

  useEffect(() => {
    if (requestBody.locale === "en-US" || requestBody.locale === "zh-CN") setLocale(requestBody.locale);
  }, [requestBody]);

  const emit: Emit = async (action, payload) => {
    setPending(true);
    setFeedback(null);
    try {
      const toolName = actionTools[action];
      if (previewMode) {
        setFeedback({ tone: "info", message: l(locale, "预览模式：已记录交互，但未调用后台 Tool", "Preview mode: interaction recorded; no backend tool was called") });
        return false;
      }
      if (!app || !isConnected) throw new Error(l(locale, "尚未连接灵基宿主，操作未执行", "The Lingee host is not connected; no action was executed"));

      let result: unknown = null;
      if (toolName) {
        result = await app.callServerTool({ name: toolName, arguments: payload });
        const failure = toolFailure(result);
        if (failure) throw new Error(failure);
        if (mutatingActions.has(action) && !toolSuccessConfirmed(result)) {
          throw new Error(l(locale, "后台 Tool 未返回明确成功状态，操作不视为完成", "The backend tool did not return explicit success; the action is not considered complete"));
        }
      }

      const responseBody = { action, view, payload, success: true, component: componentId, toolResult: result, timestamp: new Date().toISOString() };
      await app.sendMessage({ role: "user", content: [{ type: "text", text: `[HelpDesk Card Action]\n${JSON.stringify({ responseBody })}` }] });
      setToolResult(result);
      setFeedback({ tone: "success", message: toolName ? l(locale, "后台操作已完成，智能体将继续处理", "Backend action completed; the agent will continue") : l(locale, "已通知智能体继续处理", "The agent was notified to continue") });
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setFeedback({ tone: "error", message: l(locale, `操作未完成：${message}`, `Action not completed: ${message}`) });
      return false;
    } finally {
      setPending(false);
    }
  };

  const props = { view, locale, data: inputData, emit, previewMode };
  const contentKey = JSON.stringify({ view, inputData });
  const content = !previewMode && !hasBusinessData
    ? <Card><CardHeader icon="…" title={l(locale, "等待业务数据", "Waiting for business data")} subtitle={l(locale, "生产模式不会使用固定演示数据回退", "Production mode does not fall back to fixed demo data")} /><EmptyState locale={locale} /></Card>
    : componentId === "agent" ? <AgentCard key={contentKey} {...props} /> : componentId === "manager" ? <ManagerCard key={contentKey} {...props} /> : componentId === "approval" ? <ApprovalCard key={contentKey} {...props} /> : componentId === "knowledge" ? <KnowledgeCard key={contentKey} {...props} /> : <EmployeeCard key={contentKey} {...props} />;
  const dark = hostContext?.theme === "dark";

  return <main className={cx("card-host", dark && "theme-dark")} aria-busy={pending}>
    {false && <DemoBanner locale={locale} />}
    {content}
    {pending && <div className="pending" role="status" aria-live="polite"><span aria-hidden="true" /><b>{l(locale, "正在处理…", "Processing…")}</b></div>}
    {feedback && <div className={cx("inline-feedback", feedback.tone)} role={feedback.tone === "error" ? "alert" : "status"} aria-live={feedback.tone === "error" ? "assertive" : "polite"}><b aria-hidden="true">{feedback.tone === "success" ? "✓" : feedback.tone === "info" ? "i" : "!"}</b><span>{feedback.message}</span></div>}
    {toolResult != null && <span className="sr-only" aria-live="polite">{l(locale, "已收到工具结果", "Tool result received")}</span>}
  </main>;
}
