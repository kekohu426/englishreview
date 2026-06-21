export const SOURCE_REGISTRY = [
  {
    id: 'opw2_textbook',
    type: 'textbook',
    label: 'Big Fun 2 textbook',
    defaultForGenericUnits: true,
    aliases: [
      /opw2/i,
      /big\s*fun\s*2/i,
      /bigfun\s*2/i,
      /oxford\s+phonics\s+world\s*2/i,
      /\u8bfe\u672c/,
      /\u6559\u6750/,
      /\u7ec3\u4e60/,
    ],
  },
  {
    id: 'oxford_phonics',
    type: 'phonics',
    label: 'Oxford phonics',
    defaultForGenericUnits: false,
    aliases: [
      /phonics/i,
      /natural\s+phonics/i,
      /\u81ea\u7136\u62fc\u8bfb/,
      /\u81ea\u62fc/,
      /\u62fc\u8bfb/,
      /\u725b\u6d25\u81ea\u7136\u62fc\u8bfb/,
    ],
  },
];

export function routeHomeworkSources(inputText = '', registry = SOURCE_REGISTRY, context = {}) {
  const raw = String(inputText || '');
  const segments = splitSegments(raw);
  const activeRegistry = applySourceContext(registry, context);

  const sourceRoutes = segments.map(segment => {
    const matchedSources = activeRegistry
      .filter(source => matchesAny(segment, source.aliases))
      .map(source => source.id);
    const sources = matchedSources.length ? matchedSources : ['general_instruction'];
    return {
      text: segment,
      sources,
      units: parseUnitsFromText(segment),
      pages: parsePagesFromText(segment),
    };
  });

  const sourceScopes = Object.fromEntries(activeRegistry.map(source => [
    source.id,
    { units: [], pages: [], segments: [], selected: !!source.selectedByParent },
  ]));

  sourceRoutes.forEach(route => {
    route.sources.forEach(sourceId => {
      if (!sourceScopes[sourceId]) return;
      sourceScopes[sourceId].units.push(...route.units);
      sourceScopes[sourceId].pages.push(...route.pages);
      sourceScopes[sourceId].segments.push(route.text);
    });
  });

  const defaultSources = activeRegistry.filter(source => source.defaultForGenericUnits);
  sourceRoutes
    .filter(route => route.sources.includes('general_instruction'))
    .forEach(route => {
      defaultSources.forEach(source => {
        sourceScopes[source.id].units.push(...route.units);
        sourceScopes[source.id].pages.push(...route.pages);
        sourceScopes[source.id].segments.push(route.text);
      });
    });

  Object.values(sourceScopes).forEach(scope => {
    scope.units = unique(scope.units).sort((a, b) => a - b);
    scope.pages = unique(scope.pages).sort((a, b) => a - b);
    scope.segments = unique(scope.segments);
  });

  return {
    source_routes: sourceRoutes,
    source_scopes: sourceScopes,
    opw2_units: sourceScopes.opw2_textbook?.units || [],
    phonics_units: sourceScopes.oxford_phonics?.selected && !(sourceScopes.oxford_phonics?.units || []).length
      ? [1, 2, 3, 4]
      : sourceScopes.oxford_phonics?.units || [],
    opw2_pages: sourceScopes.opw2_textbook?.pages || [],
    aliases: Object.fromEntries(activeRegistry.map(source => [source.id, source.label])),
  };
}

function applySourceContext(registry, context = {}) {
  const defaultTextbookId = context.default_textbook_id || context.defaultTextbookId;
  const selectedIds = new Set(context.selected_material_ids || context.selectedMaterialIds || []);
  if (!defaultTextbookId && !selectedIds.size) return registry;
  return registry.map(source => ({
    ...source,
    defaultForGenericUnits: selectedIds.size
      ? selectedIds.has(source.id)
      : (source.type === 'textbook' ? source.id === defaultTextbookId : source.defaultForGenericUnits),
    selectedByParent: selectedIds.has(source.id),
  }));
}

export function parseUnitsFromText(raw = '') {
  const text = String(raw || '');
  if (
    /unit\s*1\s*[-~\u5230\u81f3]\s*4/i.test(text) ||
    /units?\s*1\s*[-~]\s*4/i.test(text) ||
    /\u524d\s*(?:4|\u56db)\s*(?:\u4e2a)?\s*(?:\u5355\u5143|\u8bfe|\u8bfe\u6587)/.test(text)
  ) {
    return [1, 2, 3, 4];
  }

  const units = [];
  for (const match of text.matchAll(/unit\s*(\d+)/gi)) {
    addUnit(units, match[1]);
  }
  for (const match of text.matchAll(/lessons?\s*(\d+)/gi)) {
    addUnit(units, match[1]);
  }
  for (const match of text.matchAll(/(?:\u7b2c)?\s*(\d+)\s*(?:\u5355\u5143|\u8bfe|\u8bfe\u6587|unit|lesson)/gi)) {
    addUnit(units, match[1]);
  }
  for (const match of text.matchAll(/(?:\u7b2c)?\s*([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341])\s*(?:\u5355\u5143|\u8bfe|\u8bfe\u6587|unit|lesson)/g)) {
    addUnit(units, chineseUnitNumber(match[1]));
  }
  return unique(units).sort((a, b) => a - b);
}

export function parsePagesFromText(raw = '') {
  const pages = [];
  const normalized = String(raw || '').replace(/[\uff0c\u3001]/g, ',');

  for (const match of normalized.matchAll(/(?:p|page)\s*([0-9]+(?:\s*,\s*[0-9]+)*)/gi)) {
    match[1].split(/\s*,\s*/).forEach(part => addPage(pages, part));
  }
  for (const match of normalized.matchAll(/(?:\u6559\u6750|\u7ec3\u4e60)?\s*(?:p|\u9875)\s*([0-9]+(?:\s*,\s*[0-9]+)*)/gi)) {
    match[1].split(/\s*,\s*/).forEach(part => addPage(pages, part));
  }

  return unique(pages).sort((a, b) => a - b);
}

function splitSegments(raw) {
  return String(raw || '')
    .split(/\r?\n+/)
    .map(text => text.trim())
    .filter(Boolean);
}

function matchesAny(value, patterns) {
  return patterns.some(pattern => pattern.test(value));
}

function addUnit(units, value) {
  const unit = Number(value);
  if (Number.isInteger(unit) && unit > 0) units.push(unit);
}

function addPage(pages, value) {
  const page = Number(value);
  if (Number.isInteger(page) && page > 0) pages.push(page);
}

function chineseUnitNumber(value) {
  return {
    '\u4e00': 1,
    '\u4e8c': 2,
    '\u4e09': 3,
    '\u56db': 4,
    '\u4e94': 5,
    '\u516d': 6,
    '\u4e03': 7,
    '\u516b': 8,
    '\u4e5d': 9,
    '\u5341': 10,
  }[value];
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

export default {
  SOURCE_REGISTRY,
  routeHomeworkSources,
  parseUnitsFromText,
  parsePagesFromText,
};
