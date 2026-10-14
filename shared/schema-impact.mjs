const fields = form => new Map(form.sections.flatMap(s => s.fields.map(f => [f.id, f])));
const present = value => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length);
export function schemaChanges(before, after) {
  const previous = fields(before), next = fields(after), changes = [];
  for (const section of before.sections)
    if (!after.sections.some(s => s.id === section.id)) changes.push({ kind: 'section_removed', sectionId: section.id });
  for (const [id, field] of previous) {
    const target = next.get(id);
    if (!target) changes.push({ kind: 'field_removed', fieldId: id });
    else if (target.type !== field.type) changes.push({ kind: 'type_changed', fieldId: id });
    else {
      const removed = (field.options ?? []).filter(o => !target.options?.some(n => n.id === o.id)).map(o => o.id);
      if (removed.length) changes.push({ kind: 'options_removed', fieldId: id, optionIds: removed });
    }
  }
  return changes;
}
/** Only explicit schema changes remove answers; unrelated historical keys are retained. */
export function transformAnswers(before, after, source) {
  const previous = fields(before), next = fields(after), answers = { ...source }, lostFieldIds = [];
  for (const [id, value] of Object.entries(source)) {
    const old = previous.get(id), target = next.get(id);
    let remove = (old && (!target || old.type !== target.type)) || (!old && target);
    if (!remove && old && target && old.options && target.options) {
      const removed = new Set(old.options.filter(o => !target.options.some(n => n.id === o.id)).map(o => o.id));
      const oldIds = new Set(old.options.map(o => o.id));
      const targetIds = new Set(target.options.map(o => o.id));
      const unsafe = option => removed.has(option) || (!oldIds.has(option) && targetIds.has(option));
      if (Array.isArray(value)) {
        const kept = value.filter(v => !unsafe(v));
        if (kept.length !== value.length) { answers[id] = kept; lostFieldIds.push(id); }
      } else if (unsafe(value)) remove = true;
    }
    if (remove) { delete answers[id]; if (present(value)) lostFieldIds.push(id); }
  }
  return { answers, lostFieldIds: [...new Set(lostFieldIds)] };
}
