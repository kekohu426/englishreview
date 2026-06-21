/**
 * 超级迷你测试 - 只测试12题（每题型1题）
 * 最小化API调用：1次Stage1 + 12次Stage2 = 总共13次请求
 */

const testSample = `Unit 3: hen, pen, red
单词练习即可`;

const API_URL = 'http://127.0.0.1:5000/api/generate';

async function testUltraMini() {
  console.log('🧪 超级迷你测试 - 12题验证流程\n');
  console.log('📄 测试样本:', testSample);
  console.log('🎯 预期: 12题（每题型1题），约26秒完成');
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
        target_minutes: 5,  // 减少目标时长，生成更少题目
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ 生成成功! 耗时: ${elapsed}秒\n`);

    // 统计题型
    const typeCounts = {};
    data.modules.forEach(m => {
      m.items.forEach(q => {
        typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
      });
    });

    console.log('📊 题型统计:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}题`);
    });

    console.log(`\n✅ 总题数: ${Object.values(typeCounts).reduce((a,b) => a+b, 0)}`);
    console.log(`✅ 覆盖题型: ${Object.keys(typeCounts).length}/12`);

    // 显示第一题
    if (data.modules[0]?.items[0]) {
      console.log('\n📋 第一题示例:');
      console.log(JSON.stringify(data.modules[0].items[0], null, 2).substring(0, 300) + '...');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testUltraMini();
