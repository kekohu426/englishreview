export class AnalysisRequiredError extends Error {
  constructor(analysis) {
    super('Confirm or edit the analysis before generation.');
    this.name = 'AnalysisRequiredError';
    this.statusCode = 409;
    this.analysis = analysis;
  }
}

export class QualityGateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QualityGateError';
    this.statusCode = 422;
    this.details = details;
  }
}

export function isInfrastructureError(error) {
  const message = String(error?.message || '');
  return error?.name === 'AbortError'
    || /timeout/i.test(message)
    || message.includes('LLM API error: 429')
    || /LLM API error: 5\d\d/.test(message)
    || /network|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message);
}

export default {
  AnalysisRequiredError,
  QualityGateError,
  isInfrastructureError,
};
