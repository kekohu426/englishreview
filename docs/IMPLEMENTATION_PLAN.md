# 儿童英语自拼练习 - 完整实施计划

---

## 📋 项目目标回顾

### 核心需求
1. ✅ **12种题型全覆盖**，每种最少5题
2. ✅ **两阶段生成**（Stage1计划 + Stage2逐题）
3. ✅ **OPW2知识库**（93个真实词汇）
4. ✅ **React前端UI**（User_greeting 2）
5. ✅ **100%知识点覆盖**

### 当前状态
- ✅ 后端框架搭建完成（793行代码）
- ✅ OPW2加载器完成
- ✅ Stage1/Stage2生成器完成
- ✅ Prompts整合完成
- ❌ **未经过实际测试**
- ❌ 前端集成未开始
- ❌ 格式校验器未实现

---

## 🎯 分阶段实施计划

---

# Phase 1: 后端功能验证（今天，预计2-4小时）

## 目标
验证后端核心功能，修复所有bug，确保能稳定生成12题型

---

### Step 1.1: 启动服务器冒烟测试（15分钟）

**操作**：
```bash
cd D:\dev\english-review-app
npm start
```

**检查点**：
- [ ] 服务器启动成功（端口5000）
- [ ] OPW2知识库加载成功（显示"93个词汇"）
- [ ] 没有语法错误

**预期问题**：
- 可能的ES Module导入错误
- 可能的路径问题（Windows vs Unix）

**解决方案**：
- 修改import/export语法
- 统一路径分隔符

---

### Step 1.2: 测试健康检查API（5分钟）

**操作**：
```bash
curl http://127.0.0.1:5000/health
```

**预期响应**：
```json
{
  "status": "ok",
  "timestamp": "2026-06-12T...",
  "config": {
    "llm": "claude",
    "model": "claude-opus-4-8"
  }
}
```

**检查点**：
- [ ] API能正常响应
- [ ] 配置正确

---

### Step 1.3: 测试Stage1生成（30-60分钟）

**操作**：
```bash
# 简单测试：只生成Stage1计划，不生成题目
# 修改server.js临时注释掉Stage2调用
```

**测试输入**（最简单版本）：
```
Unit3 en/ed: hen, pen, red, bed
```

**检查点**：
- [ ] LLM API调用成功
- [ ] 返回有效的JSON
- [ ] task_list有60+个task
- [ ] 包含12种题型

**预期问题**：
1. **API格式错误**
   - Claude API的请求格式可能不对
   - 需要查看muyuan.do的文档
   
2. **JSON解析失败**
   - LLM可能返回markdown包裹的JSON
   - 需要strip ```json``` 标记

3. **Prompt格式问题**
   - OPW2知识库注入可能格式错误
   - 占位符替换可能失败

**解决策略**：
- 添加详细日志记录LLM请求/响应
- 添加JSON清理逻辑
- 验证Prompt模板

---

### Step 1.4: 分析Stage1输出质量（15分钟）

**检查项**：
```javascript
// 统计每种题型数量
const typeCounts = {};
plan.task_list.forEach(t => {
  typeCounts[t.question_type] = (typeCounts[t.question_type] || 0) + 1;
});
console.log(typeCounts);
```

**验证**：
- [ ] 12种题型都有
- [ ] 每种题型≥5个task（如果不足，兜底会补充）
- [ ] target_word都是OPW2词汇表中的词
- [ ] 没有重复的 target_word + question_type 组合

**如果质量不好**：
- 调整Stage1 prompt
- 增加示例
- 调整约束规则

---

### Step 1.5: 测试Stage2生成（60-90分钟）

**操作**：
```bash
# 完整测试：Stage1 + Stage2
node test.js
```

**检查点**：
- [ ] 并发生成成功（5题/批）
- [ ] 所有题目JSON格式正确
- [ ] 没有生成超时

