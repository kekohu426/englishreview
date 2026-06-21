import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';
import { loadOPW2 } from './knowledge/opw2_loader.js';
import { loadPhonicsKnowledge } from './knowledge/phonics_loader.js';
import { getLlmThrottleStatus } from './llmThrottle.js';
import { analyzeHomework } from './analysis/homeworkAnalysis.js';
import { assembleUserModules } from './adapters/userClient.js';
import { TYPE_TO_MODULE } from './questionTypes.js';
import { listCustomMaterials, saveCustomMaterial } from './knowledge/customMaterials.js';
import { generatePracticeService } from './services/generatePracticeService.js';
import { AnalysisRequiredError, QualityGateError, isInfrastructureError } from './errors.js';
import { regenerateQuestion } from './renderers/typedRenderer.js';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDistDir = join(__dirname, '../frontend/dist');
let latestPractice = null;

app.use(cors());
app.use(express.json());

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }
  return next(error);
});

console.log('Starting server...');
try {
  loadOPW2();
  loadPhonicsKnowledge();
} catch (error) {
  console.error('Failed to load knowledge base. Server cannot start.');
  console.error(error.message);
  process.exit(1);
}

app.post('/api/analyze-homework', async (req, res) => {
  const { content, material_context = {} } = req.body || {};
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid request: content is required' });
  }

  try {
    const analysis = await analyzeHomework(content, material_context);
    return res.json({ status: 'analysis_ready', analysis });
  } catch (error) {
    console.error('Homework analysis failed:', error.message);
    return res.status(500).json({ error: error.message || 'Homework analysis failed' });
  }
});

app.get('/api/materials', (req, res) => {
  try {
    return res.json({ materials: listCustomMaterials() });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list materials' });
  }
});

app.post('/api/materials/upload', (req, res) => {
  const { label, aliases = [], filename = 'material.md', content = '' } = req.body || {};
  try {
    const material = saveCustomMaterial({ label, aliases, filename, content });
    return res.json({ status: 'uploaded', material, materials: listCustomMaterials() });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to upload material' });
  }
});

app.post('/api/generate', async (req, res) => {
  const { content, difficulty = 'level_2', target_minutes = 20, confirmed_analysis = null } = req.body || {};

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid request: content is required' });
  }

  try {
    const generated = await generatePracticeService({
      content,
      difficulty,
      targetMinutes: target_minutes,
      confirmedAnalysis: confirmed_analysis,
    });
    latestPractice = generated;
    return res.json(latestPractice);
  } catch (error) {
    if (error instanceof AnalysisRequiredError) {
      return res.status(error.statusCode).json({
        status: 'analysis_required',
        analysis: error.analysis,
        message: error.message,
      });
    }
    if (error instanceof QualityGateError) {
      console.error('\nGeneration quality gate failed:', error.message);
      return res.status(error.statusCode).json({
        error: error.message,
        status: 'quality_failed',
        publishable: false,
        audit: {
          overall: 'FAIL',
          stage: error.details?.stage || 'quality',
          missing: error.details?.missing || [],
          coverage: error.details?.coverage || null,
        },
      });
    }
    if (isInfrastructureError(error)) {
      console.error('\nGeneration infrastructure failed:', error.message);
      try {
        const fallback = await generatePracticeService({
          content,
          difficulty,
          targetMinutes: target_minutes,
          confirmedAnalysis: confirmed_analysis,
          mode: 'mock',
        });
        fallback.publishable = false;
        fallback.meta.publishable = false;
        fallback.meta.audit = {
          ...(fallback.meta.audit || {}),
          overall: 'REVIEW_REQUIRED',
          infrastructureError: formatLlmError(error),
        };
        fallback.practice.publishable = false;
        fallback.practice.audit = fallback.meta.audit;
        return res.status(200).json(fallback);
      } catch (fallbackError) {
        return res.status(500).json({ error: fallbackError.message || error.message || 'Internal server error', publishable: false });
      }
    }
    console.error('\nGeneration failed:', error.message);
    console.error(error.stack);
    return res.status(500).json({ error: error.message || 'Internal server error', publishable: false });
  }
});

app.post('/api/practice/regenerate-item', (req, res) => {
  const {
    practice_id = null,
    module_id = null,
    item_id = null,
    type = null,
    reason = '',
    note = '',
    confirmed_analysis = null,
    coverage_context = {},
  } = req.body || {};
  try {
    const item = regenerateQuestion({
      moduleId: module_id,
      itemId: item_id,
      type,
      reason,
      note,
      confirmedAnalysis: confirmed_analysis,
      coverageContext: coverage_context,
    });
    return res.json({
      status: 'regenerated',
      practice_id,
      module_id: item.module_id,
      item,
      audit: { overall: 'PASS', validation: 'pass' },
      publishable: true,
    });
  } catch (error) {
    return res.status(error.statusCode || 422).json({
      status: 'regenerate_failed',
      error: error.message || 'Regeneration failed',
      audit: {
        overall: 'FAIL',
        stage: error.details?.stage || 'regenerate',
        missing: error.details?.missing || [],
      },
      publishable: false,
    });
  }
});

