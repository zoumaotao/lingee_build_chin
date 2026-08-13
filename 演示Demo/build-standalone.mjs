import { readFile, writeFile } from "node:fs/promises";

const [template, css, javascript] = await Promise.all([
  readFile(new URL("./index.template.html", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8")
]);

const inlineScript = javascript.replaceAll("</script", "<\\/script");
const html = template
  .replace(/\s*<base href="[^"]+" \/>/, "")
  .replace(/\s*<script>\s*\/\/ 直接双击本文件时[\s\S]*?<\/script>/, "")
  .replace('  <link rel="stylesheet" href="./styles.css" />', `  <style>\n${css}\n  </style>`)
  .replace('  <script src="./app.js" defer></script>', `  <script>\n${inlineScript}\n  </script>`);

if (html.includes('./styles.css') || html.includes('./app.js')) {
  throw new Error("Standalone build still contains external application assets");
}

await writeFile(new URL("./index.html", import.meta.url), html);
console.log(`Built standalone index.html (${Buffer.byteLength(html)} bytes)`);
