import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import componentDefinitions, { createInfo } from "./components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "components");
const groupNames = {
  employee: "员工服务",
  agent: "处理人",
  manager: "经理运营",
  approval: "审批",
  knowledge: "知识沉淀"
};

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createPreviewIndex(definitions) {
  const groups = Object.entries(groupNames).map(([group, label]) => {
    const buttons = definitions
      .filter((definition) => definition.group === group)
      .map((definition) => `<button type="button" data-card="${escapeHtml(definition.id)}"><span>${escapeHtml(definition.appName)}</span><code>${escapeHtml(definition.view)}</code></button>`)
      .join("\n");
    return `<section><h2>${label}<small>${definitions.filter((definition) => definition.group === group).length}</small></h2>${buttons}</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HelpDesk MCP Apps 本地预览</title>
  <style>
    * { box-sizing: border-box; }
    :root { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202126; background: #f3f4f7; }
    body { margin: 0; min-height: 100vh; }
    .shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
    aside { height: 100vh; overflow: auto; padding: 18px 14px; border-right: 1px solid #e1e3e8; background: #fff; }
    header { margin: 0 4px 18px; }
    h1 { margin: 0; font-size: 17px; }
    header p { margin: 5px 0 0; color: #70737d; font-size: 12px; }
    section { margin-top: 18px; }
    h2 { display: flex; align-items: center; gap: 6px; margin: 0 5px 7px; color: #60636d; font-size: 12px; }
    h2 small { padding: 1px 6px; border-radius: 10px; background: #f0f1f5; }
    button { display: flex; align-items: center; justify-content: space-between; width: 100%; margin: 3px 0; padding: 8px 9px; border: 1px solid transparent; border-radius: 8px; color: #34363d; background: transparent; cursor: pointer; text-align: left; }
    button:hover { background: #f5f4ff; }
    button.active { border-color: #d8d4ff; color: #5146c7; background: #efedff; }
    button span { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    button code { margin-left: 8px; color: #8a8d97; font-size: 10px; }
    main { min-width: 0; padding: 18px; }
    .toolbar { display: flex; align-items: center; gap: 10px; max-width: 900px; margin: 0 auto 12px; }
    .toolbar strong { overflow: hidden; flex: 1; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
    select, a { height: 32px; padding: 0 10px; border: 1px solid #d9dbe2; border-radius: 7px; color: #34363d; background: #fff; font: inherit; font-size: 12px; }
    a { display: inline-flex; align-items: center; text-decoration: none; }
    .stage { max-width: 900px; min-height: calc(100vh - 80px); margin: 0 auto; padding: 24px; border: 1px solid #e0e2e8; border-radius: 12px; background: #fff; box-shadow: 0 3px 14px rgba(23, 29, 43, .05); }
    iframe { display: block; width: 100%; min-height: 720px; border: 0; }
    @media (max-width: 760px) {
      .shell { grid-template-columns: 1fr; }
      aside { height: auto; max-height: 42vh; border-right: 0; border-bottom: 1px solid #e1e3e8; }
      main { padding: 10px; }
      .stage { min-height: 500px; padding: 8px; }
      iframe { min-height: 620px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <header><h1>HelpDesk MCP Apps</h1><p>26 张独立原子卡 · 本地快速预览</p></header>
      ${groups}
    </aside>
    <main>
      <div class="toolbar">
        <strong id="title">卡片预览</strong>
        <select id="locale" aria-label="界面语言"><option value="zh-CN">中文</option><option value="en-US">English</option></select>
        <a id="open" target="_blank" rel="noreferrer">新窗口打开</a>
      </div>
      <div class="stage"><iframe id="frame" title="MCP App 卡片预览"></iframe></div>
    </main>
  </div>
  <script>
    const buttons = Array.from(document.querySelectorAll("[data-card]"));
    const frame = document.getElementById("frame");
    const title = document.getElementById("title");
    const locale = document.getElementById("locale");
    const open = document.getElementById("open");
    const params = new URLSearchParams(location.search);
    let selected = params.get("card") || "employee/ticket-draft";
    if (!buttons.some((button) => button.dataset.card === selected)) selected = buttons[0].dataset.card;
    locale.value = params.get("locale") === "en-US" ? "en-US" : "zh-CN";

    function render(updateUrl = true) {
      const active = buttons.find((button) => button.dataset.card === selected);
      const source = "./" + selected + "/dist/index.html?locale=" + encodeURIComponent(locale.value);
      buttons.forEach((button) => button.classList.toggle("active", button === active));
      title.textContent = active ? active.querySelector("span").textContent + " · " + selected : selected;
      frame.src = source;
      open.href = source;
      if (updateUrl) {
        const next = new URLSearchParams(location.search);
        next.set("card", selected);
        next.set("locale", locale.value);
        history.replaceState(null, "", "?" + next.toString());
      }
    }

    buttons.forEach((button) => button.addEventListener("click", () => { selected = button.dataset.card; render(); }));
    locale.addEventListener("change", () => render());
    render(false);
  </script>
</body>
</html>
`;
}

await rm(outputRoot, { recursive: true, force: true });

for (const definition of componentDefinitions) {
  const target = path.join(outputRoot, definition.group, definition.view);
  await mkdir(target, { recursive: true });
  await run(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], {
    COMPONENT_ID: definition.group,
    VIEW_ID: definition.view
  });
  await writeFile(path.join(target, "info.json"), `${JSON.stringify(createInfo(definition), null, 2)}\n`);
  console.log(`Built ${definition.appCode}`);
}

await writeFile(path.join(outputRoot, "index.html"), createPreviewIndex(componentDefinitions));
console.log("Built local preview index for 26 cards");
