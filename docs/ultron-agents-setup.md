# Ultron + Agency Agents setup

Two independent pieces, installed by `scripts/setup-ultron-agents.sh`:

| Piece | Source | Lands in |
|---|---|---|
| Ultron server — collective memory / skill / harness hub | [modelscope/ultron](https://github.com/modelscope/ultron) | `~/.local/share/ultron-setup/ultron` (venv inside) |
| Agency Agents — 273 role presets across 18 divisions | [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) | `~/.claude/agents/` |

The two are related: Ultron's README credits agency-agents as the source of the
role presets surfaced in its Harness Hub.

```bash
./scripts/setup-ultron-agents.sh                # both halves
./scripts/setup-ultron-agents.sh --agents-only  # just the Claude Code agents
./scripts/setup-ultron-agents.sh --start        # install, then boot the server
```

Keys are read from the environment (`DASHSCOPE_API_KEY`, optionally
`ULTRON_API_KEY`) and written to `~/.ultron/.env` with `umask 077`. An existing
`.env` is never overwritten.

## Why not just run the README's block

Ultron's server-deployment block is short, but three things bite on a clean
machine. Each of these was hit and confirmed while writing this script:

**1. `~/.ultron` does not exist yet.** The README opens with
`echo 'ULTRON_LLM_PROVIDER=dashscope' >> ~/.ultron/.env`, but nothing has
created that directory, so the very first line fails:

```
/bin/bash: line 1: /root/.ultron/.env: No such file or directory
```

`ultron/.env.example` does say "create `~/.ultron` if needed" — the README block
just doesn't. The script runs `mkdir -p` first.

**2. `pip install -e .` cannot run the server.** The base install resolves nine
packages (`requests`, `modelscope_hub`, and their transitive deps). `fastapi`,
`uvicorn`, `transformers` and `presidio` all live in the `server` extra, so the
README's next command dies immediately:

```
ModuleNotFoundError: No module named 'fastapi'
```

The script installs `-e .[server]`, which adds 116 packages on top of the base
nine and pulls several GB of torch and CUDA wheels.

**3. A missing spaCy model fails in a misleading way.** `ultron.utils.sanitizer`
builds a presidio `AnalyzerEngine`, which wants a spaCy model. When it is
absent, spaCy shells out to `uv pip install`, and uv — invoked from a
non-activated venv — reports something with no obvious connection to Ultron,
spaCy or presidio:

```
error: No virtual environment found; run `uv venv` to create an environment,
or pass `--system` to install into a non-virtual environment
```

`import ultron` succeeds and every submodule imports cleanly; only
`import ultron.server` trips it. The script installs `en_core_web_sm` up front
so the auto-download path is never taken.

## Network requirements

`ultron/server.py` builds an `Ultron()` at module scope, which constructs an
`LLMService`, which calls `tiktoken.get_encoding("cl100k_base")`. tiktoken
downloads its BPE ranks on first use, so **the server cannot boot until
`openaipublic.blob.core.windows.net` is reachable**. The setup script warms that
cache and points `TIKTOKEN_CACHE_DIR` at `~/.ultron/tiktoken-cache`, so the
fetch happens once, at setup, instead of failing at boot.

Beyond that the server needs DashScope reachable for embeddings and LLM calls.

## Verified

Checked on Python 3.11.15 while writing this:

- `ultron[server]` installs; all seven API routers
  (`auth`, `dashboard`, `harness`, `memory`, `repo`, `skills`, `system`)
  import and expose a `router`; uvicorn 0.52.4 present.
- `~/.ultron/.env` is picked up: `llm_provider=dashscope`,
  `embedding_backend=dashscope`, `embedding_model=text-embedding-v4`,
  `data_dir=/root/.ultron`, and the DashScope key resolves.
- `ultron` CLI exposes `login`, `upload`, `download`, `convert`, `list`,
  `watch`, `stop`, `restore`.
- agency-agents installs 273 agents across 18 divisions into `~/.claude/agents/`.

Not verified: a running server. The sandbox this was set up in denies the
tiktoken host at the proxy (`403` on CONNECT to
`openaipublic.blob.core.windows.net:443`), which is the sole remaining blocker —
the traceback stops at `token_budget.py:30`, with everything above it loaded.
On a network that allows that host, `--start` should boot it; treat the first
real boot as unproven until you see `/dashboard` respond.

## Using the agents

Agent files are flat markdown in `~/.claude/agents/`, prefixed by division
(`engineering-*`, `design-*`, `academic-*`, …), each with `name`, `description`,
`color`, `emoji` and `vibe` frontmatter. Claude Code picks them up on restart.

To install one division rather than all 273:

```bash
~/.local/share/ultron-setup/agency-agents/scripts/install.sh \
  --tool claude-code --division engineering --no-interactive
```

`--dry-run` prints the plan without writing, and `CLAUDE_CONFIG_DIR` overrides
the destination.
