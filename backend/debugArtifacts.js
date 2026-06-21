import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = path.join(__dirname, '../.ai/generated');

export function writeGenerationArtifacts(runId, artifacts) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });

  const latest = {};
  Object.entries(artifacts).forEach(([name, value]) => {
    const fileName = `${runId}-${name}.json`;
    const filePath = path.join(DEBUG_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
    latest[name] = filePath;
  });

  fs.writeFileSync(
    path.join(DEBUG_DIR, 'latest.json'),
    JSON.stringify({ runId, generatedAt: new Date().toISOString(), files: latest }, null, 2),
    'utf-8'
  );

  return latest;
}

export function createRunId(prefix = 'generation') {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

export default {
  createRunId,
  writeGenerationArtifacts,
};
