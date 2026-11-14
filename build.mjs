import { readFile, mkdir, writeFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const [template, css, model, catalog, storage, app, copyEditor, events, homeTemplate, homeCss, home] = await Promise.all(
  ["page.html", "style.css", "model.js", "catalog.js", "supabase.js", "app.js", "event-copy-editor.js", "events.js",
    "home.html", "home.css", "home.js"].map(read),
);
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, VERCEL } = process.env;
const hasEnvironmentConfig = VERCEL === "1" || SUPABASE_URL !== undefined || SUPABASE_PUBLISHABLE_KEY !== undefined;
const config = hasEnvironmentConfig
  ? { url: SUPABASE_URL?.trim().replace(/\/+$/, ""), key: SUPABASE_PUBLISHABLE_KEY?.trim() }
  : await read("supabase.config.json").then(JSON.parse).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
if (config && (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)
  || !/^sb_publishable_[\w-]+$/.test(config.key))) {
  throw new Error("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (sb_publishable_...).");
}
const publicConfig = config ? { url: config.url, key: config.key } : null;
const script = ["const supabaseConfig = " + JSON.stringify(publicConfig) + ";", model, catalog, storage, app, copyEditor, events].join("\n");
const page = template
  .replace("/* STYLE */", () => css)
  .replace("/* SCRIPTS */", () => script.replaceAll("</script", "<\\/script"));
const homePage = homeTemplate
  .replace("/* HOME_STYLE */", () => homeCss)
  .replace("/* HOME_SCRIPT */", () => [model, catalog, home].join("\n").replaceAll("</script", "<\\/script"));
await mkdir(new URL("dist/painel/", root), { recursive: true });
await writeFile(new URL("dist/index.html", root), homePage);
await writeFile(new URL("dist/painel/index.html", root), page);
