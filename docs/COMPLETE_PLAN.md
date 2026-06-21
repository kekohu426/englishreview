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

### Step 2.2: 配置前端API代理（15分钟）

**文件**：`C:\Users\ke'ko\Downloads\User_greeting (2)\vite.config.ts`

**修改**：
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',  // 指向新后端
      changeOrigin: true,
    },
  },
}
```

**验证**：
```bash
cd "C:\Users\ke'ko\Downloads\User_greeting (2)"
npm run dev
# 打开 http://localhost:5173
# 测试调用 /api/generate
```

---

### Step 2.3: 补充缺失组件（2-3小时）

#### 2.3.1 match_word_image（30分钟）

**文件**：`src/app/components/questions/match_word_image/index.tsx`

**功能**：
- 显示单词（如"hen"）
- 自动播放发音（Web Speech API）
- 显示3张图片
- 点击选择
- 即时反馈

**参考**：
- 可以复用 listen_pick_image 的图片渲染逻辑
- 只是把音频换成显示单词

---

#### 2.3.2 dialogue_complete（45分钟）

**文件**：`src/app/components/questions/dialogue_complete/index.tsx`

**功能**：
- 显示对话框（2行）
- 第1行：Leo🧒 "What do you like?"
- 第2行：Mia👧（空白，待选择）
- 底部3个选项按钮
- 选中后填入对话

**UI设计**：
```tsx
<div className="dialogue-box">
  <div className="message">
    <span className="icon">🧒</span>
    <span className="name">Leo</span>
    <div className="bubble">What do you like?</div>
  </div>
  <div className="message blank">
    <span className="icon">👧</span>
    <span className="name">Mia</span>
    <div className="bubble empty">???</div>
  </div>
</div>
<div className="options">
  <button>I like corn.</button>
  <button>Yes, I do.</button>
  <button>I want corn.</button>
