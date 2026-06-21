import config from '../config.js';
import { REQUIRED_QUESTION_TYPES } from '../questionTypes.js';
import { buildTaskCoverageReport } from './taskCoverage.js';

export function auditQuestionCoverage({ requirements, knowledgeScope, phonicsScope, confirmedAnalysis, tasks, questions, taskReport }) {
  const taskLikeQuestions = questionsToTaskShape(Array.isArray(questions) ? questions : []);
  const report = buildTaskCoverageReport(taskLikeQuestions, requirements, knowledgeScope, [], [], [], { phonicsScope, confirmedAnalysis, knowledgePoints: tasks });
  const typeCounts = countTypes(questions || []);
  const typeMissing = REQUIRED_QUESTION_TYPES.filter(type => (typeCounts[type] || 0) < config.questions.minPerType);
  const invalidTypes = (questions || []).map(question => question?.type).filter(type => !REQUIRED_QUESTION_TYPES.includes(type));
  const traceability = (questions || []).every(question =>
    Array.isArray(question.requirement_ids) && question.requirement_ids.length > 0 &&
    Array.isArray(question.source_refs) && question.source_refs.length > 0 &&
    Array.isArray(question.knowledge_tags) && question.knowledge_tags.length > 0
  );

  const missing = [];
  if (report.overall !== 'PASS') missing.push('question_content_coverage');
  if (typeMissing.length) missing.push(...typeMissing.map(type => `question_type:${type}`));
  if (invalidTypes.length) missing.push(...invalidTypes.map(type => `invalid_type:${type}`));
  if (!traceability) missing.push('traceability');

  const overall = missing.length === 0 ? 'PASS' : 'FAIL';
  return {
    valid: overall === 'PASS',
    overall,
    missing,
    report: {
      ...report,
      overall,
      task_overall: taskReport?.overall || 'UNKNOWN',
      question_types: {
        status: typeMissing.length || invalidTypes.length ? 'FAIL' : 'PASS',
        counts: typeCounts,
        missing: typeMissing,
        invalid: invalidTypes,
      },
      traceability: {
        status: traceability ? 'PASS' : 'FAIL',
        total: (questions || []).length,
      },
    },
  };
}

function questionsToTaskShape(questions) {
  return questions.map(question => ({
    task_id: question.id,
    question_type: question.type,
    target_word: question.target_word || question.spell_word || question.word || wordFromQuestion(question),
    target_sentence: sentenceFromQuestion(question),
    ability_targets: question.ability_targets,
    note: JSON.stringify({
      audio_text: question.audio_text,
      options: question.options,
      sentence: question.sentence,
      words: question.words,
      sentence_parts: question.sentence_parts,
      blank_answer: question.blank_answer,
      source_text: question.source_text,
      dialogue: question.dialogue,
      text: question.text,
    }),
    source_refs: question.source_refs,
    knowledge_tags: question.knowledge_tags,
  }));
}

function sentenceFromQuestion(question) {
  if (question.target_sentence) return question.target_sentence;
  if (question.text) return question.text;
  if (question.sentence) return question.sentence;
  if (question.audio_text) return question.audio_text;
  if (question.source_text) return question.source_text;
  if (Array.isArray(question.dialogue)) return question.dialogue.map(line => line.text).join(' ');
  if (Array.isArray(question.sentence_parts)) return question.sentence_parts.join(' ');
  return '';
}

function wordFromQuestion(question) {
  const text = sentenceFromQuestion(question).toLowerCase();
  const words = text.match(/\b[a-z]{1,12}\b/g) || [];
  return words[words.length - 1] || '';
}

function countTypes(questions) {
  const counts = {};
  questions.forEach(question => {
    counts[question?.type] = (counts[question?.type] || 0) + 1;
  });
  return counts;
}

export default {
  auditQuestionCoverage,
};
