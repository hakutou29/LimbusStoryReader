export async function loadIndex() {
  const response = await fetch('./data/story-index.json');
  if (!response.ok) {
    throw new Error('无法加载剧情索引。');
  }
  return response.json();
}

export function createStoryDataLoader(story, loadedStories) {
  return async function fetchStoryData(languageId) {
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

    const payload = await response.json();
    loadedStories.set(cacheKey, payload);
    return payload;
  };
}

export async function fetchCharacterMap(language, characterMaps) {
  if (characterMaps.has(language.id)) {
    return characterMaps.get(language.id);
  }

  const characterMap = new Map();

  const introPath = `../LocalizeLimbusCompany/${language.folder}/IntroduceCharacter.json`;
  try {
    const introRes = await fetch(introPath);
    if (introRes.ok) {
      const introPayload = await introRes.json();
      const dataList = Array.isArray(introPayload?.dataList) ? introPayload.dataList : [];
      let index = 0;
      dataList.forEach((item) => {
        if (item?.id && item?.name) {
          let displayNo = index + 1;
          if (displayNo >= 10) displayNo += 1;
          characterMap.set(item.id, { name: item.name, no: displayNo });
          index++;
        }
      });
    }
  } catch (err) {
    console.warn(`Failed to load IntroduceCharacter for ${language.id}`, err);
  }

  const modelPath = `../LocalizeLimbusCompany/${language.folder}/ScenarioModelCodes-AutoCreated.json`;
  try {
    const modelRes = await fetch(modelPath);
    if (modelRes.ok) {
      const modelPayload = await modelRes.json();
      const dataList = Array.isArray(modelPayload?.dataList) ? modelPayload.dataList : [];
      dataList.forEach((item) => {
        if (item?.id && item?.name) {
          if (characterMap.has(item.id)) {
            characterMap.get(item.id).name = item.name;
          } else {
            characterMap.set(item.id, { name: item.name, no: null });
          }
        }
      });
    }
  } catch (err) {
    console.warn(`Failed to load ScenarioModelCodes for ${language.id}`, err);
  }

  characterMaps.set(language.id, characterMap);
  return characterMap;
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