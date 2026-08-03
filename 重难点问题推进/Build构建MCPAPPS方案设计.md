# Build 构建 MCP APPS 方案设计

> 目标：使灵基 Build 具备 MCP APPS 的完整开发能力，用户通过对话即可完成 APPS 的创建、开发、调试、测试和发布  
> 面向：Build 产品团队、Console 团队、MCP APPS 平台团队  
> 状态：方案初稿，待各方评审对齐

---

## 一、背景与目标

### 1.1 当前现状与问题

MCP APPS 是灵基智能体与用户之间的可视化交互层（对话中嵌入的自定义 UI 卡片），当前的开发流程如下：

```
开发者在本地 IDE 编码（React/Vue）
    ↓
按 mcp-app-dev-guide 规范开发，引用 @modelcontextprotocol/ext-apps SDK
    ↓
vite build 打包为 dist/ + info.json
    ↓
压缩为 zip 文件
    ↓
金蝶内部人员登录 KDManage → 业务组件 → 上传 zip
    ↓
配置集群连接器、关联 MCP 工具、审核上架
    ↓
在 Build 中开发 Skill 时，通过提示词引用该组件的 appCode
    ↓
智能体运行时渲染该 APPS 组件
```

**核心问题：**

| # | 问题 | 影响 |
|---|------|------|
| 1 | APPS 开发完全在本地 IDE，与 Build 割裂 | Build 号称"一站式开发"但缺了交互层 |
| 2 | 上传入口在 KDManage（金蝶内部平台），客户无法自助 | 每次变更都要走金蝶内部流程 |
| 3 | Build 中做 Skill/智能体时无法同步做 APPS | 交互层和逻辑层开发完全分离，联调困难 |
| 4 | 开发者需在 5+ 工具间切换 | 本地 IDE → KDManage → Build → Console → Work |
| 5 | 无版本管理 | APPS 组件修改后无法回滚、无法对比 |

### 1.2 目标

**一句话目标**：用户在 Build 中通过对话就能完成 MCP APPS 的创建、开发、调试、测试和发布——与技能开发、智能体开发一样的"对话即开发"体验。

具体而言：
- 开发者不需要本地 IDE，在 Build 中对话即可生成 APPS 代码
- 开发者不需要操作 KDManage，Build 一键提交到 Console
- 开发者不需要在多个工具间切换，Build 内完成全流程
- APPS 开发与 Skill/智能体开发在同一上下文中，天然协同

### 1.3 MCP 开发的子类型

MCP 开发涵盖两类不同性质的制品：

| 子类型 | 产物 | 本质 | 本方案覆盖 |
|--------|------|------|-----------|
| **MCP APPS（交互式）** | 前端 UI 组件（React/Vue → zip） | 对话中的可交互卡片（表单、列表、图表等） | ✅ 本方案聚焦 |
| **MCP Tool（工具式）** | 后端服务（Python/Java/TS → 容器部署） | 给智能体调用的 API 能力（数据读写、业务逻辑） | ⏳ 后续单独设计 |

**两者关系：** APPS 是"前端展示层"，MCP Tool 是"后端能力层"。APPS 组件在运行时通过 `callServerTool` 调用 MCP Tool 完成实际业务操作。一个完整的 MCP 场景通常同时需要两者配合（如工单确认卡 APPS + Create_Ticket Tool）。

**本方案聚焦 MCP APPS（交互式）**，MCP Tool 的 Build 开发能力后续单独设计。

---

## 二、MCP APPS 完整机制介绍

### 2.1 什么是 MCP APPS

MCP APPS 是灵基智能体对话中嵌入的**自定义可交互 UI 组件**（如表单卡片、数据列表、图表等）。它运行在沙箱 iframe 中，通过 AppBridge（基于 PostMessage）与宿主（灵基 WebUI）双向通信。

核心定位：智能体与用户之间的"可视化交互层"——让对话不仅有文字，还有结构化的表单、按钮、列表等 UI 形态。

### 2.2 运行时架构

