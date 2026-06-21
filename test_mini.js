/**
 * 迷你测试 - 只测试Stage1+少量Stage2
 */

const testSample = `Unit 3: hen, pen, red`;

const API_URL = 'http://127.0.0.1:5000/api/generate';

async function testMini() {
  console.log('🧪 迷你测试 - 验证基本流程\n');
  console.log('📄 测试样本:', testSample);
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
        difficulty: 'level_1',
        target_minutes: 10,
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
    console.log('📦 模块数量:', data.modules.length);

    let totalQuestions = 0;
    data.modules.forEach(m => {
      console.log(`  - ${m.module_id}: ${m.items.length}题`);
      totalQuestions += m.items.length;
    });

    console.log(`\n📝 总题目数: ${totalQuestions}`);

    // 显示第一题示例
    if (data.modules.length > 0 && data.modules[0].items.length > 0) {
      const firstQ = data.modules[0].items[0];
      console.log('\n📋 第一题示例:');
      console.log(JSON.stringify(firstQ, null, 2));
    }

    console.log('\n✅ 迷你测试通过！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testMini();
