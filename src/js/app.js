'use strict';

(function (global) {
  const { config, calculator, database } = global.PayrollStudio;
  const {
    SALARY_FIELDS,
    EXTRA_FIELDS,
    DEDUCT_FIELDS,
    ALL_FIELDS,
    MODES,
    DEFAULT_INPUTS,
    formatRupiah,
  } = config;
  const { parsePeriodInputs, calculatePayroll } = calculator;
  const { parseCSV, validateDatabase, escapeCsvCell } = database;

  const $ = (id) => document.getElementById(id);
  const val = (id) => $(id).value;
  const num = (id) => Math.max(0, Number($(id).value) || 0);

  let currentResult = null;
  let employeeDb = [];

  function initNumericFields() {
    const groups = [
      ['salaryFields', SALARY_FIELDS],
      ['extraFields', EXTRA_FIELDS],
      ['deductFields', DEDUCT_FIELDS],
    ];

    for (const [targetId, fields] of groups) {
      const container = $(targetId);
      for (const [id, label, defaultValue] of fields) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<label for="${id}">${label} (Rp)</label><input type="number" min="0" step="1" id="${id}" value="${defaultValue}">`;
        container.append(wrapper);
      }
    }
  }

  function collectFormValues() {
    const values = {
      dutyDays: num('dutyDays'),
      absence: num('absence'),
      autoBpjs: $('autoBpjs').checked,
    };

    for (const [key] of ALL_FIELDS) {
      values[key] = num(key);
    }

    return values;
  }

  function showAlert(id, message) {
    const el = $(id);
    el.textContent = message;
    el.classList.toggle('hidden', !message);
  }

  function appendBreakdownRow(tbody, row) {
    const tr = document.createElement('tr');
    tr.className = row.type || '';

    const labelCell = document.createElement('td');
    const valueCell = document.createElement('td');

    labelCell.textContent = row.label;
    if (row.detail) {
      const small = document.createElement('small');
      small.textContent = row.detail;
      labelCell.append(small);
    }

    valueCell.textContent = formatRupiah(row.amount);
    if (row.type === 'negative') {
      valueCell.className = 'negative';
    }

    tr.append(labelCell, valueCell);
    tbody.append(tr);
  }

  function render() {
    const mode = val('mode');

    document
      .querySelectorAll('.case')
      .forEach((el) => el.classList.toggle('hidden', mode.endsWith('full')));
    $('transitionField').classList.toggle('hidden', mode !== 'transition');

    const baseSalary = SALARY_FIELDS.reduce((sum, [id]) => sum + num(id), 0);
    $('base80').textContent = formatRupiah(baseSalary * 0.8);
    $('base100').textContent = formatRupiah(baseSalary);
    $('scenarioName').textContent = MODES[mode];
    $('resultName').textContent = `${val('name') || 'Karyawan'} · ${val('start')} — ${val('end')}`;

    $('breakdown').replaceChildren();
    $('comparison').replaceChildren();
    currentResult = null;

    try {
      const period = parsePeriodInputs({
        start: val('start'),
        end: val('end'),
        activeStart: val('activeStart'),
        activeEnd: val('activeEnd'),
        transition: val('transition'),
        holidaysRaw: val('holidays'),
      });
      const values = collectFormValues();
      const result = calculatePayroll(mode, period, values);

      currentResult = result;
      showAlert('dateError', '');
      showAlert('resultWarning', result.warning);
      showAlert('attendanceError', result.warning);

      $('workdays').textContent = `${result.den} hari kerja`;
      $('paidDays').textContent = `${result.n} hari hak upah`;
      $('count80').textContent = `A80: ${result.n80} hari`;
      $('count100').textContent = `A100: ${result.n100} hari`;
      $('bar80').style.width = `${(100 * result.n80) / result.den}%`;
      $('bar100').style.width = `${(100 * result.n100) / result.den}%`;
      $('attendance').value = result.attendance;

      $('net').textContent = formatRupiah(result.net);
      $('gross').textContent = formatRupiah(result.gross);
      $('deductions').textContent = formatRupiah(result.deductions);

      result.rows.forEach((row) => appendBreakdownRow($('breakdown'), row));

      for (const [scenarioKey, scenarioLabel] of Object.entries(MODES)) {
        const tr = document.createElement('tr');
        const labelCell = document.createElement('td');
        const amountCell = document.createElement('td');
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'secondary scenario-btn';
        button.textContent = (scenarioKey === mode ? '✓ ' : '') + scenarioLabel;
        button.onclick = () => {
          $('mode').value = scenarioKey;
          render();
        };

        labelCell.append(button);
        try {
          const compared = calculatePayroll(scenarioKey, period, values);
          amountCell.textContent = formatRupiah(compared.net) + (compared.warning ? ' *' : '');
        } catch {
          amountCell.textContent = '—';
        }

        tr.append(labelCell, amountCell);
        $('comparison').append(tr);
      }
    } catch (error) {
      showAlert('dateError', error.message);
      showAlert('resultWarning', error.message);
      showAlert('attendanceError', '');

      for (const id of ['net', 'gross', 'deductions', 'workdays', 'paidDays', 'count80', 'count100']) {
        $(id).textContent = '—';
      }
      $('attendance').value = '';
      $('bar80').style.width = '0%';
      $('bar100').style.width = '0%';
    }

    const actionsDisabled = !currentResult || Boolean(currentResult.warning);
    for (const id of ['print', 'export', 'copy']) {
      $(id).disabled = actionsDisabled;
    }
  }

  function resetSimulation() {
    for (const [id, , defaultValue] of ALL_FIELDS) {
      $(id).value = defaultValue;
    }
    for (const [id, defaultValue] of Object.entries(DEFAULT_INPUTS)) {
      $(id).value = defaultValue;
    }
    $('autoBpjs').checked = true;
    render();
  }

  async function handleDatabaseUpload() {
    try {
      const file = $('file').files[0];
      if (!file) return;

      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.json')
        ? JSON.parse(text)
        : parseCSV(text);

      employeeDb = validateDatabase(parsed);
      $('employee').replaceChildren(new Option('Input manual', ''));
      employeeDb.forEach((record, index) => {
        $('employee').add(new Option(`${record.name} · ${record.id}`, String(index)));
      });
      $('dbstatus').textContent = `${employeeDb.length} karyawan berhasil dibaca dari ${file.name}.`;
    } catch (error) {
      $('dbstatus').textContent = 'Impor gagal: ' + error.message;
    }
  }

  function handleEmployeeSelect() {
    if (val('employee') === '') return;
    const record = employeeDb[Number(val('employee'))];
    $('name').value = record.name;
    for (const [key] of ALL_FIELDS) {
      $(key).value = record[key];
    }
    render();
  }

  function handleClearDatabase() {
    employeeDb = [];
    $('employee').replaceChildren(new Option('Input manual', ''));
    $('file').value = '';
    $('dbstatus').textContent = 'Database sesi dihapus. Nilai input saat ini tetap ada.';
  }

  function handleExportCsv() {
    if (!currentResult) return;

    const lines = [
      ['Nama', val('name')],
      ['Periode', `${val('start')} - ${val('end')}`],
      ['Skenario', MODES[val('mode')]],
      ['Komponen', 'Dasar hitung', 'Nominal'],
      ...currentResult.rows.map((row) => [row.label, row.detail || '', row.amount]),
    ];

    const csvContent =
      '\uFEFF' +
      lines
        .map((line) =>
          line.map((cell) => (typeof cell === 'number' ? cell : escapeCsvCell(cell))).join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payroll-simulation.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleCopySummary() {
    if (!currentResult) return;

    try {
      const header = `${val('name')} | ${MODES[val('mode')]} | ${val('start')} – ${val('end')}\n`;
      const body = currentResult.rows
        .map((row) => `${row.label}: ${formatRupiah(row.amount)}`)
        .join('\n');

      await navigator.clipboard.writeText(header + body);
      $('actionStatus').textContent = 'Ringkasan disalin.';
    } catch {
      $('actionStatus').textContent = 'Tidak dapat menyalin; gunakan Ekspor CSV.';
    }
  }

  function bindEvents() {
    $('file').onchange = handleDatabaseUpload;
    $('employee').onchange = handleEmployeeSelect;
    $('clearDb').onclick = handleClearDatabase;
    $('reset').onclick = resetSimulation;
    $('print').onclick = () => window.print();
    $('export').onclick = handleExportCsv;
    $('copy').onclick = handleCopySummary;

    document.addEventListener('input', (event) => {
      if (event.target.matches('input:not([type=file]),select') && event.target.id !== 'employee') {
        render();
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.id === 'mode' || event.target.id === 'autoBpjs') {
        render();
      }
    });
  }

  initNumericFields();
  bindEvents();
  render();
})(window);