**预期问题**：
1. **并发超时**
   - Stage2生成60题可能需要5-10分钟
   - 需要调整超时时间

2. **JSON格式不一致**
   - 不同题型可能有不同的格式错误
   - 需要逐题型验证

3. **LLM不遵守规则**
   - fill_blank空白在句首/句尾
   - word_order没有动词
   - listen_judge的audio_text不是完整句子

**解决策略**：
- 先测试单个题型（如只生成spell_word）
- 添加格式校验器
- 调整Stage2 prompt加强约束

---

### Step 1.6: 实现格式校验器（30分钟）

**文件**：`backend/validators/index.js`

**功能**：
```javascript
// 校验fill_blank
function validateFillBlank(question) {
  const { sentence_parts, blank_answer } = question;
  
  // 检查空白不在句首
  if (sentence_parts[0].trim() === '') {
    return { valid: false, error: 'blank at beginning' };
  }
  
  // 检查空白不在句尾
  if (sentence_parts[1].trim() === '') {
    return { valid: false, error: 'blank at end' };
  }
  
  return { valid: true };
}

// 校验word_order
function validateWordOrder(question) {
  const { sentence } = question;
  
  // 简单检查：句子必须包含动词
  const verbs = ['is', 'are', 'am', 'do', 'does', 'have', 'has', 'like', 'want', 'see'];
  const hasVerb = verbs.some(v => sentence.toLowerCase().includes(` ${v} `));
  
  if (!hasVerb) {
    return { valid: false, error: 'no verb in sentence' };
  }
  
  return { valid: true };
}
```

**集成到Stage2**：
- 生成后立即校验
- 如果不通过，重新生成或丢弃

---

### Step 1.7: 端到端测试（30分钟）

**测试用例**：

1. **简单测试**（Unit3 en/ed）
```
Unit3 en/ed: hen, pen, red, bed
```

2. **复杂测试**（Unit4 + 语法）
```
Unit4可数不可数：
不可数：corn, watermelon, chicken, juice, water, milk, rice
可数：potatoes, pears, grapes, cookies
How much / How many
```

3. **极限测试**（多单元）
```
Unit3-4 复习：
Unit3 en/ed (hen, pen, red, bed)
Unit4 i/ip/ib/id (hip, lip, tip, sip, rip, bib, rib, kid, lid)
How much / How many
26字母
```

**验证**：
- [ ] 3个测试都能成功生成
- [ ] 12题型全覆盖
- [ ] 每题型≥5题
- [ ] 总题目数60-100题
- [ ] 生成时间<5分钟

---

## Phase 1 输出物

- ✅ 可稳定运行的后端服务器
- ✅ 通过3个测试用例
- ✅ 格式校验器
- ✅ 详细的错误日志
- ✅ 性能数据（生成时间、题目数量）

---

# Phase 2: 前端集成（明天，预计4-6小时）

## 目标
检查React前端组件，补充缺失题型，实现端到端流程

---

### Step 2.1: 检查现有前端组件（30分钟）

**操作**：
```bash
cd "C:\Users\ke'ko\Downloads\User_greeting (2)"
ls src/app/components/questions/
```

**检查清单**（12个组件）：
```javascript
const components = [
  'listen_pick_image',    // ❓
  'match_word_image',     // ❓
  'spell_word',           // ✅ 已实现
  'read_aloud',           // ⚠️  录音功能
  'listen_pick_word',     // ❓
  'listen_judge',         // ✅ 已实现
  'fill_blank',           // ✅ 已实现
  'word_order',           // ✅ 已实现
  'translate_pick',       // ✅ 已实现
  'dialogue_complete',    // ❓
  'mixed_challenge',      // ❓
  'letter_sound_trace',   // ❓
];
```

**逐个检查**：
- [ ] 组件文件是否存在
- [ ] 组件是否能渲染我生成的JSON
- [ ] 交互逻辑是否完整

---
