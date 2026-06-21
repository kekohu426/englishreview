/**
 * Phonics Word Family — TypeScript 配套工具
 * 
 * 提供：
 * 1. 类型定义
 * 2. 扁平词表导出（供 LLM Stage2 Prompt 直接用）
 * 3. spell_word 题型数据生成器
 */

import type { LessonItem } from './lesson';

// ─────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────

export interface PhonicsWord {
  word: string;        // 单词（小写）
  translation: string; // 中文翻译
  level: string;       // level_1 | level_2 | level_3
  family: string;       // 词族 key
}

export interface WordFamily {
  phoneme: string;
  words: Array<{ word: string; translation: string }>;
}

// ─────────────────────────────────────────
// 扁平词表（从 phonics_words.json 手动导出）
// Level 1 核心 CVC 词
// ─────────────────────────────────────────

export const PHONICS_WORDS: PhonicsWord[] = [
  // ── a 词族 ──────────────────────────
  { word: 'cat',   translation: '猫',      level: 'level_1', family: 'a' },
  { word: 'hat',   translation: '帽子',    level: 'level_1', family: 'a' },
  { word: 'mat',   translation: '垫子',    level: 'level_1', family: 'a' },
  { word: 'rat',   translation: '老鼠',    level: 'level_1', family: 'a' },
  { word: 'bat',   translation: '蝙蝠',    level: 'level_1', family: 'a' },
  { word: 'bag',   translation: '包',      level: 'level_1', family: 'a' },
  { word: 'map',   translation: '地图',    level: 'level_1', family: 'a' },
  { word: 'cap',   translation: '帽子',    level: 'level_1', family: 'a' },
  { word: 'pan',   translation: '平底锅',  level: 'level_1', family: 'a' },
  { word: 'can',   translation: '能/罐子', level: 'level_1', family: 'a' },
  { word: 'fan',   translation: '风扇',    level: 'level_1', family: 'a' },
  { word: 'man',   translation: '男人',    level: 'level_1', family: 'a' },
  { word: 'dad',   translation: '爸爸',    level: 'level_1', family: 'a' },
  { word: 'mom',   translation: '妈妈',    level: 'level_1', family: 'a' },
  { word: 'jam',   translation: '果酱',    level: 'level_1', family: 'a' },
  { word: 'ham',   translation: '火腿',    level: 'level_1', family: 'a' },

  // ── e 词族 ──────────────────────────
  { word: 'hen',   translation: '母鸡',    level: 'level_1', family: 'e' },
  { word: 'pen',   translation: '笔',      level: 'level_1', family: 'e' },
  { word: 'ten',   translation: '十',      level: 'level_1', family: 'e' },
  { word: 'bed',   translation: '床',      level: 'level_1', family: 'e' },
  { word: 'red',   translation: '红色',    level: 'level_1', family: 'e' },
  { word: 'leg',   translation: '腿',      level: 'level_1', family: 'e' },
  { word: 'egg',   translation: '蛋',      level: 'level_1', family: 'e' },
  { word: 'bell',  translation: '铃铛',    level: 'level_1', family: 'e' },
  { word: 'well',  translation: '井/好',   level: 'level_1', family: 'e' },
  { word: 'sell',  translation: '卖',      level: 'level_1', family: 'e' },
  { word: 'best',  translation: '最好的',  level: 'level_1', family: 'e' },
  { word: 'rest',  translation: '休息',    level: 'level_1', family: 'e' },
  { word: 'nest',  translation: '鸟窝',    level: 'level_1', family: 'e' },
  { word: 'wet',   translation: '湿的',    level: 'level_1', family: 'e' },
  { word: 'pet',   translation: '宠物',    level: 'level_1', family: 'e' },
  { word: 'net',   translation: '网',      level: 'level_1', family: 'e' },
  { word: 'jet',   translation: '喷气机',  level: 'level_1', family: 'e' },
  { word: 'get',   translation: '得到',    level: 'level_1', family: 'e' },
  { word: 'let',   translation: '让',      level: 'level_1', family: 'e' },
  { word: 'set',   translation: '设置',    level: 'level_1', family: 'e' },

  // ── i 词族 ──────────────────────────
  { word: 'sit',   translation: '坐',      level: 'level_1', family: 'i' },
  { word: 'hit',   translation: '打',      level: 'level_1', family: 'i' },
  { word: 'bit',   translation: '一点',    level: 'level_1', family: 'i' },
  { word: 'fit',   translation: '适合',    level: 'level_1', family: 'i' },
  { word: 'win',   translation: '赢',      level: 'level_1', family: 'i' },
  { word: 'pin',   translation: '别针',    level: 'level_1', family: 'i' },
  { word: 'fin',   translation: '鱼鳍',    level: 'level_1', family: 'i' },
  { word: 'bin',   translation: '垃圾桶',  level: 'level_1', family: 'i' },
  { word: 'big',   translation: '大的',    level: 'level_1', family: 'i' },
  { word: 'pig',   translation: '猪',      level: 'level_1', family: 'i' },
  { word: 'dig',   translation: '挖',      level: 'level_1', family: 'i' },
  { word: 'fig',   translation: '无花果',  level: 'level_1', family: 'i' },
  { word: 'wig',   translation: '假发',    level: 'level_1', family: 'i' },
  { word: 'six',   translation: '六',      level: 'level_1', family: 'i' },
  { word: 'mix',   translation: '混合',    level: 'level_1', family: 'i' },
  { word: 'fix',   translation: '修理',    level: 'level_1', family: 'i' },

  // ── o 词族 ──────────────────────────
  { word: 'hot',   translation: '热的',    level: 'level_1', family: 'o' },
  { word: 'pot',   translation: '锅',      level: 'level_1', family: 'o' },
  { word: 'dot',   translation: '点',      level: 'level_1', family: 'o' },
  { word: 'got',   translation: '得到',    level: 'level_1', family: 'o' },
  { word: 'not',   translation: '不',      level: 'level_1', family: 'o' },
  { word: 'fox',   translation: '狐狸',    level: 'level_1', family: 'o' },
  { word: 'box',   translation: '盒子',    level: 'level_1', family: 'o' },
  { word: 'hop',   translation: '跳',      level: 'level_1', family: 'o' },
  { word: 'pop',   translation: '砰',      level: 'level_1', family: 'o' },
  { word: 'top',   translation: '顶部',    level: 'level_1', family: 'o' },
  { word: 'mop',   translation: '拖把',    level: 'level_1', family: 'o' },
  { word: 'dog',   translation: '狗',      level: 'level_1', family: 'o' },
  { word: 'log',   translation: '木头',    level: 'level_1', family: 'o' },
  { word: 'frog',  translation: '青蛙',    level: 'level_1', family: 'o' },

  // ── u 词族 ──────────────────────────
  { word: 'up',    translation: '向上',    level: 'level_1', family: 'u' },
  { word: 'cut',   translation: '切',      level: 'level_1', family: 'u' },
  { word: 'fun',   translation: '有趣',    level: 'level_1', family: 'u' },
  { word: 'run',   translation: '跑',      level: 'level_1', family: 'u' },
  { word: 'sun',   translation: '太阳',    level: 'level_1', family: 'u' },
  { word: 'bus',   translation: '公共汽车', level: 'level_1', family: 'u' },
  { word: 'mug',   translation: '马克杯',  level: 'level_1', family: 'u' },
  { word: 'hug',   translation: '拥抱',    level: 'level_1', family: 'u' },
  { word: 'mud',   translation: '泥巴',    level: 'level_1', family: 'u' },
  { word: 'rug',   translation: '地毯',    level: 'level_1', family: 'u' },
  { word: 'bug',   translation: '虫子',    level: 'level_1', family: 'u' },
  { word: 'tub',   translation: '浴缸',    level: 'level_1', family: 'u' },
  { word: 'rub',   translation: '摩擦',    level: 'level_1', family: 'u' },

  // ── ck 词族 ─────────────────────────
  { word: 'back',  translation: '背/回来', level: 'level_1', family: 'ck' },
  { word: 'neck',  translation: '脖子',    level: 'level_1', family: 'ck' },
  { word: 'duck',  translation: '鸭子',    level: 'level_1', family: 'ck' },
  { word: 'luck',  translation: '运气',    level: 'level_1', family: 'ck' },
  { word: 'sock',  translation: '袜子',    level: 'level_1', family: 'ck' },
  { word: 'rock',  translation: '岩石',    level: 'level_1', family: 'ck' },
  { word: 'lock',  translation: '锁',      level: 'level_1', family: 'ck' },
  { word: 'clock', translation: '时钟',    level: 'level_1', family: 'ck' },
  { word: 'kick',  translation: '踢',      level: 'level_1', family: 'ck' },
  { word: 'pick',  translation: '捡',      level: 'level_1', family: 'ck' },
  { word: 'sick',  translation: '生病',    level: 'level_1', family: 'ck' },

  // ── Level 2: en/ed 词族 ─────────────
  { word: 'hen',   translation: '母鸡',    level: 'level_2', family: 'en_ed' },
  { word: 'pen',   translation: '笔',      level: 'level_2', family: 'en_ed' },
  { word: 'ten',   translation: '十',      level: 'level_2', family: 'en_ed' },
  { word: 'den',   translation: '兽穴',    level: 'level_2', family: 'en_ed' },
  { word: 'when',  translation: '什么时候', level: 'level_2', family: 'en_ed' },
  { word: 'then',  translation: '然后',    level: 'level_2', family: 'en_ed' },
  { word: 'send',  translation: '发送',    level: 'level_2', family: 'en_ed' },
  { word: 'lend',  translation: '借出',    level: 'level_2', family: 'en_ed' },
  { word: 'mend',  translation: '修理',    level: 'level_2', family: 'en_ed' },
  { word: 'bend',  translation: '弯曲',    level: 'level_2', family: 'en_ed' },
  { word: 'end',   translation: '结束',    level: 'level_2', family: 'en_ed' },
  { word: 'spend', translation: '花费',    level: 'level_2', family: 'en_ed' },
  { word: 'blend', translation: '混合',    level: 'level_2', family: 'en_ed' },
  { word: 'red',   translation: '红色',    level: 'level_2', family: 'en_ed' },
  { word: 'bed',   translation: '床',      level: 'level_2', family: 'en_ed' },
  { word: 'led',   translation: '领导',    level: 'level_2', family: 'en_ed' },
  { word: 'fed',   translation: '喂养',    level: 'level_2', family: 'en_ed' },
  { word: 'wed',   translation: '结婚',    level: 'level_2', family: 'en_ed' },
  { word: 'shed',  translation: '小屋',    level: 'level_2', family: 'en_ed' },
  { word: 'fled',  translation: '逃走',    level: 'level_2', family: 'en_ed' },
  { word: 'sled',  translation: '雪橇',    level: 'level_2', family: 'en_ed' },
  { word: 'sped',  translation: '加速',    level: 'level_2', family: 'en_ed' },
  { word: 'bred',  translation: '繁殖',    level: 'level_2', family: 'en_ed' },

  // ── Level 2: ip/ib/id 词族 ──────────
  { word: 'hip',   translation: '屁股',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'lip',   translation: '嘴唇',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'tip',   translation: '尖端',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'sip',   translation: '小口喝',  level: 'level_2', family: 'ip_ib_id' },
  { word: 'dip',   translation: '蘸',      level: 'level_2', family: 'ip_ib_id' },
  { word: 'rip',   translation: '撕开',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'nip',   translation: '捏',      level: 'level_2', family: 'ip_ib_id' },
  { word: 'zip',   translation: '拉链',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'chip',  translation: '薯片',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'ship',  translation: '船',      level: 'level_2', family: 'ip_ib_id' },
  { word: 'skip',  translation: '跳绳',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'flip',  translation: '翻',      level: 'level_2', family: 'ip_ib_id' },
  { word: 'slip',  translation: '滑倒',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'grip',  translation: '抓住',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'drip',  translation: '滴落',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'trip',  translation: '旅行',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'bib',   translation: '围嘴',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'fib',   translation: '小谎',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'rib',   translation: '肋骨',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'nib',   translation: '笔尖',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'kid',   translation: '小孩',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'lid',   translation: '盖子',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'bid',   translation: '出价',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'did',   translation: '做了',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'hid',   translation: '藏起来',  level: 'level_2', family: 'ip_ib_id' },
  { word: 'rid',   translation: '摆脱',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'skid',  translation: '打滑',    level: 'level_2', family: 'ip_ib_id' },
  { word: 'slid',  translation: '滑',      level: 'level_2', family: 'ip_ib_id' },
  { word: 'grid',  translation: '网格',    level: 'level_2', family: 'ip_ib_id' },

  // ── Level 2: sh/ch 词族 ─────────────
  { word: 'ship',  translation: '船',      level: 'level_2', family: 'sh_ch' },
  { word: 'fish',  translation: '鱼',      level: 'level_2', family: 'sh_ch' },
  { word: 'dish',  translation: '盘子',    level: 'level_2', family: 'sh_ch' },
  { word: 'wish',  translation: '希望',    level: 'level_2', family: 'sh_ch' },
  { word: 'wash',  translation: '洗',      level: 'level_2', family: 'sh_ch' },
  { word: 'push',  translation: '推',      level: 'level_2', family: 'sh_ch' },
  { word: 'cash',  translation: '现金',    level: 'level_2', family: 'sh_ch' },
  { word: 'chin',  translation: '下巴',    level: 'level_2', family: 'sh_ch' },
  { word: 'chip',  translation: '薯片',    level: 'level_2', family: 'sh_ch' },
  { word: 'chat',  translation: '聊天',    level: 'level_2', family: 'sh_ch' },
  { word: 'chop',  translation: '砍',      level: 'level_2', family: 'sh_ch' },
  { word: 'bench', translation: '长凳',    level: 'level_2', family: 'sh_ch' },
  { word: 'lunch', translation: '午餐',    level: 'level_2', family: 'sh_ch' },

  // ── Level 2: th/wh 词族 ─────────────
  { word: 'this',  translation: '这个',    level: 'level_2', family: 'th_wh' },
  { word: 'that',  translation: '那个',    level: 'level_2', family: 'th_wh' },
  { word: 'them',  translation: '他们',    level: 'level_2', family: 'th_wh' },
  { word: 'there', translation: '那里',    level: 'level_2', family: 'th_wh' },
  { word: 'with',  translation: '和',     level: 'level_2', family: 'th_wh' },
  { word: 'think', translation: '想',      level: 'level_2', family: 'th_wh' },
  { word: 'thank', translation: '谢谢',    level: 'level_2', family: 'th_wh' },
  { word: 'thick', translation: '厚的',    level: 'level_2', family: 'th_wh' },
  { word: 'thin',  translation: '薄的',    level: 'level_2', family: 'th_wh' },
  { word: 'three', translation: '三',      level: 'level_2', family: 'th_wh' },
  { word: 'what',  translation: '什么',    level: 'level_2', family: 'th_wh' },
  { word: 'when',  translation: '什么时候', level: 'level_2', family: 'th_wh' },
  { word: 'where', translation: '在哪里',  level: 'level_2', family: 'th_wh' },
  { word: 'why',   translation: '为什么',  level: 'level_2', family: 'th_wh' },
  { word: 'which', translation: '哪个',    level: 'level_2', family: 'th_wh' },
  { word: 'wheel', translation: '轮子',    level: 'level_2', family: 'th_wh' },
  { word: 'white', translation: '白色',    level: 'level_2', family: 'th_wh' },

  // ── Level 2: ng 词族 ────────────────
  { word: 'ring',  translation: '戒指',    level: 'level_2', family: 'ng' },
  { word: 'sing',  translation: '唱歌',    level: 'level_2', family: 'ng' },
  { word: 'king',  translation: '国王',    level: 'level_2', family: 'ng' },
  { word: 'wing',  translation: '翅膀',    level: 'level_2', family: 'ng' },
  { word: 'thing', translation: '东西',    level: 'level_2', family: 'ng' },
  { word: 'long',  translation: '长的',    level: 'level_2', family: 'ng' },
  { word: 'song',  translation: '歌曲',    level: 'level_2', family: 'ng' },
  { word: 'strong', translation: '强壮的', level: 'level_2', family: 'ng' },
  { word: 'pink',  translation: '粉色',    level: 'level_2', family: 'ng' },
  { word: 'ink',   translation: '墨水',    level: 'level_2', family: 'ng' },
  { word: 'link',  translation: '链接',    level: 'level_2', family: 'ng' },
  { word: 'sink',  translation: '水槽',    level: 'level_2', family: 'ng' },
  { word: 'bank',  translation: '银行',    level: 'level_2', family: 'ng' },
  { word: 'drink', translation: '喝',      level: 'level_2', family: 'ng' },

  // ── Level 2: ai/ay 词族 ─────────────
  { word: 'rain',  translation: '雨',      level: 'level_2', family: 'ai_ay' },
  { word: 'tail',  translation: '尾巴',    level: 'level_2', family: 'ai_ay' },
  { word: 'mail',  translation: '邮件',    level: 'level_2', family: 'ai_ay' },
  { word: 'nail',  translation: '钉子',    level: 'level_2', family: 'ai_ay' },
  { word: 'day',   translation: '天',      level: 'level_2', family: 'ai_ay' },
  { word: 'way',   translation: '路',      level: 'level_2', family: 'ai_ay' },
  { word: 'say',   translation: '说',      level: 'level_2', family: 'ai_ay' },
  { word: 'play',  translation: '玩',      level: 'level_2', family: 'ai_ay' },
  { word: 'stay',  translation: '停留',    level: 'level_2', family: 'ai_ay' },
  { word: 'away',  translation: '离开',    level: 'level_2', family: 'ai_ay' },
  { word: 'today', translation: '今天',    level: 'level_2', family: 'ai_ay' },
  { word: 'always', translation: '总是',   level: 'level_2', family: 'ai_ay' },

  // ── Level 2: ee/ea 词族 ─────────────
  { word: 'see',   translation: '看见',    level: 'level_2', family: 'ee_ea' },
  { word: 'tree',  translation: '树',      level: 'level_2', family: 'ee_ea' },
  { word: 'three', translation: '三',      level: 'level_2', family: 'ee_ea' },
  { word: 'free',  translation: '自由的',  level: 'level_2', family: 'ee_ea' },
  { word: 'green', translation: '绿色',    level: 'level_2', family: 'ee_ea' },
  { word: 'sheep', translation: '绵羊',    level: 'level_2', family: 'ee_ea' },
  { word: 'sleep', translation: '睡觉',    level: 'level_2', family: 'ee_ea' },
  { word: 'feet',  translation: '脚',      level: 'level_2', family: 'ee_ea' },
  { word: 'meet',  translation: '遇见',    level: 'level_2', family: 'ee_ea' },
  { word: 'beach', translation: '海滩',    level: 'level_2', family: 'ee_ea' },
  { word: 'team',  translation: '团队',    level: 'level_2', family: 'ee_ea' },
  { word: 'read',  translation: '读',      level: 'level_2', family: 'ee_ea' },
  { word: 'eat',   translation: '吃',      level: 'level_2', family: 'ee_ea' },
  { word: 'meat',  translation: '肉',      level: 'level_2', family: 'ee_ea' },
  { word: 'seat',  translation: '座位',    level: 'level_2', family: 'ee_ea' },

  // ── Level 2: oa/ow 词族 ─────────────
  { word: 'boat',  translation: '船',      level: 'level_2', family: 'oa_ow' },
  { word: 'coat',  translation: '外套',    level: 'level_2', family: 'oa_ow' },
  { word: 'road',  translation: '路',      level: 'level_2', family: 'oa_ow' },
  { word: 'soap',  translation: '肥皂',    level: 'level_2', family: 'oa_ow' },
  { word: 'show',  translation: '显示',    level: 'level_2', family: 'oa_ow' },
  { word: 'know',  translation: '知道',    level: 'level_2', family: 'oa_ow' },
  { word: 'snow',  translation: '雪',      level: 'level_2', family: 'oa_ow' },
  { word: 'grow',  translation: '生长',    level: 'level_2', family: 'oa_ow' },
  { word: 'flow',  translation: '流动',    level: 'level_2', family: 'oa_ow' },
  { word: 'blow',  translation: '吹',      level: 'level_2', family: 'oa_ow' },
  { word: 'slow',  translation: '慢的',    level: 'level_2', family: 'oa_ow' },
  { word: 'window', translation: '窗户',  level: 'level_2', family: 'oa_ow' },
  { word: 'yellow', translation: '黄色', level: 'level_2', family: 'oa_ow' },

  // ── Level 2: oo/ew 词族 ─────────────
  { word: 'moon',  translation: '月亮',    level: 'level_2', family: 'oo_ew' },
  { word: 'room',  translation: '房间',    level: 'level_2', family: 'oo_ew' },
  { word: 'zoo',   translation: '动物园',  level: 'level_2', family: 'oo_ew' },
  { word: 'food',  translation: '食物',    level: 'level_2', family: 'oo_ew' },
  { word: 'book',  translation: '书',      level: 'level_2', family: 'oo_ew' },
  { word: 'look',  translation: '看',      level: 'level_2', family: 'oo_ew' },
  { word: 'good',  translation: '好的',    level: 'level_2', family: 'oo_ew' },
  { word: 'foot',  translation: '脚',      level: 'level_2', family: 'oo_ew' },
  { word: 'cook',  translation: '厨师',    level: 'level_2', family: 'oo_ew' },
  { word: 'new',   translation: '新的',    level: 'level_2', family: 'oo_ew' },
  { word: 'knew',  translation: '知道',    level: 'level_2', family: 'oo_ew' },
  { word: 'grew',  translation: '生长',    level: 'level_2', family: 'oo_ew' },
  { word: 'flew',  translation: '飞',      level: 'level_2', family: 'oo_ew' },

  // ── Level 2: ai_e (magic e) ─────────
  { word: 'like',  translation: '喜欢',    level: 'level_2', family: 'ai_e' },
  { word: 'time',  translation: '时间',    level: 'level_2', family: 'ai_e' },
  { word: 'bike',  translation: '自行车',  level: 'level_2', family: 'ai_e' },
  { word: 'hide',  translation: '躲藏',    level: 'level_2', family: 'ai_e' },
  { word: 'side',  translation: '边',      level: 'level_2', family: 'ai_e' },
  { word: 'fine',  translation: '好的',    level: 'level_2', family: 'ai_e' },
  { word: 'line',  translation: '线',      level: 'level_2', family: 'ai_e' },
  { word: 'nine',  translation: '九',      level: 'level_2', family: 'ai_e' },
  { word: 'five',  translation: '五',      level: 'level_2', family: 'ai_e' },
  { word: 'drive', translation: '驾驶',    level: 'level_2', family: 'ai_e' },
  { word: 'size',  translation: '尺寸',    level: 'level_2', family: 'ai_e' },

  // ── Level 2: oa_o_e (magic e) ───────
  { word: 'home',  translation: '家',      level: 'level_2', family: 'oa_o_e' },
  { word: 'hope',  translation: '希望',    level: 'level_2', family: 'oa_o_e' },
  { word: 'phone', translation: '电话',    level: 'level_2', family: 'oa_o_e' },
  { word: 'hole',  translation: '洞',      level: 'level_2', family: 'oa_o_e' },
  { word: 'bone',  translation: '骨头',    level: 'level_2', family: 'oa_o_e' },
  { word: 'stone', translation: '石头',    level: 'level_2', family: 'oa_o_e' },
  { word: 'nose',  translation: '鼻子',    level: 'level_2', family: 'oa_o_e' },
  { word: 'rose',  translation: '玫瑰',    level: 'level_2', family: 'oa_o_e' },
  { word: 'note',  translation: '笔记',    level: 'level_2', family: 'oa_o_e' },

  // ── Level 3: 进阶 ───────────────────
  { word: 'share', translation: '分享',    level: 'level_3', family: 'are' },
  { word: 'care',  translation: '关心',    level: 'level_3', family: 'are' },
  { word: 'chair', translation: '椅子',    level: 'level_3', family: 'air' },
  { word: 'hair',  translation: '头发',    level: 'level_3', family: 'air' },
  { word: 'pair',  translation: '一对',    level: 'level_3', family: 'air' },
  { word: 'hear',  translation: '听见',    level: 'level_3', family: 'ear' },
  { word: 'near',  translation: '近',      level: 'level_3', family: 'ear' },
  { word: 'year',  translation: '年',      level: 'level_3', family: 'ear' },
  { word: 'tear',  translation: '眼泪',    level: 'level_3', family: 'ear' },
  { word: 'pear',  translation: '梨',      level: 'level_3', family: 'ear' },
  { word: 'bear',  translation: '熊',      level: 'level_3', family: 'ear' },
  { word: 'wear',  translation: '穿',      level: 'level_3', family: 'ear' },
  { word: 'fire',  translation: '火',      level: 'level_3', family: 'ire' },
  { word: 'tire',  translation: '累',      level: 'level_3', family: 'ire' },
  { word: 'sure',  translation: '确定',    level: 'level_3', family: 'ure' },
  { word: 'pure',  translation: '纯净的',  level: 'level_3', family: 'ure' },
  { word: 'future', translation: '未来',   level: 'level_3', family: 'ure' },
  { word: 'dangerous', translation: '危险的', level: 'level_3', family: 'ous' },
  { word: 'delicious', translation: '美味的', level: 'level_3', family: 'ous' },
  { word: 'famous', translation: '著名的', level: 'level_3', family: 'ous' },
];

