import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const page = new URL("./dist/index.html", import.meta.url);
const port = Number(process.env.MUTIRAO_PORT || 4188);

createServer(async (request, response) => {
  if (request.url !== "/" || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const html = await readFile(page);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(request.method === "GET" ? html : undefined);
  } catch {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Gere a página com node build.mjs.");
  }
}).listen(port, "127.0.0.1", () => console.log("Painel em http://127.0.0.1:" + port + "/"));
