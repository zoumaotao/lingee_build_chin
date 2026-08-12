function card(group, view, appName, description, support, tools = []) {
  return {
    group,
    view,
    id: `${group}/${view}`,
    appCode: `zcy_kingdee_helpdesk_${group}_${view.replaceAll("-", "_")}`,
    appName,
    description,
    support,
    notSupport: "完整后台页面、批量操作及当前卡片之外的业务流程",
    tools
  };
}

const componentDefinitions = [
  card("employee", "resolution", "HelpDesk解决方案确认卡", "在 Agent 对话中展示知识解决方案并收集是否解决的反馈", "知识答案展示与解决结果确认"),
  card("employee", "ticket-draft", "HelpDesk工单确认卡", "在 Agent 对话中展示 AI 生成的工单草稿并收集提交确认", "工单信息核对与确认提交", ["Create_Ticket"]),
  card("employee", "ticket-receipt", "HelpDesk工单回执卡", "在 Agent 对话中展示工单创建成功或失败结果", "工单提交结果与进度入口", ["Get_Ticket_Detail"]),
  card("employee", "ticket-list", "HelpDesk我的工单摘要卡", "在 Agent 对话中展示最近更新的个人工单摘要", "个人工单摘要查询", ["List_My_Tickets", "Get_Ticket_Detail"]),
  card("employee", "ticket-detail", "HelpDesk员工工单进度卡", "在 Agent 对话中展示单个工单的处理进度并收集解决确认", "工单进度展示与关闭确认", ["Close_Ticket"]),
  card("employee", "rating", "HelpDesk服务评价卡", "在 Agent 对话中收集用户对已完成工单的服务评价", "服务评分与评价提交", ["Rate_Ticket"]),
  card("employee", "attachments", "HelpDesk附件确认卡", "在 Agent 对话中展示并确认随工单提交的附件", "工单附件选择与上传确认", ["Upload_Ticket_Attachment"]),

  card("agent", "notification", "HelpDesk新单通知卡", "在 Agent 对话中向处理人展示新分配工单并收集接单或转派意图", "新单摘要、接单与转派入口", ["Get_Ticket_Detail", "Reassign_Ticket"]),
  card("agent", "queue", "HelpDesk处理人待办卡", "在 Agent 对话中展示处理人按 SLA 排序的待办摘要", "处理人待办摘要", ["Get_Ticket_Detail"]),
  card("agent", "ticket-detail", "HelpDesk处理人工单详情卡", "在 Agent 对话中展示待处理工单详情及下一步处理入口", "处理人工单详情与答复、转派入口", ["Reassign_Ticket"]),
  card("agent", "reply", "HelpDesk答复确认卡", "在 Agent 对话中编辑并确认发送给提单人的处理答复", "处理答复编辑与发送", ["Reply_Ticket"]),
  card("agent", "reassign", "HelpDesk处理人转派卡", "在 Agent 对话中确认目标工作组、处理人与转派原因", "处理人工单转派", ["Reassign_Ticket"]),
  card("agent", "sla-alert", "HelpDesk处理人SLA告警卡", "在 Agent 对话中展示临期和超时工单摘要", "处理人 SLA 风险提醒", ["Get_Ticket_Detail"]),

  card("manager", "dashboard", "HelpDesk经理运营摘要卡", "在 Agent 对话中展示团队关键指标与风险提示", "团队 KPI 与风险摘要", ["Get_Helpdesk_Metrics"]),
  card("manager", "team-tickets", "HelpDesk团队风险工单卡", "在 Agent 对话中展示需要经理关注的团队工单摘要", "团队风险工单摘要", ["List_Team_Tickets", "Get_Ticket_Detail"]),
  card("manager", "workload", "HelpDesk团队负载建议卡", "在 Agent 对话中展示成员负载并提供调配建议", "团队工作负载与人员选择"),
  card("manager", "sla", "HelpDesk团队SLA摘要卡", "在 Agent 对话中展示团队 SLA 指标和风险分类", "团队 SLA 摘要", ["Get_Helpdesk_Metrics"]),
  card("manager", "reassign", "HelpDesk经理快速转派卡", "在 Agent 对话中由经理确认工单转派", "经理工单转派确认", ["Reassign_Ticket"]),

  card("approval", "approval-list", "HelpDesk审批待办卡", "在 Agent 对话中展示当前用户的审批待办摘要", "审批待办摘要与详情入口", ["Get_Approval_Detail"]),
  card("approval", "approval-detail", "HelpDesk审批申请详情卡", "在 Agent 对话中展示单个申请的审批信息与风险", "审批申请详情与决策入口"),
  card("approval", "decision", "HelpDesk审批决策卡", "在 Agent 对话中收集审批意见并执行同意或驳回", "审批决策确认", ["Approve_Ticket_Request", "Reject_Ticket_Request"]),
  card("approval", "timeline", "HelpDesk审批轨迹卡", "在 Agent 对话中展示申请的审批审计轨迹", "审批流程与审计轨迹展示"),

  card("knowledge", "knowledge-draft", "HelpDesk知识草稿确认卡", "在 Agent 对话中编辑并确认由工单生成的知识草稿", "知识草稿编辑与提交", ["Create_Knowledge_Draft"]),
  card("knowledge", "source-ticket", "HelpDesk知识来源工单卡", "在 Agent 对话中展示适合沉淀知识的来源工单摘要", "知识来源工单核对与草稿生成", ["Create_Knowledge_Draft"]),
  card("knowledge", "review", "HelpDesk知识发布审核卡", "在 Agent 对话中执行知识质量、冲突检查和发布确认", "知识质量审核与发布", ["Check_Knowledge_Conflict", "Publish_Knowledge"]),
  card("knowledge", "publish-result", "HelpDesk知识发布结果卡", "在 Agent 对话中展示知识发布成功结果", "知识发布结果反馈")
];

