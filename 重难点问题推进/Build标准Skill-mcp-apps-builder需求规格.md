# Build 标准 Skill：mcp-apps-builder 需求规格

> 中文名：业务组件  
> 英文展示名：MCP Apps  
> Skill Code：`mcp-apps-builder`  
> 文档状态：研发评审稿  
> 适用范围：Build 板块对话式创建、预览、构建和提交 MCP App

## 1. 产品定位

`mcp-apps-builder` 是 Build 板块的标准编排 Skill，与“智能体开发、技能开发、应用开发”同级。它通过一个连续、有状态的对话完成 MCP App 的需求澄清、代码编写、编译预览和可选构建打包，并将项目状态持续投射到业务组件结果卡和详情面板。

该 Skill 不是一次性代码生成提示词，也不拆分成多个用户可见 Skill。用户始终面对一个“业务组件”能力；内部可调用代码生成、校验、预览进程、构建、Console 检查和提交服务。

### 1.1 核心目标

1. 降低 MCP App 从业务描述到可预览组件的开发门槛。
2. 将 `info.json`、关联 Tool、构建产物和提交门禁标准化。
3. 任何失败都可定位、可恢复，不以“生成完成”替代真实校验。
4. 阶段 1、2、3 每次构建必做；阶段 4 仅在用户明确选择时执行。
5. 不伪造 Tool、Console、权限、上传或发布结果。

### 1.2 非目标

- 不替代 MCP Tool、MCP Connector、权限和数据服务本身的开发。
- 不自动授予 Tool 权限或绕过 Console 校验。
- 不自动提交生产；提交必须由用户点击并确认。
- 不把 `SKILL.md` 强制放入 MCP App 上传包。
- 不保证业务后台写操作成功；成功状态必须来自对应服务。

## 2. 名词与对象模型

| 对象 | 含义 |
|---|---|
| Project | 一次 MCP App 开发工程，可包含源代码和多个草稿修订 |
| `draftRevision` | 每轮澄清或代码修改形成的草稿修订号 |
| Preview | 指定修订对应的本地预览服务和访问 URL |
| Build | 对指定修订执行的可复现构建记录 |
| Artifact | 构建后可上传的 ZIP 及其摘要 |
| SandboxDeployment | 用户发起的沙箱上传记录；与生产 Submission 独立，不进入生产审核 |
| Submission | 用户发起的生产 Console 提交记录 |
| Local Check | Build 本地执行的 `info.json`、目录、资源、Schema 等检查 |
| Console Check | Console 返回的 Connector/Tool 存在性、权限或提交前检查 |

建议核心标识：

```text
projectId + draftRevision + buildId + sandboxDeploymentId + submissionId
```

所有异步命令必须携带 `projectId` 和目标 `draftRevision`，防止多项目、多窗口或旧请求覆盖新结果。沙箱上传结果还必须校验 `buildId + artifactSha256 + sandboxDeploymentId`；生产提交结果必须校验 `submissionId`，两类结果不可互相覆盖或混用。

## 3. 总体流程与状态机

### 3.1 四阶段

| 阶段 | 必做性 | 目标 | 完成状态 |
|---|---:|---|---|
| 1. 需求澄清 | 必做 | 得到完整、无关键歧义的组件规格 | `SPEC_READY` |
| 2. 代码编写 | 必做 | 生成/修改源码和 `info.json`，通过本地静态检查 | `STATIC_VALIDATED` |
| 3. 编译预览 | 必做 | 启动可访问预览，完成 smoke check | `VERIFIED` |
| 4. 构建打包 | 用户选择 | 生成可上传 ZIP、摘要和更新日志 | `PACKAGED` |

阶段 3 的“编译”是面向预览修订的编译与 smoke check；阶段 4 是面向提交的可复现 release build、目录净化、ZIP 和哈希生成。两者不能合并为一个模糊的“构建成功”。

用户跳过阶段 4 时，项目停留在 `VERIFIED_DRAFT`，仍可继续修改和预览，但不能提交。

### 3.2 主状态机

```text
CLARIFYING
  -> SPEC_READY
  -> GENERATING
  -> GENERATED
  -> STATIC_VALIDATED
  -> PREVIEW_STARTING
  -> PREVIEW_READY
  -> VERIFIED

VERIFIED -> VERIFIED_DRAFT                           （用户暂不打包）
VERIFIED | VERIFIED_DRAFT -> PACKAGING -> PACKAGED  （用户选择打包，或显式点击“测试”触发打包）
PACKAGED -> SANDBOX_UPLOADING                        （用户点击“测试”）
  -> SANDBOX_READY | SANDBOX_UPLOAD_FAILED
PACKAGED -> READY_TO_SUBMIT                         （生产提交门禁通过）
READY_TO_SUBMIT -> SUBMITTING
  -> PENDING_REVIEW | PUBLISHED | SUBMIT_FAILED
```

`PACKAGED` 仅表示制品已生成，不表示已上传沙箱或可以提交生产。“测试”是用户显式选择阶段 4 的入口：当前合格修订尚未打包或产物已过期时，点击后先执行构建打包，再上传沙箱；不得在无用户动作时后台打包上传。沙箱上传与生产提交为两个独立动作，进入 `SANDBOX_READY` 不会进入生产审核，也不代表 Skill 已制作或端到端测试通过。

每次进入详情或准备提交生产时执行生产门禁：全部通过才进入 `READY_TO_SUBMIT`；任何门禁失败或检查结果过期都回到 `PACKAGED`，并在“检查”Tab 展示原因。

异常状态：

- `BLOCKED_LOCAL`：本地环境、依赖或文件系统阻断。
- `FAILED_RECOVERABLE`：生成、编译、预览或构建失败，可修复后从当前阶段重试。
- `CANCELLED`：用户主动取消当前操作。
- `STALE`：当前结果对应旧 `draftRevision`，不可提交。

### 3.3 回退规则