```
┌─────────────────────────────────────────────────────────────┐
│                    灵基 WebUI（Host/Client 端）               │
│                                                              │
│  ┌────────────────────────┐     ┌─────────────────────────┐ │
│  │ 对话消息流              │     │ AppBridge               │ │
│  │ ┌──────────────────┐   │     │ (PostMessage 通信层)     │ │
│  │ │ 文本消息          │   │     │                         │ │
│  │ │ AI 回复           │   │     │  Host → App:            │ │
│  │ │ ┌──────────────┐ │   │     │   sendToolInput         │ │
│  │ │ │ MCP APPS     │ │◀──┼────▶│   sendToolResult        │ │
│  │ │ │ (沙箱iframe) │ │   │     │   sendHostContextChange │ │
│  │ │ └──────────────┘ │   │     │                         │ │
│  │ │ 文本消息          │   │     │  App → Host:            │ │
│  │ └──────────────────┘   │     │   oncalltool            │ │
│  └────────────────────────┘     │   onmessage             │ │
│                                  │   onsizechange          │ │
│                                  │   onupdatemodelcontext  │ │
│                                  └─────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────┘
                                   │ 代理调用
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server（后端）                         │
│                                                              │
│   Tool 调用：App 通过 Host 代理调用 MCP Server 中的工具       │
│   POST /session/{id}/mcp-app/proxy                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 通信能力

**Host → App（宿主向组件注入数据）：**

| 能力 | 方法 | 说明 |
|------|------|------|
| 注入工具输入 | `sendToolInput({ arguments })` | 将 Skill 调用时的参数传给 App |
| 注入工具输出 | `sendToolResult(result)` | 将 MCP Tool 执行结果传给 App |
| 上下文变更通知 | `sendHostContextChange(ctx)` | 通知主题、尺寸、显示模式变化 |
| 资源就绪 | `sendSandboxResourceReady({ html })` | 将 App HTML 注入沙箱 iframe |

**App → Host（组件向宿主发起请求）：**

| 能力 | 事件/方法 | 说明 |
|------|----------|------|
| 请求调用 MCP Tool | `oncalltool({ name, arguments })` | App 发起工具调用，Host 代理到后端 |
| 发送消息给 LLM | `onmessage({ content })` | App 向大模型发送追问/上下文消息 |
| 上报尺寸 | `onsizechange({ height })` | 通知 Host 内容高度变化 |
| 切换显示模式 | `onrequestdisplaymode({ mode })` | 请求 inline / fullscreen 切换 |
| 更新模型上下文 | `onupdatemodelcontext({ structuredContent })` | App 向 LLM 上下文写入结构化数据 |
| 打开链接 | `onopenlink({ url })` | 在新窗口打开外部链接 |
| 下载文件 | `ondownloadfile({ contents })` | 请求下载文件 |

### 2.4 组件描述文件 info.json

每个 APPS 组件必须包含 `info.json`，用于声明组件的身份、能力和依赖关系：

```json
{
  "cloud": "zcy",
  "domain": "kingdee",
  "appCode": "zcy_kingdee_mcpapp_test",
  "appName": "mcpapp测试demo",
  "description": "...",
  "capabilityDescription": {
    "support": "数据报表",
    "notSupport": "表单"
  },
  "mcpConnector": {
    "type": "XK",
    "code": "xkmcp_test"
  },
  "runMode": "message",
  "version": "1.0.0",
  "dependsOnApp": {
    "appCode": "",
    "writeArtifactTool": ""
  },
  "relateTools": [
    { "name": "tool_name", "writeArtifact": "false" }
  ],
  "entryTool": {
    "virtual": {
      "inputSchema": "{ JSON Schema }",
      "outputSchema": "{ JSON Schema }"
    }
  }
}
```

**核心规则：**
- `appCode` 同时作为虚拟入口工具的 toolName 和 Skill 中 allowed-tools 的引用名
- `relateTools` 中的工具必须在对应 MCP 集群连接器中真实存在
- 组件间支持单级依赖（A 依赖 B 的写产物），禁止自依赖和循环依赖

### 2.5 配套 Skill 描述文件 SKILL.md

每个 APPS 组件可配套一个 Skill 文件，让大模型知道何时调用该组件：

```markdown
---
name: mock-mcp-app-demo-xxx
description: Use this skill to open the managed MCP App xxx.
allowed-tools:
- {appCode}
---

# Mock MCP App Demo

Use this skill when the user asks to ...

