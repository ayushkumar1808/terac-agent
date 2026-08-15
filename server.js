import "dotenv/config";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import cors from "cors";
import express from "express";
import OpenAI from "openai";

const PORT = Number(process.env.PORT || 3000);
const TERAC_MCP_URL = "https://terac.com/api/mcp";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const MAX_TOOL_ROUNDS = 8;

const AGENT_INSTRUCTIONS = `
You are Terac Agent, a focused assistant that helps people source verified human
experts through Terac. Use the Terac tools when they help complete the request.

Rules:
1. Read the organization context when it is relevant.
2. Convert the user's goal into a specific expert profile, scope, count, timing,
   screening criteria, and deliverable.
3. You may request feasibility and show the quote without a second confirmation.
4. Before launching an opportunity, spending credits, pausing work, or taking
   another consequential action, explain the exact action and ask the user for
   explicit confirmation. A request to find an expert is not confirmation to spend.
5. Do not request Social Security numbers, tax returns, bank data, passwords, or
   authentication codes. Private records should be exchanged later through a
   suitable secure channel.
6. For US tax work, use Certified Public Accountant (CPA) unless the user asks
   for another type of professional.
7. Be concise and clearly state what happened after every tool call.
`.trim();

let openai;
let mcpClient;
let mcpTools;
let mcpConnecting;

function requireEnvironment() {
  const missing = ["OPENAI_API_KEY", "TERAC_API_KEY"].filter(
    (key) => !process.env[key],
  );
  if (missing.length) {
    throw new Error(`Missing server environment variable(s): ${missing.join(", ")}`);
  }
}

function getOpenAI() {
  requireEnvironment();
  openai ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

async function connectTerac() {
  requireEnvironment();
  if (mcpClient && mcpTools) return { client: mcpClient, tools: mcpTools };
  if (mcpConnecting) return mcpConnecting;

  mcpConnecting = (async () => {
    const client = new Client({ name: "terac-agent-web", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(TERAC_MCP_URL), {
      requestInit: {
        headers: { "x-api-key": process.env.TERAC_API_KEY },
      },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    mcpClient = client;
    mcpTools = listed.tools;
    return { client: mcpClient, tools: mcpTools };
  })();

  try {
    return await mcpConnecting;
  } finally {
    mcpConnecting = undefined;
  }
}

function asOpenAITools(tools) {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description || `Call the Terac tool ${tool.name}`,
    parameters: tool.inputSchema || { type: "object", properties: {} },
    strict: false,
  }));
}

function toolOutput(result) {
  if (result?.structuredContent) return JSON.stringify(result.structuredContent);
  if (!Array.isArray(result?.content)) return JSON.stringify(result ?? null);
  return result.content
    .map((item) => (item.type === "text" ? item.text : JSON.stringify(item)))
    .join("\n");
}

async function runAgent(message, previousResponseId) {
  const ai = getOpenAI();
  const { client, tools } = await connectTerac();

  let response = await ai.responses.create({
    model: MODEL,
    instructions: AGENT_INSTRUCTIONS,
    input: message,
    tools: asOpenAITools(tools),
    previous_response_id: previousResponseId || undefined,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      return { text: response.output_text, responseId: response.id };
    }

    const outputs = [];
    for (const call of calls) {
      try {
        const args = call.arguments ? JSON.parse(call.arguments) : {};
        const result = await client.callTool({ name: call.name, arguments: args });
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: toolOutput(result),
        });
      } catch (error) {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: error.message }),
        });
      }
    }

    response = await ai.responses.create({
      model: MODEL,
      instructions: AGENT_INSTRUCTIONS,
      previous_response_id: response.id,
      input: outputs,
      tools: asOpenAITools(tools),
    });
  }

  throw new Error("The agent exceeded its tool-call limit for one message.");
}

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN === "*" ? "*" : process.env.ALLOWED_ORIGIN,
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(express.static("public"));

app.get("/api/health", (_request, response) => {
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.TERAC_API_KEY);
  response.status(configured ? 200 : 503).json({ ok: configured, model: MODEL });
});

app.post("/api/chat", async (request, response) => {
  const message = String(request.body?.message || "").trim();
  const previousResponseId = request.body?.previousResponseId;
  if (!message) return response.status(400).json({ error: "Message is required." });
  if (message.length > 8_000) {
    return response.status(400).json({ error: "Message is too long." });
  }

  try {
    const result = await runAgent(message, previousResponseId);
    return response.json(result);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: error.message || "Agent request failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Terac Agent is listening on port ${PORT}`);
});