1. 需求字段变化：回到 `CLARIFYING` 或 `SPEC_READY`，使旧 Preview/Build 标记为 `STALE`。
2. 源代码变化：回到 `GENERATED`，必须重新静态检查和阶段 3。
3. 仅预览进程退出：代码状态不回退，Preview Manager 可直接重启。
4. `info.json` 或关联 Tool 变化：必须重新本地检查；若已打包，旧 Artifact 标记为 `STALE`。
5. Console Tool 不存在：不得清空全部上下文，只插入局部澄清并回到关联 Tool 字段。
6. 提交失败：保留 `PACKAGED` Artifact，状态回到 `PACKAGED`；重新执行或刷新门禁，通过后再进入 `READY_TO_SUBMIT`，不自动重新生成代码。

## 4. 阶段 1：需求澄清

### 4.1 必填信息

| 字段 | 说明 | 建议交互 |
|---|---|---|
| 名称 | 业务组件名称 | 模型建议，可编辑 |
| 描述 | 10–15 个汉字；英文按等价简短语义 | 模型生成，可编辑 |
| `appCode` | 全局业务组件编码 | Build 自动生成，首次构建前可在高级设置调整 |
| `mcpConnector.code` | 组件依赖的 Connector | 搜索/推荐 + 手工输入 |
| Tool 用途清单 | 每个 Tool 对应的业务目的 | 模型先提炼用途 |
| `relateTools[].name` | 每个用途绑定的 Tool 编码 | 每个用途逐项选择 |
| `supportedLocales` | 支持的界面语言集合 | 中文、英文，可多选 |
| `defaultLocale` | 默认界面语言 | 从支持语言中单选 |
| 运行模式 | 第一版默认 `message` | 默认值，不主动澄清 |
| 写产物 | 第一版默认不写 | 默认值，不主动澄清 |
| 组件输入/输出 | UI 所需字段和交互结果 | 模型根据业务补充确认 |
| 高风险操作 | 审批、发布、删除、权限、资金等 | 必须识别并增加确认门禁 |


### 4.2 appCode 自动生成与确认

Build 默认生成以下编码，不要求用户自由命名：

```text
appCode = {tenantCode}_{projectCode}_{componentCode}
```

与现行 `info.json` 字段的建议映射为：

```text
cloud      = tenantCode
domain     = projectCode
自定义编码 = componentCode
```

> 上述映射是 Build 产品侧命名策略。现行手册仍将 `cloud` 定义为云环境标识、`domain` 定义为业务域标识；正式落地前必须由 Console/平台确认允许按租户和工程映射。未确认时由版本化 Schema 适配器使用平台正式取值，不得擅自改变字段语义。

生成规则：

1. `tenantCode`：直接读取当前租户唯一编码，不让用户填写；保持跨工程稳定，最长 15 字符。
2. `projectCode`：工程创建时根据工程名生成。中文默认转小写拼音全拼；整体超长时再使用可识别简拼。
3. `componentCode`：根据组件业务名称生成可读编码，优先使用稳定英文语义或拼音，例如 `ticket_confirm`。
4. 仅允许字母、数字和下划线；统一小写、移除声调，空格和连字符归一化为下划线。
5. 优先保证 `tenantCode` 和 `projectCode` 稳定；超过 50 字符时先缩短 `projectCode`，再压缩 `componentCode`。
6. 编码冲突时追加稳定短序号或短摘要，例如 `_02`、`_a3f2`，不默认使用不可读随机长串。
7. 系统必须在确认前展示完整 `appCode`。用户只能在首次构建前通过“高级设置”调整 `projectCode` 或 `componentCode`。
8. 首次成功构建后锁定 `tenantCode`、`projectCode` 和 `appCode`；工程展示名称变化不自动改编码。
9. 确需改码时创建显式修订，并使旧 Preview、Build、Artifact 和 Submission 失效，不允许静默改名。

本地校验：

- 保持现行格式 `{cloud}_{domain}_{自定义编码}`，整体最长 50 字符。
- 自定义编码至少 5 字符，只允许字母、数字和下划线。
- `cloud` 只允许字母、数字组合，最长 15 字符。
- 全局唯一性由 Console 最终校验；Console 不可用时不得显示“唯一性已通过”。

### 4.3 Connector 与 Tool 澄清

先说明数量和用途：

> 你需要确定 2 个 MCP Tool，分别用于「创建工单」和「查询工单详情」。

然后每个用途独立提问：

> 请提供用于「创建工单」的 MCP Tool 编码。

- 推荐值 1：编码（名称、简短描述）。
- 推荐值 2：编码（名称、简短描述）。
- 选项 3：输入 MCP Tool 编码。

推荐数据必须来自可用 Tool 检索结果；没有检索结果时只能让用户输入或稍后配置，不能编造 Tool 名称。

### 4.4 局部澄清模型

检查失败时只回到受影响字段：

```json
{
  "issueCode": "RELATE_TOOL_NOT_FOUND",
  "scope": "relateTools[1].name",
  "currentValue": "Accept_Ticket",
  "message": "Console 中未找到该 Tool",
  "options": [
    { "type": "replace", "value": "Get_Ticket_Detail", "label": "更换为已存在 Tool" },
    { "type": "manual", "label": "输入其他 Tool 编码" },
    { "type": "remove", "label": "移除此能力并重新生成" }
  ]
}
```

局部澄清后只重跑受影响检查和后续阶段，不重复询问 appCode、语言等无关字段。

### 4.5 阶段退出条件

- 必填字段齐全。
- Tool 用途和编码一一对应，不存在未解释 Tool。
- 高风险操作已定义二次确认和服务端结果要求。
- 用户已确认需求摘要。
- 形成结构化 `McpAppSpec`，状态进入 `SPEC_READY`。

## 5. 阶段 2：代码编写与静态检查

### 5.1 生成内容

- MCP App 源码、样式、静态资源和构建配置。
- `info.json`。
- 本地预览所需脚本或配置。
- 可选开发辅助文档；不得污染上传包。

### 5.2 上传包硬性结构

MCP App ZIP 解压后的一级目录只允许包含：