// ─────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────

/**
 * 按级别获取 phonics 词
 * @param level level_1 | level_2 | level_3 | undefined（全部）
 */
export function getPhonicsWordsByLevel(level?: string): PhonicsWord[] {
  if (!level) return PHONICS_WORDS;
  return PHONICS_WORDS.filter((w) => w.level === level);
}

/**
 * 按词族获取 phonics 词
 */
export function getPhonicsWordsByFamily(family: string): PhonicsWord[] {
  return PHONICS_WORDS.filter((w) => w.family === family);
}

/**
 * 生成 spell_word 题目的 letter_pool
 * 答案字母 + 4个干扰字母
 */
export function generateLetterPool(word: string): string[] {
  const answer = word.toUpperCase().split('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const extras = alphabet
    .split('')
    .filter((l) => !answer.includes(l))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(4, 8 - answer.length));
  const pool = [...answer, ...extras];
  // 打乱顺序
  return pool.sort(() => Math.random() - 0.5);
}

/**
 * 从 phonics 词列表中随机抽 N 个
 */
export function samplePhonicsWords(n: number, level?: string): PhonicsWord[] {
  const pool = level ? getPhonicsWordsByLevel(level) : PHONICS_WORDS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * 构建 spell_word LessonItem
 */
export function buildSpellWordItem(
  phonicsWord: PhonicsWord,
  id: string
): LessonItem {
  return {
    id,
    type: 'spell_word',
    audio_text: phonicsWord.word,
    spell_word: phonicsWord.word,
    word_translation: phonicsWord.translation,
    letter_pool: generateLetterPool(phonicsWord.word),
    explanation: `${phonicsWord.word} = ${phonicsWord.translation}。`,
  };
}

// ─────────────────────────────────────────
// Level 描述（供 Stage1 Prompt 使用）
// ─────────────────────────────────────────

export const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Level 1 — 26字母音 + CVC (a e i o u ck)',
  level_2: 'Level 2 — 混合辅音 + 长元音 (en ed ip ib id sh ch th wh ng ai ay ee ea oa ow oo)',
  level_3: 'Level 3 — 进阶拼读 (are ere ire ure ear air ou ion)',
};

