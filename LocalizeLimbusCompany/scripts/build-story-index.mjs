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
  B: '战斗前剧情',
  A: '战斗后剧情',
  X: '特殊剧情',
  I: '战斗中剧情',
};

const partSortBase = {
  '': 0,
  B: 1,
  I: 2,
  A: 3,
  X: 4,
};

const categorySort = {
  main: 1,
  intervallo: 2,
  intervalloLecture: 3,
  identity: 4,
  voice: 5,
  walpurgis: 6,
  arknights: 7,
  aprilFools: 7.5,
  sideStory: 8,
  other: 9,
};

const sinnerIdentityMap = {
  '101': { name: '李箱', no: 1 },
  '102': { name: '浮士德', no: 2 },
  '103': { name: '堂吉诃德', no: 3 },
  '104': { name: '良秀', no: 4 },
  '105': { name: '默尔索', no: 5 },
  '106': { name: '鸿璐', no: 6 },
  '107': { name: '希斯克利夫', no: 7 },
  '108': { name: '以实玛利', no: 8 },
  '109': { name: '罗佳', no: 9 },
  '110': { name: '辛克莱', no: 11 },
  '111': { name: '奥提斯', no: 12 },
  '112': { name: '格里高尔', no: 13 },
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
  let match = fileCode.match(/^(V)(\d+)$/);
  if (match) {
    const [, prefix, digits] = match;
    const chapter = digits.slice(0, 3);
    const stage = digits.slice(3);
    const chapterNumber = toNumber(chapter);
    const stageNumber = toNumber(stage);
    const part = normalizePart('');
    const sinnerInfo = sinnerIdentityMap[chapter] || { name: '特别', no: '' };
    const chapName = sinnerInfo.no ? `#${sinnerInfo.no} ${sinnerInfo.name}` : sinnerInfo.name;
    
    return {
      code: fileCode,
      category: 'voice',
      categoryLabel: '人格语音',
      categoryDescription: 'V 开头，为人格语音。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: chapName,
      stageKey: `${prefix}${digits}`,
      stageLabel: `语音 ${chapName} ${stage}`.trim(),
      storyLabel: `人格语音 ${chapName} ${stage}`.trim(),
      part,
      sortKey: [categorySort.voice, sinnerInfo.no ? sinnerInfo.no : 999, stageNumber, part.sort],
      searchText: buildSearchText([fileCode, '人格语音', sinnerInfo.name, stage, part.label]),
    };
  }

  match = fileCode.match(/^(S)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || '0';
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      displayCode: `${chapter}-${padStage(stage)}${rawPart}`,
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
      sortKey: [categorySort.main, toNumber(chapter), toNumber(stage), 0, part.sort],
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
      category: 'intervallo',
      categoryLabel: '间章剧情',
      categoryDescription: 'ES 开头，间章8授课剧情，置于切磋琢春E803B之后。',
      prefix,
      chapterKey: `E8`,
      chapterLabel: `间章 第8章 切磋琢春`,
      stageKey: `${prefix}${digits}`,
      stageLabel: `授课单元 ${toNumber(chapter)}-${stage}`,
      storyLabel: `间章 第8章 切磋琢春 授课单元 ${toNumber(chapter)}-${stage} ${part.label}`,
      part,
      sortKey: [categorySort.intervallo, 8, 0, 3, 1.5 + (toNumber(digits) / 1000) + (part.sort / 10000)],
      searchText: buildSearchText([fileCode, '间章剧情', '切磋琢春', '授课单元', digits, part.label]),
      gameChapterId: '9119',
      gameStageId: '911903'
    };
  }

  
  match = fileCode.match(/^(E00)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ""] = match;
    const stageNum = parseInt(digits, 10);
    let foolsChapter = 0;
    let label = "";
    if (stageNum === 0) { foolsChapter = 1; label = "第一次愚人节"; }
    else if (stageNum === 1 || stageNum === 2) { foolsChapter = 2; label = "第二次愚人节"; }
    else { foolsChapter = 3; label = "第三次愚人节"; }
    const part = normalizePart(rawPart);
    return { code: fileCode, category: "aprilFools", categoryLabel: "愚人节剧情", categoryDescription: "E00 开头，历年愚人节活动剧情。", prefix, chapterKey: "AF" + foolsChapter, chapterLabel: label, stageKey: fileCode, stageLabel: "第" + stageNum + "节", storyLabel: label + " 第" + stageNum + "节 " + part.label, part, sortKey: [categorySort.aprilFools, foolsChapter, stageNum, part.sort], searchText: buildSearchText([fileCode, "愚人节剧情", label, "第" + stageNum + "节", part.label]) };
  }

  match = fileCode.match(/^(E0)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ""] = match;
    const stageGroup = parseInt(digits.slice(0, 1), 10);
    const stageNum = parseInt(digits.slice(1), 10);
    let walpurgisNum = 0;
    if (stageGroup === 4) walpurgisNum = 1;
    else if (stageGroup === 5) walpurgisNum = 2;
    else if (stageGroup === 6 && stageNum <= 3) walpurgisNum = 3;
    else if (stageGroup === 6 && stageNum > 3) walpurgisNum = 4;
    else if (stageGroup === 7) walpurgisNum = 5;
    else if (stageGroup === 8) walpurgisNum = 6;
    else if (stageGroup === 9) walpurgisNum = 8;
    else walpurgisNum = 99;

    if (walpurgisNum !== 99) {
      const label = `第${walpurgisNum}次 瓦尔普吉斯之夜`;
      const part = normalizePart(rawPart);
      return { code: fileCode, category: "walpurgis", categoryLabel: "瓦尔普吉斯之夜", categoryDescription: "瓦尔普吉斯之夜相关短篇", prefix, chapterKey: "WP" + walpurgisNum, chapterLabel: label, stageKey: fileCode, stageLabel: "第" + stageNum + "节", storyLabel: label + " 第" + stageNum + "节 " + part.label, part, sortKey: [categorySort.walpurgis, walpurgisNum, stageNum, part.sort], searchText: buildSearchText([fileCode, "瓦尔普吉斯之夜", label, "第" + stageNum + "节", part.label]), gameChapterId: "90" + (10 + walpurgisNum), gameStageId: "90" + (10 + walpurgisNum) + String(stageNum).padStart(2, "0") };
    } else {
      const part = normalizePart(rawPart);
      const label = "但丁的笔记 & 其他记录";
      return { code: fileCode, category: "sideStory", categoryLabel: "其他短篇", categoryDescription: "边角剧情", prefix, chapterKey: "SS0", chapterLabel: label, stageKey: fileCode, stageLabel: "第" + stageGroup + "-" + stageNum + "节", storyLabel: label + " 第" + stageGroup + "-" + stageNum + "节 " + part.label, part, sortKey: [categorySort.sideStory, stageGroup, stageNum, part.sort], searchText: buildSearchText([fileCode, "其他短篇", label, "第" + stageGroup + "-" + stageNum + "节", part.label]) };
    }
  }
