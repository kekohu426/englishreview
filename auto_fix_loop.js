#!/usr/bin/env node
/**
 * 自动化测试 + 自动修复循环系统
 * 测试 → 发现问题 → AI分析 → 自动修复代码 → 再测试
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = 'http://127.0.0.1:5000/api/generate';
const REPORT_DIR = path.join(__dirname, 'test-reports');
const AUTO_FIX_LOG = path.join(__dirname, 'auto-fix-log.json');
const INTERVAL_MS = 30 * 60 * 1000; // 30分钟

// 测试用例
const TEST_CASES = [
  {
    name: '简单词汇测试',
    input: 'Unit 3: hen, pen, red',
    difficulty: 'level_1',
    minutes: 5,
  },
];

let fixHistory = [];

// 加载历史记录
if (fs.existsSync(AUTO_FIX_LOG)) {
  fixHistory = JSON.parse(fs.readFileSync(AUTO_FIX_LOG, 'utf-8'));
}

/**
 * 执行测试
 */
async function runTest(testCase) {
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testCase.input,
        difficulty: testCase.difficulty,
        target_minutes: testCase.minutes,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: 'FAIL',
        error: `API错误 ${response.status}`,
        errorDetail: errorText,
        duration: elapsed,
      };
    }

    const data = await response.json();
    const typeCounts = {};
    let totalQuestions = 0;

    data.modules.forEach(m => {
      m.items.forEach(q => {
        typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
        totalQuestions++;
      });
    });

    const requiredTypes = [
      'listen_pick_image', 'match_word_image', 'spell_word', 'read_aloud',
      'listen_pick_word', 'listen_judge', 'fill_blank', 'word_order',
      'translate_pick', 'dialogue_complete', 'mixed_challenge', 'letter_sound_trace'
    ];

    const missingTypes = requiredTypes.filter(t => !typeCounts[t]);

    return {
      status: missingTypes.length === 0 ? 'PASS' : 'FAIL',
      duration: elapsed,
      totalQuestions,
      typeCounts,
      missingTypes,
    };

  } catch (error) {
    return {
      status: 'ERROR',
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 分析问题并生成修复方案
 */
function analyzeProblemAndGenerateFix(testResult) {
  const fixes = [];

  if (testResult.error) {
    const errorText = testResult.errorDetail || testResult.error;

    // API速率限制
    if (errorText.includes('429') || errorText.includes('请求数限制')) {
      fixes.push({
        type: 'rate_limit',
        priority: 'HIGH',
        file: 'backend/config.js',
        action: 'increase_delay',
        description: '增加Stage2批次间延迟',
        code: `stage2: {
  batchSize: 1,
  delayMs: 3000,  // 从2000增加到3000
}`,
      });
    }

    // API超时
    if (errorText.includes('504') || errorText.includes('timeout')) {
      fixes.push({
        type: 'timeout',
        priority: 'HIGH',
        file: 'backend/config.js',
        action: 'increase_timeout',
        description: '增加超时时间',
        code: `llm: {
  // ...
  timeoutMs: 600000,  // 从300000增加到600000 (10分钟)
}`,
      });
    }

    // JSON解析错误
    if (errorText.includes('JSON') || errorText.includes('parse')) {
      fixes.push({
        type: 'json_parse',
        priority: 'HIGH',
        file: 'backend/generators/stage1.js 和 stage2.js',
        action: 'improve_json_cleaning',
        description: '改进JSON清理逻辑',
        suggestion: '增强cleanJsonResponse函数，处理更多边界情况',
      });
    }
  }

  // 题型覆盖不完整
  if (testResult.missingTypes && testResult.missingTypes.length > 0) {
    fixes.push({
      type: 'missing_types',
      priority: 'HIGH',
      file: 'prompts/stage1_balanced.md',
      action: 'strengthen_type_coverage',
      description: `缺少题型: ${testResult.missingTypes.join(', ')}`,
      suggestion: '在prompt中强化12题型全覆盖要求',
    });
  }

  return fixes;
}

/**
 * 自动应用修复
 */
async function applyFix(fix) {
  console.log(`\n🔧 自动修复: ${fix.description}`);
  console.log(`   文件: ${fix.file}`);
  console.log(`   操作: ${fix.action}`);

  try {
    switch (fix.action) {
      case 'increase_delay':
        await autoFixIncreaseDelay();
        break;

      case 'increase_timeout':
        await autoFixIncreaseTimeout();
        break;

      case 'strengthen_type_coverage':
        await autoFixStrengthenTypeCoverage();
        break;

      default:
        console.log(`   ⚠️  此修复需要手动处理: ${fix.suggestion}`);
        return false;
    }

    console.log(`   ✅ 修复已应用`);
    return true;

  } catch (error) {
    console.log(`   ❌ 修复失败: ${error.message}`);
    return false;
  }
}

/**
 * 自动修复：增加延迟
 */
async function autoFixIncreaseDelay() {
  const configPath = path.join(__dirname, 'backend/config.js');
  let content = fs.readFileSync(configPath, 'utf-8');

  // 查找当前delayMs值
  const match = content.match(/delayMs:\s*(?:Number\([^)]+\)\s*\|\|\s*)?(\d+)/);
  if (match) {
    const currentDelay = parseInt(match[1]);
    const newDelay = currentDelay + 1000; // 增加1秒

    content = content.replace(
      /delayMs:\s*(?:Number\([^)]+\)\s*\|\|\s*)?\d+/,
      `delayMs: ${newDelay}`
    );

    fs.writeFileSync(configPath, content, 'utf-8');
    console.log(`   延迟从 ${currentDelay}ms 增加到 ${newDelay}ms`);
  }
}