export const FAMILY_LABELS: Record<string, string> = {
  a: 'a 音（如 cat, hat, bag）',
  e: 'e 音（如 hen, pen, bed）',
  i: 'i 音（如 sit, win, big）',
  o: 'o 音（如 hot, dog, fox）',
  u: 'u 音（如 cut, fun, bus）',
  ck: 'ck 音（如 back, duck, sock）',
  en_ed: 'en/ed 音（如 hen, pen, red, bed, send, lend）',
  ip_ib_id: 'ip/ib/id 音（如 hip, zip, kid, lid, rib）',
  sh_ch: 'sh/ch 音（如 ship, fish, chin, bench）',
  th_wh: 'th/wh 音（如 this, that, what, when, where）',
  ng: 'ng 音（如 ring, sing, king, long, song）',
  ai_ay: 'ai/ay 音（如 rain, day, play, stay, away）',
  ee_ea: 'ee/ea 音（如 see, tree, green, feet, eat）',
  oa_ow: 'oa/ow 音（如 boat, coat, show, snow, know）',
  oo_ew: 'oo/ew 音（如 moon, room, food, book, good）',
  ai_e: 'a_e 魔法 e（如 like, time, bike, five, drive）',
  oa_o_e: 'o_e 魔法 e（如 home, hope, phone, nose, stone）',
  are: 'are 音（如 share, care）',
  air: 'air 音（如 chair, hair, pair）',
  ear: 'ear 音（如 hear, near, year, bear, wear）',
  ire: 'ire 音（如 fire, tire）',
  ure: 'ure 音（如 sure, pure, future）',
  ous: 'ous 音（如 dangerous, delicious）',
};
