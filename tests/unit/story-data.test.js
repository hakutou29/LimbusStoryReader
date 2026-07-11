import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appendBattleSpeechRows, getVoiceIdentityId } from '../../story-viewer/lib/story-data.js';

describe('story data helpers', () => {
  it('extracts personality ids from voice stories', () => {
    assert.equal(getVoiceIdentityId({ category: 'voice', code: 'V11216', stageKey: 'V11216' }), '11216');
    assert.equal(getVoiceIdentityId({ category: 'identity', code: 'P11216', stageKey: 'P11216' }), null);
    assert.equal(getVoiceIdentityId({ category: 'voice', code: 'S11216', stageKey: 'S11216' }), null);
  });

  it('appends matching battle speech bubble rows to voice payloads', () => {
    const payload = {
      dataList: [
        { id: 'battleentry_11216_1', desc: '进入战斗', dlg: '开始吧。' },
      ],
    };
    const battlePayload = {
      dataList: [
        { id: 'battle_special_11216_3', desc: '特殊语音 3', dlg: '特殊台词。' },
        { id: 'battle_react_noVoice_11216_1', desc: '', dlg: '无说明台词。' },
        { id: 'battle_special_11217_1', desc: '其他人格', dlg: '不应出现。' },
        { id: 'not_battle_11216_1', desc: '非战斗气泡', dlg: '不应出现。' },
      ],
    };

    const merged = appendBattleSpeechRows(payload, battlePayload, '11216');

    assert.deepEqual(merged.dataList, [
      { id: 'battleentry_11216_1', desc: '进入战斗', dlg: '开始吧。' },
      { id: 'battle_special_11216_3', desc: '特殊语音 3', dlg: '特殊台词。' },
      { id: 'battle_react_noVoice_11216_1', desc: '战斗中语音', dlg: '无说明台词。' },
    ]);
  });
});