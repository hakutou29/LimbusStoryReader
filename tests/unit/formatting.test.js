import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeHtml, formatRichText } from '../../story-viewer/lib/formatting.js';

describe('formatting helpers', () => {
  it('escapes HTML-sensitive characters', () => {
    assert.equal(
      escapeHtml(`<script>alert("x")</script> & 'quoted'`),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;',
    );
  });

  it('restores the limited rich-text tags supported by story data', () => {
    assert.equal(
      formatRichText('<color=#ff00aa><b>Hello</b></color> <i>world</i>'),
      '<span style="color: #ff00aa;"><b>Hello</b></span> <i>world</i>',
    );
  });

  it('keeps unsupported HTML escaped', () => {
    assert.equal(
      formatRichText('<img src=x onerror=alert(1)> <unknown>tag</unknown>'),
      '&lt;img src=x onerror=alert(1)&gt; &lt;unknown&gt;tag&lt;/unknown&gt;',
    );
  });
});