Call the MCP tool `{appCode}`
```

### 2.6 开发技术栈

| 项 | 说明 |
|---|------|
| 前端框架 | React 18（推荐）；也支持 Vue/Svelte |
| SDK | `@modelcontextprotocol/ext-apps`（npm 包，提供 `useApp` Hook） |
| 构建工具 | Vite 5 |
| 语言 | TypeScript |
| 产物格式 | dist/index.html + 静态资源（js/css/图片） |
| 上传格式 | zip（一级目录含 dist/ 和 info.json） |

### 2.7 本地调试机制

开发者本地启动 dev server 后，通过 URL 参数将 App 资源指向本地：

```
https://your-webui.com/session/xxx?lg_mcpapp_cdn=http://localhost:4000
```

原理：Host 加载 App 资源时检查 `lg_mcpapp_cdn` 参数，如存在则将 CDN 地址替换为该参数值。

### 2.8 当前上架流程（KDManage）

```
1. 登录 KDManage → 左侧菜单 → 业务组件
2. 新建业务组件
3. 上传 zip 文件（打包好的 APPS）
4. 配置集群连接器
5. 关联集群连接器里的 MCP 工具
6. 提交保存、审核上架
```

> ⚠️ 该入口仅金蝶内部人员可操作，租户/客户无法访问 KDManage。

---

## 三、用户体验设计（用户视角）

### 3.1 整体开发流程

```
用户进入 Build → 选择"MCP 开发" → 新会话
    ↓
用户：用自然语言描述想要的 APPS 组件
    （如："帮我创建一个工单确认卡片，展示工单信息，支持编辑和提交"）
    ↓
Build：澄清需求（需要哪些字段？调用什么 MCP Tool？交互模式？）
    ↓
用户：补充信息
    ↓
Build：生成 APPS 项目（App.tsx + info.json + SKILL.md）
    ↓
用户：预览效果（右侧面板沙箱 iframe）
    ↓
用户：通过对话调整（"把提交按钮改成蓝色"、"增加附件上传功能"）
    ↓
Build：更新代码，刷新预览
    ↓
用户：点击"沙箱测试"
    ↓
Build：自动构建打包 → 提交沙箱 Console → 用户在沙箱 Work 中端到端联调
    ↓
用户：测试通过，点击"提交生产"
    ↓
Build：构建 → 打包 zip → 提交生产 Console → 管理员审核 → 上架
    ↓
生产 Work 中智能体可使用该 APPS 组件
```

### 3.2 开发过程中的对话示例

#### 示例一：从零创建一个 APPS

```
用户：帮我创建一个工单确认卡片。需要展示工单标题、描述、优先级、
     处理人，用户可以编辑后点确认提交。

Build：好的，我来帮你梳理一下需求：
     - 组件类型：表单确认卡片
     - 展示字段：标题（文本）、描述（多行文本）、优先级（下拉选择）、处理人（文本）
     - 交互：字段可编辑 + 确认/取消按钮
     - 提交后需要调用什么 MCP Tool？比如 Create_Ticket？
     - 运行模式：对话内卡片（message）还是侧边栏（sidecar）？

用户：调用 Create_Ticket 工具，对话内卡片就行。

Build：明白了。我来生成项目：
     - appCode: chin_helpdesk_ticket_confirm
     - 关联工具: Create_Ticket
     - 运行模式: message
     
     已生成以下文件：
     ✅ App.tsx — 工单确认表单组件
     ✅ info.json — 组件描述（relateTools 已配置 Create_Ticket）
     ✅ SKILL.md — 配套技能描述
     
     右侧面板已加载预览，你可以看到卡片效果。需要调整吗？
```

#### 示例二：修改已有的 APPS

```
用户：优先级字段改成带颜色标签的样式，紧急显示红色，普通显示灰色。

Build：好的，我来修改 App.tsx 中优先级字段的渲染逻辑。
     [更新代码]
     已更新预览，你看看效果。紧急工单现在会显示红色标签。

用户：不错，再加一个附件上传功能，允许上传图片和PDF。

Build：附件上传需要确认几点：
     1. 上传后文件存哪里？是调用某个文件上传的 MCP Tool 还是转为 base64 放在提交参数里？
     2. 文件大小限制？
     
用户：调用 Upload_Attachment 工具上传，限制 10MB。

Build：明白。我需要做两件事：
     1. App.tsx 中增加文件上传组件
     2. info.json 的 relateTools 中新增 Upload_Attachment
     
     [更新代码]
     已完成。预览中可以看到新增的上传区域。
