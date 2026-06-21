/**
 * 测试脚本 - 验证后端生成功能
 * 使用测试样本调用API，检查12题型覆盖、每题型≥5题
 */

const testSample = `## Unit 4 复习要求

本周重点复习可数名词与不可数名词，以及 How much / How many 的区分使用。

### 重点词汇
- 不可数名词：corn, watermelon, chicken, juice, water, milk, rice
- 可数名词复数：potatoes, pears, grapes, cookies, books, pens

### 句型练习
1. How much + 不可数名词（如 How much milk?）
2. How many + 可数名词复数（如 How many books?）
3. What do you have? / What do you like? / What do you see?
4. Do you like...? Yes, I do. / No, I don't.

### 课后小练兵
- 听音辨词：听到单词选出对应图片
- 句型问答：练习 What do you 和 Do you 句型
- 跟读：跟着原声读句子

### 学有余力
旧词混合练习，巩固前几单元内容。

请孩子独立完成，预计 15-18 分钟。`;

const API_URL = 'http://127.0.0.1:5000/api/generate';

async function testGeneration() {
  console.log('🧪 开始测试后端生成功能\n');
  console.log('📄 测试样本:');
  console.log(testSample);
  console.log('\n' + '='.repeat(60));

  const startTime = Date.now();

  try {
    console.log('\n📡 发送请求到:', API_URL);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: testSample,
        difficulty: 'level_2',
        target_minutes: 20,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ 生成成功! 耗时: ${elapsed}秒\n`);

    // 验证结果
    validateResult(data);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

function validateResult(data) {
  console.log('🔍 验证生成结果\n');

  const { modules } = data;

  if (!modules || !Array.isArray(modules)) {
    throw new Error('返回数据缺少modules数组');
  }

  console.log(`📦 模块数量: ${modules.length}`);

  // 收集所有题目
  const allQuestions = [];
  modules.forEach(module => {
    console.log(`  - ${module.module_id} ${module.icon} ${module.title}: ${module.items.length}题`);
    allQuestions.push(...module.items);
  });

  console.log(`\n📝 总题目数: ${allQuestions.length}`);

  // 统计题型
  const requiredTypes = [
    'listen_pick_image',
    'match_word_image',
    'spell_word',
    'read_aloud',
    'listen_pick_word',
    'listen_judge',
    'fill_blank',
    'word_order',
    'translate_pick',
    'dialogue_complete',
    'mixed_challenge',
    'letter_sound_trace',
  ];

  const typeCounts = {};
  allQuestions.forEach(q => {
    const type = q.type;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  console.log('\n📊 题型统计:');
  let allPassed = true;
  requiredTypes.forEach((type, idx) => {
    const count = typeCounts[type] || 0;
    const status = count >= 5 ? '✅' : '❌';
    console.log(`  ${idx + 1}. ${status} ${type}: ${count}题 ${count < 5 ? `(需要至少5题)` : ''}`);
    if (count < 5) allPassed = false;
  });

  // 检查是否有未知题型
  Object.keys(typeCounts).forEach(type => {
    if (!requiredTypes.includes(type)) {
      console.log(`  ⚠️  未知题型: ${type}: ${typeCounts[type]}题`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (allPassed) {
    console.log('\n✅ 验证通过! 所有题型覆盖，每题型≥5题\n');
  } else {
    console.log('\n❌ 验证失败! 部分题型数量不足\n');
    process.exit(1);
  }
}

// 运行测试
testGeneration();