```text
<artifact-root>/
├── dist/
│   ├── index.html
│   └── ...相对路径静态资源
└── info.json
```

规则：

- `dist/index.html` 必须存在。
- 资源必须使用可部署的相对路径。
- `info.json` 必须可解析并符合平台字段规范。
- 不将源码、`node_modules`、日志、`.DS_Store`、测试数据或密钥放入 ZIP。
- `SKILL.md` 可作为 Skill 开发协作文档，但不是 MCP App ZIP 必需文件，默认不打入上传包。

### 5.3 本地静态检查

至少包含：

1. `info.json` JSON 语法。
2. 必填字段、字段类型、枚举、长度和格式。
3. `appCode` 与工程记录一致。
4. `mcpConnector.code` 非空。
5. `relateTools` 去重，Tool 名称非空。
6. `entryTool.virtual.inputSchema/outputSchema` 是合法 JSON Schema 字符串。
7. `dist/index.html` 和所有相对资源存在。
8. 禁止绝对本地路径、密钥、Token 和调试服务地址。
9. 上传包一级目录白名单。
10. 交互动作不能把“未调用 Tool”解释成后台成功。

检查结果统一结构：

```json
{
  "checkId": "INFO_REQUIRED_FIELD",
  "source": "local",
  "severity": "error",
  "status": "failed",
  "file": "info.json",
  "path": "relateTools[0].name",
  "message": "Tool 编码不能为空",
  "fixable": true
}
```

### 5.4 自动修复边界

可自动修复：格式化、缺失的非业务默认值、资源相对路径、重复字段、可确定的 Schema 语法。

必须澄清：appCode、Connector、Tool 替换、权限、高风险行为、业务字段含义、是否删除能力。

### 5.5 阶段退出条件

- 代码生成成功。
- 类型检查/编译前检查通过。
- 本地 `error` 级问题为 0。
- 形成 `STATIC_VALIDATED` 修订。

## 6. 阶段 3：编译预览

### 6.1 结果卡

每个 MCP App 项目生成一张结果卡：

- 背景图：平台默认背景或模型从受控素材库选择；不得远程引用不可信图片。
- 名称。
- 10–15 字描述。
- 当前状态：生成中、可预览、预览中、检查失败、已打包等。
- 四个操作入口：**启动预览**、**停止预览**、**测试**、**详情**。启动和停止可根据状态互斥展示，但协议中是两个独立 action。
- “测试”表示将当前合格 MCP App 制品上传到沙箱，不表示直接运行完整测试，也不自动打开或跳转沙箱 Work。
- 打包后重新推送更新后的同一项目卡，而不是创建无法关联的新卡。

建议卡片协议：

```json
{
  "type": "mcp_app_project_card",
  "projectId": "prj_xxx",
  "draftRevision": 12,
  "name": "HelpDesk 工单确认卡",
  "description": "核对并提交智能工单",
  "cover": { "type": "asset", "assetId": "mcp-app-default-01" },
  "status": "PREVIEW_READY",
  "preview": {
    "status": "HEALTHY",
    "url": "https://preview.example/p/prj_xxx/r/12/",
    "startedAt": "2026-08-11T10:00:00Z"
  },
  "artifact": null,
  "sandboxDeployment": null,
  "actions": [
    { "id": "start_preview", "label": "启动预览", "enabled": true },
    { "id": "stop_preview", "label": "停止预览", "enabled": false },
    { "id": "test_sandbox", "label": "测试", "enabled": true },
    { "id": "open_detail", "label": "详情", "enabled": true }
  ]
}
```

### 6.2 按钮状态矩阵

| Preview 状态 | 启动预览 | 停止预览 | 详情 |
|---|---|---|---|
| 无实例/`STOPPED` | 可用 | 禁用 | 可用 |
| `ALLOCATING`/`STARTING` | 禁用，显示启动中 | 可用 | 可用 |
| `HEALTHY` | 可用；行为是直接打开已有 URL | 可用 | 可用 |
| `DEGRADED` | 可用；先尝试恢复，失败则新端口 | 可用 | 可用 |
| `STOPPING` | 禁用 | 禁用，显示停止中 | 可用 |
| `STALE` | 可用；为新修订启动 | 可停止旧实例 | 可用 |

“测试”使用独立状态矩阵：

| 当前修订/沙箱状态 | 测试按钮 | 点击行为与反馈 |
|---|---|---|
| 未到 `VERIFIED` | 禁用 | 提示先完成当前修订预览与检查 |
| `VERIFIED`/`VERIFIED_DRAFT`，无有效 Artifact | 可用 | 显式触发阶段 4 构建打包，成功后继续上传 |
| `PACKAGING` | 禁用，显示“构建中” | 留在当前 Build 页面 |
| `PACKAGED` | 可用 | 进入 `SANDBOX_UPLOADING` |
| `SANDBOX_UPLOADING` | 禁用，显示“上传中” | 合并重复点击，不创建第二次上传 |
| `SANDBOX_READY`，制品哈希未变 | 可用，显示“已上传” | 可复用真实回执或执行幂等重传；仍不跳转 |
| `SANDBOX_UPLOAD_FAILED` | 可用，显示“重试” | 保留当前页面、制品和错误详情 |
| `STALE` | 禁用 | 提示重新完成检查/预览后再测试，旧制品不可上传 |

### 6.3 Preview Manager

预览端口不得硬编码为 4000 或 5173。Preview Manager 负责：

1. 以 `projectId + draftRevision` 查找存活实例。
2. 若同修订实例 `HEALTHY`，直接打开已有预览 URL，不重复拉起。
3. 若不存在或已退出，从动态端口池申请可用端口；端口冲突时自动换端口，不询问用户。
4. 对外优先暴露稳定反向代理 URL，内部端口不作为项目身份。
5. 同项目新修订启动后，旧修订标记 `STALE`，可按资源策略延迟回收。
6. 支持显式停止、空闲超时、Build 服务重启后的进程恢复/清理。
7. 仅监听受控地址；不得把本地预览无鉴权暴露到公网。

进程状态：