const stringField = (description) => ({ type: "string", description });
const numberField = (description) => ({ type: "number", description });
const booleanField = (description) => ({ type: "boolean", description });
const metricField = (description) => ({ oneOf: [{ type: "number" }, { type: "string" }], description });
const memberSchema = { type: "object", properties: { id: stringField("成员稳定标识"), assigneeId: stringField("处理人标识（兼容字段）"), name: stringField("成员姓名"), role: stringField("角色或技能组"), active: numberField("处理中数量"), overdue: numberField("超时数量"), capacity: numberField("负载百分比"), color: stringField("头像颜色") }, required: ["id", "name"] };
const optionSchema = { type: "object", properties: { id: stringField("稳定标识"), code: stringField("编码"), name: stringField("展示名称"), label: stringField("展示名称（兼容字段）") } };
const metricsSchema = { type: "object", properties: { ticketCount: metricField("工单量"), ticketTrend: metricField("工单趋势"), slaMet: metricField("SLA 达标率"), slaTrend: metricField("SLA 趋势"), resolved: metricField("已解决数量"), resolutionRate: metricField("解决率"), rating: metricField("满意度"), ratingTrend: metricField("满意度趋势"), responseSla: metricField("响应 SLA"), resolutionSla: metricField("解决 SLA") }, additionalProperties: false };
const ticketSchema = {
  type: "object",
  properties: {
    id: stringField("工单编号"), ticketId: stringField("工单编号（兼容字段）"), title: stringField("工单标题"), titleZh: stringField("中文标题"), titleEn: stringField("英文标题"),
    category: stringField("分类"), status: stringField("状态"), statusZh: stringField("中文状态"), statusEn: stringField("英文状态"), priority: stringField("优先级"),
    assignee: stringField("处理人"), team: stringField("处理团队"), due: stringField("SLA 剩余时间"), sla: numberField("SLA 风险百分比")
  }
};
const attachmentSchema = { type: "object", properties: { id: stringField("附件标识"), name: stringField("文件名"), size: stringField("展示大小"), type: stringField("文件类型"), selected: booleanField("是否选中") }, required: ["name"] };

