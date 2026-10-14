import { answerIssues } from './validation.mjs';
// Archives contain text and numbers only. Images are removed even from unknown legacy keys.
export function withoutImages(value) {
  if (typeof value === 'string') {
    if (value === 'art/alena.png') return '';
    const text = value.replace(/data:image\/[^\s"'<>]+/gi, '');
    return /data:image\//i.test(text) ? '' : text;
  }
  if (Array.isArray(value)) return value.map(withoutImages);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, withoutImages(v)]));
  return value;
}
export function textAnswers(form, answers, historicalFileIds = []) {
  const fields = new Map(form.sections.flatMap(s => s.fields).map(f => [f.id,f]));
  const files = new Set(historicalFileIds);
  return withoutImages(Object.fromEntries(Object.entries(answers).filter(([id]) =>
    fields.get(id)?.type !== 'file' && (fields.has(id) || !files.has(id)))));
}
export function reusableAnswers(before, after, answers) {
  const old = new Map(before.sections.flatMap(s => s.fields).map(f => [f.id,f]));
  const result = {};
  for (const field of after.sections.flatMap(s => s.fields)) {
    if (['file','info'].includes(field.type) || old.get(field.id)?.type !== field.type || answers[field.id] === undefined) continue;
    const value = withoutImages(answers[field.id]);
    if (field.type === 'multi' && !Array.isArray(value)) continue;
    if (['single','select'].includes(field.type) && !field.options.some(o => o.id === value)) continue;
    result[field.id] = field.type === 'multi' ? value.filter(v => field.options.some(o => o.id === v)) : value;
  }
  const draft = { ...after, sections: after.sections.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, required: false, minLength: 0, minSelections: 0 })) })) };
  for (const id of Object.keys(answerIssues(draft, result))) delete result[id];
  return result;
}
