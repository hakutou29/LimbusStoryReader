import { promises as fs } from 'node:fs';
import path from 'node:path';

const scriptPath = 'LocalizeLimbusCompany/scripts/build-story-index.mjs';

async function run() {
  let content = await fs.readFile(scriptPath, 'utf8');

  const injectionPoint = content.indexOf('function buildCategorySummary(stories)');
  if (injectionPoint === -1) {
    console.error('Could not find injection point');
    return;
  }

  const newCode = `
async function buildTitleMaps() {
  const chapterTitlesMap = {};
  const stageTitlesMap = {};

  for (const language of languageConfigs) {
    try {
      const chapterJsonPath = path.join(workspaceRoot, 'LocalizeLimbusCompany', language.folder, 'StageChapterText.json');
      const chapterData = JSON.parse(await fs.readFile(chapterJsonPath, 'utf-8'));
      for (const c of chapterData.dataList) {
        const m = c.id.match(/_(\\d+)$/);
        if (m) {
          const chapId = m[1];
          if (!chapterTitlesMap[chapId]) chapterTitlesMap[chapId] = {};
          chapterTitlesMap[chapId][language.id] = c.chaptertitle || c.chapterName || c.chapter;
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
  }
  return { chapterTitlesMap, stageTitlesMap };
}

function enrichStoryTitles(stories, { chapterTitlesMap, stageTitlesMap }) {
  for (const story of stories) {
    let chapterId = null;
    let stageId = null;

    if (story.prefix === 'S') {
      const chapterDigits = story.chapterKey.slice(1);
      chapterId = '1' + chapterDigits.padStart(2, '0');
      const stageDigits = story.stageKey.slice(1 + chapterDigits.length);
      stageId = chapterId + stageDigits.padStart(2, '0');
    } else if (story.prefix === 'E') {
      const chapterDigits = story.chapterKey.slice(1);
      chapterId = '91' + chapterDigits.padStart(2, '0');
      const stageDigits = story.stageKey.slice(1 + chapterDigits.length);
      stageId = chapterId + stageDigits.padStart(2, '0');
    }

    if (chapterId && chapterTitlesMap[chapterId]) {
      story.chapterNames = chapterTitlesMap[chapterId];
      if (story.chapterNames['LLC_zh-CN']) {
         story.chapterLabel = \`\${story.chapterLabel} \${story.chapterNames['LLC_zh-CN']}\`;
         story.searchText += ' ' + story.chapterNames['LLC_zh-CN'];
      }
    }

    if (stageId && stageTitlesMap[stageId]) {
      story.stageNames = stageTitlesMap[stageId];
      if (story.stageNames['LLC_zh-CN']) {
         const sName = story.stageNames['LLC_zh-CN'];
         story.stageLabel = \`\${story.stageLabel} \${sName}\`;
         story.storyLabel = \`\${sName} (\${story.part.label})\`;
         story.searchText += ' ' + sName;
      }
    }
  }
}

`;

  content = content.slice(0, injectionPoint) + newCode + content.slice(injectionPoint);

  const mainHookPoint = content.indexOf('const categories = buildCategorySummary(stories);');
  if (mainHookPoint === -1) {
    console.error('Could not find main hook point');
    return;
  }

  const hookCode = `
  const titleMaps = await buildTitleMaps();
  enrichStoryTitles(stories, titleMaps);
  `;
  content = content.slice(0, mainHookPoint) + hookCode + content.slice(mainHookPoint);

  await fs.writeFile(scriptPath, content, 'utf8');
  console.log('Patched build-story-index.mjs successfully!');
}

run().catch(console.error);