function createDataSchema(definition) {
  const common = { ticketId: stringField("当前工单编号"), ticket: ticketSchema, tickets: { type: "array", items: ticketSchema }, status: stringField("后台业务状态") };
  const schemas = {
    "employee/resolution": { properties: { solutionTitle: stringField("解决方案标题"), solutionSteps: { type: "array", items: { type: "string" } }, source: stringField("知识来源"), knowledgeId: stringField("知识编号") }, required: ["solutionTitle", "solutionSteps", "source"] },
    "employee/ticket-draft": { properties: { requesterName: stringField("提单人姓名"), requesterEmail: stringField("提单人邮箱"), title: stringField("工单标题"), category: stringField("分类"), priority: stringField("优先级"), description: stringField("问题描述"), attachments: { type: "array", items: attachmentSchema } }, required: ["title", "category", "priority", "description"] },
    "employee/ticket-receipt": { properties: { ticketId: stringField("后台返回的工单编号"), status: { type: "string", enum: ["success", "created", "pending", "processing", "failed", "error", "unknown"] }, assignedTeam: stringField("处理团队"), errorMessage: stringField("失败原因") }, required: ["status"], allOf: [{ if: { properties: { status: { enum: ["success", "created"] } }, required: ["status"] }, then: { required: ["ticketId"] } }] },
    "employee/ticket-list": { properties: { tickets: { type: "array", items: ticketSchema } }, required: ["tickets"] },
    "employee/ticket-detail": { properties: { ticket: ticketSchema, latestReply: stringField("最新回复"), latestReplyAuthor: stringField("回复人"), latestReplyTime: stringField("回复时间"), timeline: { type: "array", items: { type: "object" } } }, required: ["ticket"] },
    "employee/rating": { properties: { ticketId: stringField("已完成工单编号"), assignee: stringField("服务处理人") }, required: ["ticketId"] },
    "employee/attachments": { properties: { ticketId: stringField("目标工单编号"), attachments: { type: "array", items: attachmentSchema } }, required: ["ticketId", "attachments"] },
    "agent/notification": { properties: { ticket: ticketSchema, requester: stringField("提单人"), description: stringField("问题摘要") }, required: ["ticket"] },
    "agent/queue": { properties: { tickets: { type: "array", items: ticketSchema }, resolvedToday: numberField("今日已解决数量") }, required: ["tickets"] },
    "agent/ticket-detail": { properties: { ticket: ticketSchema, requester: stringField("提单人"), description: stringField("问题描述"), attachments: { type: "array", items: attachmentSchema }, timeline: { type: "array", items: { type: "object" } } }, required: ["ticket"] },
    "agent/reply": { properties: { ticket: ticketSchema, reply: stringField("建议回复内容"), internalNote: stringField("内部备注") }, required: ["ticket"] },
    "agent/reassign": { properties: { ticket: ticketSchema, teams: { type: "array", items: { oneOf: [{ type: "string" }, optionSchema] } }, assignees: { type: "array", items: { oneOf: [{ type: "string" }, optionSchema] } }, teamId: stringField("默认目标组稳定标识"), assigneeId: stringField("默认处理人稳定标识") }, required: ["ticket", "teams", "assignees"] },
    "agent/sla-alert": { properties: { tickets: { type: "array", items: ticketSchema } }, required: ["tickets"] },
    "manager/dashboard": { properties: { teamName: stringField("团队名称"), period: stringField("统计周期"), metrics: metricsSchema, riskCategory: stringField("风险分类"), riskSummary: stringField("风险摘要") }, required: ["metrics", "period"] },
    "manager/team-tickets": { properties: { tickets: { type: "array", items: ticketSchema } }, required: ["tickets"] },
    "manager/workload": { properties: { members: { type: "array", items: memberSchema }, recommendedAssigneeId: stringField("推荐处理人稳定标识"), confidence: numberField("推荐置信度 0-100"), recommendationReason: stringField("推荐依据") }, required: ["members"] },
    "manager/sla": { properties: { metrics: metricsSchema, categories: { type: "array", items: { type: "object", properties: { name: stringField("分类名称"), value: numberField("达标率"), tone: { type: "string", enum: ["success", "warning", "danger"] } }, required: ["name", "value"] } }, summary: stringField("SLA 摘要") }, required: ["metrics", "categories"] },
    "manager/reassign": { properties: { tickets: { type: "array", items: ticketSchema }, members: { type: "array", items: memberSchema }, ticketId: stringField("默认工单"), assigneeId: stringField("默认处理人稳定标识") }, required: ["tickets", "members"] },
    "approval/approval-list": { properties: { approvals: { type: "array", items: { type: "object" } } }, required: ["approvals"] },
    "approval/approval-detail": { properties: { approval: { type: "object" }, description: stringField("申请说明"), timeLeft: stringField("审批剩余时间"), timeline: { type: "array", items: { type: "object" } } }, required: ["approval"] },
    "approval/decision": { properties: { approval: { type: "object" }, checks: { type: "object", properties: { policy: booleanField("政策符合性"), businessNeed: booleanField("业务必要性"), requiresL2: booleanField("是否需要 L2") } } }, required: ["approval"] },
    "approval/timeline": { properties: { approval: { type: "object" }, timeline: { type: "array", items: { type: "object" } } }, required: ["approval", "timeline"] },
    "knowledge/knowledge-draft": { properties: { sourceTicket: stringField("来源工单"), title: stringField("知识标题"), answer: stringField("标准处理方法"), tags: stringField("知识标签"), piiRemoved: booleanField("脱敏检查是否通过") }, required: ["sourceTicket", "title", "answer", "piiRemoved"] },
    "knowledge/source-ticket": { properties: { sourceTicket: stringField("来源工单"), summary: stringField("来源摘要"), steps: { type: "array", items: { type: "string" } }, rating: numberField("来源服务评分"), similarTickets30d: numberField("近 30 天相似工单数"), estimatedDeflection: stringField("预计分流量") }, required: ["sourceTicket", "summary", "steps"] },
    "knowledge/review": { properties: { sourceTicket: stringField("来源工单"), qualityScore: numberField("质量评分 0-100"), similarity: numberField("相似度 0-100"), checks: { type: "object" }, conflictSuggestion: stringField("冲突处理建议"), publishMode: stringField("发布模式") }, required: ["sourceTicket", "qualityScore", "checks"] },
    "knowledge/publish-result": { properties: { sourceTicket: stringField("来源工单"), status: { type: "string", enum: ["success", "published", "failed", "unknown"] }, knowledgeId: stringField("知识编号"), version: stringField("知识版本"), audience: stringField("可见范围") }, required: ["status"], allOf: [{ if: { properties: { status: { enum: ["success", "published"] } }, required: ["status"] }, then: { required: ["knowledgeId"] } }] }
  };
  const selected = schemas[definition.id] ?? { properties: common };
  return { ...selected, type: "object", description: `${definition.support}所需的当前业务数据；生产环境不使用演示回退`, properties: { ...common, ...(selected.properties ?? {}) }, required: selected.required ?? [], additionalProperties: true };
}