```

#### 示例三：调试渲染问题

```
用户：预览里卡片没有渲染出来，显示空白。

Build：我来检查一下。
     
     发现问题：App.tsx 第 23 行 useApp() hook 的 onToolInput 回调中，
     解析 arguments 时字段名不匹配。info.json 中 entryTool 定义的输入字段
     是 "ticketData"，但代码中读的是 "data"。
     
     已修复，刷新预览。现在应该能看到卡片了。

用户：好了，能看到了。
```

#### 示例四：关联 MCP Tool

```
用户：这个卡片还需要调用 Get_Ticket_Detail 来获取工单详情，
     在初始化时自动加载。

Build：好的，我来做以下调整：
     1. info.json → relateTools 新增 Get_Ticket_Detail
     2. App.tsx → 在组件挂载时通过 callServerTool 调用 Get_Ticket_Detail
        获取详情数据填充表单
     3. entryTool inputSchema 需要增加 ticketId 字段，
        这样 Skill 调用时会传入工单 ID
     
     [更新代码]
     已完成。预览中我会注入一个模拟的 ticketId，你可以看到加载效果。
```

### 3.3 与其他开发能力的协同

MCP APPS 开发不是孤立的，它与 Build 的其他开发能力天然配合：

**与技能开发的协同：**
- APPS 组件通过 appCode 被 Skill 的 `allowed-tools` 引用
- 在 Build 中开发 Skill 时，可以直接选择已有的 APPS 组件关联
- Build 在生成 APPS 时会自动生成配套的 SKILL.md
- 如果用户在 Skill 开发中发现需要自定义 UI，Build 可切换到 APPS 开发上下文

**与智能体开发的协同：**
- 智能体通过 Skill 间接使用 APPS 组件
- 在测试智能体时，APPS 会在沙箱 Work 中正常渲染
- 智能体项目可以包含多个 Skill，每个 Skill 可关联不同的 APPS

**一体化开发场景：**
- 用户可以在同一个项目中同时开发 APPS + Skill + 智能体
- Build 感知它们之间的依赖关系
- 如果 Skill 引用了一个本项目中尚未提交的 APPS，Build 会在沙箱测试前自动先将 APPS 提交到沙箱 Console，确保联调可用

---

## 四、Build 内部能力设计（平台视角）

### 4.1 支撑 MCP APPS 开发所需的 Skill

Build 内部使用 Skill 来支撑各项开发能力。以下是 MCP APPS 开发所需的 Skill 设计：

| Skill 名称 | 职责 | 触发时机 |
|---|---|---|
| APPS 需求澄清 Skill | 解析用户自然语言描述，澄清组件类型、展示字段、交互方式、关联 MCP Tool、运行模式等 | 用户首次描述 APPS 需求时 |
| APPS 代码生成 Skill | 基于确认后的需求，生成 App.tsx、info.json、SKILL.md 等项目文件 | 需求澄清确认后 |
| APPS 代码修改 Skill | 根据用户对话指令修改已有代码，支持增删字段、调整样式、修改交互逻辑等 | 用户描述修改需求时（如"把按钮改成蓝色"） |
| APPS 预览调试 Skill | 启动沙箱 iframe 预览，注入模拟 toolInput 数据，检查渲染问题并给出修复建议 | 用户点击预览或说"看看效果"时 |
| APPS 构建打包 Skill | 执行 vite build，生成 dist/ 目录，将 dist/ + info.json 打包为标准 zip | 用户点击"沙箱测试"或"提交生产"时 |
| APPS 提交发布 Skill | 调用 Console API 上传 zip 包，处理注册结果和审核状态反馈 | 构建打包完成后 |

### 4.2 支撑 MCP APPS 开发所需的 Tool

Build 内部使用 Tool 执行具体操作。以下是支撑 APPS 开发的底层工具：

| Tool 名称 | 能力 | 调用方 |
|---|---|---|
| Vite_Build | 执行 `vite build` 前端构建命令，生成 dist/ 产物 | APPS 构建打包 Skill |
| Zip_Package | 将 dist/ + info.json 按规范打包为上传用 zip 文件 | APPS 构建打包 Skill |
| Console_Upload_API | 调用 Console 组件上传接口，提交 zip 并获取注册状态 | APPS 提交发布 Skill |
| Console_List_API | 查询当前租户已上架的 APPS 组件列表 | 技能开发中引用 APPS 时 |
| Sandbox_Preview | 在沙箱 iframe 中渲染 APPS，注入模拟 toolInput 数据 | APPS 预览调试 Skill |
| Template_Generator | 基于用户选定的模板生成标准项目结构文件 | APPS 代码生成 Skill |

### 4.3 APPS 开发 Agent

类似应用开发有自己的编排 Agent，MCP APPS 开发也需要一个专属 Agent 来协调上述 Skill：

| 属性 | 说明 |
|---|---|
| 名称 | MCP APPS 开发助手 |
| 职责 | 根据用户意图，选择合适的 Skill 执行；维护开发上下文（当前项目状态、已生成文件、测试状态） |
| 编排逻辑 | 用户描述需求 → 需求澄清 Skill → 代码生成 Skill → 用户请求预览 → 预览调试 Skill → 用户请求修改 → 代码修改 Skill → ... → 提交发布 Skill |
| 上下文维护 | 记录当前 APPS 项目的文件列表、info.json 配置、关联 Tool、测试状态等 |
| 决策能力 | 判断用户意图是"新建"还是"修改"；判断是否需要澄清还是直接执行；识别错误并触发调试 |

### 4.4 模板库

Build 预置常用 APPS 模板，降低开发门槛：

| 模板名称 | 描述 | 包含的文件 |
|---|---|---|
| 空白模板 | 最基础结构，用户从零开始 | main.tsx + App.tsx(空) + info.json(模板) + vite.config.ts |
| 表单卡片 | 带输入字段和提交按钮的标准表单 | main.tsx + App.tsx(表单) + styles.css + info.json |
| 列表展示卡 | 展示数据列表，支持分页和操作 | main.tsx + App.tsx(列表) + styles.css + info.json |
| 确认卡片 | 展示信息摘要，用户确认或拒绝 | main.tsx + App.tsx(确认) + styles.css + info.json |
| 图表卡片 | 展示图表数据（柱状图/饼图/折线图） | main.tsx + App.tsx(图表) + styles.css + info.json |

> 模板选择不是必须的。用户直接用自然语言描述需求时，Build 的代码生成 Skill 会根据需求自动选择最合适的基础结构。

---

## 五、端到端流程设计

### 5.1 目标流程全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          灵基 Build                                      │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 创建APPS │───▶│ 开发APPS │───▶│ 调试APPS │───▶│ 沙箱测试 │          │
│  │ (对话)   │    │ (对话)   │    │ (预览)   │    │ (→沙箱)  │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│                                                        │                 │
│                                                        │ 测试通过        │
│                                                        ▼                 │
│                                                   ┌──────────┐          │
│                                                   │ 提交生产 │          │
│                                                   └──────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼                             ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│     沙箱环境（开发/测试）       │  │     生产环境                        │
│                                │  │                                    │
│  ┌────────────┐ ┌───────────┐ │  │  ┌──────────────┐ ┌────────────┐  │
│  │ 沙箱Console │ │ 沙箱Work  │ │  │  │ 生产Console  │ │ 生产Work   │  │
│  │ (自动注册  │ │ (端到端   │ │  │  │ (审核/上架)  │ │ (正式使用) │  │
│  │  无需审核) │ │  联调测试)│ │  │  │              │ │            │  │
│  └────────────┘ └───────────┘ │  │  └──────────────┘ └────────────┘  │
└────────────────────────────────┘  └────────────────────────────────────┘
```

