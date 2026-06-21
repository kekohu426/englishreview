# Prompt 版本说明

## 三个版本对比

### 1. stage1_original_backup.md（原始版）
- **长度**：~200行
- **优点**：规则最详细，包含完整示例和自检清单
- **缺点**：太长，导致LLM API 504超时
- **状态**：已备份，保留作为需求参考

### 2. stage1_minimal.md（极简版）
- **长度**：~60行
- **优点**：最短，响应快
- **缺点**：缺少关键规则（vocabulary/phonics区分、出题规则），质量差
- **状态**：保留用于快速测试

### 3. stage1_balanced.md（平衡版）⭐️当前使用
- **长度**：~120行
- **优点**：保留所有核心规则，删除冗余内容
- **缺点**：无明显缺点
- **状态**：当前正在使用

## 平衡版保留的核心规则

1. ✅ **知识点分类**（vocabulary/phonics/sentence_pattern/grammar_sense/letter_sound）
2. ✅ **vocabulary vs phonics区分规则**（决定是否配图）
3. ✅ **12种题型清单**
4. ✅ **各知识点出题规则**（每种知识点应该出哪些题型）
5. ✅ **关键约束**（禁止重复、句子完整性、拼写难度）
6. ✅ **模块分配逻辑**（m1-m8各模块的题型归属）
7. ✅ **优先级判断**（must vs optional）

## 平衡版删除的内容

1. ❌ 多个完整JSON示例（只保留1个精简示例）
2. ❌ 重复强调的文字
3. ❌ 详细的自检清单（12条）
4. ❌ 过长的表格说明
5. ❌ 冗余的规则解释

## 切换版本

如果需要切换回其他版本，修改 `backend/generators/stage1.js` 第20行：

```javascript
// 使用原始版（可能超时）
const promptPath = path.join(__dirname, '../../prompts/stage1_original_backup.md');

// 使用极简版（质量较差）
const promptPath = path.join(__dirname, '../../prompts/stage1_minimal.md');

// 使用平衡版（推荐）
const promptPath = path.join(__dirname, '../../prompts/stage1_balanced.md');
```

## 测试建议

1. 先用平衡版测试完整流程
2. 对比生成的题目质量
3. 如果质量不满意，可以逐步添加原始版中的规则到平衡版
4. 如果仍然超时，继续精简平衡版的非核心内容

## 版本历史

- 2026-06-12 20:20：创建平衡版，设为当前使用版本
- 2026-06-12 20:20：备份原始版到 stage1_original_backup.md
- 2026-06-12 12:15：创建极简版用于调试