app.post('/api/generate-progress', async (req, res) => {
  const { content, confirmed_analysis = null } = req.body || {};
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid request: content is required' });
  }
  if (!confirmed_analysis) {
    const analysis = await analyzeHomework(content);
    return res.status(409).json({
      status: 'analysis_required',
      analysis,
      message: 'Progressive generation requires confirmed analysis.',
    });
  }
  return res.status(501).json({
    status: 'not_implemented',
    message: 'Progressive generation is paused until the 11-type confirmed-analysis flow is implemented.',
  });
});

app.get('/api/generate-progress/:jobId', (req, res) => {
  return res.status(404).json({ error: 'Progressive generation is paused in this flow.' });
});

app.post('/api/mock-generate', async (req, res) => {
  try {
    const result = await generatePracticeService({
      content: req.body?.content || 'mock practice',
      mode: 'mock',
    });
    result.meta.adapter = 'user-client-v2';
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/review-feedback', (req, res) => {
  const { practice_id = null, module_id = null, item_id = null, type = null, reason = '', note = '', item = null } = req.body || {};
  if (!item_id && !note && !reason) {
    return res.status(400).json({ error: 'Feedback requires item_id, reason, or note.' });
  }
  try {
    const feedbackDir = join(__dirname, '../.ai');
    fs.mkdirSync(feedbackDir, { recursive: true });
    const record = {
      created_at: new Date().toISOString(),
      practice_id,
      module_id,
      item_id,
      type,
      reason,
      note,
      item,
    };
    fs.appendFileSync(join(feedbackDir, 'review-feedback.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
    return res.json({ status: 'recorded' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to record feedback.' });
  }
});

app.get('/api/latest-practice', (req, res) => {
  const practice = latestPractice || readLatestPracticeFromDisk();
  if (!practice) {
    return res.status(404).json({ error: 'No generated practice is available yet.' });
  }
  return res.json(practice);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      llm: config.llm.provider,
      model: config.llm.model,
      mockGeneration: config.features.mockGeneration,
      minQuestionsPerType: config.questions.minPerType,
      requiredTypes: config.questions.requiredTypes.length,
      stage2UseLLM: config.stage2.useLLM,
      stage2Mode: config.stage2.mode,
      stage2Renderer: config.stage2.mode || (config.stage2.useLLM ? 'llm' : 'local'),
      stage2AiTypes: config.stage2.aiTypes,
      throttle: getLlmThrottleStatus(),
    },
  });
});

app.use(express.static(join(__dirname, '../public')));
if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

if (fs.existsSync(frontendDistDir)) {
  app.get('*', (req, res) => {
    res.sendFile(join(frontendDistDir, 'index.html'));
  });
}

export function assembleModules(questions) {
  return assembleUserModules(questions);
}

export function getModuleIdFromQuestion(question) {
  if (question.module_id) return question.module_id;
  return TYPE_TO_MODULE[question.type] || 'm1';
}

function formatLlmError(error) {
  const message = String(error?.message || 'Internal server error');
  if (message.includes('API_KEY_DISABLED')) return 'LLM API key is disabled; generated local fallback practice.';
  if (message.includes('INVALID_API_KEY')) return 'LLM API key is invalid; generated local fallback practice.';
  if (message.includes('429')) return 'LLM API rate limited; generated local fallback practice.';
  if (/LLM API error: 5\d\d/.test(message)) return 'LLM API temporarily unavailable; generated local fallback practice.';
  return message;
}

function readLatestPracticeFromDisk() {
  const generatedDir = join(__dirname, '../.ai/generated');
  try {
    const files = fs.readdirSync(generatedDir)
      .filter(file => file.endsWith('-modules.json'))
      .map(file => {
        const fullPath = join(generatedDir, file);
        return { file, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = files[0];
    if (!latest) return null;
    return {
      modules: JSON.parse(fs.readFileSync(latest.fullPath, 'utf8')),
      meta: { mode: 'latest_disk', source: latest.file },
      updatedAt: new Date(latest.mtimeMs).toISOString(),
    };
  } catch (error) {
    return null;
  }
}

const { port, host } = config.server;
app.listen(port, host, () => {
  console.log('Server started successfully');
  console.log(`Address: http://${host}:${port}`);
  console.log(`Health: http://${host}:${port}/health`);
});
