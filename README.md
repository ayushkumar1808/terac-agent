# Terac Agent

A small local agent for sourcing and coordinating verified human experts through Terac MCP. It reuses the Terac OAuth connection already stored by Codex, so there is no API key in this package.

## Quick start

From this folder, verify the connection:

```sh
./terac-agent check
```

Start an interactive request:

```sh
./terac-agent run "Find one US-based CPA for a personal tax consultation"
```

The agent can clarify the brief, check organization context, request feasibility, review quotes, create a draft, and inspect results. Changes made through Terac use Codex's `writes` approval mode. Read-only calls can proceed automatically, while write operations prompt for approval.

## Safety behavior

- No opportunity is launched and no money is spent without explicit confirmation in the current session.
- The agent prefers feasibility checks and drafts before consequential actions.
- Shell access is read-only and command approvals are disabled for the agent session.
- Only the listed Terac MCP tools are enabled for the session.
- Sensitive tax records, Social Security numbers, bank details, passwords, and authentication codes must not be entered into the agent.

## Commands

```text
terac-agent check
terac-agent run <request>
```

`check` performs a real, read-only `terac_get_context` call. `run` opens an interactive Codex session with Terac-specific instructions and approval gates.

## Requirements

- macOS with the ChatGPT/Codex desktop app, or a recent Codex CLI on `PATH`
- Terac configured as an MCP server named `terac`
- Completed Terac OAuth login
- Python 3

If Codex is installed somewhere else, set its path:

```sh
export TERAC_AGENT_CODEX=/path/to/codex
```

## Terac MCP setup

If needed:

```sh
codex mcp add terac --url https://terac.com/api/mcp
codex mcp login terac
```

The ChatGPT desktop app, Codex CLI, and IDE extension share MCP configuration on the same Codex host. See the [official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and the [Terac installation guide](https://terac.com/docs/researchers/mcp/install).

## Notes

This is an orchestration tool, not tax or legal advice. The professional sourced through Terac remains responsible for their advice and services.
