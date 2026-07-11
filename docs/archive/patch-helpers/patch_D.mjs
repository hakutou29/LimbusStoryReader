import fs from 'fs/promises';

const p = 'LocalizeLimbusCompany/scripts/build-story-index.mjs';

async function run() {
  let content = await fs.readFile(p, 'utf8');

  content = content.replace(
    /let match = fileCode.match\(\/\^\(S\)\(\\d\+\)\(A\|B\|X\|I\\d\*\)\?\$\/\);[\s\S]*?searchText: buildSearchText\(\[fileCode, '主线剧情', \`第\${toNumber\(chapter\)}章\`, \`第\${toNumber\(stage\)}节\`, part.label\]\),\s*\};\s*\}/,
    `let match = fileCode.match(/^(S)(\\d+)(A|B|X|I\\d*)?$/);
  if (match) {
    const [, prefix, digits, rawPart = ''] = match;
    const chapter = digits.slice(0, 1) || '0';
    const stage = digits.slice(1) || '0';
    const part = normalizePart(rawPart);
    return {
      code: fileCode,
      displayCode: \`\${chapter}-\${padStage(stage)}\${rawPart}\`,
      category: 'main',
      categoryLabel: '主线剧情',
      categoryDescription: 'S 开头，按主线章节与关卡索引。',
      prefix,
      chapterKey: \`\${prefix}\${chapter}\`,
      chapterLabel: \`主线 第\${toNumber(chapter)}章\`,
      stageKey: \`\${prefix}\${digits}\`,
      stageLabel: \`第\${toNumber(stage)}节\`,
      storyLabel: \`主线 第\${toNumber(chapter)}章 第\${toNumber(stage)}节 \${part.label}\`,
      part,
      sortKey: [categorySort.main, toNumber(chapter), toNumber(stage), 0, part.sort],
      searchText: buildSearchText([fileCode, '主线剧情', \`第\${toNumber(chapter)}章\`, \`第\${toNumber(stage)}节\`, part.label]),
    };
  }`
  );

  content = content.replace(
    /match = fileCode.match\(\/\^\(\\d\+D\)\(\\d\+\)\(A\|B\|X\|I\\d\*\)\?\$\/\);[\s\S]*?searchText: buildSearchText\(\[fileCode, '其他剧情', prefix, chapter, stage, part.label\]\),\s*\};\s*\}/,
    `match = fileCode.match(/^(\\d+)D(\\d+)(A|B|X|I\\d*)?$/);
  if (match) {
    const [, chapStr, digits, rawPart = ''] = match;
    const chapterNum = toNumber(chapStr);
    const subStage = toNumber(digits);
    const part = normalizePart(rawPart);
    const stageGroup = chapterNum === 8 ? 20 : 999;
    return {
      code: fileCode,
      displayCode: \`\${chapStr}D-\${digits}\${rawPart}\`,
      category: 'main',
      categoryLabel: '主线剧情',
      categoryDescription: 'S 开头，按主线章节与关卡索引 (包含附加 Dungeon)。',
      prefix: 'S',
      chapterKey: \`S\${chapStr}\`,
      chapterLabel: \`主线 第\${chapterNum}章\`,
      stageKey: chapterNum === 8 ? \`S820-D\${digits}\` : \`S\${chapStr}999-D\${digits}\`,
      stageLabel: chapterNum === 8 ? \`第20节 D\${digits}\` : \`后记 D\${digits}\`,
      storyLabel: \`\${chapStr}D\${digits} \${part.label}\`,
      part,
      sortKey: [categorySort.main, chapterNum, stageGroup, subStage, part.sort],
      searchText: buildSearchText([fileCode, '主线剧情', \`第\${chapterNum}章\`, 'Dungeon', digits, part.label]),
    };
  }`
  );
  
  await fs.writeFile(p, content, 'utf8');
}
run();