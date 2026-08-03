# Build 构建 MCP APPS 方案设计

> 目标：使灵基 Build 具备 MCP APPS 组件的完整开发能力，实现从创建→开发→调试→上传→编排→使用的端到端闭环  
> 面向：Build 产品团队、Console（TManage）团队、MCP APPS 平台团队  
> 状态：方案初稿，待各方评审对齐

---

## 一、背景与问题

### 1.1 当前现状

MCP APPS 是灵基智能体与用户之间的可视化交互层（对话中嵌入的自定义 UI 卡片），当前的开发和使用流程如下：

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

### 1.2 核心问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | APPS 开发完全在本地 IDE，与 Build 割裂 | Build 号称"一站式开发"但缺了交互层 |
| 2 | 上传入口在 KDManage（金蝶内部平台），客户无法自助 | 每次变更都要走金蝶内部流程 |
| 3 | Build 中做 Skill/智能体时无法同步做 APPS | 交互层和逻辑层开发完全分离，联调困难 |
| 4 | 开发者需在 5+ 工具间切换 | 本地 IDE → KDManage → Build → Console → Work |
| 5 | 无版本管理 | APPS 组件修改后无法回滚、无法对比 |

### 1.3 目标

**一句话目标**：开发者在 Build 中就能完成 MCP APPS 的创建、开发、调试、上传、编排和使用——不需要离开 Build 去操作 KDManage，也不需要在本地 IDE 和 Build 之间反复切换。

---

