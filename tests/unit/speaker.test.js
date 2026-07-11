import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLocalSpeakerMap, loadStoryLanguageData } from '../../story-viewer/lib/story-data.js';
import { getSpeakerGlyph, getSpeakerTone, resolvePortraitName, resolveSpeakerName } from '../../story-viewer/lib/speaker.js';

describe('speaker helpers', () => {
  it('loads language payloads concurrently while preserving language order', async () => {
    const languages = [
      { id: 'LLC_zh-CN', folder: 'LLC_zh-CN' },
      { id: 'JP', folder: 'JP' },
    ];
    const characterMaps = new Map(languages.map((language) => [language.id, new Map()]));
    const payloads = new Map([
      ['LLC_zh-CN', { dataList: [{ model: 'yi01', teller: '李箱' }] }],
      ['JP', { dataList: [{ model: 'yi01', teller: 'イサン' }] }],
    ]);

    const { loadedData, localSpeakerMaps } = await loadStoryLanguageData(
      languages,
      async (languageId) => payloads.get(languageId),
      characterMaps,
    );

    assert.deepEqual([...loadedData.keys()], ['LLC_zh-CN', 'JP']);
    assert.equal(loadedData.get('JP'), payloads.get('JP'));
    assert.equal(localSpeakerMaps.get('LLC_zh-CN').get('yi'), '李箱');
    assert.equal(localSpeakerMaps.get('JP').get('yi'), 'イサン');
  });

  it('builds local speaker names from translated teller rows', () => {
    const localMap = buildLocalSpeakerMap({
      dataList: [
        { model: 'faust01', teller: '浮士德' },
        { model: 'faust02', teller: '파우스트' },
        { model: 'don01', teller: '堂吉诃德' },
      ],
    });

    assert.equal(localMap.get('faust01'), '浮士德');
    assert.equal(localMap.get('faust'), '浮士德');
    assert.equal(localMap.has('faust02'), false);
    assert.equal(localMap.get('don'), '堂吉诃德');
  });

  it('prefers character map names and then local Korean speaker fallback names', () => {
    const language = { id: 'KR' };
    const characterMap = new Map([['model-a', { name: '映射名' }]]);
    const localSpeakerMaps = new Map([
      ['KR', new Map([['model-b', '本地名'], ['model', '基础名'], ['테러', '译名']])],
    ]);

    assert.equal(
      resolveSpeakerName({ model: 'model-a', teller: 'ignored' }, language, characterMap, null, localSpeakerMaps),
      '映射名',
    );
    assert.equal(
      resolveSpeakerName({ model: 'model-b', teller: '테러' }, language, new Map(), null, localSpeakerMaps),
      '本地名',
    );
    assert.equal(
      resolveSpeakerName({ teller: '테러' }, language, new Map(), null, localSpeakerMaps),
      '译名',
    );
  });

  it('infers voice speaker names from the selected voice story chapter label', () => {
    assert.equal(
      resolveSpeakerName(
        { dlg: 'hello' },
        { id: 'LLC_zh-CN' },
        new Map(),
        { category: 'voice', chapterLabel: '#3 堂吉诃德' },
        new Map(),
      ),
      '堂吉诃德',
    );
  });

  it('creates stable speaker glyphs, tones, and portrait names', () => {
    assert.equal(getSpeakerGlyph('【但丁】'), '但');
    assert.equal(getSpeakerTone('但丁'), getSpeakerTone('但丁'));

    const characterMaps = new Map([
      ['LLC_zh-CN', new Map([['model-a', { name: '但丁' }], ['model-b', { name: '未知' }]])],
    ]);
    assert.equal(resolvePortraitName({ model: 'model-a' }, characterMaps), '但丁');
    assert.equal(resolvePortraitName({ model: 'model-b' }, characterMaps), '无');
  });
});