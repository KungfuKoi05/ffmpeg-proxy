# Setup

Step-by-step installation. If you just want the short version, run
`./scripts/setup.sh` and skip to [Running it](#running-it).

---

## 1. Install FFmpeg

FFmpeg does all the video work. FFprobe ships with it.

### macOS

```bash
brew install ffmpeg
```

No Homebrew? Install it from [brew.sh](https://brew.sh), or download a static
build from [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) and put `ffmpeg`
and `ffprobe` somewhere on your `PATH`.

### Debian / Ubuntu

```bash
sudo apt update
sudo apt install ffmpeg
```

### Fedora / RHEL

```bash
sudo dnf install ffmpeg          # needs RPM Fusion enabled
```

### Arch

```bash
sudo pacman -S ffmpeg
```

### Windows

```powershell
winget install Gyan.FFmpeg
```

Or download from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/),
unzip it, and add the `bin` folder to your `PATH`.

### Check it worked

```bash
ffmpeg -version
ffprobe -version
```

Both must print a version. If the shell says "command not found", FFmpeg isn't
on your `PATH` yet — reopen your terminal, and on Windows confirm the `bin`
folder was added to the system `PATH`.

---

## 2. Install Python 3.10 or newer

```bash
python3 --version
```

* **macOS:** `brew install python@3.12`
* **Ubuntu/Debian:** `sudo apt install python3 python3-venv python3-pip`
* **Windows:** `winget install Python.Python.3.12`
* Or [python.org/downloads](https://www.python.org/downloads/)

On Debian and Ubuntu, `python3-venv` is a separate package and you will need it.

---

## 3. Install Node.js 18 or newer

Only needed to build the web interface, which you do once.

```bash
node --version
```

* **macOS:** `brew install node`
* **Ubuntu/Debian:** `sudo apt install nodejs npm`
* **Windows:** `winget install OpenJS.NodeJS.LTS`
* Or [nodejs.org](https://nodejs.org)

---

## 4. Install the app

### The easy way

```bash
./scripts/setup.sh
```

This checks every tool, creates the virtual environment, installs the Python
and Node dependencies, builds the web UI, and creates your `.env`.

Add local speech-to-text at the same time (see [step 6](#6-optional-transcription-for-videos-without-captions)):

```bash
WITH_WHISPER=1 ./scripts/setup.sh
```

### The manual way

```bash
# Backend
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r backend/requirements.txt

# Frontend
cd frontend
npm install
npm run build
cd ..

# Config
cp .env.example .env
```

On Windows the virtual environment paths use backslashes:

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
```

---

## 5. Running it

```bash
./scripts/start.sh
```

Open **http://127.0.0.1:8000**.

Manually, if you prefer:

```bash
./.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

To change the port:

```bash
PORT=9000 ./scripts/start.sh
```

### Development mode

```bash
./scripts/dev.sh
```

Runs the backend with auto-reload on `:8000` and the Vite dev server on
`:5173`. **Open the 5173 one** — it proxies `/api` through to the backend, so
the ownership cookie and video streaming behave exactly as in production.

---

## 6. Optional: transcription for videos without captions

Most YouTube videos publish captions, and the app uses them automatically —
instantly and for free. For videos that have none, install `faster-whisper` to
transcribe locally:

```bash
./.venv/bin/pip install -r backend/requirements-whisper.txt
```

The first video you process will download a model (~150 MB for `base`), cached
under `~/.cache/huggingface`. Transcription then costs roughly 1–3 minutes of
CPU per hour of video.

Pick a different size in `.env`:

```
WHISPER_MODEL=tiny     # fastest, least accurate
WHISPER_MODEL=base     # default; good balance
WHISPER_MODEL=small    # slower, more accurate
WHISPER_MODEL=medium   # much slower, most accurate
```

Set `WHISPER_ENABLED=0` to turn the fallback off entirely.

---

## 7. Optional: AI clip ranking

Off by default, and the app is complete without it. If you want a model to
re-rank the top candidates and write clip titles:

```bash
# in .env
LLM_RANKING_ENABLED=1
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

The model only ever chooses from candidate ranges the app already generated and
validated. Any timestamp it returns is re-checked against the real candidate
list, and anything unrecognised is discarded and the built-in ranking is used
instead.

---

## 8. Verify the install

```bash
# Fast unit tests - about a second
./.venv/bin/python -m pytest -m "not e2e" -q

# Full suite, including real video rendering - a few minutes
./.venv/bin/python -m pytest -q
```

Or check what the app itself thinks:

```bash
curl -s http://127.0.0.1:8000/api/system/status | python3 -m json.tool
```

`"ready": true` means every required tool is present.

---

## Troubleshooting the install

**`python3 -m venv` fails on Ubuntu**
`sudo apt install python3-venv`

**`pip install` fails building a wheel**
Update pip first: `./.venv/bin/pip install --upgrade pip setuptools wheel`

**`npm install` fails**
Delete `frontend/node_modules` and `frontend/package-lock.json`, then retry.
Confirm `node --version` is 18 or newer.

**The page loads but says the API is unreachable**
The backend isn't running, or something else is on port 8000. Start it with
`./scripts/start.sh`, or set a different `PORT`.

**The page is blank at http://127.0.0.1:8000**
The UI hasn't been built. Run `cd frontend && npm run build`.

**Everything installs but jobs fail immediately**
Check `/api/system/status`. Almost always FFmpeg isn't on the `PATH` of the
shell that launched the server.