## 二、MCP APPS 当前机制完整介绍

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
  "cloud": "zcy",                          // 云环境标识
  "domain": "kingdee",                     // 业务域
  "appCode": "zcy_kingdee_mcpapp_test",    // 全局唯一编码（同时作为虚拟工具名）
  "appName": "mcpapp测试demo",             // 组件名称
  "description": "...",                    // 描述
  "capabilityDescription": {
    "support": "数据报表",                  // 支持的能力
    "notSupport": "表单"                    // 不支持的能力
  },
  "mcpConnector": {
    "type": "XK",                          // 集群连接器类型
    "code": "xkmcp_test"                   // 集群连接器编码
  },
  "runMode": "message",                    // 运行模式：message(对话内) / sidecar(侧边栏)
  "version": "1.0.0",                      // 版本号
  "dependsOnApp": {                        // 依赖上游组件声明（可选）
    "appCode": "",
    "writeArtifactTool": ""
  },
  "relateTools": [                         // 组件引用的 MCP 工具列表
    { "name": "tool_name", "writeArtifact": "false" }
  ],
  "entryTool": {                           // 虚拟入口工具（定义组件接受的参数）
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

## 三、角色定义

| 角色 | 说明 | 典型操作 |
|------|------|---------|
| **APPS 组件开发者** | 编写 MCP APPS 前端代码的人 | 创建 APPS 项目、编码、调试、打包、上传 |
| **智能体/技能开发者** | 在 Build 中构建智能体和 Skill 的人 | 编排 Skill 引用 APPS 组件、联调测试 |
| **运营管理员** | 在 Console（TManage）中管理组件的人 | 审核上架、启用/停用、版本管理 |

> 实际项目中，APPS 开发者和智能体开发者可能是同一个人（如振兴 HelpDesk 项目）。方案需支持"一个人在 Build 中同时做 APPS + Skill + 智能体"的场景。

---

## 四、端到端流程设计

### 3.1 目标流程全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          灵基 Build                                      │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 创建APPS │───▶│ 开发APPS │───▶│ 调试APPS │───▶│ 提交APPS │          │
│  │ 项目     │    │ (编码)   │    │ (预览)   │    │ (→Console)│          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│       │                                                │                 │
│       │         同一项目上下文中                         │                 │
│       ▼                                                ▼                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 创建Skill│───▶│ 引用APPS │───▶│ 联调测试 │───▶│ 提交上线 │          │
│  └──────────┘    │ 组件     │    │ (端到端) │    └──────────┘          │
│                  └──────────┘    └──────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Console（TManage）                                    │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ 组件仓库     │    │ 审核/上架    │    │ 版本管理     │              │
│  │ (接收Build   │    │              │    │ (回滚/对比)  │              │
│  │  提交的APPS) │    │              │    │              │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        灵基 Work（运行时）                                │
│                                                                          │
│  智能体对话 → Skill 触发 → 渲染 APPS 组件 → 用户交互                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 关键链路拆解

#### 链路 A：APPS 独立开发（先做 APPS，再做 Skill/智能体）

```
Build 中创建 APPS 项目
    ↓ 脚手架生成（基于模板）
Build 中编码开发（对话辅助 + 代码编辑器）
    ↓
Build 中实时预览（沙箱 iframe 渲染）
    ↓
Build 中一键提交到 Console 组件仓库
    ↓
Console 审核上架
    ↓
回到 Build，创建 Skill 时从组件库选择该 APPS
    ↓
编排智能体，绑定 Skill
    ↓
端到端联调测试
```

#### 链路 B：Skill/智能体开发中同步创建 APPS（一体化开发）

```
Build 中创建智能体项目
    ↓ 包含 Skill + APPS 的一体化项目结构
开发 Skill（对话式）
    ↓ 开发过程中 Build 识别到需要自定义 APPS
Build 自动生成 APPS 脚手架（或开发者手动创建）
    ↓
在同一项目中编码 APPS
    ↓
Skill 引用该 APPS（通过 appCode 关联）
    ↓
联调：对话触发 Skill → 渲染 APPS → 用户交互 → 数据回传
    ↓
一键提交（Skill + APPS + 智能体 统一发布）
```

---

## 五、各系统能力拆分

### 4.1 Build 侧需要做什么

| # | 能力 | 说明 | 优先级 |
|---|------|------|--------|
| B1 | 创建 APPS 项目 | 提供"新建 MCP APPS"入口，基于模板生成标准项目结构（info.json + src/ + vite.config.ts） | 高 |
| B2 | APPS 代码编辑 | 在 Build 中展示和编辑 APPS 源代码，支持对话辅助生成/修改代码 | 高 |
| B3 | APPS 实时预览 | Build 中嵌入沙箱 iframe 预览 APPS 渲染效果，支持模拟 toolInput 注入 | 高 |
| B4 | APPS 构建打包 | 在 Build 中执行 vite build，生成 dist/ + info.json 的 zip 包 | 高 |
| B5 | 一键提交到 Console | Build 中点击"提交"将打包好的 zip 推送到 Console 组件仓库（调用 Console API） | 高 |
| B6 | 从 Console 拉取组件 | Build 中创建 Skill 时，可浏览 Console 组件仓库，选择已上架的 APPS 组件进行引用 | 高 |
| B7 | Skill 中引用 APPS | Skill 的 allowed-tools 中可关联 APPS 的 appCode，Build 自动生成 SKILL.md 的引用配置 | 高 |
| B8 | 端到端联调 | 在 Build 的测试环境中，对话触发 Skill → 渲染 APPS → 完整交互链路可跑通 | 高 |
| B9 | APPS + Skill + 智能体统一项目 | 支持在同一个 Build 项目中包含 APPS、Skill、智能体，统一管理和发布 | 中 |
| B10 | APPS 模板库 | 预置常用模板（表单卡片、列表卡片、图表卡片等），新建时可选 | 中 |
| B11 | 对话式 APPS 开发 | 开发者用自然语言描述需求，Build AI 自动生成 APPS 代码 | 中 |
| B12 | 本地开发热更新通道 | 对于复杂 APPS，支持开发者在本地 IDE 编码、Build 中实时预览（类似当前 lg_mcpapp_cdn 机制） | 低 |

### 4.2 Console（TManage）侧需要做什么

| # | 能力 | 说明 | 优先级 |
|---|------|------|--------|
| C1 | 开放组件上传 API | 提供标准 API 供 Build 调用，接收 zip 包并注册为业务组件 | 高 |
| C2 | 租户级组件仓库 | 每个租户有自己的组件列表，支持"我上传的"和"官方预置的"分类展示 | 高 |
| C3 | 组件审核流程 | 上传后可配置是否需要审核（租户可选：免审核/需管理员审核） | 高 |
| C4 | 组件版本管理 | 支持上传新版本、查看历史版本列表、回滚到指定版本 | 中 |
| C5 | 组件启用/停用/下架 | 管理组件的生命周期状态 | 中 |
| C6 | 组件浏览 API | 提供 API 供 Build 查询当前租户可用的组件列表（含 appCode、名称、描述、版本） | 高 |
| C7 | 对租户开放管理界面 | 租户管理员可在 Console 中查看、管理自己上传的组件（不依赖 KDManage） | 中 |

### 4.3 MCP APPS 平台侧需要做什么

| # | 能力 | 说明 | 优先级 |
|---|------|------|--------|
| A1 | 开发规范对外公开 | 将 mcp-app-dev-guide 整理为面向客户的公开文档 | 高 |
| A2 | SDK 版本化发布 | @modelcontextprotocol/ext-apps 作为公开 npm 包，提供稳定版本和 changelog | 高 |
| A3 | 模板工程公开 | 提供可直接 clone 使用的模板仓库（React/Vue 版本） | 中 |

---

## 六、信息架构：组件在各系统中如何流转

### 5.1 组件生命周期状态流转

```
                Build                          Console                        Work
                  │                              │                             │
    [创建/开发]   │                              │                             │
         │        │                              │                             │
         ▼        │                              │                             │
    ┌─────────┐   │      提交（zip + meta）      │                             │
    │ 开发中  │───┼─────────────────────────────▶│                             │
    └─────────┘   │                              │                             │
                  │                    ┌─────────▼─────────┐                   │
                  │                    │ 待审核/已上架      │                   │
                  │                    │ (组件仓库中)       │                   │
                  │                    └─────────┬─────────┘                   │
                  │                              │                             │
                  │◀── 拉取可用组件列表 ──────────┤                             │
                  │                              │                             │
    ┌─────────┐   │                              │      运行时加载             │
    │Skill引用│   │                              ├────────────────────────────▶│
    │该组件   │   │                              │                             │
    └─────────┘   │                              │                             │
```


---

## 七、Build 中 APPS 项目结构

### 6.1 项目文件结构

当开发者在 Build 中"新建 MCP APPS 项目"时，自动生成以下标准结构：

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
└── mcp-app.config.json      ← 本地调试配置
```

### 6.2 info.json 关键字段（开发者需填写）

| 字段 | 说明 | 示例 |
|------|------|------|
| appCode | 组件唯一编码（发布后不可改） | `chin_helpdesk_ticket_confirm` |
| appName | 组件名称 | `工单确认卡` |
| description | 组件描述 | `展示工单草稿，支持编辑确认后提交` |
| mcpConnector | 关联的 MCP 集群连接器 | `{ "type": "OTHERS", "code": "chin_mcp" }` |
| relateTools | 组件需要调用的 MCP 工具列表 | `[{ "name": "Create_Ticket", "writeArtifact": "false" }]` |
| entryTool.virtual | 虚拟入口工具的输入/输出 Schema | 描述组件接受什么参数、返回什么数据 |
| runMode | 运行模式 | `"message"` |

---

## 八、关键交互流程

### 7.1 在 Build 中创建 APPS 的交互流程

```
开发者：在 Build 中选择"新建 MCP APPS"
    ↓
Build：展示模板选择（空白 / 表单卡片 / 列表卡片 / 图表）
    ↓
开发者：选择模板，填写 appCode 和名称
    ↓
Build：自动生成项目文件结构
    ↓
开发者：生产 App.tsx、info.json（对话让 AI 生成，包含 relateTools、entryTool Schema等）
    ↓
开发者：点击"预览"
    ↓
Build：在右侧面板渲染沙箱 iframe，模拟 toolInput 注入，展示 APPS 效果
    ↓
开发者：反复调试直到满意
    ↓
开发者：点击"构建并提交"
    ↓
Build：执行 vite build → 打包 zip → 调用 Console API 上传
    ↓
Console：接收 zip，注册组件，返回 status
    ↓
Build：展示"提交成功，待审核"或"已上架"
```

### 7.2 在 Build 中开发 Skill 时引用 APPS 的交互流程

```
开发者：在 Build 中开发 Skill
    ↓
Build 对话：这个 Skill 是否需要展示 UI 给用户？
    ↓
开发者：展示一个工单确认卡片
    ↓
Build：从 Console 拉取当前租户已上架的 APPS 列表，展示给开发者选择
    ↓ 或
Build：检测到当前项目中有未提交的 APPS，也可直接引用
    ↓
开发者：选择"工单确认卡"（appCode: chin_helpdesk_ticket_confirm）
    ↓
Build：自动将 appCode 写入 SKILL.md 的 allowed-tools
    ↓
开发者：配置 Skill 的提示词，描述何时触发该 APPS
    ↓
测试：在 Build 的对话测试中触发 Skill → 渲染 APPS 组件 → 验证交互
```

### 7.3 联调测试流程

```
开发者：在 Build 中点击"测试"
    ↓
沙箱：Work 运行时
    ↓
开发者：在对话框中输入测试话术（如"帮我提个工单"）
    ↓
智能体：意图路由 → 触发 Skill → 调用 entryTool（虚拟入口）
    ↓
沙箱：加载 APPS 组件 HTML → 注入 toolInput
    ↓
APPS 组件：渲染 UI → 用户在卡片中填写/操作
    ↓
APPS 组件：调用 callServerTool（真实 MCP Tool 调用）
    ↓
MCP Server：返回结果
    ↓
APPS 组件：展示结果 / 更新 UI
    ↓
开发者：验证全链路是否通畅
```

---

## 九、与现有机制的兼容

| 现有机制 | 方案兼容策略 |
|---------|-------------|
| 本地 IDE 开发 + zip 上传 | 继续支持。Build 只是新增了一条路径，不取代本地开发方式 |
| KDManage 上传 | KDManage 作为金蝶内部管理工具继续存在。Console 是面向租户的开放入口 |
| lg_mcpapp_cdn 本地调试 | Build 的预览功能内置了类似机制，无需手动加 URL 参数 |
| info.json 规范 | 完全复用现有规范，Build 只是提供了可视化编辑界面 |
| @modelcontextprotocol/ext-apps SDK | 完全复用，Build 项目模板中直接引入 |
| SKILL.md 格式 | 完全复用，Build 在引用 APPS 时自动生成 |

---

## 十、任务拆解

| # | 任务 | 归属团队 | 前置依赖 | 时间 | 责任人 |
|---|------|---------|---------|------|--------|
| 1 | Console 提供组件上传 API（接收 zip + 注册） | Console/TManage | — | | |
| 2 | Console 提供组件列表查询 API | Console/TManage | — | | |
| 3 | Console 租户级组件管理界面（上传/审核/版本/上下架） | Console/TManage | #1 | | |
| 4 | MCP APPS 开发规范文档对外公开 | APPS 平台 | — | | |
| 5 | SDK（@modelcontextprotocol/ext-apps）版本化公开发布 | APPS 平台 | — | | |
| 6 | Build 新增"创建 MCP APPS 项目"入口 + 模板生成 | Build | #4, #5 | | |
| 7 | Build APPS 代码编辑器（含对话辅助生成） | Build | #6 | | |
| 8 | Build APPS 预览（沙箱 iframe + 模拟 toolInput） | Build | #6 | | |
| 9 | Build APPS 构建打包（vite build → zip） | Build | #6 | | |
| 10 | Build 一键提交到 Console（调用上传 API） | Build | #1, #9 | | |
| 11 | Build 从 Console 拉取组件列表（调用查询 API） | Build | #2 | | |
| 12 | Build Skill 编辑中引用 APPS 组件（写入 allowed-tools） | Build | #11 | | |
| 13 | Build 端到端联调测试环境（对话→Skill→APPS→MCP Tool） | Build | #8, #12 | | |
| 14 | Build APPS + Skill + 智能体统一项目结构支持 | Build | #6, #12 | | |
| 15 | Build APPS 模板库（表单/列表/图表等预置模板） | Build | #6 | | |
| 16 | 组件版本管理（Console 侧 + Build 侧展示） | Console + Build | #3 | | |

---

## 十一、风险与待确认项

| # | 风险/待确认 | 影响 | 建议 |
|---|------------|------|------|
| 1 | Build 是否具备运行前端构建工具（vite）的能力 | 决定 #9 的实现方式 | 如果 Build 无法运行 vite，则改为：Build 将源码提交到服务端，服务端执行构建后返回 zip |
| 2 | Console 上传 API 的鉴权和权限模型 | 决定租户只能管理自己的组件 | 需 Console 团队确认 API 权限设计 |
| 3 | Build 沙箱预览是否支持真实 MCP Tool 调用 | 决定预览是"UI 渲染 only"还是"全功能联调" | 建议分两级：快速预览（mock toolResult）+ 联调测试（真实调用） |
| 4 | APPS 引用的 MCP 工具是否必须在集群中已存在 | 影响开发阶段是否能预览 | 建议预览阶段允许 mock，提交时校验工具是否存在 |
| 5 | 同一项目中 APPS + Skill 的发布顺序依赖 | APPS 需先上架才能被 Skill 引用 | Build 应感知依赖关系，自动先提交 APPS 再提交 Skill |
| 6 | 架构师资源 | 会议中提到需架构师介入对齐规范 | 需高翔协调 |


### 附录

#### Build → Console（提交组件）

```json
POST /api/v1/mcp-apps/upload
Content-Type: multipart/form-data

{
  "file": "<zip binary>",
  "tenantId": "xxx",
  "operatorId": "xxx",
  "description": "工单确认卡组件 v1.1",
  "autoApprove": false
}

Response:
{
  "appCode": "zcy_kingdee_mcpapp_test",
  "version": "1.1.0",
  "status": "pending_review" | "approved",
  "uploadTime": "2026-08-01T10:00:00Z"
}
```

#### Console → Build（查询组件列表）

```json
GET /api/v1/mcp-apps/list?tenantId=xxx&status=approved

Response:
{
  "components": [
    {
      "appCode": "zcy_kingdee_mcpapp_test",
      "appName": "工单确认卡",
      "description": "展示工单草稿并支持编辑确认",
      "version": "1.0.0",
      "runMode": "message",
      "capabilityDescription": { "support": "表单交互", "notSupport": "图表" },
      "relateTools": ["Create_Ticket", "Get_Ticket_Schema"],
      "status": "approved",
      "updatedAt": "2026-07-28T10:00:00Z"
    }
  ]
}
```