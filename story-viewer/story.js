import { escapeHtml, formatRichText } from './lib/formatting.js';
import { buildMergedRows } from './lib/row-align.js';
import { createStoryDataLoader, fetchCharacterMap, loadIndex, loadStoryLanguageData } from './lib/story-data.js';
import { buildStoryIconPath, getSpeakerGlyph, getSpeakerTone, resolvePortraitName, resolveSpeakerName } from './lib/speaker.js';

const state = {
  storyIndex: null,
  story: null,
  selectedLanguages: new Set(),
  loadedStories: new Map(),
  characterMaps: new Map(),
  localSpeakerMaps: new Map(),
  renderedRowsByKey: new Map(),
  renderLanguagesById: new Map(),
  renderLanguageOrder: new Map(),
};

const elements = {
  storyTitle: document.querySelector('#story-title'),
  storyMeta: document.querySelector('#story-meta'),
  languagePicker: document.querySelector('#language-picker'),
  availability: document.querySelector('#availability'),
  storySections: document.querySelector('#story-sections'),
};

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

function createSpeakerPortrait(entry, speaker) {
  const portraitName = resolvePortraitName(entry, state.characterMaps);
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
  const speaker = resolveSpeakerName(entry, language, characterMap, state.story, state.localSpeakerMaps);
  const tone = getSpeakerTone(speaker);
  
  const isVoice = state.story && state.story.category === 'voice';

  let roleText = [entry.title, entry.teller].filter(Boolean).join(' · ');
  if (!roleText && entry.desc) roleText = entry.desc;
  if (!roleText && !isVoice && speaker === '旁白') roleText = '旁白';
  if (!roleText && !isVoice && speaker !== '旁白') roleText = '';
  if (isVoice && entry.desc) roleText = entry.desc; // Force using desc for voices if available
  
  const placeText = entry.place ? `<p class="entry-place">${escapeHtml(entry.place)}</p>` : '';
  const characterInfo = entry.model && characterMap.has(entry.model) ? characterMap.get(entry.model) : null;
  const charNoBadge = characterInfo && characterInfo.no != null ? `<span class="speaker-character-no">#${characterInfo.no}</span>` : '';
  const contentText = entry.content ?? entry.dlg ?? '';

  if (isVoice) {
      return `
        <article class="dialogue-card dialogue-card-voice">
          <aside class="dialogue-speaker">
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
            <div class="dialogue-body">
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

function createLineLanguageBlock(row, language, isVisible = true) {
  const entry = row.entries.get(language.id);
  const displayId = language.id === 'LLC_zh-CN' ? 'CN' : language.id;

  let innerCard;
  if (!entry) {
    innerCard = createMissingEntryCard(language);
  } else {
    const characterMap = state.characterMaps.get(language.id) ?? new Map();
    innerCard = createEntryCard(entry, row.order, language, characterMap);
  }

  const displayStyle = isVisible ? '' : 'display: none;';
  const order = state.renderLanguageOrder.get(language.id) ?? 999;
  return `
    <section class="line-language-block" data-lang-id="${language.id}" data-lang-order="${order}" style="${displayStyle}">
      <div class="line-language-head">
        <span class="line-language-code">${escapeHtml(displayId)}</span>
        <strong>${escapeHtml(language.label)}</strong>
      </div>
      ${innerCard}
    </section>
  `;
}

function createRowPanel(row, index, languages) {
  const cards = languages
    .filter((language) => state.selectedLanguages.has(language.id))
    .map((language) => createLineLanguageBlock(row, language, true))
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
  const fetchStoryData = createStoryDataLoader(state.story, state.loadedStories);
  const { loadedData, localSpeakerMaps } = await loadStoryLanguageData(languages, fetchStoryData, state.characterMaps);
  state.localSpeakerMaps = localSpeakerMaps;

  const mergedRows = buildMergedRows(loadedData, state.selectedLanguages);
  state.renderedRowsByKey = new Map(mergedRows.map((row) => [row.key, row]));
  state.renderLanguagesById = new Map(languages.map((language) => [language.id, language]));
  state.renderLanguageOrder = new Map(languages.map((language, index) => [language.id, index]));
  
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
    await fetchCharacterMap(chineseLanguage, state.characterMaps);
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
      let block = panel.querySelector(`.line-language-block[data-lang-id="${langId}"]`);
      if (isChecked && !block) {
        const row = state.renderedRowsByKey.get(panel.dataset.rowKey);
        const language = state.renderLanguagesById.get(langId);
        const stack = panel.querySelector('.line-language-stack');
        if (row && language && stack) {
          const template = document.createElement('template');
          template.innerHTML = createLineLanguageBlock(row, language, true).trim();
          block = template.content.firstElementChild;
          const order = state.renderLanguageOrder.get(langId) ?? 999;
          const nextBlock = [...stack.children].find((item) => Number(item.dataset.langOrder) > order);
          stack.insertBefore(block, nextBlock ?? null);
        }
      }

      if (block) {
        block.style.display = isChecked ? '' : 'none';
      }
    }
  }
});
