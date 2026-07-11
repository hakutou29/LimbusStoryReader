import { expect, test } from '@playwright/test';

async function loadStoryIndex(request) {
  const response = await request.get('/story-viewer/data/story-index.json');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function pickMultilingualStory(storyIndex) {
  return storyIndex.stories.find((story) => (
    story.category !== 'voice'
      && story.availableLanguages['LLC_zh-CN']
      && story.availableLanguages.JP
  )) ?? storyIndex.stories.find((story) => story.availableLanguages['LLC_zh-CN']);
}

test.describe('story viewer', () => {
  test('loads the catalog and filters identity entries', async ({ page }) => {
    await page.goto('/story-viewer/');

    await expect(page.getByRole('heading', { name: '多语言剧情索引' })).toBeVisible();
    await expect(page.getByText(/当前匹配 \d+ 个剧情文件/)).toBeVisible();

    await page.getByRole('button', { name: '人格' }).click();
    await page.getByLabel('搜索剧情编号或章节').fill('人格语音');

    await expect(page.getByText('人格语音').first()).toBeVisible();
    await expect(page.getByRole('link').first()).toBeVisible();
  });

  test('opens a story and supports global plus per-line language toggles', async ({ page, request }) => {
    const storyIndex = await loadStoryIndex(request);
    const story = pickMultilingualStory(storyIndex);
    expect(story).toBeTruthy();

    await page.goto(`/story-viewer/story.html?code=${story.code}&langs=LLC_zh-CN`);

    await expect(page.getByRole('heading', { name: story.storyLabel })).toBeVisible();
    const firstLine = page.locator('.line-panel').first();
    await expect(firstLine).toBeVisible();
    await expect(firstLine.locator('.line-language-block[data-lang-id="LLC_zh-CN"]')).toBeVisible();

    await page.getByLabel('日文').check();
    await expect(page).toHaveURL(/langs=.*JP/);
    await expect(firstLine.locator('.line-language-block[data-lang-id="JP"]')).toBeVisible();

    await firstLine.locator('.local-lang-toggle', { hasText: 'JP' }).click();
    await expect(firstLine.locator('.line-language-block[data-lang-id="JP"]')).toBeHidden();

    await firstLine.locator('.local-lang-toggle', { hasText: 'JP' }).click();
    await expect(firstLine.locator('.line-language-block[data-lang-id="JP"]')).toBeVisible();
  });
});
