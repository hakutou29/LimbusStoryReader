import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const outputPath = path.join(workspaceRoot, 'story-viewer', 'data', 'story-index.json');

const languageConfigs = [
  { id: 'LLC_zh-CN', label: '中文', folder: 'LLC_zh-CN' },
  { id: 'JP', label: '日文', folder: 'JP' },
  { id: 'EN', label: '英文', folder: 'EN' },
  { id: 'KR', label: '韩文', folder: 'KR' },
];

const partLabelMap = {
  '': '正篇',
  A: '战斗前剧情',
  B: '战斗后剧情',
  X: '特殊剧情',
  I: '战斗中剧情',
};

const partSortBase = {
  '': 0,
  A: 1,
  I: 2,
  B: 3,
  X: 4,
};

const categorySort = {
  main: 1,
  intervallo: 2,
  intervalloLecture: 3,
  walpurgis: 4,
  arknights: 5,
  sideStory: 6,
  other: 7,
};

function normalizePart(part) {
  if (!part) {
    return {
      raw: '',
      code: '',
      label: partLabelMap[''],
      sort: partSortBase[''],
    };
  }

  const match = part.match(/^(A|B|X|I)(\d*)$/);
  if (!match) {
    return {
      raw: part,
      code: part,
      label: part,
      sort: 99,
    };
  }

  const [, base, sequence] = match;
  if (base === 'I' && sequence) {
    return {
      raw: part,
      code: part,
      label: `战斗中剧情 ${sequence}`,
      sort: partSortBase.I + Number(sequence) / 100,
    };
  }

  return {
    raw: part,
    code: part,
    label: partLabelMap[base] ?? part,
    sort: partSortBase[base] ?? 99,
  };
}

