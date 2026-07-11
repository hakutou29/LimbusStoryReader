import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePart, parseStoryCode } from '../../LocalizeLimbusCompany/scripts/build-story-index.mjs';

describe('story index code parsing', () => {
  it('normalizes base, sequenced, and unknown story parts', () => {
    assert.deepEqual(normalizePart(''), {
      raw: '',
      code: '',
      label: '正篇',
      sort: 0,
    });

    assert.deepEqual(normalizePart('I3'), {
      raw: 'I3',
      code: 'I3',
      label: '战斗中剧情 3',
      sort: 2.03,
    });

    assert.deepEqual(normalizePart('Z9'), {
      raw: 'Z9',
      code: 'Z9',
      label: 'Z9',
      sort: 99,
    });
  });

  it('parses main story and dungeon-style main addenda', () => {
    const mainStory = parseStoryCode('S947B');
    assert.equal(mainStory.category, 'main');
    assert.equal(mainStory.displayCode, '9-47B');
    assert.equal(mainStory.part.label, '战斗前剧情');

    const dungeonStory = parseStoryCode('8D4A');
    assert.equal(dungeonStory.category, 'main');
    assert.equal(dungeonStory.displayCode, '8D-4A');
    assert.equal(dungeonStory.stageKey, 'S820-D4');
  });

  it('parses event and collaboration story families', () => {
    assert.equal(parseStoryCode('E001').category, 'aprilFools');
    assert.equal(parseStoryCode('E041').category, 'walpurgis');
    assert.equal(parseStoryCode('ES803B').category, 'intervallo');
    assert.equal(parseStoryCode('PC001A').category, 'arknights');
  });

  it('parses identity stories and personality voice entries', () => {
    const identityStory = parseStoryCode('P10101');
    assert.equal(identityStory.category, 'identity');
    assert.equal(identityStory.chapterLabel, '#1 李箱');

    const voiceStory = parseStoryCode('V10101');
    assert.equal(voiceStory.category, 'voice');
    assert.equal(voiceStory.chapterLabel, '#1 李箱');
  });

  it('falls back to other for unknown code families', () => {
    const parsed = parseStoryCode('UNKNOWN42');
    assert.equal(parsed.category, 'other');
    assert.equal(parsed.stageLabel, 'UNKNOWN42');
  });
});