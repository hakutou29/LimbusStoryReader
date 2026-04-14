const state = {
  storyIndex: null,
  selectedLanguages: new Set(['LLC_zh-CN']),
  searchTerm: '',
};

const elements = {
  statsPanel: document.querySelector('#stats-panel'),
  searchInput: document.querySelector('#search-input'),
  languagePicker: document.querySelector('#language-picker'),
  catalogSummary: document.querySelector('#catalog-summary'),
  catalogTree: document.querySelector('#catalog-tree'),
};

function debounce(callback, delay) {
  let timerId = 0;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), delay);
  };
}

function buildQueryString(storyCode) {
  const params = new URLSearchParams();
  params.set('code', storyCode);
  params.set('langs', [...state.selectedLanguages].join(','));
  return params.toString();
}

async function loadIndex() {
  const response = await fetch('./data/story-index.json');
  if (!response.ok) {
    throw new Error('无法加载剧情索引。');
  }
  return response.json();
}

function renderStats() {
  const cards = [
    { label: '唯一剧情编号', value: state.storyIndex.stats.totalStories },
    { label: '剧情类别', value: state.storyIndex.categories.length },
    { label: '当前筛选语言', value: state.selectedLanguages.size },
    { label: '中文文件数', value: state.storyIndex.stats.perLanguage['LLC_zh-CN'] },
  ];

  elements.statsPanel.innerHTML = cards
    .map(
      (card) => `
        <div class="metric-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `,
    )
    .join('');
}

function renderLanguagePicker() {
  elements.languagePicker.innerHTML = state.storyIndex.languages
    .map((language) => {
      const checked = state.selectedLanguages.has(language.id) ? 'checked' : '';
        const displayId = language.id === 'LLC_zh-CN' ? 'CN' : language.id;
        return `
        <label class="language-chip">
            <input type="checkbox" data-language-id="${language.id}" ${checked} />
            <span>
              <strong>${language.label}</strong>
              <small>${displayId} / ${language.storyCount}</small>
          </span>
        </label>
      `;
    })
    .join('');

  elements.languagePicker.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const languageId = event.currentTarget.dataset.languageId;
      if (event.currentTarget.checked) {
        state.selectedLanguages.add(languageId);
      } else if (state.selectedLanguages.size > 1) {
        state.selectedLanguages.delete(languageId);
      } else {
        event.currentTarget.checked = true;
      }

      renderStats();
      renderCatalog();
    });
  });
}

function getFilteredStories() {
  const term = state.searchTerm.trim().toLowerCase();
  return state.storyIndex.stories.filter((story) => {
    if (term && !story.searchText.includes(term)) {
      return false;
    }

    return [...state.selectedLanguages].some((languageId) => story.availableLanguages[languageId]);
  });
}

function buildCatalogGroups(stories) {
  const categories = new Map();

  for (const story of stories) {
    if (!categories.has(story.category)) {
      categories.set(story.category, {
        label: story.categoryLabel,
        description: story.categoryDescription,
        chapters: new Map(),
      });
    }

    const category = categories.get(story.category);
    if (!category.chapters.has(story.chapterKey)) {
      category.chapters.set(story.chapterKey, {
        label: story.chapterLabel,
        stories: [],
      });
    }

    category.chapters.get(story.chapterKey).stories.push(story);
  }

  return [...categories.values()];
}

function renderCatalog() {
  const filteredStories = getFilteredStories();
  const categories = buildCatalogGroups(filteredStories);
  elements.catalogSummary.textContent = `当前匹配 ${filteredStories.length} 个剧情文件`;

  if (!filteredStories.length) {
    elements.catalogTree.innerHTML = '<p class="empty-hint">没有匹配结果，请调整筛选条件。</p>';
    return;
  }

  elements.catalogTree.innerHTML = categories
    .map((category) => {
      const chapters = [...category.chapters.values()]
        .map((chapter) => {
          const storyLinks = chapter.stories
            .map((story) => {
              const availableText = [...state.selectedLanguages]
                .filter((languageId) => story.availableLanguages[languageId])
                .map((languageId) => state.storyIndex.languages.find((language) => language.id === languageId)?.label)
                .join(' / ');
              return `
                <a class="story-card-link" href="./story.html?${buildQueryString(story.code)}">
                  <span class="story-card-code">${story.displayCode || story.code}</span>
                  <strong>${story.storyLabel}</strong>
                  <small>${availableText || '无可用语言'}</small>
                </a>
              `;
            })
            .join('');

          return `
            <details class="chapter-panel">
              <summary class="chapter-panel-header">
                <h3>${chapter.label}</h3>
                <span>${chapter.stories.length} 个关卡</span>
              </summary>
              <div class="story-card-grid">${storyLinks}</div>
            </details>
          `;
        })
        .join('');

      return `
        <section class="catalog-block">
          <div class="catalog-block-header">
            <p class="section-kicker">${category.label}</p>
            <p>${category.description}</p>
          </div>
          ${chapters}
        </section>
      `;
    })
    .join('');
}

function bindEvents() {
  elements.searchInput.addEventListener(
    'input',
    debounce((event) => {
      state.searchTerm = event.target.value;
      renderCatalog();
    }, 120),
  );
}

async function init() {
  bindEvents();
  state.storyIndex = await loadIndex();
  renderStats();
  renderLanguagePicker();
  renderCatalog();
}

init().catch((error) => {
  elements.catalogSummary.textContent = error.message;
  elements.catalogTree.innerHTML = `<p class="empty-hint">${error.message}</p>`;
});