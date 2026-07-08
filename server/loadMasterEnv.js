import fs from 'fs';
import path from 'path';

const MASTER_ENV = path.join(process.env.USERPROFILE || '', '.cursor', 'master.env');
const ENV_LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

/** Load Steve master.env into process.env (does not overwrite existing keys). */
export function loadMasterEnv({ overwrite = false } = {}) {
  const loaded = {};
  if (!fs.existsSync(MASTER_ENV)) return loaded;
  for (const raw of fs.readFileSync(MASTER_ENV, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(ENV_LINE);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    loaded[m[1]] = value;
    if (overwrite || process.env[m[1]] == null || process.env[m[1]] === '') {
      process.env[m[1]] = value;
    }
  }
  return loaded;
}
