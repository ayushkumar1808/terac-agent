# Terac Agent

A deployable public web agent that connects OpenAI to Terac MCP. Visitors get a
simple chat interface and do not need Codex, Terac, or an OpenAI account.

The repository also keeps the original local CLI for laptop use.

## Deploy the public demo on Render

1. Generate a Terac API key under your organization's **Settings → API Keys**.
   Terac keys begin with `tk_`.
2. Create an OpenAI API key in the OpenAI platform.
3. Open Render's Blueprint flow and select this GitHub repository.
4. Enter `OPENAI_API_KEY` and `TERAC_API_KEY` when Render asks for them.
5. Deploy. Render gives you a public URL that anyone can open.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/ayushkumar1808/terac-agent)

The included `render.yaml` configures the web service. The free Render plan may
sleep while idle, so the first request after a quiet period can be slower.

## Use it from Lovable

The deployed app is already a complete public website. To use a Lovable-made
frontend instead, call the same backend endpoint:

```http
POST https://YOUR-RENDER-URL/api/chat
Content-Type: application/json

{
  "message": "Find a US CPA for personal taxes",
  "previousResponseId": null
}
```

Send the returned `responseId` as `previousResponseId` on the next message to
continue the conversation. `ALLOWED_ORIGIN=*` allows a Lovable preview or
deployed site to call the demo backend.

## Run locally

```sh
cp .env.example .env
# Add your keys to .env
npm install
npm start
```

Open `http://localhost:3000`.

Required variables:

```text
OPENAI_API_KEY=sk-...
TERAC_API_KEY=tk_...
```

Optional variables:

```text
OPENAI_MODEL=gpt-5.4
PORT=3000
ALLOWED_ORIGIN=*
```

## Demo behavior

- Terac tools are discovered dynamically from its remote MCP server.
- The model can read context, request feasibility, inspect opportunities, and
  handle other tools exposed by Terac.
- The agent asks for explicit confirmation before launching paid work.
- The API is intentionally public and has no user authentication or rate limit.
  Anyone with the URL can use your OpenAI and Terac credits.

## Original local CLI

If you prefer the laptop-only version that reuses Codex OAuth:

```sh
./terac-agent check
./terac-agent run "Find one US-based CPA for a personal tax consultation"
```

The local CLI requires Codex and a completed Terac OAuth login. The hosted web
version does not use Codex and authenticates to Terac with `TERAC_API_KEY`.

This project coordinates expert sourcing. It does not provide tax or legal
advice.
