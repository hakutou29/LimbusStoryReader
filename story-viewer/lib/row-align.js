export function toRowKey(item, fallbackIndex) {
  if (typeof item.id === 'number' && item.id !== -1) {
    return `id:${item.id}`;
  }
  return `idx:${fallbackIndex}`;
}

export function buildMergedRows(loadedData, selectedLanguages) {
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

  if (!selectedLanguages.has('KR')) {
    const selectedLangsArray = [...selectedLanguages];
    finalRows = finalRows.filter((row) => {
      if (row.id !== -1) return true;

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