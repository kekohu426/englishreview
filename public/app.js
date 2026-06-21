const REQUIRED_TYPES = [
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
];

const state = {
  busy: false,
  modules: [],
  activeModuleId: null,
  activeQuestionIndex: 0,
  activeQuestionId: null,
  spellAnswer: [],
  wordSource: [],
  wordAnswer: [],
  analysis: null,
};

const el = {
  reviewInput: document.querySelector('#reviewInput'),
  difficulty: document.querySelector('#difficulty'),
  minutes: document.querySelector('#minutes'),
  mockBtn: document.querySelector('#mockBtn'),
  analyzeBtn: document.querySelector('#analyzeBtn'),
  realBtn: document.querySelector('#realBtn'),
  analysisPanel: document.querySelector('#analysisPanel'),
  modules: document.querySelector('#modules'),
  practice: document.querySelector('#practice'),
  message: document.querySelector('#message'),
  serviceStatus: document.querySelector('#serviceStatus'),
  modePill: document.querySelector('#modePill'),
  moduleCount: document.querySelector('#moduleCount'),
  questionCount: document.querySelector('#questionCount'),
  typeCoverage: document.querySelector('#typeCoverage'),
  elapsedTime: document.querySelector('#elapsedTime'),
};

el.mockBtn.addEventListener('click', () => generate('/api/mock-generate', 'Quick demo'));
el.analyzeBtn.addEventListener('click', analyzeHomework);
el.realBtn.addEventListener('click', () => generate('/api/generate', 'AI generation'));
el.modules.addEventListener('click', onModulesClick);
el.practice.addEventListener('click', onPracticeClick);

checkHealth();

async function checkHealth() {
  try {
    const response = await fetch('/health');
    const data = await response.json();
    el.serviceStatus.textContent = `Service online: ${data.config.llm} / ${data.config.model}`;
    setMode('Ready', 'ready');
  } catch (error) {
    el.serviceStatus.textContent = 'Service offline. Start the backend first.';
    setMode('Offline', 'error');
  }
}

async function analyzeHomework() {
  if (state.busy) return;
  const content = el.reviewInput.value.trim();
  if (!content) {
    showMessage('Enter review requirements first.', true);
    return;
  }

  setBusy(true);
  showMessage('Analyzing homework with AI, OPW2, and phonics knowledge.');
  setMode('Analyzing', 'busy');

  try {
    const response = await fetch('/api/analyze-homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    state.analysis = data.analysis;
    renderAnalysis(data.analysis);
    el.realBtn.disabled = false;
    showMessage('Analysis ready. Review it, then confirm and generate.');
    setMode('Analysis ready', 'ready');
  } catch (error) {
    showMessage(error.message, true);
    setMode('Failed', 'error');
  } finally {
    setBusy(false);
  }
}

async function generate(endpoint, label) {
  if (state.busy) return;

  const content = el.reviewInput.value.trim();
  if (!content) {
    showMessage('Enter review requirements first.', true);
    return;
  }

  setBusy(true);
  const hint = endpoint.includes('mock')
    ? 'Usually finishes within 1 second.'
    : 'Live AI may take 1-3 minutes.';
  showMessage(`${label} in progress. ${hint}`);
  setMode('Generating', 'busy');
  clearResults();
  const started = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        difficulty: el.difficulty.value,
        target_minutes: Number(el.minutes.value) || 5,
        confirmed_analysis: endpoint.includes('mock') ? undefined : readAnalysisFromPanel(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.status === 'analysis_required') {
        state.analysis = data.analysis;
        renderAnalysis(data.analysis);
        el.realBtn.disabled = false;
        throw new Error('Please confirm the analysis before generation.');
      }
      if (response.status === 429) {
        throw new Error('Live AI is rate-limited. Wait about 5 minutes or use Quick Demo now.');
      }
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    renderResult(data, elapsed);
    showMessage(`${label} complete. Click any module to start practicing.`);
    setMode(data.meta?.mode === 'mock' ? 'Demo result' : 'AI result', 'ready');
  } catch (error) {
    showMessage(error.message, true);
    setMode('Failed', 'error');
  } finally {
    setBusy(false);
  }
}

