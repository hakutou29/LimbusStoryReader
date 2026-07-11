import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMergedRows, toRowKey } from '../../story-viewer/lib/row-align.js';

describe('story row alignment', () => {
  it('uses dialogue ids when available and fallback indexes for continuation rows', () => {
    assert.equal(toRowKey({ id: 12 }, 3), 'id:12');
    assert.equal(toRowKey({ id: -1 }, 3), 'idx:3');
    assert.equal(toRowKey({}, 4), 'idx:4');
  });

  it('aligns language entries by row key and sorts valid ids numerically', () => {
    const rows = buildMergedRows(
      new Map([
        ['LLC_zh-CN', { dataList: [{ id: 20, content: '二十' }, { id: 10, content: '十' }] }],
        ['JP', { dataList: [{ id: 10, content: '十 JP' }, { id: 20, content: '二十 JP' }] }],
      ]),
      new Set(['LLC_zh-CN']),
    );

    assert.deepEqual(rows.map((row) => row.key), ['id:10', 'id:20']);
    assert.equal(rows[0].entries.get('LLC_zh-CN').content, '十');
    assert.equal(rows[0].entries.get('JP').content, '十 JP');
  });

  it('filters Korean-only continuation rows when Korean is not selected', () => {
    const loadedData = new Map([
      ['KR', { dataList: [{ id: 1, content: '시작' }, { id: -1, content: '한국어 계속' }] }],
      ['LLC_zh-CN', { dataList: [{ id: 1, content: '开始' }] }],
    ]);

    const withoutKorean = buildMergedRows(loadedData, new Set(['LLC_zh-CN']));
    assert.deepEqual(withoutKorean.map((row) => row.key), ['id:1']);

    const withKorean = buildMergedRows(loadedData, new Set(['LLC_zh-CN', 'KR']));
    assert.deepEqual(withKorean.map((row) => row.key), ['id:1', 'idx:1']);
  });

  it('keeps translated continuation rows for selected non-Korean languages', () => {
    const rows = buildMergedRows(
      new Map([
        ['LLC_zh-CN', { dataList: [{ id: 1, content: '开始' }, { id: -1, content: '中文继续' }] }],
        ['KR', { dataList: [{ id: 1, content: '시작' }, { id: -1, content: '한국어 계속' }] }],
      ]),
      new Set(['LLC_zh-CN']),
    );

    assert.deepEqual(rows.map((row) => row.key), ['id:1', 'idx:1']);
  });
});