match = fileCode.match(/^(E)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const origChapter = digits.slice(0, 1) || '0';
    const origStageStr = digits.slice(1) || '0';
    const origStage = toNumber(origStageStr);
    const part = normalizePart(rawPart);

    let actualStage = origStage;
    let actualChapterTitle = `间章 第${toNumber(origChapter)}章`;
    let chapterSubSort = 0;

    let gameChapterId = '';
    let gameStageId = '';

    if (origChapter === '5') {
       if (origStage > 13) {
          gameChapterId = '9107'; // 肉斩骨断
          actualStage = origStage - 13;
          chapterSubSort = 2;
       } else {
          gameChapterId = '9105'; // 20区的奇迹
          chapterSubSort = 1;
       }
    } else if (origChapter === '6') {
       if (origStage > 15) {
          gameChapterId = '9110'; // WARP快车
          actualStage = origStage - 15;
          chapterSubSort = 2;
       } else {
          gameChapterId = '9109'; // 时间杀人时间
          chapterSubSort = 1;
       }
    } else if (origChapter === '7') {
         if (origStage > 14) {
            gameChapterId = '9116'; // 深夜清扫
            actualStage = origStage - 14;
            chapterSubSort = 2;
         } else {
            gameChapterId = '9114'; // LCB体检
            chapterSubSort = 1;
         }
      } else if (origChapter === '8') {
         gameChapterId = '9119'; // 切磋琢春
      } else if (origChapter === '9') {
         gameChapterId = '9125'; // 绞丝结线
    } else {
       gameChapterId = '91' + origChapter.padStart(2, '0');
    }
    
    gameStageId = gameChapterId + String(actualStage).padStart(2, '0');

    return {
      code: fileCode,
      category: 'intervallo',
      categoryLabel: '间章剧情',
      categoryDescription: 'E 开头，按间章章节与关卡索引。',
      prefix,
      chapterKey: `${prefix}${origChapter}_${chapterSubSort}`,
      chapterLabel: actualChapterTitle,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${actualStage}节`,
      storyLabel: `${actualChapterTitle} 第${actualStage}节 ${part.label}`,
      part,
      sortKey: [categorySort.intervallo, toNumber(origChapter), chapterSubSort, actualStage, part.sort],
      searchText: buildSearchText([fileCode, '间章剧情', actualChapterTitle, `第${actualStage}节`, part.label]),
      gameChapterId,
      gameStageId
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

  match = fileCode.match(/^(P)(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 3);
    const stage = digits.slice(3);
    const chapterNumber = toNumber(chapter);
    const stageNumber = toNumber(stage);
    const part = normalizePart(rawPart);
    const sinnerInfo = sinnerIdentityMap[chapter] || { name: '特别', no: '' };
    const chapName = sinnerInfo.no ? `#${sinnerInfo.no} ${sinnerInfo.name}` : sinnerInfo.name;
    
    return {
      code: fileCode,
      category: 'identity',
      categoryLabel: '人格剧情',
      categoryDescription: 'P 开头，为人格剧情。',
      prefix,
      chapterKey: `${prefix}${chapter}`,
      chapterLabel: chapName,
      stageKey: `${prefix}${digits}`,
      stageLabel: `第${padStage(stage)}节`,
      storyLabel: `人格剧情 ${chapName} ${stage} ${part.label === '正篇' ? '' : part.label}`.trim().replace(/\s+/g, ' '),
      part,
      sortKey: [categorySort.identity, sinnerInfo.no ? sinnerInfo.no : 999, stageNumber, part.sort],
      searchText: buildSearchText([fileCode, '人格剧情', sinnerInfo.name, stage, part.label]),
    };
  }

  match = fileCode.match(/^(\d+)D(\d+)(A|B|X|I\d*)?$/);
  if (match) {
    const [, chapStr, digits, rawPart = ''] = match;
    const chapterNum = toNumber(chapStr);
    const subStage = toNumber(digits);
    const part = normalizePart(rawPart);
    const stageGroup = chapterNum === 8 ? 20 : 999;
    return {
      code: fileCode,
      displayCode: `${chapStr}D-${digits}${rawPart}`,
      category: 'main',
      categoryLabel: '主线剧情',
      categoryDescription: 'S 开头，按主线章节与关卡索引 (包含附加 Dungeon)。',
      prefix: 'S',
      chapterKey: `S${chapStr}`,
      chapterLabel: `主线 第${chapterNum}章`,
      stageKey: chapterNum === 8 ? `S820-D${digits}` : `S${chapStr}999-D${digits}`,
      stageLabel: chapterNum === 8 ? `第20节 D${digits}` : `后记 D${digits}`,
      storyLabel: `${chapStr}D${digits} ${part.label}`,
      part,
      sortKey: [categorySort.main, chapterNum, stageGroup, subStage, part.sort],
      searchText: buildSearchText([fileCode, '主线剧情', `第${chapterNum}章`, 'Dungeon', digits, part.label]),
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
  const result = [];
  try {
    const storyDir = path.join(repoRoot, language.folder, 'StoryData');
    const entries = await fs.readdir(storyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        result.push({
          code: path.parse(entry.name).name,
          relativePath: `StoryData/${entry.name}`,
        });
      }
    }
  } catch (e) {}

  try {
    const voiceDir = path.join(repoRoot, language.folder, 'PersonalityVoiceDlg');
    const entries = await fs.readdir(voiceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const match = entry.name.match(/_(\d+)\.json$/);
        if (match) {
          result.push({
            code: `V${match[1]}`,
            relativePath: `PersonalityVoiceDlg/${entry.name}`,
          });
        }
      }
    }
  } catch (e) {}

  return result.sort((a, b) => a.code.localeCompare(b.code));
}