### 5.2 关键链路 A：MCP APPS 独立开发

适用场景：用户专门要开发一个 APPS 组件，之后再在 Skill/智能体中引用。

```
1. 用户进入 Build，选择"MCP 开发"，开始新会话
2. 用户用自然语言描述需求
3. Build 澄清需求，确认后生成项目代码
4. 用户在 Build 中通过对话迭代修改
5. 用户预览效果，确认 UI 和交互正确
6. 用户点击"沙箱测试"
   └── Build 执行 vite build → 打包 zip → 提交沙箱 Console（自动注册，无需审核）
7. 用户在沙箱 Work 中端到端测试
   └── 对话 → 触发 Skill → 渲染 APPS → 用户交互 → MCP Tool 调用 → 结果展示
8. 测试通过，用户点击"提交生产"
   └── Build 构建打包 → 提交生产 Console → 进入审核流程
9. 管理员审核上架
10. 生产 Work 中智能体可使用该 APPS 组件
```

### 5.3 关键链路 B：与 Skill 一体化开发

适用场景：用户在开发 Skill 的过程中，发现需要一个自定义 APPS 来承载交互。

```
1. 用户在 Build 中开发 Skill（技能开发模式）
2. 用户描述 Skill 需要展示一个自定义 UI 卡片
3. Build 识别需要创建 APPS，切换到 APPS 开发上下文
4. Build 澄清 APPS 需求，生成代码
5. 用户确认后，Build 自动将 APPS 的 appCode 写入 Skill 的 allowed-tools
6. 用户点击"测试"
   └── Build 检测到 Skill 依赖一个未提交的 APPS
   └── Build 自动先将 APPS 提交到沙箱 Console
   └── 再将 Skill 提交到沙箱
7. 用户在沙箱 Work 中联调
8. 一体化提交：APPS + Skill 按依赖顺序提交生产
```

