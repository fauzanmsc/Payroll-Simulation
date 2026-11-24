'use strict';

(function (global) {
  const PayrollStudio = (global.PayrollStudio = global.PayrollStudio || {});
  const { ALL_FIELDS } = PayrollStudio.config;

  function parseCSV(text) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const firstLine = cleanText.split(/\r?\n/)[0];
    const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
    const rows = [];

    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (char === '"') {
        if (quoted && cleanText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && char === separator) {
        row.push(field);
        field = '';
      } else if (!quoted && (char === '\n' || char === '\r')) {
        if (char === '\r' && cleanText[i + 1] === '\n') i++;
        row.push(field);
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (quoted) {
      throw new Error('CSV memiliki kutip yang belum ditutup.');
    }

    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);

    const headers = rows.shift()?.map((header) => header.trim()) || [];
    return rows.map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
  }

  function validateDatabase(data) {
    if (!Array.isArray(data) || !data.length) {
      throw new Error('Database harus berisi minimal satu karyawan.');
    }

    return data.map((item, index) => {
      if (
        !item ||
        typeof item !== 'object' ||
        !String(item.name ?? '').trim() ||
        item.basic === undefined ||
        item.basic === ''
      ) {
        throw new Error(`Baris ${index + 1}: name dan basic wajib diisi.`);
      }

      const record = {
        name: String(item.name),
        id: String(item.id ?? index + 1),
      };

      for (const [key] of ALL_FIELDS) {
        const raw = item[key];
        const value = raw === undefined || raw === '' ? 0 : Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(
            `Baris ${index + 1}: ${key} harus angka nonnegatif tanpa pemisah ribuan.`
          );
        }
        record[key] = Math.round(value);
      }

      return record;
    });
  }

  function escapeCsvCell(value) {
    return '"' + String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  }

  PayrollStudio.database = {
    parseCSV,
    validateDatabase,
    escapeCsvCell,
  };
})(typeof window !== 'undefined' ? window : globalThis);