```text
ALLOCATING -> STARTING -> HEALTHY -> DEGRADED -> STOPPING -> STOPPED
```

建议健康检查同时验证：HTTP 可达、入口 HTML、关键静态资源和前端无致命启动错误。

### 6.4 Smoke check

- 页面可打开，无空白页。
- `dist/index.html` 和关键静态资源返回成功。
- 组件在最小支持宽度可用。
- 无未捕获启动异常。
- 演示模式必须有明确标识，且不调用生产 Tool。
- 生产模式缺数据展示空态/错误，不显示伪造回执。

### 6.5 阶段退出条件

- 至少一次成功启动当前修订预览。
- Preview 健康检查通过。
- Smoke check 通过。
- 当前修订状态为 `VERIFIED`。
- 用户未选择阶段 4 时，转为 `VERIFIED_DRAFT`。

## 7. 阶段 4：构建打包（用户选择）

### 7.1 触发与确认

- 只有当前修订为 `VERIFIED`/`VERIFIED_DRAFT` 时可打包。
- 用户明确点击“构建打包”或在对话中确认后执行。
- 不允许模型在后台自动打包并提交生产。

### 7.2 构建记录

每次构建记录：

| 字段 | 说明 |
|---|---|
| `buildId` / `buildNumber` | 唯一构建标识和项目内递增序号 |
| `version` | SemVer 业务版本 |
| `draftRevision` | 构建对应修订 |
| `sourceHash` | 源代码快照哈希 |
| `lockfileHash` | 依赖锁文件哈希 |
| `artifactSha256` | ZIP SHA-256 |
| `status` | 构建状态 |
| `startedAt` / `finishedAt` | 起止时间 |
| `durationMs` | 耗时 |
| `operator` | 操作者 |
| `checks` | 门禁结果快照 |
| `logs` | 脱敏构建日志地址 |

同一 `sourceHash + lockfileHash + build config` 可复用已有成功构建，但必须生成明确的复用记录，不能静默返回旧包。

### 7.3 版本与更新日志

建议默认规则：

- 首次打包：`0.1.0` 或由平台产品策略指定。
- 兼容修复：patch。
- 向后兼容能力新增：minor。
- 输入/输出或关键行为不兼容：major。

每次成功打包生成一条本地更新日志：

```json
{
  "version": "0.2.0",
  "buildId": "bld_xxx",
  "time": "2026-08-11T10:20:00Z",
  "description": "增加附件校验并完善失败反馈"
}
```

描述由模型生成但用户可编辑；建议 10–30 个汉字，不写“优化若干问题”之类无信息内容。

### 7.4 打包后行为

- 重新推送同一 `projectId` 的更新卡片。
- 卡片状态先更新为 `PACKAGED`；本地与 Console 门禁全部通过后再更新为 `READY_TO_SUBMIT`。
- 显示版本、构建时间和产物状态。
- 详情中的产物路径、SHA-256、更新日志、测试按钮和生产提交按钮刷新。
- 若源码随后变化，Artifact 标记 `STALE`，测试与生产提交按钮禁用，必须重新经过阶段 2、3、4。

### 7.5 测试并上传沙箱

1. 入口展示名固定为 **“测试”**，结果卡和详情面板均可提供；两处共享同一 `SandboxDeployment` 状态。
2. 用户点击后保持当前 Build 页面，不打开新页面、不切换路由，也不自动跳转沙箱 Work。
3. 当前修订为 `VERIFIED`/`VERIFIED_DRAFT` 且无有效 Artifact 时，该次点击视为用户明确选择阶段 4：先构建打包，校验成功后继续上传；Artifact 已过期或当前修订不合格时不得上传旧包。
4. Build 以 `sandboxDeploymentId` 和 `tenant + appCode + artifactSha256 + sandboxEnvironment` 生成幂等键，调用 Console 沙箱上传接口。连续点击、刷新重试或异步回调不得产生无法识别的重复版本。
5. 仅当 Console 返回真实成功回执，且回执与当前 `projectId + draftRevision + buildId + artifactSha256` 一致时，进入 `SANDBOX_READY`。建议回执至少包含沙箱组件/App ID、沙箱版本、Artifact SHA-256、Console request ID 和完成时间。
6. 成功后在当前页面显示绿色成功提示，原文必须为：**“已经上传到沙箱，您可以开始制作技能进行测试”**。
7. 该提示仅表示当前制品已在沙箱就绪；不表示 Skill 已制作、不表示端到端测试通过、不表示生产提交或发布成功。
8. 超时、接口不可用、权限失败、哈希不一致或回执字段缺失时进入 `SANDBOX_UPLOAD_FAILED`，原页显示可重试错误并保留 Artifact；不得显示绿色成功提示，也不得由模型补写成功状态。
9. 上传操作必须经过服务端鉴权、租户与环境隔离、制品完整性校验和审计。前端不得持有 Console 长期凭据。

## 8. 业务组件详情

点击卡片“详情”，在右侧详情面板打开。面板顶部提供两个相互独立的动作：**测试**（上传沙箱、原页反馈）和**提交生产**（生产 Console 提交与审核）；下方包含两个 Tab：**概览**、**检查**。

### 8.1 顶部动作

**测试按钮**遵循 §6.2 独立状态矩阵与 §7.5 沙箱上传协议，始终留在当前页面反馈；**提交生产按钮**遵循以下规则：

1. 未打包：可点击，但弹出黄色提示，原文为：**“请先构建打包，再发起提交”**。
2. Artifact 已过期：黄色提示“当前产物已过期，请重新构建打包”。
3. 本地检查有 error：禁用提交，跳转“检查”Tab。
4. Console Tool 检查未通过：不提交，插入局部澄清。
5. 全部门禁通过：项目先进入 `READY_TO_SUBMIT`；用户完成二次确认后才进入 `SUBMITTING`。
6. 连续点击使用 `submissionId/idempotencyKey` 去重。

### 8.2 概览 Tab

