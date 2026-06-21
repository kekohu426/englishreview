#!/usr/bin/env node
/**
 * 自动化测试调度器
 * 每30分钟执行一次测试，生成报告，供开发优化
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = 'http://127.0.0.1:5000/api/generate';
const REPORT_DIR = path.join(__dirname, 'test-reports');
const INTERVAL_MS = 30 * 60 * 1000; // 30分钟

// 确保报告目录存在
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// 测试用例
const TEST_CASES = [
  {
    name: '简单词汇测试',
    input: 'Unit 3: hen, pen, red',
    difficulty: 'level_1',
    minutes: 5,
  },
  {
    name: 'Unit4完整测试',
    input: `## Unit 4 复习要求

本周重点复习可数名词与不可数名词，以及 How much / How many 的区分使用。

### 重点词汇
- 不可数名词：corn, watermelon, chicken, juice
- 可数名词复数：potatoes, pears, grapes

### 句型练习
1. How much + 不可数名词
2. How many + 可数名词复数
3. What do you have?`,
    difficulty: 'level_2',
    minutes: 15,
  },
];

/**
 * 执行单个测试用例
 */
async function runTest(testCase) {
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
        name: testCase.name,
        status: 'FAIL',
        error: `API错误 ${response.status}`,
        errorDetail: errorText,
        duration: elapsed,
      };
    }

    const data = await response.json();

    // 统计题型
    const typeCounts = {};
    let totalQuestions = 0;

    data.modules.forEach(m => {
      m.items.forEach(q => {
        typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
        totalQuestions++;
      });
    });

    // 检查12题型覆盖
    const requiredTypes = [
      'listen_pick_image', 'match_word_image', 'spell_word', 'read_aloud',
      'listen_pick_word', 'listen_judge', 'fill_blank', 'word_order',
      'translate_pick', 'dialogue_complete', 'mixed_challenge', 'letter_sound_trace'
    ];

    const missingTypes = requiredTypes.filter(t => !typeCounts[t]);
    const insufficientTypes = requiredTypes.filter(t => (typeCounts[t] || 0) < 5);

    return {
      name: testCase.name,
      status: missingTypes.length === 0 ? 'PASS' : 'FAIL',
      duration: elapsed,
      totalQuestions,
      typeCounts,
      missingTypes,
      insufficientTypes,
      modules: data.modules.length,
    };

  } catch (error) {
    return {
      name: testCase.name,
      status: 'ERROR',
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 执行所有测试
 */
async function runAllTests() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `run-${timestamp}`;

  console.log('\n' + '='.repeat(70));
  console.log(`🤖 自动化测试开始 [${runId}]`);
  console.log('='.repeat(70));
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`📝 测试用例数: ${TEST_CASES.length}`);
  console.log('');

  const results = [];

  for (const testCase of TEST_CASES) {
    console.log(`▶️  运行: ${testCase.name}`);
    const result = await runTest(testCase);
    results.push(result);

    console.log(`   状态: ${result.status}`);
    console.log(`   耗时: ${(result.duration / 1000).toFixed(1)}秒`);
    if (result.status === 'PASS') {
      console.log(`   题数: ${result.totalQuestions}`);
      console.log(`   题型覆盖: ${Object.keys(result.typeCounts).length}/12`);
    } else {
      console.log(`   ❌ 错误: ${result.error || '题型覆盖不完整'}`);
    }
    console.log('');

    // 测试间延迟3秒
    if (TEST_CASES.indexOf(testCase) < TEST_CASES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 生成报告
  const report = generateReport(runId, results);

  // 保存报告
  const reportPath = path.join(REPORT_DIR, `${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  const summaryPath = path.join(REPORT_DIR, `${runId}.txt`);
  fs.writeFileSync(summaryPath, generateSummaryText(report), 'utf-8');

  console.log('='.repeat(70));
  console.log(`📊 测试报告已生成:`);
  console.log(`   JSON: ${reportPath}`);
  console.log(`   摘要: ${summaryPath}`);
  console.log('='.repeat(70));
  console.log('');

  return report;
}

/**
 * 生成测试报告
 */
function generateReport(runId, results) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  return {
    runId,
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      errors,
      successRate: ((passed / results.length) * 100).toFixed(1) + '%',
    },
    results,
    recommendations: generateRecommendations(results),
  };
}

/**
 * 生成优化建议
 */
function generateRecommendations(results) {
  const recommendations = [];

  results.forEach(result => {
    if (result.status === 'ERROR') {
      if (result.error.includes('429')) {
        recommendations.push({
          priority: 'HIGH',
          issue: 'API速率限制',
          suggestion: '增加批次间延迟时间，或降低并发数',
          file: 'backend/config.js',
          action: '将 stage2.delayMs 从 2000 增加到 3000',
        });
      } else if (result.error.includes('504')) {
        recommendations.push({
          priority: 'HIGH',
          issue: 'API超时',
          suggestion: 'Stage1 prompt太长，继续精简',
          file: 'prompts/stage1_balanced.md',
          action: '进一步删减非核心内容',
        });
      } else if (result.error.includes('JSON')) {
        recommendations.push({
          priority: 'MEDIUM',
          issue: 'JSON解析失败',
          suggestion: '改进cleanJsonResponse函数',
          file: 'backend/generators/stage1.js 或 stage2.js',
          action: '增强JSON提取逻辑',
        });
      }
    }

    if (result.status === 'FAIL' && result.missingTypes?.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: `缺少题型: ${result.missingTypes.join(', ')}`,
        suggestion: '检查fallback逻辑是否正常工作',
        file: 'backend/generators/fallback.js',
        action: '确保兜底逻辑正确生成缺失题型',
      });
    }

    if (result.status === 'PASS' && result.duration > 60000) {
      recommendations.push({
        priority: 'LOW',
        issue: '生成速度慢（>60秒）',
        suggestion: '优化并发策略',
        file: 'backend/config.js',
        action: '考虑增加batchSize（在不触发速率限制的前提下）',
      });
    }
  });

  // 去重
  const unique = [];
  recommendations.forEach(r => {
    if (!unique.find(u => u.issue === r.issue)) {
      unique.push(r);
    }
  });

  return unique;
}

/**
 * 生成纯文本摘要
 */
function generateSummaryText(report) {
  let text = `# 自动化测试报告\n\n`;
  text += `运行ID: ${report.runId}\n`;
  text += `时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n\n`;

  text += `## 总览\n\n`;
  text += `- 总测试数: ${report.summary.total}\n`;
  text += `- ✅ 通过: ${report.summary.passed}\n`;
  text += `- ❌ 失败: ${report.summary.failed}\n`;
  text += `- 🚨 错误: ${report.summary.errors}\n`;
  text += `- 成功率: ${report.summary.successRate}\n\n`;

  text += `## 详细结果\n\n`;
  report.results.forEach((r, i) => {
    text += `### ${i + 1}. ${r.name}\n`;
    text += `- 状态: ${r.status}\n`;
    text += `- 耗时: ${(r.duration / 1000).toFixed(1)}秒\n`;
    if (r.status === 'PASS') {
      text += `- 题目数: ${r.totalQuestions}\n`;
      text += `- 题型覆盖: ${Object.keys(r.typeCounts).length}/12\n`;
    } else if (r.error) {
      text += `- 错误: ${r.error}\n`;
    }
    text += `\n`;
  });

  if (report.recommendations.length > 0) {
    text += `## 🔧 优化建议\n\n`;
    report.recommendations.forEach((rec, i) => {
      text += `### ${i + 1}. [${rec.priority}] ${rec.issue}\n`;
      text += `- 建议: ${rec.suggestion}\n`;
      text += `- 文件: ${rec.file}\n`;
      text += `- 操作: ${rec.action}\n\n`;
    });
  } else {
    text += `## ✅ 所有测试通过，暂无优化建议\n\n`;
  }

  return text;
}

/**
 * 主循环
 */
async function startAutoLoop() {
  console.log('🚀 自动化测试系统启动');
  console.log(`⏰ 测试间隔: 30分钟`);
  console.log(`📂 报告目录: ${REPORT_DIR}`);
  console.log(`🔄 按 Ctrl+C 停止\n`);

  // 立即执行第一次
  await runAllTests();

  // 设置定时循环
  setInterval(async () => {
    await runAllTests();
  }, INTERVAL_MS);
}

// 启动
startAutoLoop();
