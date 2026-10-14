import { answerIssues } from '../shared/validation.mjs';

/** Metadata only: never expose answers, email addresses, password or session hashes. */
export function characterMappingReport(db) {
  const forms = db.prepare('SELECT id,revision,definition FROM forms ORDER BY id,revision').all();
  const known = new Map(forms.map(f => [`${f.id}:${f.revision}`, JSON.parse(f.definition)]));
  const report = { characterCount: 0, retainedQuestionnaireCount: 0, unresolved: [], conflicts: [],
    forms: forms.map(f => ({ formId: f.id, revision: f.revision, eventId: known.get(`${f.id}:${f.revision}`).eventId })),
    preservedAnswerWarnings: [] };
  const pairs = new Map();
  for (const row of db.prepare('SELECT id,user_id,form_id,form_revision,answers FROM applications ORDER BY id').all()) {
    const form = known.get(`${row.form_id}:${row.form_revision}`), eventId = form?.eventId;
    if (row.form_id === 'logistics-2027' && eventId === 'ursunalia-2027') {
      report.retainedQuestionnaireCount++;
    } else if (row.form_id === 'character-2027' && eventId === 'ursunalia-2027') {
      report.characterCount++;
    } else report.unresolved.push({ applicationId: row.id, formId: row.form_id, eventId });
    if (!(row.form_id === 'logistics-2027' && eventId === 'ursunalia-2027')) {
      const key = JSON.stringify([row.user_id, eventId]), ids = pairs.get(key) ?? [];
      ids.push(row.id); pairs.set(key, ids);
    }
    if (form) {
      const answers = JSON.parse(row.answers), fields = new Set(form.sections.flatMap(s => s.fields.map(f => f.id)));
      const unknownFieldIds = Object.keys(answers).filter(id => !fields.has(id));
      const invalidFieldIds = Object.keys(answerIssues(form, answers));
      if (unknownFieldIds.length || invalidFieldIds.length)
        report.preservedAnswerWarnings.push({ applicationId: row.id, unknownFieldIds, invalidFieldIds });
    }
  }
  for (const ids of pairs.values()) if (ids.length > 1) report.conflicts.push({ applicationIds: ids });
  return report;
}
