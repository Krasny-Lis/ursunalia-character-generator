import { transformAnswers } from '../shared/schema-impact.mjs';
import { answerIssues } from '../shared/validation.mjs';
export function liveSchemaMappingReport(db, legacy = false) {
  const report = { characterCount: 0, conflicts: [], validationWarnings: [] };
  const sql = legacy ? `SELECT c.id,c.answers,f.definition original,t.definition target FROM applications c
    JOIN forms f ON f.id=c.form_id AND f.revision=c.form_revision JOIN forms t ON t.id=c.form_id
    AND t.revision=(SELECT MAX(revision) FROM forms WHERE id=c.form_id) WHERE c.form_id='character-2027'`
    : `SELECT c.id,c.answers,f.definition original,t.definition target FROM characters c
    JOIN forms f ON f.id=c.form_id AND f.revision=c.form_revision
    JOIN event_character_forms m ON m.event_id=c.event_id
    JOIN forms t ON t.id=m.form_id AND t.revision=m.form_revision`;
  for (const row of db.prepare(sql).all()) {
    report.characterCount++;
    const impact = transformAnswers(JSON.parse(row.original), JSON.parse(row.target), JSON.parse(row.answers));
    if (impact.lostFieldIds.length) report.conflicts.push({ characterId: row.id, fieldIds: impact.lostFieldIds });
    const fields = Object.keys(answerIssues(JSON.parse(row.target), JSON.parse(row.answers)));
    if (fields.length) report.validationWarnings.push({ characterId: row.id, fieldIds: fields });
  }
  return report;
}