</div>
```

---

#### 2.3.3 mixed_challenge（30分钟）

**功能**：
- 和 listen_pick_word 类似
- 播放音频
- 显示文字选项
- 选择答案

**实现**：
- 可以直接复用 listen_pick_word 组件
- 只是 type 不同

---

#### 2.3.4 letter_sound_trace（45分钟）

**功能**：
- 显示大字母"A"
- 播放字母发音
- 跟读按钮
- 书写区域（canvas描红）

**可以简化**：
- 先不做书写功能
- 只做听音+跟读
- 后期再加canvas描红

---

### Step 2.4: 完善read_aloud录音功能（1小时）

**当前问题**：录音功能未实现

**两种方案**：

**方案A：复用现有项目的讯飞ISE**
- 从 `D:\codexapp\kids-english-review` 复制讯飞集成代码
- 需要WebSocket连接讯飞API
- 有发音评分功能

**方案B：简化版（推荐）**
- 用 Web Speech API 录音
- 不评分，只录音播放
- 后期再集成讯飞

**实现**（方案B）：
```tsx
const [recording, setRecording] = useState(false);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  
  recorder.ondataavailable = (e) => {
    const audioUrl = URL.createObjectURL(e.data);
    // 播放录音
  };
  
  recorder.start();
  setRecording(true);
};
```

---

### Step 2.5: 组装QuestionRouter（30分钟）

**文件**：`src/app/components/questions/QuestionRouter.tsx`

**确保12种题型都有路由**：
```tsx
switch (question.type) {
  case 'listen_pick_image':
    return <ListenPickImage {...question} />;
  case 'match_word_image':
    return <MatchWordImage {...question} />;
  case 'spell_word':
    return <SpellWord {...question} />;
  case 'read_aloud':
    return <ReadAloud {...question} />;
  case 'listen_pick_word':
    return <ListenPickWord {...question} />;
  case 'listen_judge':
    return <ListenJudge {...question} />;
  case 'fill_blank':
    return <FillBlank {...question} />;
  case 'word_order':
    return <WordOrder {...question} />;
  case 'translate_pick':
    return <TranslatePick {...question} />;
  case 'dialogue_complete':
    return <DialogueComplete {...question} />;
  case 'mixed_challenge':
    return <MixedChallenge {...question} />;
  case 'letter_sound_trace':
    return <LetterSoundTrace {...question} />;
  default:
    return <div>未知题型: {question.type}</div>;
}
```

---

### Step 2.6: 端到端测试（1小时）

**完整流程测试**：
1. 打开前端 http://localhost:5173
2. 粘贴老师输入：
   ```
   Unit4可数不可数：
   不可数：corn, watermelon, chicken, juice
   可数：potatoes, pears, grapes
   How much / How many
   ```
3. 点击"AI 生成练习"
4. 等待生成（显示loading）
5. 显示12个模块卡片
6. 点击模块开始做题
7. 逐题验证：
   - [ ] 音频能播放
   - [ ] 图片能显示
   - [ ] 交互正常
   - [ ] 反馈即时
8. 完成后显示奖状

**问题记录**：
- 列出所有遇到的问题
- 逐一修复

---

## Phase 2 输出物

- ✅ 12个题型组件全部实现
- ✅ 前后端联调成功
- ✅ 端到端流程跑通
- ✅ 问题列表和解决方案

---

# Phase 3: 优化与完善（后天，预计4-6小时）

## 目标
提升用户体验、性能优化、错误处理

---

### Step 3.1: 性能优化（1小时）

**1. 生成速度优化**
- [ ] 调整Stage2并发数（5→10题/批）
- [ ] 缓存OPW2知识库（已做）
- [ ] 预热LLM连接

**2. 前端加载优化**
- [ ] 懒加载题型组件
- [ ] 图片预加载
- [ ] 音频预加载

**3. 生成进度显示**
```tsx
// 实时显示生成进度
"正在生成第 15/60 题..."
```

---

### Step 3.2: 错误处理增强（1小时）

**1. LLM调用失败重试**
```javascript
async function callLLMWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callLLM(prompt);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`重试 ${i+1}/${maxRetries}...`);
      await sleep(2000);
    }
  }
}
```

**2. 格式错误降级**
```javascript
// 如果某题生成失败，用简化版替换
if (!validateQuestion(question)) {
  question = generateFallbackQuestion(task);
}
```

**3. 用户友好的错误提示**
```tsx
// 前端显示具体错误
"生成失败：API超时，请稍后重试"
"生成失败：部分题目格式不正确，已自动修复"
```

---

### Step 3.3: 用户体验优化（2小时）

**1. 音频方案优化**

**当前方案**：Web Speech API
- 优点：免费、即时
- 缺点：发音不太自然、不支持离线

**优化方案**：
- [ ] 高频词（30个）预录真人音频
- [ ] 低频词用Web Speech API
- [ ] 或集成Azure TTS（更自然）

**2. 图片资源补充**

**当前**：30+个内置词的简笔画
**优化**：
- [ ] 检查所有词是否有图
- [ ] 缺失的用AI生图（DALL-E 3 / Flux）
- [ ] 统一图片风格（卡通、儿童友好）

**3. 奖状设计**
```tsx
// 完成后生成奖状
<Certificate 
  name="小明"
  score={85}
  completedModules={12}
  totalTime="18分钟"
  stars={5}
/>
```

---

### Step 3.4: 数据持久化（1小时）

**需求**：
- 保存生成的练习（方便复用）
- 保存孩子的答题记录（查看进度）

**方案A：localStorage（简单）**
```javascript
// 保存练习
localStorage.setItem('lesson_20260612', JSON.stringify(modules));

// 保存答题记录
localStorage.setItem('progress_20260612', JSON.stringify({
  completed: ['m1', 'm2'],
  scores: { m1: 90, m2: 85 },
}));
```

**方案B：后端数据库（完整）**
- 需要：SQLite / MongoDB
- 好处：多设备同步、数据分析

**推荐**：先用localStorage，后期再加数据库

---

### Step 3.5: 分享功能（1小时）

**需求**：家长生成练习后，分享给孩子

**实现**：
```javascript
// 生成唯一ID
const lessonId = generateId(); // "lesson_abc123"

