export async function loadIndex() {
  const response = await fetch('./data/story-index.json');
  if (!response.ok) {
    throw new Error('无法加载剧情索引。');
  }
  return response.json();
}

export function createStoryDataLoader(story, loadedStories) {
  return async function fetchStoryData(languageOrId) {
    const languageId = typeof languageOrId === 'string' ? languageOrId : languageOrId.id;
    const cacheKey = `${story.code}:${languageId}`;
    if (loadedStories.has(cacheKey)) {
      return loadedStories.get(cacheKey);
    }

    const filePath = story.paths[languageId];
    if (!filePath) {
      return null;
    }

    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`无法加载 ${story.code} 的 ${languageId} 版本。`);
    }

    let payload = await response.json();
    const identityId = getVoiceIdentityId(story);
    if (identityId && typeof languageOrId === 'object') {
      const battlePayload = await fetchBattleSpeechData(languageOrId, loadedStories);
      payload = appendBattleSpeechRows(payload, battlePayload, identityId);
    }

    loadedStories.set(cacheKey, payload);
    return payload;
  };
}

async function fetchJsonIfOk(path) {
  const response = await fetch(path);
  return response.ok ? response.json() : null;
}

async function fetchBattleSpeechData(language, loadedStories) {
  const cacheKey = `BattleSpeechBubbleDlg:${language.id}`;
  if (loadedStories.has(cacheKey)) {
    return loadedStories.get(cacheKey);
  }

  const path = `../LocalizeLimbusCompany/${language.folder}/BattleSpeechBubbleDlg.json`;
  try {
    const payload = await fetchJsonIfOk(path);
    loadedStories.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.warn(`Failed to load BattleSpeechBubbleDlg for ${language.id}`, err);
    loadedStories.set(cacheKey, null);
    return null;
  }
}

export function getVoiceIdentityId(story) {
  if (story?.category !== 'voice') {
    return null;
  }

  const match = String(story.stageKey ?? story.code ?? '').match(/^V(\d+)$/);
  return match ? match[1] : null;
}

function isBattleSpeechForIdentity(id, identityId) {
  return typeof id === 'string'
    && id.startsWith('battle_')
    && id.split('_').slice(1).includes(identityId);
}

export function appendBattleSpeechRows(payload, battlePayload, identityId) {
  const baseRows = Array.isArray(payload?.dataList) ? payload.dataList : [];
  const existingIds = new Set(baseRows.map((item) => item?.id).filter(Boolean));
  const battleRows = Array.isArray(battlePayload?.dataList) ? battlePayload.dataList : [];
  const extraRows = battleRows
    .filter((item) => item?.dlg && isBattleSpeechForIdentity(item.id, identityId) && !existingIds.has(item.id))
    .map((item) => {
      const row = {
        id: item.id,
        desc: typeof item.desc === 'string' && item.desc.trim() ? item.desc : '战斗中语音',
        dlg: item.dlg,
      };
      return row;
    });

  return {
    ...(payload ?? {}),
    dataList: [...baseRows, ...extraRows],
  };
}

export async function fetchCharacterMap(language, characterMaps) {
  if (characterMaps.has(language.id)) {
    return characterMaps.get(language.id);
  }

  const characterMap = new Map();
  const introPath = `../LocalizeLimbusCompany/${language.folder}/IntroduceCharacter.json`;
  const modelPath = `../LocalizeLimbusCompany/${language.folder}/ScenarioModelCodes-AutoCreated.json`;
  let introPayload = null;
  let modelPayload = null;

  try {
    [introPayload, modelPayload] = await Promise.all([
      fetchJsonIfOk(introPath),
      fetchJsonIfOk(modelPath),
    ]);
  } catch (err) {
    console.warn(`Failed to load character metadata for ${language.id}`, err);
  }

  const introList = Array.isArray(introPayload?.dataList) ? introPayload.dataList : [];
  let index = 0;
  introList.forEach((item) => {
    if (item?.id && item?.name) {
      let displayNo = index + 1;
      if (displayNo >= 10) displayNo += 1;
      characterMap.set(item.id, { name: item.name, no: displayNo });
      index++;
    }
  });

  const modelList = Array.isArray(modelPayload?.dataList) ? modelPayload.dataList : [];
  modelList.forEach((item) => {
    if (item?.id && item?.name) {
      if (characterMap.has(item.id)) {
        characterMap.get(item.id).name = item.name;
      } else {
        characterMap.set(item.id, { name: item.name, no: null });
      }
    }
  });

  characterMaps.set(language.id, characterMap);
  return characterMap;
}

export async function loadStoryLanguageData(languages, fetchStoryData, characterMaps) {
  const results = await Promise.all(languages.map(async (language) => {
    const [, payload] = await Promise.all([
      fetchCharacterMap(language, characterMaps),
      fetchStoryData(language),
    ]);

    return {
      languageId: language.id,
      payload,
      localSpeakerMap: buildLocalSpeakerMap(payload),
    };
  }));

  const loadedData = new Map();
  const localSpeakerMaps = new Map();
  results.forEach((result) => {
    loadedData.set(result.languageId, result.payload);
    localSpeakerMaps.set(result.languageId, result.localSpeakerMap);
  });

  return { loadedData, localSpeakerMaps };
}

export function buildLocalSpeakerMap(payload) {
  const localMap = new Map();
  const dataList = Array.isArray(payload?.dataList) ? payload.dataList : [];

  for (const item of dataList) {
    if (!item.teller || typeof item.teller !== 'string') continue;

    if (!/[가-힣]/.test(item.teller) && item.model) {
      const baseModel = item.model.replace(/\d+$/, '');
      if (!localMap.has(item.model)) localMap.set(item.model, item.teller);
      if (!localMap.has(baseModel)) localMap.set(baseModel, item.teller);
    }
  }

  return localMap;
}