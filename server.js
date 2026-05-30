const express = require('express');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const TEMP_DIR = '/tmp/ffmpeg-proxy';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const buffer = await response.buffer();
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args);
    let stderr = '';
    process.stderr.on('data', (data) => { stderr += data.toString(); });
    process.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
    process.on('error', reject);
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/transcode', async (req, res) => {
  const { sourceUrl, format = 'mp4', resolution, preset = 'medium' } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl is required' });

  const jobId = generateId();
  const inputPath = path.join(TEMP_DIR, `${jobId}-input`);
  const outputPath = path.join(TEMP_DIR, `${jobId}-output.${format}`);

  try {
    await downloadFile(sourceUrl, inputPath);

    const args = ['-i', inputPath, '-preset', preset];
    if (resolution) {
      const scales = { '1080p': '1920:1080', '720p': '1280:720', '480p': '854:480' };
      if (scales[resolution]) args.push('-vf', `scale=${scales[resolution]}`);
    }
    if (format === 'mp4') {
      args.push('-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart');
    }
    args.push('-y', outputPath);

    await runFFmpeg(args);

    res.download(outputPath, `output.${format}`, () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
  }
});

app.post('/thumbnail', async (req, res) => {
  const { sourceUrl, timestamp = '00:00:01', width = 1280 } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl is required' });

  const jobId = generateId();
  const inputPath = path.join(TEMP_DIR, `${jobId}-input`);
  const outputPath = path.join(TEMP_DIR, `${jobId}-thumb.jpg`);

  try {
    await downloadFile(sourceUrl, inputPath);
    await runFFmpeg([
      '-i', inputPath, '-ss', timestamp, '-vframes', '1',
      '-vf', `scale=${width}:-1`, '-q:v', '2', '-y', outputPath
    ]);

    res.download(outputPath, 'thumbnail.jpg', () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
  }
});

app.post('/extract-audio', async (req, res) => {
  const { sourceUrl, format = 'mp3', bitrate = '192k' } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl is required' });

  const jobId = generateId();
  const inputPath = path.join(TEMP_DIR, `${jobId}-input`);
  const outputPath = path.join(TEMP_DIR, `${jobId}-audio.${format}`);

  try {
    await downloadFile(sourceUrl, inputPath);
    await runFFmpeg([
      '-i', inputPath, '-vn', '-acodec', format === 'mp3' ? 'libmp3lame' : 'aac',
      '-b:a', bitrate, '-y', outputPath
    ]);

    res.download(outputPath, `audio.${format}`, () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
  }
});

app.post('/preview-gif', async (req, res) => {
  const { sourceUrl, startTime = '00:00:00', duration = 5, width = 480 } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl is required' });

  const jobId = generateId();
  const inputPath = path.join(TEMP_DIR, `${jobId}-input`);
  const outputPath = path.join(TEMP_DIR, `${jobId}-preview.gif`);

  try {
    await downloadFile(sourceUrl, inputPath);
    await runFFmpeg([
      '-i', inputPath, '-ss', startTime, '-t', String(duration),
      '-vf', `fps=10,scale=${width}:-1:flags=lanczos`, '-y', outputPath
    ]);

    res.download(outputPath, 'preview.gif', () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
  }
});

app.post('/youtube-optimize', async (req, res) => {
  const { sourceUrl, resolution = '1080p' } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl is required' });

  const jobId = generateId();
  const inputPath = path.join(TEMP_DIR, `${jobId}-input`);
  const outputPath = path.join(TEMP_DIR, `${jobId}-youtube.mp4`);

  const scales = { '4k': '3840:2160', '1080p': '1920:1080', '720p': '1280:720' };

  try {
    await downloadFile(sourceUrl, inputPath);
    await runFFmpeg([
      '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-c:a', 'aac', '-b:a', '256k',
      '-vf', `scale=${scales[resolution] || scales['1080p']}`,
      '-movflags', '+faststart',
      '-y', outputPath
    ]);

    res.download(outputPath, 'youtube-ready.mp4', () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FFmpeg proxy server running on port ${PORT}`);
});