- 图标、名称、编码。
- 关联工具。
- 更多信息：开发者、appCode、描述、产物路径、构建打包时间。
- 版本、Build Number、Artifact SHA-256。
- 本地更新日志：版本、时间、更新描述。
- 预览状态和最近一次预览时间。

产物路径对用户展示逻辑路径或受控下载地址，不暴露宿主机绝对路径。

### 8.3 检查 Tab

#### A. info.json 合规性检查（本地）

- JSON 语法。
- 必填字段。
- 字段类型、枚举、格式。
- input/output Schema 可解析性。
- 目录和静态资源。
- 上传包一级目录。

#### B. relate Tool 存在性检查（Console）

- Connector 是否存在且可用。
- 每个 `relateTools[].name` 是否存在。
- Tool 是否属于所选 Connector。
- 如平台支持，可展示当前租户是否具备调用/提交权限。
- 返回结果必须带检查时间和 Console 请求标识，不能用本地猜测替代。

检查项状态：`not_run | running | passed | warning | failed | unavailable`。

Console 不可用时状态为 `unavailable`，不得显示“通过”；用户可重试，但生产提交默认阻断。

## 9. 提交协议与安全门禁

### 9.1 提交前置条件

- 当前 Artifact 存在且非 `STALE`。
- Artifact SHA-256 与构建记录一致。
- 本地 error 检查为 0。
- Console Connector/Tool 检查通过。
- appCode 唯一性检查通过。
- 用户完成二次确认。

### 9.2 幂等与并发

- 提交接口必须使用 `submissionId` 或 `idempotencyKey`。
- 同一 `artifactSha256 + tenant + appCode` 的进行中提交应复用已有请求。
- 多个项目并发时，状态更新必须按 `projectId` 隔离。
- 异步结果必须校验 `draftRevision/buildId`；旧结果不得覆盖新卡片。

### 9.3 权限与审计

- Build 前端只展示权限结果，不承担服务端鉴权。
- 服务端记录操作者、租户、项目、构建、提交、时间和结果。
- 日志和错误信息必须脱敏，不回传 Token、Cookie、密钥或本地敏感路径。
- 高风险发布操作不得仅凭模型文本确认成功。

### 9.4 沙箱上传协议

- 沙箱上传与生产 Submission 使用不同接口语义、记录类型、权限和状态，不得以沙箱成功回执推进生产审核状态。
- 请求必须携带 `sandboxDeploymentId`、环境标识、`projectId`、`draftRevision`、`buildId`、`appCode` 和 `artifactSha256`。
- 服务端以 `tenant + sandboxEnvironment + appCode + artifactSha256` 幂等；同一进行中请求应返回原任务，同一已成功制品应返回可验证的既有回执。
- 成功判定只接受 Console 沙箱服务的结构化回执；回执中的 App/组件 ID、版本、哈希、request ID 和环境必须持久化并可审计。
- 回调到达时重新核对当前修订和制品哈希。旧修订成功只能写入历史记录，不得覆盖新卡片状态或触发当前页面绿色提示。
- Console 接口不可用时显示 `unavailable`/上传失败并允许重试，禁止降级为本地假成功。

## 10. Skill 内部能力建议

`mcp-apps-builder` 对用户保持一个 Skill，对内建议分为以下服务：

1. `Spec Manager`：结构化澄清、规格版本和局部澄清。
2. `Code Generator`：模板选择、代码生成和增量修改。
3. `Static Validator`：`info.json`、Schema、目录和资源检查。
4. `Preview Manager`：动态端口、进程、健康检查和 URL。
5. `Build Manager`：可复现构建、净化、ZIP、哈希和日志。
6. `Console Gateway`：Connector/Tool 检查、独立的沙箱上传与生产提交；校验真实回执并隔离两类状态。
7. `Project Card Presenter`：结果卡、详情面板、测试按钮、绿色原页反馈和状态更新。

服务失败必须返回结构化错误，不要求模型从非结构化日志中猜测真实状态。

## 11. 与当前 HelpDesk 工程的映射

### 11.1 最新交付里程碑与业务范围

- 最新项目计划要求 **2026-08-14** 完成 Build 构建业务组件能力节点，并在 Console 管理构建结果。
- 该日期是交付/验收目标，不证明本规格中的 Preview Manager、沙箱上传 API、状态回调等能力已经实现；必须按本文 P0 标准逐项验收。
- HelpDesk 本次验收范围为 11 类业务组件：
  1. 知识检索卡；
  2. 工单草稿卡（含附件）；
  3. 附件确认卡；
  4. 工单回执卡；
  5. 员工工单列表卡；
  6. 员工工单详情卡（含进度）；
  7. 工单评价卡；
  8. 工单答复卡；
  9. 处理人工单列表卡；
  10. 处理人工单详情卡（含转派）；
  11. 知识产物卡。
- 上述 11 类是**业务验收类型**；参考工程中的 26 个原子组件是**实现颗粒度**，二者不能按数量直接等同。8/14 前必须形成 `业务类型 → appCode/view → 复用原子组件 → 依赖 Tool → 责任人 → 验收结果` 映射。
- 工单草稿卡、附件确认卡和知识产物卡依赖 MCP Apps 使用会话附件：8/13 对齐方案和效果，8/14 为原计划发布日期；未取得发布记录和 UAT 前，这三类不得以模拟附件冒充生产通过。
- 知识产物卡只承载产物展示/确认，不决定哪些工单可生成知识。定时触发、对话触发或组合触发及 eligible ticket 规则由处理人 Skill/产品另行确认。

### 11.2 当前参考工程

当前参考工程：

```text
helpdesk-pro/交互式卡片/helpdesk-components/
├── src/                      # React MCP App 共用运行时
├── scripts/components.mjs   # 26 个原子组件定义和 info.json 生成
├── scripts/build-all.mjs    # 逐卡构建和统一预览入口生成
└── components/
    ├── index.html            # 仅本地统一预览，不进入上传包
    └── <group>/<view>/
        ├── dist/
        └── info.json
```

可复用能力：

