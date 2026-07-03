// github-scheduler.cjs — Runs in GitHub Actions to post scheduled LinkedIn posts
// Mon/Wed/Fri at 7 AM ET (11 AM UTC). Your PC can be off.
const fs = require('fs');
const path = require('path');
const https = require('http');
const httpsMod = require('https');

const LI_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LI_PERSON_URN = process.env.LINKEDIN_PERSON_URN;

if (!LI_ACCESS_TOKEN || !LI_PERSON_URN) {
  console.error('[SCHED] Missing LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN env vars');
  process.exit(1);
}

const DIR = __dirname;
const ARC_PATH = path.join(DIR, 'arc-viz.html');
const STATE_PATH = path.join(DIR, 'state-autosave', 'latest.json');

// ── Helpers ──

function httpsReq(hostname, p, method, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${LI_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202506',
      'Content-Type': 'application/json',
      ...extraHeaders
    };
    const opts = { hostname, path: p, method, headers };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = httpsMod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsUpload(uploadUrl, imageBuffer) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${LI_ACCESS_TOKEN}`,
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
      }
    };
    const mod = url.protocol === 'https:' ? httpsMod : https;
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(imageBuffer);
    req.end();
  });
}

async function uploadImageToLinkedIn(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  
  // Step 1: Initialize upload
  const initBody = JSON.stringify({
    initializeUploadRequest: {
      owner: LI_PERSON_URN
    }
  });
  const init = await httpsReq('api.linkedin.com', '/rest/images?action=initializeUpload', 'POST', initBody);
  
  if (init.status !== 200 && init.status !== 201) {
    console.error(`[SCHED] Image init failed: ${init.status}`, JSON.stringify(init.body).slice(0, 300));
    return null;
  }
  
  const uploadUrl = init.body?.value?.uploadUrl;
  const imageUrn = init.body?.value?.image;
  
  if (!uploadUrl || !imageUrn) {
    console.error('[SCHED] No uploadUrl or image in init response');
    return null;
  }
  
  // Step 2: Upload binary
  const upload = await httpsUpload(uploadUrl, imageBuffer);
  if (upload.status !== 200 && upload.status !== 201) {
    console.error(`[SCHED] Image upload failed: ${upload.status}`);
    return null;
  }
  
  console.log(`[SCHED] Image uploaded: ${imageUrn}`);
  return imageUrn;
}

async function postToLinkedIn(text, imageUrn) {
  const personId = LI_PERSON_URN.split(':').pop();
  const postObj = {
    author: `urn:li:person:${personId}`,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };

  if (imageUrn) {
    postObj.content = {
      media: {
        id: imageUrn
      }
    };
  }

  return httpsReq('api.linkedin.com', '/rest/posts', 'POST', JSON.stringify(postObj));
}

function parseArcViz() {
  const html = fs.readFileSync(ARC_PATH, 'utf-8');

  const postsMatch = html.match(/const posts = \[([\s\S]*?)\];/);
  if (!postsMatch) { console.error('[SCHED] Could not find posts array'); return []; }

  const postsStr = postsMatch[1];
  const postRegex = /\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  const posts = [];
  let m;
  while ((m = postRegex.exec(postsStr)) !== null) {
    try {
      const obj = {};
      const entries = m[1];
      const propRe = /(\w+):"((?:[^"\\]|\\.)*)"/g;
      let pm;
      while ((pm = propRe.exec(entries)) !== null) {
        obj[pm[1]] = pm[2];
      }
      if (obj.spine) {
        // Fix: convert escaped \n to actual newlines
        if (obj.body) {
          obj.body = obj.body.replace(/\\n/g, '\n');
        }
        posts.push(obj);
      }
    } catch {}
  }
  return posts;
}

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function getTodayStr() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
}

// ── Main ──

(async () => {
  const today = getTodayStr();
  console.log(`[SCHED] Today is ${today} (ET)`);

  const validDays = ['Mon', 'Wed', 'Fri'];
  const todayName = today.split(' ')[0];
  if (!validDays.includes(todayName)) {
    console.log(`[SCHED] ${todayName} is not a posting day. Skipping.`);
    process.exit(0);
  }

  const posts = parseArcViz();
  console.log(`[SCHED] Found ${posts.length} posts in arc-viz.html`);

  const state = loadState();
  const statuses = state.statuses || {};
  const linkedinTake = state.linkedinTake || {};

  const readyToday = posts.filter((p, i) => {
    if (p.date !== today) return false;
    const st = statuses[i] || 'draft';
    const liTake = linkedinTake[i];
    return st === 'ready' && liTake != null;
  });

  console.log(`[SCHED] Posts ready for today: ${readyToday.length}`);

  let postedCount = 0;
  for (const p of readyToday) {
    const idx = posts.indexOf(p);
    const liTake = linkedinTake[idx];

    const tag = `[Index: ${idx}, Take: ${liTake || 'original'}]`;
    console.log(`[SCHED] Posting "${p.spine}" ${tag}`);

    let text = p.body || '';
    if (liTake === 'spoken' || liTake === 'fused') {
      const takesKey = `takes_${idx}`;
      const takes = state[takesKey];
      if (takes) {
        if (liTake === 'spoken' && takes.spoken) {
          text = takes.spoken.transcript || text;
        } else if (liTake === 'fused' && takes.fused) {
          text = takes.fused.transcript || text;
        }
      }
    }

    if (!text || text.trim().length < 3) {
      console.log(`[SCHED] SKIP: empty text for "${p.spine}"`);
      continue;
    }

    try {
      // Upload image if present
      let imageUrn = null;
      if (p.image) {
        const imagePath = path.join(DIR, p.image);
        if (fs.existsSync(imagePath)) {
          console.log(`[SCHED] Uploading image: ${p.image}`);
          imageUrn = await uploadImageToLinkedIn(imagePath);
        } else {
          console.log(`[SCHED] Image not found: ${imagePath}, posting without image`);
        }
      }

      const result = await postToLinkedIn(text, imageUrn);
      if (result.status === 200 || result.status === 201) {
        console.log(`[SCHED] POSTED: "${p.spine}" (status ${result.status})`);
        statuses[idx] = 'posted';
        postedCount++;
        const fbStates = state.platformStates || {};
        if (!fbStates[idx]) fbStates[idx] = {};
        fbStates[idx].facebook = 'ready';
        state.platformStates = fbStates;
      } else {
        console.error(`[SCHED] FAILED: "${p.spine}" status ${result.status}:`, JSON.stringify(result.body).slice(0, 300));
      }
    } catch (err) {
      console.error(`[SCHED] ERROR posting "${p.spine}":`, err.message);
    }
  }

  state.statuses = statuses;
  saveState(state);
  console.log(`[SCHED] Done. Posted: ${postedCount}. State saved.`);

  if (postedCount > 0) {
    console.log('[SCHED] ::state-updated::true');
  }
})();
