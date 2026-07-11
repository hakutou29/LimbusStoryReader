const portraitNames = new Set([
  '以实玛利',
  '但丁',
  '卡戎',
  '堂吉诃德',
  '奥提斯',
  '希斯克利夫',
  '无',
  '李箱',
  '格里高尔',
  '浮士德',
  '维吉里乌斯',
  '罗佳',
  '良秀',
  '辛克莱',
  '默尔索',
]);

export function resolveSpeakerName(entry, language, characterMap, story, localSpeakerMaps) {
  if (entry.model && characterMap.has(entry.model)) {
    return characterMap.get(entry.model).name;
  }

  if (entry.dlg && story?.category === 'voice') {
    const match = story.chapterLabel.match(/#\d+\s+(.+)/);
    if (match) return match[1];
  }

  const defaultName = entry.teller || entry.title || entry.model || entry.place || '旁白';

  if (/[가-힣]/.test(defaultName) && localSpeakerMaps.has(language.id)) {
    const localMap = localSpeakerMaps.get(language.id);

    if (entry.model) {
      if (localMap.has(entry.model)) return localMap.get(entry.model);
      const baseModel = entry.model.replace(/\d+$/, '');
      if (localMap.has(baseModel)) return localMap.get(baseModel);
    }

    const baseTeller = defaultName.replace(/\d+$/, '');
    if (localMap.has(baseTeller)) return localMap.get(baseTeller);
  }

  return defaultName;
}

export function getSpeakerGlyph(speakerName) {
  const speaker = String(speakerName).replace(/[\[\]【】（）()\s]/g, '');
  return speaker.slice(0, 1) || '旁';
}

export function getSpeakerTone(seed) {
  seed = String(seed);
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return `hsl(${hash}deg 55% 60%)`;
}

export function buildStoryIconPath(fileName) {
  return `../LocalizeLimbusCompany/Assets/StoryIcons/${encodeURIComponent(fileName)}`;
}

export function resolvePortraitName(entry, characterMaps) {
  const chineseCharacterMap = characterMaps.get('LLC_zh-CN') ?? new Map();
  const candidate = entry.model && chineseCharacterMap.has(entry.model) ? chineseCharacterMap.get(entry.model).name : null;
  return candidate && portraitNames.has(candidate) ? candidate : '无';
}