> **依赖感知规则**：如果 Skill 引用了一个本项目中尚未提交的 APPS，Build 必须在 Skill 测试前自动先提交 APPS。否则沙箱 Work 无法加载该组件。

### 5.4 联调测试流程

```
开发者在 Build 中点击"测试"
    ↓
Build 将 APPS + Skill 自动提交到沙箱环境
    ↓
沙箱 Work 启动，开发者在对话框中输入测试话术
    （如："帮我提个工单"）
    ↓
智能体：意图路由 → 匹配 Skill → 调用 entryTool（虚拟入口）
    ↓
沙箱 Work：加载 APPS 组件 → 注入 toolInput 参数
    ↓
APPS 组件：渲染 UI → 用户在卡片中操作（填写表单、点击按钮）
    ↓
APPS 组件：通过 callServerTool 调用真实 MCP Tool
    ↓
MCP Server：执行业务逻辑，返回结果
    ↓
APPS 组件：展示结果 / 更新 UI / 通知 Host
    ↓
开发者：验证全链路通畅 ✓
```

---

## 六、APPS 项目结构与规范

### 6.1 项目文件结构

当开发者在 Build 中创建 MCP APPS 项目时，自动生成以下标准结构：

```
my-helpdesk-ticket-card/
├── src/
│   ├── App.tsx              ← 主组件（开发者编写的 UI 逻辑）
│   ├── main.tsx             ← 入口文件（SDK 初始化，不需要改）
│   └── styles.css           ← 样式文件
├── public/
│   └── (静态资源)
├── dist/                    ← 构建产物（build 后生成）
│   └── index.html
├── info.json                ← 组件元信息（appCode/relateTools/entryTool等）
├── SKILL.md                 ← 配套 Skill 描述文件
├── package.json             ← 依赖管理
├── vite.config.ts           ← 构建配置
└── mcp-app.config.json      ← 本地调试配置（可选）
```

### 6.2 info.json 关键字段

| 字段 | 说明 | 示例 |
|------|------|------|
| appCode | 组件唯一编码（发布后不可改） | `chin_helpdesk_ticket_confirm` |
| appName | 组件名称 | `工单确认卡` |
| description | 组件描述 | `展示工单草稿，支持编辑确认后提交` |
| mcpConnector | 关联的 MCP 集群连接器 | `{ "type": "OTHERS", "code": "chin_mcp" }` |
| relateTools | 组件需要调用的 MCP 工具列表 | `[{ "name": "Create_Ticket", "writeArtifact": "false" }]` |
| entryTool.virtual | 虚拟入口工具的输入/输出 Schema | 描述组件接受什么参数、返回什么数据 |
| runMode | 运行模式 | `"message"`（对话内）或 `"sidecar"`（侧边栏） |
| version | 版本号 | `"1.0.0"` |

### 6.3 SKILL.md 配套规范

每个 APPS 组件应配套一个 SKILL.md，遵循以下格式：

```markdown
---
name: {skill-name}
description: Use this skill to open the managed MCP App {appName}.
allowed-tools:
- {appCode}
---

# {组件名称}

Use this skill when the user asks to {触发场景描述}.

Call the MCP tool `{appCode}` with the following arguments:
- {参数1}: {说明}
- {参数2}: {说明}
```