function createStoryIndex(storyCodesByLanguage) {
  const storyMap = new Map();

  for (const language of languageConfigs) {
    const storyList = storyCodesByLanguage[language.id] ?? [];
    for (const item of storyList) {
      const code = item.code;
      const existing = storyMap.get(code);
      if (existing) {
        existing.availableLanguages[language.id] = true;
        existing.paths[language.id] = `../LocalizeLimbusCompany/${language.folder}/${item.relativePath}`;
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
      created.paths[language.id] = `../LocalizeLimbusCompany/${language.folder}/${item.relativePath}`;
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


async function buildTitleMaps() {
  const chapterTitlesMap = {};
  const stageTitlesMap = {};
  const personalitiesMap = {};

  for (const language of languageConfigs) {
    try {
      const dirPath = path.join(workspaceRoot, 'LocalizeLimbusCompany', language.folder);
      const files = await fs.readdir(dirPath);
      for (const f of files) {
         if (f.startsWith('StageChapterText') && f.endsWith('.json')) {
           const chapterData = JSON.parse(await fs.readFile(path.join(dirPath, f), 'utf-8'));
           for (const c of chapterData.dataList) {
             const m = c.id.match(/_(\d+)$/);
             if (m) {
               const chapId = m[1];
               if (!chapterTitlesMap[chapId]) chapterTitlesMap[chapId] = {};
               chapterTitlesMap[chapId][language.id] = c.chaptertitle || c.chapterName || c.chapter;
             }
           }
         }
      }
    } catch(e) {}

    try {
      const dirPath = path.join(workspaceRoot, 'LocalizeLimbusCompany', language.folder);
      const files = await fs.readdir(dirPath);
      for (const f of files) {
         if (f.startsWith('StageNode') && f.endsWith('.json')) {
           const stageData = JSON.parse(await fs.readFile(path.join(dirPath, f), 'utf-8'));
           for (const st of stageData.dataList) {
             const stId = String(st.id);
             if (!stageTitlesMap[stId]) stageTitlesMap[stId] = {};
             stageTitlesMap[stId][language.id] = st.title;
           }
         }
      }
    } catch(e) {}

    try {
      const pPath = path.join(workspaceRoot, 'LocalizeLimbusCompany', language.folder, 'Personalities.json');
      const pData = JSON.parse(await fs.readFile(pPath, 'utf-8'));
      for (const p of pData.dataList) {
        const pId = String(p.id);
        if (!personalitiesMap[pId]) personalitiesMap[pId] = {};
        let t = p.title || p.nameWithTitle || p.name || '';
        t = t.replace(/\n/g, ' ');
        personalitiesMap[pId][language.id] = t;
      }
    } catch(e) {}
  }
  return { chapterTitlesMap, stageTitlesMap, personalitiesMap };
}

function enrichStoryTitles(stories, { chapterTitlesMap, stageTitlesMap, personalitiesMap }) {
  for (const story of stories) {
    let chapterId = null;
    let stageId = null;

    if (story.prefix === 'S') {
      const chapterDigits = story.chapterKey.slice(1);
      chapterId = '1' + chapterDigits.padStart(2, '0');
      const stageDigits = story.stageKey.slice(1 + chapterDigits.length);
      stageId = chapterId + stageDigits.padStart(2, '0');
    } else if (story.prefix === 'E' || story.prefix === 'ES') {
      if (story.gameChapterId) {
        chapterId = story.gameChapterId;
        stageId = story.gameStageId;
      } else {
        const chapterDigits = story.chapterKey.slice(1);
        chapterId = '91' + chapterDigits.padStart(2, '0');
        const stageDigits = story.stageKey.slice(1 + chapterDigits.length);
        stageId = chapterId + stageDigits.padStart(2, '0');
      }
    } else if (story.prefix === 'PC') {
      chapterId = '9120'; // 善意的巡礼
      stageId = chapterId + story.stageKey.slice(2).padStart(2, '0');
    }

    if (chapterId && chapterTitlesMap[chapterId]) {
      story.chapterNames = chapterTitlesMap[chapterId];
      if (story.chapterNames['LLC_zh-CN']) {
         story.chapterLabel = `${story.chapterLabel} ${story.chapterNames['LLC_zh-CN']}`;
         story.searchText += ' ' + story.chapterNames['LLC_zh-CN'];
      }
    }

    if (stageId && stageTitlesMap[stageId]) {
      story.stageNames = stageTitlesMap[stageId];
      if (story.stageNames['LLC_zh-CN']) {
         const sName = story.stageNames['LLC_zh-CN'];
         story.stageLabel = `${story.stageLabel} ${sName}`;
         
         let prefixStr = '';
         if (story.category === 'main' && story.code.match(/^S(\d+)(A|B|X|I.*)?$/)) {
            prefixStr = `${story.sortKey[1]}-${story.sortKey[2]} `;
         } else if (story.category === 'intervallo' && story.code.match(/^E(S)?(\d+)(A|B|X|I.*)?$/)) {
            prefixStr = `${story.sortKey[1]}.5-${story.sortKey[3]} `;
         }

         story.storyLabel = `${prefixStr}${sName} (${story.part.label})`;
         story.searchText += ' ' + sName + ' ' + prefixStr;
      }
    }

    if (story.category === 'identity' || story.category === 'voice') {
      const pId = story.stageKey.slice(1);
      if (personalitiesMap && personalitiesMap[pId]) {
        story.stageNames = personalitiesMap[pId];
        if (personalitiesMap[pId]['LLC_zh-CN']) {
          const pName = personalitiesMap[pId]['LLC_zh-CN'];
          story.stageLabel = pName;
          
          const isVoice = story.category === 'voice';
          const match = story.code.match(isVoice ? /^(V)(\d+)$/ : /^(P)(\d+)(A|B|X|I\d*)?$/);
          const rawPart = match && !isVoice ? match[3] || '' : '';
          const part = normalizePart(rawPart);
          
          const sinnerNameParts = story.chapterLabel.split(' '); // e.g. ["#1", "李箱"]
          const sName = sinnerNameParts.length > 1 ? sinnerNameParts[1] : '';
          
          const prefixName = isVoice ? '人格语音' : '人格剧情';
          const partLabel = part.label === '正篇' ? '' : part.label;
          story.storyLabel = `${prefixName} ${story.chapterLabel} ${pName} ${partLabel}`.trim();
          story.searchText += ' ' + pName;
        }
      }
    }
  }
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
  
  const titleMaps = await buildTitleMaps();
  enrichStoryTitles(stories, titleMaps);
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