function createEntrySchema(definition) {
  return JSON.stringify({
    type: "object",
    properties: {
      requestBody: {
        type: "object",
        description: `${definition.appName}输入参数；该入口固定展示此单张卡片`,
        properties: {
          locale: { type: "string", enum: ["zh-CN", "en-US"], description: "界面语言" },
          data: createDataSchema(definition)
        },
        required: ["locale", "data"]
      }
    },
    required: ["requestBody"]
  });
}

function createOutputSchema() {
  return JSON.stringify({
    type: "object",
    properties: {
      responseBody: {
        type: "object",
        description: "用户完成当前卡片操作后回传给 Agent 的结构化结果",
        properties: {
          action: { type: "string", description: "用户在当前卡片执行的动作" },
          view: { type: "string", description: "构建期固定的卡片视图" },
          component: { type: "string", description: "卡片角色分组" },
          payload: { type: "object", description: "当前卡片收集或确认的业务数据" },
          success: { type: "boolean", description: "Tool 或 Agent 消息是否完成；预览动作不返回成功" },
          toolResult: { description: "后台 Tool 原始结果；无 Tool 动作为空" },
          timestamp: { type: "string", format: "date-time", description: "动作完成时间" }
        },
        required: ["action", "view", "component", "payload", "success", "timestamp"]
      }
    },
    required: ["responseBody"]
  });
}

export function createInfo(definition) {
  return {
    cloud: "zcy",
    domain: "kingdee",
    appCode: definition.appCode,
    appName: definition.appName,
    description: definition.description,
    capabilityDescription: { support: definition.support, notSupport: definition.notSupport },
    mcpConnector: { type: "XK", code: "feature_vb_test" },
    runMode: "message",
    version: "2.1.0",
    dependsOnApp: { appCode: "", writeArtifactTool: "" },
    relateTools: definition.tools.map((name) => ({ name, writeArtifact: "false" })),
    entryTool: { virtual: { inputSchema: createEntrySchema(definition), outputSchema: createOutputSchema() } }
  };
}

export default componentDefinitions;
