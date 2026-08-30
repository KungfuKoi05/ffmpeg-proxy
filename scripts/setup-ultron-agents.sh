#!/usr/bin/env bash
#
# setup-ultron-agents.sh -- install the Ultron server and the Agency Agents
# role library for Claude Code.
#
# Both halves are independent and idempotent; re-running is safe.
#
#   ./scripts/setup-ultron-agents.sh                 # both halves
#   ./scripts/setup-ultron-agents.sh --ultron-only
#   ./scripts/setup-ultron-agents.sh --agents-only
#   ./scripts/setup-ultron-agents.sh --start         # boot the server when done
#
# API keys are read from the environment, never baked into this file:
#   DASHSCOPE_API_KEY   embedding backend (required for a working server)
#   ULTRON_API_KEY      OpenAI-compatible LLM key (defaults to DASHSCOPE_API_KEY)
#
set -euo pipefail

ULTRON_GIT=${ULTRON_GIT:-https://github.com/modelscope/ultron.git}
AGENTS_GIT=${AGENTS_GIT:-https://github.com/msitarzewski/agency-agents.git}
WORKDIR=${WORKDIR:-$HOME/.local/share/ultron-setup}
ULTRON_HOME=${ULTRON_HOME:-$HOME/.ultron}
ULTRON_PORT=${ULTRON_PORT:-9999}
ULTRON_HOST=${ULTRON_HOST:-0.0.0.0}

DO_ULTRON=1
DO_AGENTS=1
DO_START=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ultron-only) DO_AGENTS=0 ;;
    --agents-only) DO_ULTRON=0 ;;
    --start)       DO_START=1 ;;
    -h|--help)     sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

say()  { printf '\n==> %s\n' "$*"; }
warn() { printf '  !  %s\n' "$*" >&2; }

# Clone if absent, otherwise fast-forward. Keeps re-runs cheap.
sync_repo() {
  local url=$1 dir=$2
  if [ -d "$dir/.git" ]; then
    say "updating $(basename "$dir")"
    git -C "$dir" pull --ff-only --quiet || warn "could not fast-forward $dir; using the checkout as-is"
  else
    say "cloning $(basename "$dir")"
    git clone --depth 1 "$url" "$dir"
  fi
}

# ---------------------------------------------------------------- Ultron ----
setup_ultron() {
  local src=$WORKDIR/ultron
  local venv=$src/.venv
  sync_repo "$ULTRON_GIT" "$src"

  say "creating virtualenv"
  if [ ! -x "$venv/bin/python" ]; then
    python3 -m venv "$venv"
  fi
  "$venv/bin/python" -m pip install --quiet --upgrade pip

  # The README's `pip install -e .` installs only the CLI dependencies
  # (requests + modelscope_hub). Running the server needs the [server] extra,
  # which is where fastapi, uvicorn, transformers and presidio come from.
  say "installing ultron[server] (this pulls torch; expect several GB)"
  "$venv/bin/python" -m pip install --quiet -e "$src[server]"

  # presidio loads a spaCy model at sanitizer construction time. If it is
  # missing, spaCy shells out to `uv pip install`, which fails with a confusing
  # "No virtual environment found" unless VIRTUAL_ENV happens to be exported.
  # Installing it up front removes that failure mode entirely.
  say "installing spaCy model en_core_web_sm"
  if ! "$venv/bin/python" -c 'import en_core_web_sm' 2>/dev/null; then
    VIRTUAL_ENV="$venv" "$venv/bin/python" -m spacy download en_core_web_sm
  fi

  # ultron.server counts tokens with tiktoken at import time, which downloads
  # the BPE ranks on first use. Warming the cache here turns a hard boot
  # failure on a locked-down network into one obvious error at setup time.
  say "warming tiktoken cache"
  mkdir -p "$ULTRON_HOME/tiktoken-cache"
  if ! TIKTOKEN_CACHE_DIR="$ULTRON_HOME/tiktoken-cache" \
       "$venv/bin/python" -c 'import tiktoken; tiktoken.get_encoding("cl100k_base")' 2>/dev/null; then
    warn "could not fetch the tiktoken encoding (needs openaipublic.blob.core.windows.net)."
    warn "the server will not boot until that host is reachable."
  fi

  say "writing $ULTRON_HOME/.env"
  mkdir -p "$ULTRON_HOME"          # the README's `echo >> ~/.ultron/.env` fails without this
  local llm_key=${ULTRON_API_KEY:-${DASHSCOPE_API_KEY:-}}
  if [ -f "$ULTRON_HOME/.env" ]; then
    warn "$ULTRON_HOME/.env already exists; leaving it untouched"
  else
    (umask 077; cat > "$ULTRON_HOME/.env") <<ENV_EOF
ULTRON_LLM_PROVIDER=dashscope
ULTRON_MODEL=qwen3.6-flash
ULTRON_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ULTRON_API_KEY=${llm_key}
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-}
TIKTOKEN_CACHE_DIR=${ULTRON_HOME}/tiktoken-cache
ENV_EOF
    [ -n "$llm_key" ] || warn "no API key in the environment; fill in $ULTRON_HOME/.env before starting"
  fi

  cat <<INFO

Ultron installed. Start it with:
  cd $src && VIRTUAL_ENV=$venv $venv/bin/uvicorn ultron.server:app \\
    --host $ULTRON_HOST --port $ULTRON_PORT
  # dashboard: http://127.0.0.1:$ULTRON_PORT/dashboard

CLI (same venv):
  $venv/bin/ultron login --server http://localhost:$ULTRON_PORT --username alice
  $venv/bin/ultron upload --framework qoder --name reviewer
INFO
}

# ---------------------------------------------------------------- agents ----
setup_agents() {
  local src=$WORKDIR/agency-agents
  sync_repo "$AGENTS_GIT" "$src"

  say "installing agents into ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/agents"
  # --no-interactive keeps this usable from CI and non-TTY shells; the
  # installer otherwise opens a wizard whenever stdout is a terminal.
  "$src/scripts/install.sh" --tool claude-code --no-interactive

  local dest=${CLAUDE_CONFIG_DIR:-$HOME/.claude}/agents
  say "$(find "$dest" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ') agent files in $dest"
}

mkdir -p "$WORKDIR"
[ "$DO_ULTRON" = 1 ] && setup_ultron
[ "$DO_AGENTS" = 1 ] && setup_agents

if [ "$DO_START" = 1 ] && [ "$DO_ULTRON" = 1 ]; then
  say "starting ultron on $ULTRON_HOST:$ULTRON_PORT"
  cd "$WORKDIR/ultron"
  VIRTUAL_ENV="$WORKDIR/ultron/.venv" exec "$WORKDIR/ultron/.venv/bin/uvicorn" \
    ultron.server:app --host "$ULTRON_HOST" --port "$ULTRON_PORT"
fi

say "done"