// 保存到服务器
POST /api/lessons
{
  "id": "lesson_abc123",
  "modules": [...]
}

// 返回分享链接
http://localhost:5173/lesson/abc123
```

**孩子访问**：
- 打开链接
- 直接开始做题
- 不需要生成

---

## Phase 3 输出物

- ✅ 生成速度提升30%
- ✅ 错误率降低到<5%
- ✅ 用户体验流畅
- ✅ 分享功能可用
- ✅ 数据可持久化

---

# Phase 4: 测试与部署（预计2-4小时）

---

### Step 4.1: 全面测试（2小时）

**测试矩阵**：

| 测试场景 | 输入 | 预期输出 | 状态 |
|---------|------|---------|-----|
| 简单词汇 | hen, pen | 12题型，60题 | ⬜ |
| 复杂语法 | How much/many | 12题型，60题 | ⬜ |
| 多单元 | Unit3+4+5 | 12题型，100题 | ⬜ |
| 26字母 | 26字母 | 26个letter_sound_trace | ⬜ |
| 极限测试 | 全8单元 | 12题型，150题 | ⬜ |

**每个场景验证**：
- [ ] 生成成功
- [ ] 12题型覆盖
- [ ] 每题型≥5题
- [ ] 前端渲染正常
- [ ] 交互流畅
- [ ] 没有crash

---

### Step 4.2: 用户验收测试（UAT）（1小时）

**让真实用户测试**（你的孩子？）：
- [ ] 能否理解操作流程
- [ ] 题目难度是否合适
- [ ] UI是否友好
- [ ] 是否愿意完成全部练习

**收集反馈**：
- 哪些题型喜欢
- 哪些题型太难/太简单
- 哪里卡住了
- 改进建议

---

### Step 4.3: 部署准备（1小时）

**如果需要部署到服务器**：

**方案A：本地运行**（推荐）
```bash
# 不需要部署，直接用
npm start
```

**方案B：局域网共享**
```bash
# 修改 .env
HOST=0.0.0.0  # 允许局域网访问

# 启动
npm start

# 其他设备访问
http://192.168.1.100:5000
```

**方案C：云服务器部署**
- 需要：VPS（阿里云/腾讯云）
- 需要：域名
- 需要：Nginx反向代理
- 需要：PM2进程管理

---

## Phase 4 输出物

- ✅ 通过所有测试用例
- ✅ 用户验收通过
- ✅ 部署方案确定
- ✅ 使用文档

---

# 时间估算与里程碑

## 总时间：3-4天（12-20小时）

| Phase | 时间 | 里程碑 |
|-------|------|--------|
| Phase 1: 后端验证 | 2-4小时 | ✅ 后端稳定生成 |
| Phase 2: 前端集成 | 4-6小时 | ✅ 端到端跑通 |
| Phase 3: 优化完善 | 4-6小时 | ✅ 用户体验良好 |
| Phase 4: 测试部署 | 2-4小时 | ✅ 可交付使用 |

## 关键风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| LLM API不稳定 | 高 | 高 | 添加重试+降级方案 |
| 前端组件缺失多 | 中 | 高 | 简化UI，先跑通流程 |
| 生成质量差 | 中 | 中 | 调整prompt，加强校验 |
| 性能慢 | 中 | 中 | 增加并发，优化缓存 |

---

# 立即行动

## 现在开始（建议步骤）

### 第1小时：后端冒烟测试
```bash
cd D:\dev\english-review-app
npm start
# 测试 /health
# 测试简单生成
```

### 第2-3小时：修复bug
- 根据实际报错修复
- 调整prompt
- 添加日志

### 第4小时：前端检查
```bash
cd "C:\Users\ke'ko\Downloads\User_greeting (2)"
# 检查12个组件
```

---

**准备好了吗？让我们开始 Phase 1 Step 1.1！** 🚀