Build 在生成 APPS 项目时会自动生成配套的 SKILL.md，用户也可以通过对话修改触发条件和参数说明。

---

## 七、各系统能力要求

### 7.1 Build 侧需要做什么

| # | 能力 | 说明 | 本质（Skill/Tool/UI） | 优先级 |
|---|------|------|---|--------|
| B1 | "MCP 开发"入口 | Build 新增开发模式入口，进入 APPS 开发会话 | UI 入口 | 高 |
| B2 | APPS 需求澄清 | 通过对话解析用户需求，确认组件类型、字段、交互、关联 Tool | Skill | 高 |
| B3 | APPS 代码生成 | 基于需求生成完整项目代码（App.tsx + info.json + SKILL.md） | Skill + Tool | 高 |
| B4 | APPS 代码修改 | 根据对话指令修改已有代码 | Skill | 高 |
| B5 | APPS 实时预览 | 在右侧面板沙箱 iframe 中渲染 APPS，注入模拟 toolInput | Tool + UI | 高 |
| B6 | APPS 构建打包 | 执行 vite build，生成 dist/，打包为标准 zip | Tool | 高 |
| B7 | 一键提交到 Console | 调用 Console API 上传 zip 并获取注册状态 | Tool | 高 |
| B8 | 从 Console 拉取组件列表 | 查询已上架 APPS 供 Skill 引用 | Tool | 高 |
| B9 | Skill 中引用 APPS | allowed-tools 关联 appCode，自动生成引用配置 | Skill 逻辑 | 高 |
| B10 | 端到端联调环境 | 对话→Skill→APPS→MCP Tool 全链路可在沙箱中跑通 | 环境 | 高 |
| B11 | 模板库 | 预置常用 APPS 模板，降低开发门槛 | 资源 | 中 |
| B12 | 依赖感知与自动提交 | 识别 Skill 对未提交 APPS 的依赖，自动先提交 APPS | Skill 逻辑 | 中 |

### 7.2 Console 侧需要做什么

| # | 能力 | 说明 | 优先级 |
|---|------|------|--------|
| C1 | 组件上传 API | 提供标准 API 供 Build 调用，接收 zip 包并注册为业务组件 | 高 |
| C2 | 租户级组件仓库 | 每个租户有自己的组件列表，支持"我上传的"和"官方预置的"分类 | 高 |
| C3 | 组件审核流程 | 上传后可配置是否需要审核（租户可选：免审核/需管理员审核） | 高 |
| C4 | 组件版本管理 | 支持上传新版本、查看历史版本列表、回滚到指定版本 | 中 |
| C5 | 组件启用/停用/下架 | 管理组件的生命周期状态 | 中 |
| C6 | 组件列表查询 API | 提供 API 供 Build 查询当前租户可用组件（含 appCode、名称、描述、版本） | 高 |
| C7 | 对租户开放管理界面 | 租户管理员可在 Console 中管理自己的组件（不依赖 KDManage） | 中 |

### 7.3 MCP APPS 平台侧需要做什么

| # | 能力 | 说明 | 优先级 |
|---|------|------|--------|
| A1 | 开发规范对外公开 | 将 mcp-app-dev-guide 整理为面向客户的公开文档 | 高 |
| A2 | SDK 版本化发布 | @modelcontextprotocol/ext-apps 作为公开 npm 包，提供稳定版本和 changelog | 高 |
| A3 | 模板工程公开 | 提供可直接使用的模板仓库（React/Vue 版本），Build 模板库基于此 | 中 |

---

## 八、与现有机制的兼容

| 现有机制 | 方案兼容策略 |
|---------|-------------|
| 本地 IDE 开发 + zip 上传 | 继续支持。Build 只是新增了一条"对话即开发"路径，不取代本地开发方式 |
| KDManage 上传 | KDManage 作为金蝶内部管理工具继续存在。Console 是面向租户的开放入口 |
| lg_mcpapp_cdn 本地调试 | Build 的预览功能内置了类似机制，无需手动加 URL 参数 |
| info.json 规范 | 完全复用现有规范，Build 只是通过对话辅助生成和编辑 |
| @modelcontextprotocol/ext-apps SDK | 完全复用，Build 项目模板中直接引入 |
| SKILL.md 格式 | 完全复用，Build 在生成 APPS 时自动生成配套 SKILL.md |
| 现有已上架组件 | 不受影响，Console 组件仓库中的已有组件继续可用 |

