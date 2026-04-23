const state = {
  storyIndex: null,
  story: null,
  selectedLanguages: new Set(),
  loadedStories: new Map(),
  characterMaps: new Map(),
  localSpeakerMaps: new Map(),
};

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

const elements = {
  storyTitle: document.querySelector('#story-title'),
  storyMeta: document.querySelector('#story-meta'),
  languagePicker: document.querySelector('#language-picker'),
  availability: document.querySelector('#availability'),
  storySections: document.querySelector('#story-sections'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatRichText(value) {
  let text = escapeHtml(value);
  text = text.replace(/&lt;color=(&quot;)?(#[0-9a-fA-F]+)\1&gt;/gi, '<span style="color: $2;">');
  text = text.replace(/&lt;\/color&gt;/gi, '</span>');
  text = text.replace(/&lt;(\/??)(b|i|u|s)&gt;/gi, '<$1$2>');
  return text;
}

function getQueryState() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const langs = (params.get('langs') || 'LLC_zh-CN')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return { code, langs };
}

function updateQuery() {
  if (!state.story) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.set('code', state.story.code);
  params.set('langs', [...state.selectedLanguages].join(','));
  window.history.replaceState({}, '', `?${params.toString()}`);
}

async function loadIndex() {
  const response = await fetch('./data/story-index.json');
  if (!response.ok) {
    throw new Error('无法加载剧情索引。');
  }
  return response.json();
}

async function fetchStoryData(languageId) {
  const cacheKey = `${state.story.code}:${languageId}`;
  if (state.loadedStories.has(cacheKey)) {
    return state.loadedStories.get(cacheKey);
  }

  const filePath = state.story.paths[languageId];
  if (!filePath) {
    return null;
  }

  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`无法加载 ${state.story.code} 的 ${languageId} 版本。`);
  }

  const payload = await response.json();
  state.loadedStories.set(cacheKey, payload);
  return payload;
}

async function fetchCharacterMap(language) {
  if (state.characterMaps.has(language.id)) {
    return state.characterMaps.get(language.id);
  }

  const characterMap = new Map();

  // Load badged characters
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

  // Load all model codes
  const modelPath = `../LocalizeLimbusCompany/${language.folder}/ScenarioModelCodes-AutoCreated.json`;
  try {
    const modelRes = await fetch(modelPath);
    if (modelRes.ok) {
      const modelPayload = await modelRes.json();
      const dataList = Array.isArray(modelPayload?.dataList) ? modelPayload.dataList : [];
      dataList.forEach((item) => {
        if (item?.id && item?.name) {
          if (characterMap.has(item.id)) {
            // keep the badge info, just update name just in case
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

  state.characterMaps.set(language.id, characterMap);
  return characterMap;
}

function toRowKey(item, fallbackIndex) {
  if (typeof item.id === 'number' && item.id !== -1) {
    return `id:${item.id}`;
  }
  return `idx:${fallbackIndex}`;
}

function buildMergedRows(loadedData) {
  const rows = new Map();

  for (const [languageId, payload] of loadedData.entries()) {
    const dataList = Array.isArray(payload?.dataList) ? payload.dataList : [];
    let currentOrderBase = -1;
    let fallbackOffset = 0.001;

    dataList.forEach((item, index) => {
      const hasValidId = typeof item.id === 'number' && item.id !== -1;
      let objOrder;

      if (hasValidId) {
        objOrder = item.id;
        currentOrderBase = item.id;
        fallbackOffset = 0.001;
      } else {
        objOrder = currentOrderBase !== -1 ? currentOrderBase + fallbackOffset : index * 0.001;
        fallbackOffset += 0.001;
      }

      const rowKey = toRowKey(item, index);
      if (!rows.has(rowKey)) {
        rows.set(rowKey, {
          key: rowKey,
          id: typeof item.id === 'number' ? item.id : null,
          order: objOrder,
          entries: new Map(),
        });
      }

      rows.get(rowKey).entries.set(languageId, item);
    });
  }

  let finalRows = [...rows.values()].sort((left, right) => left.order - right.order);

  // If KR is not selected, hide id === -1 rows that have no translated content in the selected languages
  if (!state.selectedLanguages.has('KR')) {
    finalRows = finalRows.filter((row) => {
      if (row.id !== -1) return true;
      
      // Check if at least one selected language has translated content (content without Korean characters)
      const hasTranslatedContent = selectedLangsArray.some((lang) => {
        const entry = row.entries.get(lang);
        if (!entry) return false;
        const text = entry.content ?? entry.dlg ?? '';
        return text && !/[가-힣]/.test(text);
      });
      
      return hasTranslatedContent;
    });
  }

  return finalRows;
}

function resolveSpeakerName(entry, language, characterMap) {
  if (entry.model && characterMap.has(entry.model)) {
    return characterMap.get(entry.model).name;
  }

  // Handle voice files
  if (entry.dlg) {
    if (state.story && state.story.category === 'voice') {
      const match = state.story.chapterLabel.match(/#\d+\s+(.+)/);
      if (match) return match[1];
    }
  }

  const defaultName = entry.teller || entry.title || entry.model || entry.place || '旁白';

  if (/[가-힣]/.test(defaultName) && state.localSpeakerMaps.has(language.id)) {
    const localMap = state.localSpeakerMaps.get(language.id);
    
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

function getSpeakerGlyph(speakerName) {
  const speaker = String(speakerName).replace(/[\[\]【】（）()\s]/g, '');
  return speaker.slice(0, 1) || '旁';
}

function getSpeakerTone(seed) {
  seed = String(seed);
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return `hsl(${hash}deg 55% 60%)`;
}

function buildStoryIconPath(fileName) {
  return `../LocalizeLimbusCompany/Assets/StoryIcons/${encodeURIComponent(fileName)}`;
}

function resolvePortraitName(entry) {
  const chineseCharacterMap = state.characterMaps.get('LLC_zh-CN') ?? new Map();
  const candidate = entry.model && chineseCharacterMap.has(entry.model) ? chineseCharacterMap.get(entry.model).name : null;
  return candidate && portraitNames.has(candidate) ? candidate : '无';
}

function createSpeakerPortrait(entry, speaker) {
  const portraitName = resolvePortraitName(entry);
  const portraitFileName = `140px-剧情头像-${portraitName}.webp`;
  const fallbackGlyph = getSpeakerGlyph(speaker);

  return `
    <div class="speaker-portrait-frame">
      <img class="speaker-portrait-image" src="${buildStoryIconPath(portraitFileName)}" alt="${escapeHtml(speaker)}" loading="lazy" />
      <span class="speaker-portrait-fallback" aria-hidden="true">${escapeHtml(fallbackGlyph)}</span>
    </div>
  `;
}

function createEntryCard(entry, index, language, characterMap) {
  const speaker = resolveSpeakerName(entry, language, characterMap);
  const tone = getSpeakerTone(speaker);
  
  const isVoice = state.story && state.story.category === 'voice';

  let roleText = [entry.title, entry.teller].filter(Boolean).join(' · ');
  if (!roleText && entry.desc) roleText = entry.desc;
  if (!roleText && !isVoice) roleText = '旁白';
  if (isVoice && entry.desc) roleText = entry.desc; // Force using desc for voices if available
  
  const placeText = entry.place ? `<p class="entry-place">${escapeHtml(entry.place)}</p>` : '';
  const characterInfo = entry.model && characterMap.has(entry.model) ? characterMap.get(entry.model) : null;
  const charNoBadge = characterInfo && characterInfo.no != null ? `<span class="speaker-character-no">#${characterInfo.no}</span>` : '';
  const contentText = entry.content ?? entry.dlg ?? '';

  if (isVoice) {
      return `
        <article class="dialogue-card">
          <aside class="dialogue-speaker" style="width: auto; min-width: 120px;">
            <div class="speaker-meta">
              <h3 style="margin: 0; font-size: 1.1rem; color: var(--accent);">${escapeHtml(roleText)}</h3>
            </div>
          </aside>
          <div class="dialogue-body">
            <div class="dialogue-content-wrap">
              ${placeText}
              <div class="dialogue-content">${formatRichText(contentText)}</div>
            </div>
          </div>
        </article>
      `;
    }

    if (speaker === '旁白') {
      const optRoleText = roleText !== '旁白' && roleText ? `<p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 0.4rem;">${escapeHtml(roleText)}</p>` : '';
      return `
        <article class="dialogue-card dialogue-card-narrator">
          <div class="dialogue-body" style="padding-left: 1.2rem;">
            <div class="dialogue-content-wrap">
              ${placeText}
              ${optRoleText}
              <div class="dialogue-content">${formatRichText(contentText)}</div>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="dialogue-card">
        <aside class="dialogue-speaker">
          <div class="speaker-portrait-shell" style="--speaker-tone:${tone}">${createSpeakerPortrait(entry, speaker)}</div>
          <div class="speaker-meta">
            ${charNoBadge}
            ${roleText ? `<p class="speaker-role">${escapeHtml(roleText)}</p>` : ''}
            <h3>${escapeHtml(speaker)}</h3>
          </div>
        </aside>
        <div class="dialogue-body">
          <div class="dialogue-content-wrap">
            ${placeText}
            <div class="dialogue-content">${formatRichText(contentText)}</div>
          </div>
        </div>
      </article>
    `;
}

function createMissingEntryCard(language) {
  return `
    <article class="dialogue-card dialogue-card-missing">
      <aside class="dialogue-speaker">
        <div class="speaker-portrait-shell">${createSpeakerPortrait({}, language.label)}</div>
        <div class="speaker-meta">
          <p class="speaker-role">${escapeHtml(language.id)}</p>
          <h3>${escapeHtml(language.label)}</h3>
          <span class="speaker-line-id">缺失</span>
        </div>
      </aside>
      <div class="dialogue-body">
        <div class="dialogue-content-wrap">
          <div class="dialogue-content dialogue-content-missing">该语言缺少这一句对应的剧情行。</div>
        </div>
      </div>
    </article>
  `;
}

function createRowPanel(row, index, languages) {
  const cards = languages
    .map((language) => {
      const entry = row.entries.get(language.id);
      const displayId = language.id === 'LLC_zh-CN' ? 'CN' : language.id;

      let innerCard;
      if (!entry) {
        innerCard = createMissingEntryCard(language);
      } else {
        const characterMap = state.characterMaps.get(language.id) ?? new Map();
        innerCard = createEntryCard(entry, row.order, language, characterMap);
      }

      const isSelectedGlobally = state.selectedLanguages.has(language.id);
        const displayStyle = isSelectedGlobally ? '' : 'display: none;';
        return `
        <section class="line-language-block" data-lang-id="${language.id}" style="${displayStyle}">
          <div class="line-language-head">
            <span class="line-language-code">${escapeHtml(displayId)}</span>
            <strong>${escapeHtml(language.label)}</strong>
          </div>
          ${innerCard}
        </section>
      `;
    })
    .join('');

  const localPicker = languages.map((lang) => {
    const isSelectedGlobally = state.selectedLanguages.has(lang.id);
    const shortId = lang.id === 'LLC_zh-CN' ? 'CN' : lang.id;
    return `
    <label class="local-lang-toggle">
      <input type="checkbox" class="local-lang-checkbox" ${isSelectedGlobally ? 'checked' : ''} data-lang-id="${lang.id}">
      <span class="local-lang-label">${escapeHtml(shortId)}</span>
    </label>
    `;
  }).join('');

  return `
    <section class="line-panel shell-panel" data-row-key="${row.key}">
      <div class="line-panel-header" style="justify-content: space-between; align-items: center; display: flex; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <p class="section-kicker">Line</p>
            <span>${index + 1}</span>
        </div>
        <div class="local-lang-picker">${localPicker}</div>
      </div>
      <div class="line-language-stack">${cards}</div>
    </section>
  `;
}

function renderLanguagePicker() {
  elements.languagePicker.innerHTML = state.storyIndex.languages
    .map((language) => {
      const disabled = !state.story.availableLanguages[language.id] ? 'disabled' : '';
      const checked = state.selectedLanguages.has(language.id) ? 'checked' : '';
      return `
        <label class="language-switch ${disabled ? 'disabled' : ''}">
          <input type="checkbox" data-language-id="${language.id}" ${checked} ${disabled} />
          <span>${language.label}</span>
        </label>
      `;
    })
    .join('');

  elements.languagePicker.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const languageId = event.currentTarget.dataset.languageId;
      if (event.currentTarget.checked) {
        state.selectedLanguages.add(languageId);
      } else if (state.selectedLanguages.size > 1) {
        state.selectedLanguages.delete(languageId);
      } else {
        event.currentTarget.checked = true;
      }

      updateQuery();
      renderAvailability();
      await renderStory();
    });
  });
}

function renderAvailability() {
  elements.availability.innerHTML = state.storyIndex.languages
    .map((language) => {
      const className = state.story.availableLanguages[language.id] ? 'availability-pill' : 'availability-pill missing';
      const text = state.story.availableLanguages[language.id] ? `${language.label} 可读` : `${language.label} 缺失`;
      return `<span class="${className}">${text}</span>`;
    })
    .join('');
}

async function renderStory() {
  elements.storySections.style.opacity = '0.5';
  elements.storySections.style.pointerEvents = 'none';
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  const coreLangIds = new Set(['LLC_zh-CN', 'JP', 'EN', 'KR']);
  const languages = state.storyIndex.languages.filter((language) => coreLangIds.has(language.id) || state.selectedLanguages.has(language.id));
  const loadedData = new Map();
  state.localSpeakerMaps.clear();

  for (const language of languages) {
    await fetchCharacterMap(language);
    const payload = await fetchStoryData(language.id);
    loadedData.set(language.id, payload);

    const localMap = new Map();
    const dataList = Array.isArray(payload?.dataList) ? payload.dataList : [];
    for (const item of dataList) {
      if (!item.teller || typeof item.teller !== 'string') continue;
      
      if (!/[가-힣]/.test(item.teller)) {
        if (item.model) {
          const baseModel = item.model.replace(/\d+$/, '');
          if (!localMap.has(item.model)) localMap.set(item.model, item.teller);
          if (!localMap.has(baseModel)) localMap.set(baseModel, item.teller);
        }
      }
    }
    state.localSpeakerMaps.set(language.id, localMap);
  }

  const mergedRows = buildMergedRows(loadedData);
  
  // Use chunking or direct assignment
  const htmlContent = mergedRows.length
    ? mergedRows.map((row, index) => createRowPanel(row, index, languages)).join('')
    : '<section class="shell-panel"><p class="empty-hint">当前剧情没有可显示的台词内容。</p></section>';
  
  elements.storySections.innerHTML = htmlContent;
  elements.storySections.style.opacity = '';
  elements.storySections.style.pointerEvents = '';
}

async function init() {
  const queryState = getQueryState();
  if (!queryState.code) {
    throw new Error('缺少剧情编号参数。');
  }

  state.storyIndex = await loadIndex();
  state.story = state.storyIndex.stories.find((entry) => entry.code === queryState.code);
  if (!state.story) {
    throw new Error(`未找到剧情 ${queryState.code}`);
  }

  const chineseLanguage = state.storyIndex.languages.find((language) => language.id === 'LLC_zh-CN');
  if (chineseLanguage) {
    await fetchCharacterMap(chineseLanguage);
  }

  const validLanguages = queryState.langs.filter((languageId) => state.story.availableLanguages[languageId]);
  state.selectedLanguages = new Set(validLanguages.length ? validLanguages : ['LLC_zh-CN']);

  elements.storyTitle.textContent = state.story.storyLabel;
  elements.storyMeta.textContent = `${state.story.displayCode || state.story.code} · ${state.story.categoryLabel} · ${state.story.chapterLabel} · ${state.story.stageLabel}`;
  renderLanguagePicker();
  renderAvailability();
  await renderStory();
}

init().catch((error) => {
  elements.storyTitle.textContent = '无法加载剧情';
  elements.storyMeta.textContent = error.message;
  elements.storySections.innerHTML = `<section class="shell-panel"><p class="empty-hint">${error.message}</p></section>`;
});






document.addEventListener('change', (e) => {
  if (e.target.matches('.local-lang-picker input[type="checkbox"]')) {
    const langId = e.target.dataset.langId;
    const isChecked = e.target.checked;
    const panel = e.target.closest('.line-panel');
    if (panel) {
      const block = panel.querySelector(`.line-language-block[data-lang-id="${langId}"]`);
      if (block) {
        block.style.display = isChecked ? '' : 'none';
      }
    }
  }
});
