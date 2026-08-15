#!/usr/bin/env python3
"""A small, safety-gated CLI agent for Terac MCP."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys


TERAC_URL = "https://terac.com/api/mcp"

TERAC_TOOLS = [
    "terac_get_context",
    "terac_list_opportunities",
    "terac_request_feasibility",
    "terac_get_feasibility_request",
    "terac_launch_draft_opportunity",
    "terac_get_submissions",
    "terac_pause_opportunity",
]

AGENT_POLICY = """
You are a focused Terac human-work agent. Use the Terac MCP server as the only
external system for this request.

Operating rules:
1. Begin by reading the organization context when it is relevant.
2. Turn the user's outcome into a clear expert profile, scope, count, timing,
   screening criteria, and deliverable. Ask concise questions when a missing
   choice would materially change cost or results.
3. A feasibility request may be prepared after the user has reviewed the
   proposed scope. Show the returned quote, assumptions, and timing clearly.
4. Never launch an opportunity, spend money, pause work, approve or reject a
   submission, or make another consequential change without the user's explicit
   confirmation in the current session. A general request to find someone is
   not confirmation to spend.
5. Prefer drafts and reversible actions. State exactly what changed.
6. Do not request or transmit Social Security numbers, tax returns, bank data,
   passwords, authentication codes, or other sensitive personal records. The
   agent may source a qualified professional, but private records should be
   exchanged later through an appropriate secure channel.
7. For US tax work, use the credential "Certified Public Accountant (CPA)"
   unless the user explicitly asks for a different professional.
8. If a Terac tool or account state blocks the request, report the exact blocker
   without switching to browser automation or another external service.
""".strip()


def find_codex() -> str:
    override = os.environ.get("TERAC_AGENT_CODEX")
    candidates = [
        override,
        "/Applications/ChatGPT.app/Contents/Resources/codex",
        shutil.which("codex"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise SystemExit(
        "Codex CLI was not found. Install the ChatGPT/Codex desktop app or set "
        "TERAC_AGENT_CODEX to the Codex CLI path."
    )


def toml_string_list(values: list[str]) -> str:
    return "[" + ",".join(f'\"{value}\"' for value in values) + "]"


def mcp_overrides(tools: list[str], approval_mode: str) -> list[str]:
    return [
        "-c",
        f'mcp_servers.terac.url="{TERAC_URL}"',
        "-c",
        'mcp_servers.terac.auth="oauth"',
        "-c",
        f'mcp_servers.terac.default_tools_approval_mode="{approval_mode}"',
        "-c",
        f"mcp_servers.terac.enabled_tools={toml_string_list(tools)}",
    ]


def run_checked(command: list[str]) -> int:
    try:
        return subprocess.run(command, check=False).returncode
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 130


def check(codex: str) -> int:
    local = subprocess.run(
        [codex, "mcp", "list"],
        check=False,
        text=True,
        capture_output=True,
    )
    combined = f"{local.stdout}\n{local.stderr}"
    terac_lines = [line for line in combined.splitlines() if line.strip().startswith("terac")]
    if local.returncode != 0 or not terac_lines:
        print("Terac MCP is not configured.", file=sys.stderr)
        print(f"Run: {codex} mcp add terac --url {TERAC_URL}", file=sys.stderr)
        return local.returncode or 1
    if not any("OAuth" in line for line in terac_lines):
        print("Terac MCP is configured but not authenticated.", file=sys.stderr)
        print(f"Run: {codex} mcp login terac", file=sys.stderr)
        return 1

    prompt = (
        "Call only terac_get_context. This is a read-only connectivity check. "
        "Do not create or modify anything. Report whether it succeeded, the "
        "organization name, and the project count."
    )
    command = [
        codex,
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--color",
        "never",
        *mcp_overrides(["terac_get_context"], "auto"),
        prompt,
    ]
    return run_checked(command)


def run_agent(codex: str, request: str) -> int:
    prompt = f"{AGENT_POLICY}\n\nUser request:\n{request}"
    command = [
        codex,
        "--sandbox",
        "read-only",
        "--ask-for-approval",
        "never",
        "--no-alt-screen",
        *mcp_overrides(TERAC_TOOLS, "writes"),
        prompt,
    ]
    return run_checked(command)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="terac-agent",
        description="Source and coordinate verified human experts through Terac MCP.",
    )
    subparsers = parser.add_subparsers(dest="command")
    subparsers.add_parser("check", help="Run a read-only MCP connectivity check.")
    run_parser = subparsers.add_parser("run", help="Start an interactive Terac agent session.")
    run_parser.add_argument("request", nargs="+", help="The outcome you want from a human expert.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    codex = find_codex()
    if args.command == "check":
        return check(codex)
    if args.command == "run":
        return run_agent(codex, " ".join(args.request))
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