---

## 九、任务拆解

| # | 任务 | 归属团队 | 前置依赖 | 时间 | 责任人 |
|---|------|---------|---------|------|--------|
| 1 | Console 提供组件上传 API（接收 zip + 注册） | Console/TManage | — | | |
| 2 | Console 提供组件列表查询 API | Console/TManage | — | | |
| 3 | Console 租户级组件管理界面（上传/审核/版本/上下架） | Console/TManage | #1 | | |
| 4 | MCP APPS 开发规范文档对外公开 | APPS 平台 | — | | |
| 5 | SDK（@modelcontextprotocol/ext-apps）版本化公开发布 | APPS 平台 | — | | |
| 6 | Build 新增"MCP 开发"入口 + 模板生成 | Build | #4, #5 | | |
| 7 | Build APPS 需求澄清 Skill 开发 | Build | #6 | | |
| 8 | Build APPS 代码生成 Skill 开发 | Build | #6 | | |
| 9 | Build APPS 代码修改 Skill 开发 | Build | #8 | | |
| 10 | Build APPS 预览能力（沙箱 iframe + 模拟 toolInput） | Build | #6 | | |
| 11 | Build APPS 构建打包 Tool（vite build → zip） | Build | #6 | | |
| 12 | Build 一键提交到 Console（调用上传 API） | Build | #1, #11 | | |
| 13 | Build 从 Console 拉取组件列表 | Build | #2 | | |
| 14 | Build Skill 中引用 APPS 组件（写入 allowed-tools） | Build | #13 | | |
| 15 | Build 端到端联调测试环境 | Build | #10, #14 | | |
| 16 | 组件版本管理（Console 侧 + Build 侧展示） | Console + Build | #3 | | |

---

## 十、风险与待确认项

| # | 风险/待确认 | 影响 | 建议 |
|---|------------|------|------|
| 1 | Build 是否具备运行前端构建工具（vite）的能力 | 决定构建打包的实现方式 | 如 Build 无法运行 vite，则改为服务端构建：Build 将源码提交到构建服务，服务端执行 build 后返回 zip |
| 2 | Console 上传 API 的鉴权和权限模型 | 决定租户只能管理自己的组件 | 需 Console 团队确认 API 权限设计 |
| 3 | Build 沙箱预览是否支持真实 MCP Tool 调用 | 决定预览是"UI 渲染 only"还是"全功能联调" | 建议分两级：快速预览（mock toolResult）+ 联调测试（真实调用） |
| 4 | APPS 引用的 MCP 工具是否必须在集群中已存在 | 影响开发阶段是否能预览 | 建议预览阶段允许 mock，提交时校验工具是否真实存在 |
| 5 | 同一项目中 APPS + Skill 的发布顺序依赖 | APPS 需先上架才能被 Skill 引用 | Build 应感知依赖关系，自动先提交 APPS 再提交 Skill |
| 6 | 架构师资源 | 会议中提到需架构师介入对齐各系统规范 | 需高翔协调 |
| 7 | 对话式代码生成的质量保障 | AI 生成的 APPS 代码质量参差不齐 | 预览环节作为质量门禁；提供模板减少生成自由度；代码规范校验 |
| 8 | 多人协作场景 | 多个开发者在 Build 中编辑同一个 APPS 组件 | 初期不支持，后续结合版本管理能力扩展 |

---

## 附录：Console API 能力要求

Console 需要提供以下接口能力（具体接口格式由 Console 团队定义）：

| # | 能力 | 输入 | 输出 | 说明 |
|---|------|------|------|------|
| 1 | 组件上传 | zip 文件 + 租户信息 + 描述 | 注册状态（成功/待审核/失败） | 支持首次上传和版本更新 |
| 2 | 组件列表查询 | 租户 ID + 状态筛选 | 组件列表（appCode、名称、描述、版本、状态） | 供 Build 拉取可用组件 |
| 3 | 组件版本管理 | appCode + 操作（查看历史/回滚） | 版本列表或操作结果 | 支持多版本和回滚 |
| 4 | 组件审核状态查询 | appCode | 当前审核状态 | Build 展示提交后的处理进度 |
| 5 | 组件启停控制 | appCode + 操作（启用/停用/下架） | 操作结果 | Console 管理界面使用 |