function padStage(value) {
  return value ? value.padStart(2, '0') : '00';
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildSearchText(parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function parseStoryCode(fileCode) {
  let match = fileCode.match(/^(S)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || '0';
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      category: 'main',
      categoryLabel: '主线剧情',
      categoryDescription: 'S 开头，按主线章节与关卡索引。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: `主线 第${toNumber(chapter)}章`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${toNumber(stage)}节`,
      storyLabel: `主线 第${toNumber(chapter)}章 第${toNumber(stage)}节 ${part.label}`,
      part,
      sortKey: [categorySort.main, toNumber(chapter), toNumber(stage), part.sort],
      searchText: buildSearchText([fileCode, '主线剧情', `第${toNumber(chapter)}章`, `第${toNumber(stage)}节`, part.label]),
    };
  }

  match = fileCode.match(/^(ES)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || digits;
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      category: 'intervalloLecture',
      categoryLabel: '间章8 授课剧情',
      categoryDescription: 'ES 开头，特殊标注为间章8授课剧情。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: `间章8 授课单元 ${toNumber(chapter)}`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `节次 ${stage}`,
      storyLabel: `间章8 授课剧情 ${digits} ${part.label}`,
      part,
      sortKey: [categorySort.intervalloLecture, toNumber(chapter), toNumber(stage), part.sort],
      searchText: buildSearchText([fileCode, '间章8 授课剧情', digits, part.label]),
    };
  }

  match = fileCode.match(/^(E)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || '0';
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      category: 'intervallo',
      categoryLabel: '间章剧情',
      categoryDescription: 'E 开头，按间章章节与关卡索引。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: `间章 第${toNumber(chapter)}章`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${toNumber(stage)}节`,
      storyLabel: `间章 第${toNumber(chapter)}章 第${toNumber(stage)}节 ${part.label}`,
      part,
      sortKey: [categorySort.intervallo, toNumber(chapter), toNumber(stage), part.sort],
      searchText: buildSearchText([fileCode, '间章剧情', `第${toNumber(chapter)}章`, `第${toNumber(stage)}节`, part.label]),
    };
  }

  match = fileCode.match(/^(PC)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      category: 'arknights',
      categoryLabel: '方舟联动剧情',
      categoryDescription: 'PC 开头，为方舟联动剧情。',
      prefix,
      chapterKey: prefix,
      chapterLabel: '方舟联动',
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${toNumber(digits)}节`,
      storyLabel: `方舟联动 第${toNumber(digits)}节 ${part.label}`,
      part,
      sortKey: [categorySort.arknights, 0, toNumber(digits), part.sort],
      searchText: buildSearchText([fileCode, '方舟联动剧情', `第${toNumber(digits)}节`, part.label]),
    };
  }

  match = fileCode.match(/^(P)(\d+)$/);
  if (match) {
    const [, prefix, digits] = match;
    const chapter = digits.slice(0, Math.max(1, digits.length - 2));
    const stage = digits.slice(-2);
    const chapterNumber = toNumber(chapter);
    const stageNumber = toNumber(stage);
    const part = normalizePart('');
    return {
      code: fileCode,
      category: 'walpurgis',
      categoryLabel: '瓦夜剧情',
      categoryDescription: 'P 开头，为瓦夜剧情。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: `瓦夜篇目 ${chapter}`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${padStage(stage)}节`,
      storyLabel: `瓦夜剧情 ${chapter}-${padStage(stage)}`,
      part,
      sortKey: [categorySort.walpurgis, chapterNumber, stageNumber, 0],
      searchText: buildSearchText([fileCode, '瓦夜剧情', chapter, stage]),
    };
  }

  match = fileCode.match(/^(\d+D)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || '0';
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      category: 'sideStory',
      categoryLabel: '其他剧情',
      categoryDescription: '数字+D 开头，保留原编号体系展示。',
      prefix,
      chapterKey: `${prefix}-${chapter}`,
      chapterLabel: `${prefix} 篇章 ${toNumber(chapter)}`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${toNumber(stage)}节`,
      storyLabel: `${prefix} 第${toNumber(chapter)}组 第${toNumber(stage)}节 ${part.label}`,
      part,
      sortKey: [categorySort.sideStory, toNumber(prefix), toNumber(chapter), toNumber(stage), part.sort],
      searchText: buildSearchText([fileCode, '其他剧情', prefix, chapter, stage, part.label]),
    };
  }

  return {
    code: fileCode,
    category: 'other',
    categoryLabel: '未分类剧情',
    categoryDescription: '无法匹配命名规则的剧情文件。',
    prefix: 'OTHER',
    chapterKey: 'OTHER',
    chapterLabel: '未分类',
    stageKey: fileCode,
    stageLabel: fileCode,
    storyLabel: fileCode,
    part: normalizePart(''),
    sortKey: [categorySort.other, 999, 999, 999],
    searchText: buildSearchText([fileCode, '未分类剧情']),
  };
}

async function readStoryDirectory(language) {
  const storyDir = path.join(repoRoot, language.folder, 'StoryData');
  const entries = await fs.readdir(storyDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.parse(entry.name).name)
    .sort();
}

function createStoryIndex(storyCodesByLanguage) {
  const storyMap = new Map();

  for (const language of languageConfigs) {
    const storyCodes = storyCodesByLanguage[language.id] ?? [];
    for (const code of storyCodes) {
      const existing = storyMap.get(code);
      if (existing) {
        existing.availableLanguages[language.id] = true;
        existing.paths[language.id] = `../LocalizeLimbusCompany/${language.folder}/StoryData/${code}.json`;
        continue;
      }

      const parsed = parseStoryCode(code);
      storyMap.set(code, {
        ...parsed,
        availableLanguages: Object.fromEntries(languageConfigs.map((item) => [item.id, false])),
        paths: Object.fromEntries(languageConfigs.map((item) => [item.id, null])),
      });
      const created = storyMap.get(code);
      created.availableLanguages[language.id] = true;
      created.paths[language.id] = `../LocalizeLimbusCompany/${language.folder}/StoryData/${code}.json`;
    }
  }

  return [...storyMap.values()]
    .sort((left, right) => {
      const maxLength = Math.max(left.sortKey.length, right.sortKey.length);
      for (let index = 0; index < maxLength; index += 1) {
        const leftValue = left.sortKey[index] ?? 0;
        const rightValue = right.sortKey[index] ?? 0;
        if (leftValue !== rightValue) {
          return leftValue - rightValue;
        }
      }

      return left.code.localeCompare(right.code, 'en');
    })
    .map((story) => ({
      ...story,
      languageCount: Object.values(story.availableLanguages).filter(Boolean).length,
    }));
}

function buildCategorySummary(stories) {
  const summary = new Map();

  for (const story of stories) {
    if (!summary.has(story.category)) {
      summary.set(story.category, {
        id: story.category,
        label: story.categoryLabel,
        description: story.categoryDescription,
        count: 0,
        chapterCount: 0,
        chapters: new Map(),
      });
    }

    const categoryEntry = summary.get(story.category);
    categoryEntry.count += 1;

    if (!categoryEntry.chapters.has(story.chapterKey)) {
      categoryEntry.chapters.set(story.chapterKey, {
        key: story.chapterKey,
        label: story.chapterLabel,
        count: 0,
      });
    }

    categoryEntry.chapters.get(story.chapterKey).count += 1;
  }

  return [...summary.values()]
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      count: entry.count,
      chapterCount: entry.chapters.size,
      chapters: [...entry.chapters.values()],
    }))
    .sort((left, right) => (categorySort[left.id] ?? 99) - (categorySort[right.id] ?? 99));
}

async function main() {
  const storyCodesByLanguage = {};
  for (const language of languageConfigs) {
    storyCodesByLanguage[language.id] = await readStoryDirectory(language);
  }

  const stories = createStoryIndex(storyCodesByLanguage);
  const categories = buildCategorySummary(stories);
  const payload = {
    generatedAt: new Date().toISOString(),
    repoRoot: '.',
    languages: languageConfigs.map((language) => ({
      id: language.id,
      label: language.label,
      folder: language.folder,
      storyCount: storyCodesByLanguage[language.id].length,
    })),
    stats: {
      totalStories: stories.length,
      perLanguage: Object.fromEntries(languageConfigs.map((language) => [language.id, storyCodesByLanguage[language.id].length])),
    },
    categories,
    stories,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${stories.length} stories to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});