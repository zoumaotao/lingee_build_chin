const priorityCatalog = {
  P0: { label: "核心闭环", description: "当前上线闭环所需" },
  P1: { label: "二期增强", description: "已有需求，依赖后续平台或业务能力" },
  P2: { label: "待确认", description: "方案扩展，需客户或平台进一步确认" }
};

const componentPriorities = {
  "employee/resolution": "P0",
  "employee/ticket-draft": "P0",
  "employee/ticket-list": "P0",
  "employee/ticket-detail": "P0",
  "agent/notification": "P1",
  "agent/queue": "P0",
  "agent/ticket-detail": "P0",
  "agent/sla-alert": "P1",
  "knowledge/publish-result": "P2"
};

function card(group, view, appName, description, support, tools = []) {
  const id = `${group}/${view}`;
  const priorityCode = componentPriorities[id];
  if (!priorityCode) throw new Error(`Missing priority for ${id}`);
  return {
    group,
    view,
    id,
    priority: { code: priorityCode, ...priorityCatalog[priorityCode] },
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
  card("employee", "ticket-list", "HelpDesk我的工单列表卡", "在 Agent 对话中展示员工的工单列表", "员工工单列表查询", ["List_My_Tickets", "Get_Ticket_Detail"]),
  card("employee", "ticket-detail", "HelpDesk员工工单进度卡", "在 Agent 对话中展示单个工单的处理进度并收集解决确认", "工单进度展示与关闭确认", ["Close_Ticket"]),

  card("agent", "notification", "HelpDesk新单通知卡", "在 Agent 对话中向处理人展示新分配工单并收集接单或转派意图", "新单摘要、接单与转派入口", ["Get_Ticket_Detail", "Reassign_Ticket"]),
  card("agent", "queue", "HelpDesk处理人工单列表", "在 Agent 对话中展示处理人的工单列表", "处理人工单列表查询", ["Get_Ticket_Detail"]),
  card("agent", "ticket-detail", "HelpDesk处理人工单详情卡", "在 Agent 对话中展示待处理工单详情及下一步处理入口", "处理人工单详情与答复、转派入口", ["Reassign_Ticket"]),
  card("agent", "sla-alert", "HelpDesk处理人SLA告警卡", "在 Agent 对话中展示临期和超时工单摘要", "处理人 SLA 风险提醒", ["Get_Ticket_Detail"]),



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
    "employee/ticket-list": { properties: { tickets: { type: "array", items: ticketSchema } }, required: ["tickets"] },
    "employee/ticket-detail": { properties: { ticket: ticketSchema, latestReply: stringField("最新回复"), latestReplyAuthor: stringField("回复人"), latestReplyTime: stringField("回复时间"), timeline: { type: "array", items: { type: "object" } } }, required: ["ticket"] },
    "agent/notification": { properties: { ticket: ticketSchema, requester: stringField("提单人"), description: stringField("问题摘要") }, required: ["ticket"] },
    "agent/queue": { properties: { tickets: { type: "array", items: ticketSchema }, resolvedToday: numberField("今日已解决数量") }, required: ["tickets"] },
    "agent/ticket-detail": { properties: { ticket: ticketSchema, requester: stringField("提单人"), description: stringField("问题描述"), attachments: { type: "array", items: attachmentSchema }, timeline: { type: "array", items: { type: "object" } } }, required: ["ticket"] },
    "agent/sla-alert": { properties: { tickets: { type: "array", items: ticketSchema } }, required: ["tickets"] },
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