- 每张卡独立 `appCode`、`dist + info.json` 和单 view Schema。
- 批量构建、相对资源、本地统一预览。
- Tool 输入、Tool 结果、取消事件和宿主主题接入。
- 显式演示模式与生产数据隔离。
- 26 个字段级输入 Schema 和统一输出 Schema。

尚缺、需要 Build/平台研发实现：

- 通用工程模板和增量代码生成器。
- Preview Manager 动态端口与进程登记。
- 上传 ZIP 生成器、目录白名单和 SHA-256。
- 标准检查报告存储与详情面板。
- Console Connector/Tool 检查 API。
- Console 沙箱上传 API、服务端鉴权、幂等、审计和真实状态回调。
- 生产提交 API、权限、审计、幂等和状态回调。
- 标准 Skill 自身的注册、状态持久化和卡片协议实现。

## 12. P0 验收标准

### 12.1 四阶段

1. 新建项目必须完成阶段 1、2、3，用户可选择是否进入阶段 4。
2. 任一必填需求缺失时不得进入 `SPEC_READY`。
3. 静态检查失败不得启动阶段 3，自动修复后可局部重试。
4. 当前修订至少成功预览一次才能标记 `VERIFIED`。
5. 用户跳过阶段 4 后状态为 `VERIFIED_DRAFT`，提交时出现指定黄色提示。

### 12.2 预览

1. 同项目同修订服务存活时，点击启动直接打开已有 URL。
2. 服务不存在或端口冲突时自动申请其他端口并启动。
3. 点击停止后进程进入 `STOPPED`，再次启动可获得新端口/URL。
4. 多项目同时预览不串 URL、不串状态。
5. 新修订不能错误复用旧修订页面。

### 12.3 检查与局部澄清

1. 非法 JSON、缺字段、非法 Schema 和缺资源能定位到文件/字段。
2. Console 返回 Tool 不存在时，只澄清该 Tool，不重走全部需求。
3. Console 不可用显示 `unavailable`，不得显示通过。
4. 用户更换 Tool 后只重跑 Tool 相关和后续门禁。

### 12.4 构建与提交

1. ZIP 一级目录只有 `dist/ + info.json`。
2. ZIP 不包含 `SKILL.md`、源码、依赖、日志或系统文件。
3. 每次成功打包有版本、构建时间、更新日志和 SHA-256。
4. 修改源码后旧 Artifact 变为 `STALE`，不能提交。
5. 未打包点击提交显示：**“请先构建打包，再发起提交”**。
6. 双击提交只产生一个 Console Submission。
7. 提交结果必须来自 Console，不允许模型直接标记已发布。

### 12.5 测试并上传沙箱

1. 结果卡和详情均提供展示名为“测试”的按钮，且与“提交生产”是独立动作。
2. 点击“测试”后始终保持当前 Build 页面，不自动打开或跳转沙箱 Work。
3. 当前修订合格但未打包时，只有该次用户点击可显式触发构建打包并继续上传；后台不得无操作自动上传。
4. 仅收到与当前制品匹配的真实 Console 沙箱成功回执后，显示绿色原文：**“已经上传到沙箱，您可以开始制作技能进行测试”**。
5. 成功提示不得解释为 Skill 已制作、端到端测试通过或生产发布成功。
6. 上传失败、超时、Console 不可用、回执缺失或哈希不匹配时不得显示成功；页面保留 Artifact、错误详情和重试入口。
7. 连续点击同一制品只产生一个有效 `SandboxDeployment`；旧修订回执不得覆盖新修订状态。

### 12.6 结果卡与详情

1. 卡片包含背景图、名称、10–15 字描述、启动预览、停止预览、测试、详情。
2. 打包后更新并再次推送同一项目卡片。
3. 详情包含概览/检查两个 Tab，以及测试和提交生产两个独立动作。
4. 概览字段、检查来源、沙箱上传回执和更新时间清晰可追溯。
5. HelpDesk 11 类业务组件均有唯一 appCode/view、依赖 Tool、复用原子组件和验收结果映射；不得用“参考工程已有 26 个原子组件”代替业务类型验收。
6. 依赖会话附件的组件在 8/13 方案对齐、实际发布和 UAT 通过前必须标记阻塞或演示态，不得宣称生产可用。

## 13. 建议研发拆分

### P0：可用闭环

- 四阶段状态机和项目持久化。
- 结构化澄清与局部澄清。
- 基础模板代码生成。
- 本地静态检查。
- Preview Manager 动态端口、启动/停止/复用。
- 结果卡和详情双 Tab。
- Release build、ZIP、SHA-256、更新日志。
- 结果卡/详情“测试”按钮、`SandboxDeployment` 状态与原页绿色反馈。
- Console 沙箱上传的服务端鉴权、真实回执、幂等、审计与回调。
- Console Tool 检查与人工生产提交。

### P1：效率与治理

- 多模板和受控素材库。
- 自动版本建议和 changelog diff。
- 构建缓存、失败诊断和日志查看。
- 多人协作、项目锁和角色权限。
- Preview 空闲回收与服务重启恢复。

### P2：规模化

- 组件市场/模板市场。
- 兼容性矩阵和回归快照。
- 灰度、回滚和发布策略。
- 跨环境迁移与制品晋级。

## 14. 与现有 Build 标准及 MCP Apps 规范对齐

### 14.1 证据来源与使用原则

当前可用参考分为三类，可信边界不同：

| 来源 | 可以证明 | 不能证明 |
|---|---|---|
| `kingdee-skill-creator` 完整实现 | 标准 Skill 的单入口路由、推断优先与局部澄清、MCP 双来源发现、增量编辑、校验报告和结果卡终止门控 | MCP App 项目状态、前端编译预览、ZIP 制品、Console 提交协议 |
| `灵基MCPAPPS相关/mcp-app-devguide.html` | MCP App 通信方式、`info.json` 字段约束、上传包结构、真实 Tool 规则、配套 Skill 和现行本地联调方法 | Build 内部 Creator、受管 Preview Manager、项目卡、统一校验服务和提交 API |
| 会议纪要与 KDM 上架指导 | 当前人工上架步骤，以及“Console 与 Build 打通、Build 支持构建、统一版本管理”是产品目标 | 目标已经上线，或已有可调用 API、状态机、回调、权限和幂等实现 |

