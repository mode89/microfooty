EXCLUDE = [
    # Leak: these state the rules and the design the code must carry alone.
    "SPEC.md",
    "ROADMAP.md",
    "MEMORY.md",
    "AGENTS.md",
    # Noise.
    ".git",
    "node_modules",
    "package-lock.json",
    "**/__pycache__",
]

AGENT_COMMAND = [
    "pi",
    "-p",
    "--no-session",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--mode",
    "text",
    "--model",
    "openai-codex/gpt-5.6-luna:low",
    "{prompt}",
]

TIMEOUT = 300
