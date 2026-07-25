// magnific-generate-one.js — submit, poll, download one Magnific image via REST API
// Usage: node magnific-generate-one.js "<prompt>" "<output-filepath>"

const API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83';
const ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro';
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60; // 3 minutes max

const prompt = process.argv[2];
const outPath = process.argv[3];

if (!prompt || !outPath) {
  console.error('Usage: node magnific-generate-one.js "<prompt>" "<output-filepath>"');
  process.exit(1);
}

const headers = {
  'x-magnific-api-key': API_KEY,
  'Content-Type': 'application/json',
};

async function main() {
  console.log(`\n=== Submitting prompt ===\n${prompt.substring(0, 120)}...`);

  // Step 1: Submit
  const submitRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      aspect_ratio: '16:9',
      resolution: '2K',
    }),
  });
  const submitData = await submitRes.json();

  if (!submitRes.ok) {
    console.error('SUBMIT FAILED:', submitRes.status, JSON.stringify(submitData, null, 2));
    process.exit(2);
  }

  const taskId = submitData.task_id || submitData.data?.task_id;
  if (!taskId) {
    console.error('No task_id in response:', JSON.stringify(submitData, null, 2));
    process.exit(2);
  }
  console.log(`Task ID: ${taskId}`);

  // Step 2: Poll
  let imageUrl = null;
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(`${ENDPOINT}/${taskId}`, { headers });
    const pollData = await pollRes.json();

    const status = pollData.status || pollData.data?.status;
    console.log(`  Poll ${i + 1}: ${status}`);

    if (status === 'COMPLETED' || status === 'completed') {
      imageUrl = pollData.generated?.[0] || pollData.data?.generated?.[0];
      break;
    }
    if (status === 'FAILED' || status === 'failed') {
      console.error('Generation FAILED:', JSON.stringify(pollData, null, 2));
      process.exit(2);
    }
  }

  if (!imageUrl) {
    console.error('Timed out waiting for completion.');
    process.exit(2);
  }

  // Step 3: Download
  console.log(`Downloading: ${imageUrl}`);
  const dlRes = await fetch(imageUrl);
  if (!dlRes.ok) {
    console.error('Download failed:', dlRes.status);
    process.exit(2);
  }

  const buffer = Buffer.from(await dlRes.arrayBuffer());
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`SAVED: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  console.log('DONE.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(2);
});
