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

function createEntrySchema(definition) {
  return JSON.stringify({
    type: "object",
    properties: {
      requestBody: {
        type: "object",
        description: `${definition.appName}输入参数；该入口固定展示此单张卡片`,
        properties: {
          locale: { type: "string", enum: ["zh-CN", "en-US"], description: "界面语言" },
          data: { type: "object", description: `${definition.support}所需的当前业务数据` }
        },
        required: ["locale"]
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
          payload: { type: "object", description: "当前卡片收集或确认的业务数据" },
          success: { type: "boolean" }
        },
        required: ["action", "payload", "success"]
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
    version: "2.0.0",
    dependsOnApp: { appCode: "", writeArtifactTool: "" },
    relateTools: definition.tools.map((name) => ({ name, writeArtifact: "false" })),
    entryTool: { virtual: { inputSchema: createEntrySchema(definition), outputSchema: createOutputSchema() } }
  };
}

export default componentDefinitions;
