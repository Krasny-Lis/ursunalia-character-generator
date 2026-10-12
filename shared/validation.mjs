const types = ['text', 'textarea', 'single', 'multi', 'select', 'rating', 'date', 'file', 'info'];
const record = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const safeId = (x) =>
  typeof x === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(x) &&
  !['__proto__', 'constructor', 'prototype'].includes(x);
export function definitionIssues(form) {
  const errors = [];
  if (
    !record(form) ||
    !safeId(form.id) ||
    !safeId(form.eventId) ||
    typeof form.title !== 'string' ||
    !form.title.trim() ||
    form.title.length > 200 ||
    !Number.isInteger(form.revision) ||
    form.revision < 1 ||
    !['draft', 'published'].includes(form.status) ||
    !Array.isArray(form.sections) ||
    !form.sections.length ||
    form.sections.length > 30
  )
    return ['Nieprawidłowa definicja ankiety.'];
  const ids = new Set();
  const sectionIds = new Set();
  let fields = 0;
  for (const section of form.sections) {
    if (
      !record(section) ||
      !safeId(section.id) ||
      sectionIds.has(section.id) ||
      typeof section.title !== 'string' ||
      !section.title.trim() ||
      !Array.isArray(section.fields) ||
      !section.fields.length
    ) {
      errors.push('Sekcja wymaga unikalnego ID, tytułu i przynajmniej jednego pola.');
      continue;
    }
    sectionIds.add(section.id);
    for (const f of section.fields) {
      if (++fields > 300) return ['Maksymalnie 300 pól.'];
      if (
        !record(f) ||
        !safeId(f.id) ||
        ids.has(f.id) ||
        !types.includes(f.type) ||
        typeof f.label !== 'string' ||
        !f.label.trim() ||
        typeof f.required !== 'boolean'
      ) {
        errors.push('Nieprawidłowe pole.');
        continue;
      }
      ids.add(f.id);
      if (
        ['single', 'multi', 'select'].includes(f.type) &&
        (!Array.isArray(f.options) ||
          !f.options.length ||
          f.options.length > 200 ||
          f.options.some(
            (o) => !record(o) || !safeId(o.id) || typeof o.label !== 'string' || !o.label.trim(),
          ) ||
          new Set(f.options.map((o) => o.id)).size !== f.options.length)
      )
        errors.push(`Nieprawidłowe opcje: ${f.label}.`);
      if (
        f.type === 'rating' &&
        (!Number.isInteger(f.min) ||
          !Number.isInteger(f.max) ||
          f.min < 0 ||
          f.max < f.min ||
          f.max - f.min > 10)
      )
        errors.push(`Nieprawidłowa skala: ${f.label}.`);
      for (const key of ['minLength', 'maxLength', 'minSelections', 'maxSelections'])
        if (f[key] !== undefined && (!Number.isInteger(f[key]) || f[key] < 0 || f[key] > 10000))
          errors.push(`Nieprawidłowy limit: ${f.label}.`);
      if (
        f.minLength > f.maxLength ||
        f.minSelections > f.maxSelections ||
        f.minSelections > f.options?.length ||
        f.maxSelections > f.options?.length
      )
        errors.push(`Sprzeczne limity: ${f.label}.`);
    }
  }
  return errors;
}
export function answerIssues(form, answers) {
  const issues = {};
  if (!record(answers)) return { _form: 'Nieprawidłowe odpowiedzi.' };
  for (const section of form.sections)
    for (const f of section.fields) {
      if (f.type === 'info') continue;
      const v = answers[f.id];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === 'string' && !v.trim()) ||
        (Array.isArray(v) && !v.length);
      if (empty) {
        if (f.required) issues[f.id] = 'To pole jest wymagane.';
        continue;
      }
      if (['text', 'textarea', 'date', 'file'].includes(f.type)) {
        if (typeof v !== 'string') {
          issues[f.id] = 'Nieprawidłowy tekst.';
          continue;
        }
        if (f.type === 'file') {
          if (!isPortrait(v)) issues[f.id] = 'Wybierz obraz JPG, PNG lub WebP do 750 KB.';
        } else if (v.trim().length < (f.minLength ?? 0) || v.length > (f.maxLength ?? 10000))
          issues[f.id] = `Wpisz od ${f.minLength ?? 0} do ${f.maxLength ?? 10000} znaków.`;
        if (
          f.type === 'date' &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
            !Number.isFinite(Date.parse(v)) ||
            new Date(v).toISOString().slice(0, 10) !== v)
        )
          issues[f.id] = 'Wybierz prawidłową datę.';
      } else if (f.type === 'multi') {
        if (
          !Array.isArray(v) ||
          new Set(v).size !== v.length ||
          v.some((x) => !f.options.some((o) => o.id === x)) ||
          v.length < (f.minSelections ?? 0) ||
          v.length > (f.maxSelections ?? f.options.length)
        )
          issues[f.id] =
            `Wybierz od ${f.minSelections ?? (f.required ? 1 : 0)} do ${f.maxSelections ?? f.options.length} odpowiedzi.`;
      } else if (['single', 'select'].includes(f.type)) {
        if (typeof v !== 'string' || !f.options.some((o) => o.id === v))
          issues[f.id] = 'Wybierz odpowiedź z listy.';
      } else if (f.type === 'rating' && (!Number.isInteger(v) || v < f.min || v > f.max))
        issues[f.id] = 'Wybierz ocenę w podanej skali.';
    }
  return issues;
}
export function isPortrait(value) {
  return (
    typeof value === 'string' &&
    (value === 'art/alena.png' ||
      (value.length <= 1025000 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))
  );
}
export function cleanAnswers(form, answers) {
  const allowed = new Set(
    form.sections.flatMap((s) => s.fields.filter((f) => f.type !== 'info').map((f) => f.id)),
  );
  return Object.fromEntries(Object.entries(answers).filter(([id]) => allowed.has(id)));
}