function renderAnalysis(analysis) {
  if (!analysis) return;
  el.analysisPanel.classList.remove('hidden');
  el.analysisPanel.innerHTML = `
    <div class="analysis-head">
      <div>
        <h2>Homework Analysis</h2>
        <p>Confirm or edit these targets before AI generation.</p>
      </div>
    </div>
    ${analysisListEditor('Words', 'words', analysis.words || analysis.target_words || [])}
    ${analysisListEditor('Sentence Patterns', 'sentence_patterns', analysis.sentence_patterns || [])}
    ${analysisListEditor('Grammar', 'grammar_points', analysis.grammar_points || [])}
    ${analysisListEditor('Phonics', 'phonics_points', analysis.phonics_points || [])}
  `;
}

function analysisListEditor(title, key, items) {
  const value = (items || [])
    .filter(item => item.selected !== false)
    .map(item => item.value || item.label || '')
    .filter(Boolean)
    .join(', ');
  return `
    <label class="analysis-editor">
      ${escapeHtml(title)}
      <textarea data-analysis-key="${escapeHtml(key)}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function readAnalysisFromPanel() {
  const base = state.analysis || {};
  const next = { ...base };
  el.analysisPanel.querySelectorAll('[data-analysis-key]').forEach(input => {
    const key = input.dataset.analysisKey;
    next[key] = input.value.split(',').map((value, index) => ({
      id: `${key}:${index}`,
      value: value.trim(),
      label: value.trim(),
      source: 'parent_confirmed',
      selected: true,
      required: true,
    })).filter(item => item.value);
  });
  next.target_words = next.words;
  return next;
}

function renderResult(data, elapsed) {
  state.modules = Array.isArray(data.modules) ? data.modules : [];
  const questions = state.modules.flatMap(module => Array.isArray(module.items) ? module.items : []);
  const typeSet = new Set(questions.map(question => question.type).filter(Boolean));

  el.moduleCount.textContent = state.modules.length;
  el.questionCount.textContent = questions.length;
  el.typeCoverage.textContent = `${REQUIRED_TYPES.filter(type => typeSet.has(type)).length}/11`;
  el.elapsedTime.textContent = `${elapsed}s`;

  el.practice.classList.add('hidden');
  el.modules.classList.remove('hidden');
  el.modules.innerHTML = state.modules.map(module => `
    <article class="module-card module-card-clickable" data-module-id="${escapeHtml(module.module_id)}" style="--accent:${escapeHtml(module.color || '#1f6feb')}">
      <div class="module-card-head">
        <h2>${escapeHtml(module.title || module.module_id || 'Module')}</h2>
        <button type="button" class="open-module" data-module-id="${escapeHtml(module.module_id)}">Start</button>
      </div>
      <div class="module-meta">
        <span>${escapeHtml(module.goal || '')}</span>
        <strong>${Array.isArray(module.items) ? module.items.length : 0} questions</strong>
      </div>
      <ul class="question-list">
        ${(module.items || []).slice(0, 5).map(question => `
          <li>
            <span class="question-type">${escapeHtml(question.type || 'unknown')}</span>
            <p class="question-text">${escapeHtml(questionText(question))}</p>
          </li>
        `).join('')}
      </ul>
    </article>
  `).join('');
}

function onModulesClick(event) {
  const trigger = event.target.closest('[data-module-id]');
  if (!trigger) return;

  const moduleId = trigger.dataset.moduleId;
  const module = state.modules.find(item => item.module_id === moduleId);
  if (!module) return;

  state.activeModuleId = moduleId;
  state.activeQuestionIndex = 0;
  renderPractice();
}

function onPracticeClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const module = activeModule();
  if (!module) return;

  if (action === 'back') {
    el.practice.classList.add('hidden');
    el.modules.classList.remove('hidden');
    showMessage('Choose another module or generate a new review.');
    return;
  }

  if (action === 'prev') {
    state.activeQuestionIndex = Math.max(0, state.activeQuestionIndex - 1);
    renderPractice();
    return;
  }

  if (action === 'next') {
    state.activeQuestionIndex = Math.min((module.items || []).length - 1, state.activeQuestionIndex + 1);
    renderPractice();
    return;
  }

  if (action === 'choose') {
    const correct = event.target.dataset.correct === 'true';
    const feedback = document.querySelector('#feedback');
    feedback.textContent = correct ? 'Correct.' : 'Try again.';
    feedback.className = correct ? 'feedback correct' : 'feedback wrong';
    return;
  }

  if (action === 'speak') {
    speak(event.target.dataset.text || '');
    return;
  }

  if (action === 'add-letter') {
    const question = activeQuestion();
    const answer = spellAnswer(question);
    if (state.spellAnswer.length >= answer.length) return;
    state.spellAnswer.push(event.target.dataset.letter || '');
    renderPractice();
    return;
  }

  if (action === 'backspace') {
    state.spellAnswer.pop();
    renderPractice();
    return;
  }

  if (action === 'reset-spell') {
    state.spellAnswer = [];
    renderPractice();
    return;
  }

  if (action === 'add-word') {
    const index = Number(event.target.dataset.index);
    const [word] = state.wordSource.splice(index, 1);
    if (word) state.wordAnswer.push(word);
    renderPractice();
    return;
  }

  if (action === 'remove-word') {
    const index = Number(event.target.dataset.index);
    const [word] = state.wordAnswer.splice(index, 1);
    if (word) state.wordSource.push(word);
    renderPractice();
    return;
  }

  if (action === 'reset-order') {
    const question = activeQuestion();
    state.wordSource = shuffle([...(question.words || sentenceWords(question.sentence || ''))]);
    state.wordAnswer = [];
    renderPractice();
  }
}

function renderPractice() {
  const module = activeModule();
  if (!module) return;

  const items = Array.isArray(module.items) ? module.items : [];
  const question = items[state.activeQuestionIndex];
  if (!question) return;
  prepareQuestionState(question);

  el.modules.classList.add('hidden');
  el.practice.classList.remove('hidden');
  showMessage(`Practicing ${module.title}.`);

  el.practice.innerHTML = `
    <div class="practice-head">
      <button type="button" data-action="back">Back to modules</button>
      <div>
        <h2>${escapeHtml(module.title)}</h2>
        <p>${state.activeQuestionIndex + 1} / ${items.length} · ${escapeHtml(question.type)}</p>
      </div>
    </div>
    <article class="practice-card">
      <h3>${escapeHtml(question.child_instruction || 'Complete the question.')}</h3>
      ${renderQuestionBody(question)}
      <div id="feedback" class="feedback"></div>
      <div class="practice-nav">
        <button type="button" data-action="prev" ${state.activeQuestionIndex === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" data-action="next" ${state.activeQuestionIndex === items.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
    </article>
  `;
}

function renderQuestionBody(question) {
  switch (question.type) {
    case 'listen_pick_image':
      return renderListenPickImage(question);
    case 'listen_pick_word':
    case 'mixed_challenge':
      return renderListenPickWord(question);
    case 'listen_judge':
      return renderListenJudge(question);
    case 'match_word_image':
      return renderMatchWordImage(question);
    case 'spell_word':
      return renderSpellWord(question);
    case 'word_order':
      return renderWordOrder(question);
    case 'fill_blank':
      return renderFillBlank(question);
    case 'read_aloud':
      return renderReadAloud(question);
    case 'translate_pick':
      return renderTranslatePick(question);
    case 'dialogue_complete':
      return renderDialogueComplete(question);
    default:
      return renderGenericQuestion(question);
  }
}

function renderListenPickImage(question) {
  return `
    ${audioPanel(question.audio_text || question.target_word || '')}
    <div class="picture-grid">
      ${(question.options || []).map(option => {
        const label = option.label || option.text || option.image_key || option.image_alt || 'item';
        return `
          <button type="button" class="picture-option" data-action="choose" data-correct="${option.is_correct === true}">
            <span class="picture-emoji">${emojiFor(label)}</span>
            <span>${escapeHtml(label)}</span>
          </button>
        `;
      }).join('')}
    </div>
    ${explanation(question)}
  `;
}

function renderListenPickWord(question) {
  return `
    ${audioPanel(question.audio_text || '')}
    ${optionsGrid(question.options || [])}
    ${explanation(question)}
  `;
}

function renderListenJudge(question) {
  const options = Array.isArray(question.options) && question.options.length
    ? question.options
    : [
      { text: 'Correct', is_correct: question.answer === true || question.is_correct === true },
      { text: 'Wrong', is_correct: question.answer === false || question.is_correct === false },
    ];

  return `
    ${audioPanel(question.audio_text || question.statement || '')}
    <div class="judge-grid">
      ${options.map(option => `
        <button type="button" data-action="choose" data-correct="${option.is_correct === true}">
          ${escapeHtml(option.text || option.label || 'Choice')}
        </button>
      `).join('')}
    </div>
    ${explanation(question)}
  `;
}

function renderMatchWordImage(question) {
  return `
    <p class="prompt-line">${escapeHtml(question.word || question.prompt_text || question.target_word || '')}</p>
    <div class="picture-grid">
      ${(question.options || []).map(option => {
        const label = option.label || option.text || option.image_key || option.image_alt || 'item';
        return `
          <button type="button" class="picture-option" data-action="choose" data-correct="${option.is_correct === true}">
            <span class="picture-emoji">${emojiFor(label)}</span>
            <span>${escapeHtml(label)}</span>
          </button>
        `;
      }).join('')}
    </div>
    ${explanation(question)}
  `;
}

function renderSpellWord(question) {
  const answer = spellAnswer(question);
  const pool = Array.isArray(question.letter_pool) && question.letter_pool.length
    ? question.letter_pool
    : shuffle(answer.toUpperCase().split('').concat(['A', 'E', 'T', 'P']).slice(0, 8));
  const typed = state.spellAnswer.join('');
  const done = typed.length === answer.length;
  const correct = done && typed.toLowerCase() === answer.toLowerCase();

  return `
    ${audioPanel(question.audio_text || answer)}
    <div class="spell-slots">
      ${answer.split('').map((_, index) => `<span>${escapeHtml(state.spellAnswer[index] || '')}</span>`).join('')}
    </div>
    <div class="letter-grid">
      ${pool.map(letter => `<button type="button" data-action="add-letter" data-letter="${escapeHtml(letter)}">${escapeHtml(letter)}</button>`).join('')}
    </div>
    <div class="practice-nav inline-actions">
      <button type="button" data-action="backspace">Backspace</button>
      <button type="button" data-action="reset-spell">Reset</button>
    </div>
    ${done ? `<div class="feedback ${correct ? 'correct' : 'wrong'}">${correct ? 'Correct.' : `Try again. Answer: ${escapeHtml(answer)}`}</div>` : ''}
    ${explanation(question)}
  `;
}

function renderWordOrder(question) {
  const formed = state.wordAnswer.join(' ').replace(/\s+([?.!,;:])/g, '$1');
  const complete = state.wordSource.length === 0;
  const correct = complete && normalizeSentence(formed) === normalizeSentence(question.sentence || '');

  return `
    ${audioPanel(question.sentence || question.audio_text || '')}
    <div class="order-answer">
      ${state.wordAnswer.length ? state.wordAnswer.map((word, index) => `<button type="button" data-action="remove-word" data-index="${index}">${escapeHtml(word)}</button>`).join('') : '<span class="muted">Tap words below to build the sentence.</span>'}
    </div>
    <div class="word-bank">
      ${state.wordSource.map((word, index) => `<button type="button" data-action="add-word" data-index="${index}">${escapeHtml(word)}</button>`).join('')}
    </div>
    <div class="practice-nav inline-actions">
      <button type="button" data-action="reset-order">Reset</button>
    </div>
    ${complete ? `<div class="feedback ${correct ? 'correct' : 'wrong'}">${correct ? 'Correct.' : `Correct sentence: ${escapeHtml(question.sentence || '')}`}</div>` : ''}
    ${explanation(question)}
  `;
}

function renderFillBlank(question) {
  const parts = Array.isArray(question.sentence_parts) ? question.sentence_parts : ['', ''];
  return `
    ${audioPanel(`${parts[0] || ''} ${question.blank_answer || ''} ${parts[1] || ''}`.trim())}
    <p class="prompt-line">${escapeHtml(parts[0] || '')}<span class="blank">____</span>${escapeHtml(parts[1] || '')}</p>
    ${optionsGrid(question.options || [])}
    ${explanation(question)}
  `;
}

function renderReadAloud(question) {
  const text = question.text || question.pronunciation_target || question.audio_text || '';
  return `
    ${audioPanel(text)}
    <p class="prompt-line">${escapeHtml(text)}</p>
    ${question.translation ? `<p class="answer-line">${escapeHtml(question.translation)}</p>` : ''}
    <button type="button" data-action="choose" data-correct="true">I read it aloud</button>
    ${explanation(question)}
  `;
}

function renderTranslatePick(question) {
  const prompt = question.source_text || question.text || question.prompt_text || question.target_word || '';
  return `
    <p class="prompt-line">${escapeHtml(prompt)}</p>
    ${optionsGrid(question.options || [])}
    ${explanation(question)}
  `;
}

function renderDialogueComplete(question) {
  const dialogue = Array.isArray(question.dialogue) ? question.dialogue : [];
  return `
    <div class="dialogue">
      ${dialogue.map(line => `<p><strong>${escapeHtml(line.speaker || line.name || 'Speaker')}:</strong> ${escapeHtml(line.text || '____')}</p>`).join('')}
    </div>
    ${optionsGrid(question.options || [])}
    ${explanation(question)}
  `;
}

function renderGenericQuestion(question) {
  const parts = [];
  const mainText = question.text || question.audio_text || question.sentence || question.prompt_text || question.target_word;

  if (mainText) {
    parts.push(`<p class="prompt-line">${escapeHtml(mainText)}</p>`);
  }

  if (Array.isArray(question.sentence_parts) && question.blank_answer) {
    parts.push(`<p class="prompt-line">${escapeHtml(question.sentence_parts[0])}<span class="blank">____</span>${escapeHtml(question.sentence_parts[1])}</p>`);
  }

  if (Array.isArray(question.words)) {
    parts.push(`<div class="word-bank">${question.words.map(word => `<span>${escapeHtml(word)}</span>`).join('')}</div>`);
  }

  if (Array.isArray(question.dialogue)) {
    parts.push(`<div class="dialogue">${question.dialogue.map(line => `<p><strong>${escapeHtml(line.speaker || line.name || 'Speaker')}:</strong> ${escapeHtml(line.text || '____')}</p>`).join('')}</div>`);
  }

  if (Array.isArray(question.options)) {
    parts.push(`<div class="option-grid">${question.options.map(option => {
      const label = option.text || option.label || option.image_key || option.image_alt || option.translation || 'Option';
      return `<button type="button" data-action="choose" data-correct="${option.is_correct === true}">${escapeHtml(label)}</button>`;
    }).join('')}</div>`);
  } else if (question.answer || question.spell_word || question.blank_answer) {
    parts.push(`<p class="answer-line">Answer: ${escapeHtml(question.answer || question.spell_word || question.blank_answer)}</p>`);
  }

  if (question.explanation) {
    parts.push(`<p class="explanation">${escapeHtml(question.explanation)}</p>`);
  }

  return parts.join('');
}

function audioPanel(text) {
  if (!text) return '';
  return `
    <div class="audio-panel">
      <p>${escapeHtml(text)}</p>
      <button type="button" data-action="speak" data-text="${escapeHtml(text)}">Play audio</button>
    </div>
  `;
}

function optionsGrid(options) {
  return `
    <div class="option-grid">
      ${options.map(option => {
        const label = option.text || option.label || option.image_key || option.image_alt || option.translation || 'Option';
        return `<button type="button" data-action="choose" data-correct="${option.is_correct === true}">${escapeHtml(label)}</button>`;
      }).join('')}
    </div>
  `;
}

function explanation(question) {
  return question.explanation ? `<p class="explanation">${escapeHtml(question.explanation)}</p>` : '';
}

function activeModule() {
  return state.modules.find(module => module.module_id === state.activeModuleId);
}

function activeQuestion() {
  const module = activeModule();
  return module?.items?.[state.activeQuestionIndex];
}

function prepareQuestionState(question) {
  if (state.activeQuestionId === question.id) return;
  state.activeQuestionId = question.id;
  state.spellAnswer = [];
  state.wordAnswer = [];
  state.wordSource = shuffle([...(question.words || sentenceWords(question.sentence || ''))]);
}

function spellAnswer(question) {
  return question.spell_word || question.answer || question.target_word || question.audio_text || '';
}

function sentenceWords(sentence) {
  return sentence ? sentence.match(/[A-Za-z']+|[?.!,;:]/g) || [] : [];
}

function normalizeSentence(sentence) {
  return sentence.trim().replace(/\s+/g, ' ').replace(/\s+([?.!,;:])/g, '$1').toLowerCase();
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[\u4e00-\u9fff]/.test(text) ? 'zh-CN' : 'en-US';
  utterance.rate = utterance.lang === 'en-US' ? 0.82 : 0.95;
  speechSynthesis.speak(utterance);
}

function emojiFor(label) {
  const key = String(label).toLowerCase();
  const map = {
    hen: '🐔',
    pen: '🖊️',
    bed: '🛏️',
    red: '🔴',
    corn: '🌽',
    milk: '🥛',
    water: '💧',
    apple: '🍎',
    banana: '🍌',
    dog: '🐶',
    cat: '🐱',
    fish: '🐟',
    bird: '🐦',
    book: '📘',
    pencil: '✏️',
  };
  return map[key] || '🔤';
}

function questionText(question) {
  return question.child_instruction
    || question.text
    || question.audio_text
    || question.sentence
    || question.target_word
    || 'Question generated.';
}

function clearResults() {
  state.modules = [];
  state.activeModuleId = null;
  state.activeQuestionIndex = 0;
  el.modules.innerHTML = '';
  el.modules.classList.remove('hidden');
  el.practice.innerHTML = '';
  el.practice.classList.add('hidden');
  el.moduleCount.textContent = '0';
  el.questionCount.textContent = '0';
  el.typeCoverage.textContent = '0/11';
  el.elapsedTime.textContent = '-';
}

function showMessage(text, isError = false) {
  el.message.textContent = text;
  el.message.classList.toggle('error', isError);
}

function setMode(text, className) {
  el.modePill.textContent = text;
  el.modePill.className = `status-pill ${className || ''}`;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  el.mockBtn.disabled = isBusy;
  el.analyzeBtn.disabled = isBusy;
  el.realBtn.disabled = isBusy || !state.analysis;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
