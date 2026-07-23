import fs from 'fs';
import path from 'path';

const API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83';
const ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro';
const OUTPUT = 'C:\\Users\\steve\\MeWorld\\dev\\screenshots\\diverticulitis-2026-07-23\\images\\descent-gaps-2-3x3.png';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const promptText = fs.readFileSync(
    'C:\\Users\\steve\\MeWorld\\dev\\screenshots\\diverticulitis-2026-07-23\\descent-gaps-2-prompt.md',
    'utf-8'
  );
  
  console.log(`Prompt length: ${promptText.length} chars`);
  
  // Ensure output dir exists
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  
  // Step 1: Create the task
  console.log('Creating Magnific task...');
  const createRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-magnific-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: promptText,
      aspect_ratio: '1:1',
      resolution: '2K',
    }),
  });
  
  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`Create failed (${createRes.status}): ${errText}`);
    process.exit(1);
  }
  
  const created = await createRes.json();
  const taskId = created?.data?.task_id || created?.task_id;
  if (!taskId) {
    console.error('No task_id in response:', JSON.stringify(created, null, 2));
    process.exit(1);
  }
  console.log(`Task created: ${taskId}`);
  
  // Step 2: Poll for completion
  const started = Date.now();
  let imageUrl = null;
  while (Date.now() - started < 300000) {
    await sleep(3000);
    const pollRes = await fetch(`${ENDPOINT}/${taskId}`, {
      headers: { 'x-magnific-api-key': API_KEY },
    });
    
    if (pollRes.status === 429) {
      console.log('  Rate limited, waiting...');
      await sleep(10000);
      continue;
    }
    
    if (!pollRes.ok) {
      const errText = await pollRes.text();
      console.error(`Poll failed (${pollRes.status}): ${errText}`);
      process.exit(1);
    }
    
    const payload = await pollRes.json();
    const data = payload?.data || payload;
    const status = String(data?.status || '').toUpperCase();
    console.log(`  Status: ${status} (${Math.round((Date.now() - started) / 1000)}s)`);
    
    if (status === 'COMPLETED') {
      const urls = data?.generated;
      if (Array.isArray(urls) && urls[0]) {
        imageUrl = urls[0];
        break;
      }
      console.error('Completed but no image URL');
      process.exit(1);
    }
    if (status === 'FAILED') {
      console.error('Task failed:', data?.message || 'unknown');
      process.exit(1);
    }
  }
  
  if (!imageUrl) {
    console.error('Timed out waiting for completion');
    process.exit(1);
  }
  
  // Step 3: Download and save
  console.log(`Downloading image from: ${imageUrl}`);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    console.error(`Download failed: ${imgRes.status}`);
    process.exit(1);
  }
  
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(OUTPUT, buffer);
  const sizeKb = Math.round(buffer.length / 1024);
  console.log(`Saved: ${OUTPUT} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
