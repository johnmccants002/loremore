export type MomentContext = {
  schema_version?: number; title?: string; summary?: string; likely_activity?: string;
  confidence?: 'low' | 'medium' | 'high'; uncertainty?: string;
  project_id?: string | null; project_reason?: string | null; reflection_questions?: string[];
  generated_at?: string; started_at?: string; error_code?: string;
};
// Treat stored JSON as untrusted: legacy/manual edits must not crash the UI.
export function readableContext(value: MomentContext | undefined) {
  const text = (key: keyof MomentContext) => typeof value?.[key] === 'string' ? String(value[key]) : '';
  return { summary: text('summary'), activity: text('likely_activity'), uncertainty: text('uncertainty'),
    confidence: ['low','medium','high'].includes(text('confidence')) ? text('confidence') : 'unspecified',
    projectReason: text('project_reason'),
    questions: Array.isArray(value?.reflection_questions) ? value.reflection_questions.filter((item): item is string => typeof item === 'string').slice(0,5) : [],
  };
}