本文后续研发不得把会议目标或本方案设计写成“平台已有能力”。实施时按以下标识管理需求来源：

- **CURRENT**：现行开发手册或可执行实现已确认。
- **PLANNED**：会议或路线图明确提出，但尚无实现证据。
- **PROPOSED**：本规格为闭环新增的方案，需研发评审。
- **TBD**：存在文档冲突或缺少正式接口，必须由平台确认。

如本节与前文的“建议”口径存在冲突，以本节的现行规范校正为准；平台发布新版正式 Schema 后，再以新版 Schema 为最高优先级。

### 14.2 可直接复用的 Creator 模式（CURRENT）

`mcp-apps-builder` 应复用 `kingdee-skill-creator` 的方法，而不是复制其 Skill 文件交付物：

1. 对用户只暴露一个 Creator Skill，创建、修改、查询、检查由内部路由处理。
2. 先从上下文推断，只对关键缺失项进行一次性简短访谈；检查失败只澄清受影响字段。
3. 创建前检查重名和重叠，编辑时禁止无提示覆盖已有文件。
4. Tool 必须经过 `search -> detail -> 覆盖度核验`；个人源和租户源分别发现，不得根据业务语义编造编码或 Schema。
5. 采用增量编辑、SemVer 和 CHANGELOG 思路，但 MCP App 版本及制品记录使用本规格的数据模型。
6. 采用 `validation-report + output_check + render card` 原子门控；任一环节失败都不得报告完成。
7. 校验区分 block/warn，覆盖安全扫描、破坏性操作确认和输出语言一致性。
8. 结果卡需使用 MCP App 项目卡协议，不能复用只含 `title`、`directory` 的 `kdskill` 三行卡片。

`kingdee-skill-creator` 内部文档与脚本存在规则数量、`allowed-tools` 严重级别、评测脚本使用方式及默认输出目录等口径差异，因此只能复用工作模式，不能直接把其校验器作为 MCP App 校验器。

### 14.3 现行 MCP Apps 硬约束（CURRENT）

以下约束已由现行 MCP Apps 开发手册确认，P0 默认执行：

1. ZIP 解压后一级目录只有 `dist/` 和 `info.json`，且 `dist/index.html` 必须存在。
2. `appCode` 格式为 `{cloud}_{domain}_{自定义编码}`，整体最长 50 字符；自定义编码至少 5 字符且只允许字母、数字和下划线。它同时是虚拟入口 Tool 名和配套 Skill 的 `allowed-tools` 值。
3. `appName` 全局唯一，最长 50 字符，允许中英文、数字、`-`、`_`。
4. `mcpConnector.type` 当前支持 `XK | XKE | XH | OTHERS`；`mcpConnector.code` 必须指向 KDManage 中已存在的集群连接器。
5. `runMode` 当前正式枚举为 `message | sidecar`。第一版可默认 `message`；不得生成未被当前手册支持的 `sidebar`。
6. `relateTools` 当前要求 1–50 项；普通 Tool 必须真实存在于所选 Connector，`toolName` 应保持稳定。
7. `entryTool.virtual` 是虚拟入口，不要求存在于真实 Tool 表；`inputSchema`、`outputSchema` 为 JSON Schema 字符串，业务参数建议分别由 `requestBody`、`responseBody` 包装。
8. `dependsOnApp` 最多声明一个已发布上游，禁止自依赖和环形依赖，且应满足同 Connector；`writeArtifactTool` 必须引用上游 `writeArtifact=true` 的 Tool。
9. MCP App 可配套 `SKILL.md` 以指导模型调用虚拟入口，但它不属于 MCP App ZIP 上传包，也不是本 Creator 的主交付物。
10. 现行 KDM 人工流程仅确认：新建业务组件、上传 ZIP、配置 Connector、关联 Tool、提交保存并审核上架。

对前文需求模型作以下校正：

- `appCode` 由 Build 按 `tenantCode_projectCode_componentCode` 自动生成，并继续满足现行 `{cloud}_{domain}_{自定义编码}` 格式；默认不让用户自由填写。`tenantCode -> cloud`、`projectCode -> domain` 属于产品侧建议映射，正式落地前必须由 Console/平台确认字段语义，未确认时以版本化正式 Schema 为准。
- `supportedLocales`、`defaultLocale` 可保留为 Build 工程和源码生成配置，但当前 `info.json` 手册未定义这两个字段，未获正式 Schema 支持前不得写入上传元数据。
- 当前没有“空 `relateTools`”的正式依据。纯展示或只做 Agent 导航的组件，在平台确认例外机制前不得打包为可提交状态。
- 当前手册对 `writeArtifact` 同时出现字符串示例、字符串字段说明和 `boolean/string` 表述；生成器必须通过版本化 Schema 适配，不能自行固定类型。

### 14.4 两级预览边界

当前手册的 Host 集成联调要求先上传并注册 App，再通过 `lg_mcpapp_cdn` 将资源指向本地服务；示例端口 4000 只是示例，不是平台固定协议。因此阶段 3 必须区分：

| 预览级别 | 是否依赖 Console 注册 | 验证范围 | 状态影响 |
|---|---:|---|---|
| Build 独立预览（PROPOSED） | 否 | 页面、资源、响应式、演示/生产隔离、基础 SDK mock 边界 | 通过后可到 `VERIFIED_DRAFT`，不代表 Host 集成成功 |
| Host 集成预览（CURRENT 方法，待 Build 托管） | 是 | 真实 Host 加载、`lg_mcpapp_cdn` 路由、主题/上下文、Tool 输入输出 | 通过后记录 `HOST_VERIFIED` 检查项 |

Preview Manager 的动态端口、实例复用、停止恢复、反向代理和健康检查均为 **PROPOSED**，不能宣称为现有 Build 能力。固定 4000/5173 端口不得成为项目身份；托管实现仍应动态分配端口。若 P0 无法获得临时注册或沙箱能力，独立预览可完成开发验证，但提交前是否强制 Host 集成预览必须由平台确认。