/**
 * 自动修复：增加超时时间
 */
async function autoFixIncreaseTimeout() {
  const configPath = path.join(__dirname, 'backend/config.js');
  let content = fs.readFileSync(configPath, 'utf-8');

  const match = content.match(/timeoutMs:\s*(?:Number\([^)]+\)\s*\|\|\s*)?(\d+)/);
  if (match) {
    const currentTimeout = parseInt(match[1]);
    const newTimeout = Math.min(currentTimeout * 2, 600000); // 翻倍，最多10分钟

    content = content.replace(
      /timeoutMs:\s*(?:Number\([^)]+\)\s*\|\|\s*)?\d+/,
      `timeoutMs: ${newTimeout}`
    );

    fs.writeFileSync(configPath, content, 'utf-8');
    console.log(`   超时从 ${currentTimeout}ms 增加到 ${newTimeout}ms`);
  }
}

/**
 * 自动修复：强化题型覆盖
 */
async function autoFixStrengthenTypeCoverage() {
  const promptPath = path.join(__dirname, 'prompts/stage1_balanced.md');
  let content = fs.readFileSync(promptPath, 'utf-8');

  // 在输出要求前加强调
  if (!content.includes('**再次强调**')) {
    content = content.replace(
      '**只输出JSON',
      `**再次强调：12种题型必须全部出现，每种≥5个task，缺一不可！**

**只输出JSON`
    );

    fs.writeFileSync(promptPath, content, 'utf-8');
    console.log(`   已在prompt中强化12题型覆盖要求`);
  }
}

/**
 * 重启服务器
 */
async function restartServer() {
  console.log('\n🔄 重启服务器...');

  try {
    // Windows环境，杀掉node进程
    await execAsync('taskkill /F /IM node.exe 2>nul').catch(() => {});

    console.log('   等待3秒...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 在后台启动服务器（需要另一个进程管理）
    console.log('   ⚠️  请手动重启服务器: npm start');
    console.log('   或使用 pm2 等进程管理工具实现自动重启');

    return false; // 表示需要手动重启

  } catch (error) {
    console.log(`   ❌ 重启失败: ${error.message}`);
    return false;
  }
}

/**
 * 主循环
 */
async function runCycle() {
  const timestamp = new Date().toISOString();
  console.log('\n' + '='.repeat(70));
  console.log(`🤖 自动化循环 [${timestamp}]`);
  console.log('='.repeat(70));

  // 1. 执行测试
  console.log('\n📋 阶段1: 执行测试');
  const testResult = await runTest(TEST_CASES[0]);

  console.log(`   状态: ${testResult.status}`);
  console.log(`   耗时: ${(testResult.duration / 1000).toFixed(1)}秒`);

  if (testResult.status === 'PASS') {
    console.log(`   ✅ 测试通过! 题数: ${testResult.totalQuestions}, 题型覆盖: ${Object.keys(testResult.typeCounts).length}/12`);
    console.log('\n🎉 系统运行正常，无需修复');
    return;
  }

  // 2. 分析问题
  console.log('\n🔍 阶段2: 分析问题');
  const fixes = analyzeProblemAndGenerateFix(testResult);

  if (fixes.length === 0) {
    console.log('   ⚠️  未识别到可自动修复的问题');
    console.log(`   错误: ${testResult.error}`);
    return;
  }

  console.log(`   识别到 ${fixes.length} 个可修复问题:`);
  fixes.forEach((fix, i) => {
    console.log(`   ${i + 1}. [${fix.priority}] ${fix.description}`);
  });

  // 3. 应用修复
  console.log('\n🔧 阶段3: 应用修复');
  let fixedCount = 0;
  let needsRestart = false;

  for (const fix of fixes) {
    const success = await applyFix(fix);
    if (success) {
      fixedCount++;
      needsRestart = true;

      // 记录修复历史
      fixHistory.push({
        timestamp,
        fix: fix.description,
        file: fix.file,
        action: fix.action,
      });
    }
  }

  // 保存修复历史
  fs.writeFileSync(AUTO_FIX_LOG, JSON.stringify(fixHistory, null, 2), 'utf-8');

  console.log(`\n   ✅ 成功应用 ${fixedCount}/${fixes.length} 个修复`);

  // 4. 重启服务器
  if (needsRestart) {
    console.log('\n🔄 阶段4: 重启服务器');
    const restarted = await restartServer();

    if (!restarted) {
      console.log('\n⏸️  等待手动重启服务器后，将在下个周期继续测试');
    } else {
      console.log('\n✅ 服务器已重启，下个周期将验证修复效果');
    }
  }

  console.log('\n' + '='.repeat(70));
}

/**
 * 启动
 */
async function start() {
  console.log('🚀 自动化测试 + 自动修复系统启动');
  console.log(`⏰ 循环间隔: 30分钟`);
  console.log(`📂 修复日志: ${AUTO_FIX_LOG}`);
  console.log(`🔄 按 Ctrl+C 停止\n`);

  // 立即执行第一次
  await runCycle();

  // 设置定时循环
  setInterval(async () => {
    await runCycle();
  }, INTERVAL_MS);
}

start();
