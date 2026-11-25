import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// A stand-in for OpenRouter: records what Remy sends and answers like a chat model.
test("scanText: sends the PDF itself to the AI, returns its words, and '' for a non-resume", async () => {
  let body: any = null, reply = "Jordan Rivera\nEDUCATION\n- Texas Christian University";
  const srv = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      body = JSON.parse(d);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: reply } }] }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  process.env.CUSTOM_CRED_OPENROUTER_AI_URL = `http://127.0.0.1:${(srv.address() as any).port}`;
  process.env.CUSTOM_CRED_OPENROUTER_AI_PROXY_AUTH_KEY = "test";
  process.env.OR_AI_CHAIN = "openrouter:anthropic/claude-haiku-5.5";
  try {
    const { scanText } = await import("./parse");
    const pdf = Buffer.from("%PDF-1.4 fake scan");
    assert.equal(await scanText(pdf), reply);
    const file = body.messages[1].content.find((p: any) => p.type === "file");
    assert.equal(file.file.file_data, "data:application/pdf;base64," + pdf.toString("base64"));
    reply = "NOT_A_RESUME";
    assert.equal(await scanText(pdf), "");
  } finally { srv.close(); }
});
