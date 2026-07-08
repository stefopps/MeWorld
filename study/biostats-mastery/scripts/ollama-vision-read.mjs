// Ollama vision reader — describe an image for visual plates
// Usage: node scripts/ollama-vision-read.mjs <image-path> [model]
// Default model: llava:latest

const fs = require('fs');
const http = require('http');
const path = require('path');

const imagePath = process.argv[2];
const model = process.argv[3] || 'llava:latest';

if (!imagePath) {
  console.error('Usage: node scripts/ollama-vision-read.mjs <image-path> [model]');
  process.exit(1);
}

const absPath = path.resolve(imagePath);
if (!fs.existsSync(absPath)) {
  console.error('File not found:', absPath);
  process.exit(1);
}

const img = fs.readFileSync(absPath);
const b64 = img.toString('base64');

const body = JSON.stringify({
  model,
  prompt: 'Describe this image in 2-3 sentences. What is the visual analogy or concept being shown? Focus on what would make this useful as a teaching diagram for a student.',
  images: [b64],
  stream: false
});

console.log(`Asking ${model} about: ${absPath}\n`);

const req = http.request({
  hostname: 'localhost',
  port: 11434,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      console.log(j.response);
    } catch (e) {
      console.error('Parse error:', data.substring(0, 300));
    }
  });
});

req.on('error', e => {
  console.error('Ollama not reachable at localhost:11434');
  console.error(e.message);
});

req.write(body);
req.end();