### 14.5 能力差异矩阵

| 能力 | 当前证据状态 | `mcp-apps-builder` 处理 |
|---|---|---|
| 单一 Creator 入口、局部澄清 | CURRENT（Skill Creator） | 复用模式并扩展到项目生命周期 |
| MCP Tool 发现与真实性核验 | CURRENT（Skill Creator 方法） | 复用双来源发现；接口不可用时禁止伪造 |
| `dist/ + info.json` 上传包 | CURRENT（开发手册） | 作为本地 validator 和 ZIP 白名单 |
| 人工 KDM 上架链路 | CURRENT（操作指导） | P0 可提供受控人工交接，不伪装 API 成功 |
| Build 拉取 Console 组件 | PLANNED | 接口落地前不作为已实现能力 |
| Build 内构建 MCP Apps | PLANNED | 本规格定义实现，不声称平台已有 |
| 统一版本管理与回滚 | PLANNED | 先保存本地修订/制品记录，待统一服务对接 |
| Project/Revision/Build/Submission 持久化 | PROPOSED | 需新增状态服务和异步防串写 |
| 动态预览与进程管理 | PROPOSED | 需新增 Preview Manager |
| MCP App 项目卡、action、双 Tab | PROPOSED | 需产品和渲染协议评审 |
| MCP App validator/output_check | PROPOSED | 需独立实现，不复用 Skill 校验规则冒充通过 |
| ZIP 净化、SHA-256、制品存储 | PROPOSED | 需新增 Build/Artifact Manager |
| 结果卡“测试”按钮与原页反馈 | PROPOSED | 上传沙箱后不跳转；需产品和渲染协议评审 |
| Console 沙箱上传、真实回执与状态回调 | TBD | 无正式 API 前不得显示“已经上传到沙箱” |
| Console 检查、生产提交、审核回调 | TBD | 无正式 API 前显示 `unavailable`，默认阻断自动提交 |

### 14.6 仍需 Agent/Application Creator 验证的范围

当前工作区未发现 Agent Creator 或 Application Creator 完整实现，因此下列设计仍缺少 Build 平台先例：

- 项目状态如何持久化，以及异步 `draftRevision` 如何防止旧结果覆盖新结果。
- Creator 如何调用代码工作区、长任务和版本服务。
- 结果卡的 render/update/action 协议，以及右侧详情面板的数据协议。
- Build 是否已有受管预览进程、动态 URL、健康检查和回收机制。
- `output_check` 的正式输入输出和失败语义。
- 构建制品如何保存、下载、提交、审核、回调与审计。

后续如获得资料，应优先分析完整目录中的 `SKILL.md`、`manifest.yaml`、`references/`、`scripts/`、校验器、卡片模板和示例输出。Application Creator 与 MCP Apps 同样涉及源码、编译、预览和制品，其优先级可高于 Agent Creator。

## 15. 待产品/平台确认（建议优先确认 10 项）

1. **语言模型**：第一版是单语言，还是 `supportedLocales + defaultLocale` 多语言工程模型；若需写入 `info.json`，正式字段是什么。
2. **`writeArtifact` 类型**：按平台版本最终使用字符串 `"false"`、boolean `false`，还是兼容两者；请提供机器可读 Schema。
3. **无 Tool 组件**：现行规范要求 `relateTools` 至少 1 项；纯展示/Agent 导航组件是不支持，还是存在正式例外表达。
4. **Console API**：Connector/Tool 存在性、归属、权限和 `appCode`/`appName` 唯一性检查接口、认证方式及错误码。
5. **提交边界**：Build 是上传草稿、发起审核还是可以直接发布；审核状态、回调和撤回协议是什么。
6. **预注册与 Host 联调**：阶段 3 如何获得临时 `appCode` 注册或沙箱；Host 集成预览是否为提交硬门禁。
7. **预览部署形态**：本机端口、远程容器还是反向代理沙箱；URL 生命周期、网络隔离和鉴权方式是什么。
8. **版本与修订服务**：是否已有 Agent/Skill/Application 共用的项目修订、历史对比和回滚 API，MCP Apps 应如何接入。
9. **版本起点**：首次打包使用 `0.1.0`、`1.0.0`，还是沿用工程版本。
10. **产物保存**：ZIP 的存储位置、保留周期、下载权限、最大体积，以及 SHA-256 是否由平台统一生成。

已由现行手册确认、不再作为开放问题的口径包括：`appCode` 基础格式、`runMode=message|sidecar`、`relateTools` 当前为 1–50 项、虚拟入口 Tool 规则，以及 ZIP 一级目录 `dist/ + info.json`。

上述 TBD 不阻塞先实现本地状态机、独立静态检查、Build 独立预览和 ZIP 结构；但 Console API、预注册和提交协议会阻塞真实 Host 闭环与生产提交。任何接口尚未确认时必须返回 `unavailable` 或阻断状态，不能以本地检查替代平台结果。

## 16. 结论

建议以“一个标准 Skill + 内部多服务编排”落地。`kingdee-skill-creator` 已足够证明入口路由、澄清纪律、Tool 真实性、增量编辑、校验报告和卡片终止门控的标准模式，但不足以证明 MCP App 工程生命周期能力。阶段 1–3 形成每轮必经的可验证开发闭环，阶段 4 负责可选 release build 和可提交制品；独立预览与 Host 集成预览必须明确区分。

结果卡承担快速操作，右侧详情承担追溯、检查和提交。所有成功状态必须由真实编译、健康检查、Tool 或 Console 结果驱动；无法确认的状态显示待检查、不可用或失败，而不是由模型推断成功。

仍建议继续获取 Agent Creator；若存在 Application Creator，应一并提供且优先分析。获取目的限定为验证 Build 的项目状态、长任务、预览、卡片、校验、制品和提交编排先例，不再重复研究通用 Skill 创建规范。
