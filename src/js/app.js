'use strict';

(function (global) {
  const { config, calculator, database } = global.PayrollStudio;
  const {
    SALARY_FIELDS,
    EXTRA_FIELDS,
    DEDUCT_FIELDS,
    ALL_FIELDS,
    MODES,
    MODE_META,
    DEFAULT_INPUTS,
    ATTENDANCE_RATE,
    formatRupiah,
    formatCompactRupiah,
  } = config;
  const { parsePeriodInputs, calculatePayroll } = calculator;
  const { parseCSV, validateDatabase, escapeCsvCell } = database;

  const $ = (id) => document.getElementById(id);
  const val = (id) => $(id).value;
  const num = (id) => Math.max(0, Number($(id).value) || 0);

  let currentResult = null;
  let employeeDb = [];
  let activeStep = 'contract';
  let viewMode = 'tabs'; // 'tabs' | 'all'
  let toastTimer = null;

  function runLoaderScreen() {
    const loader = $('appLoader');
    const bar = $('loaderBar');
    const hint = $('loaderHint');
    if (!loader || !bar) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      bar.style.width = '100%';
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      return;
    }

    requestAnimationFrame(() => {
      bar.style.width = '68%';
    });

    setTimeout(() => {
      bar.style.width = '100%';
      if (hint) hint.textContent = 'Siap digunakan!';
    }, 320);

    setTimeout(() => {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
    }, 620);
  }

  function showToast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2400);
  }

  function getInitials(name) {
    const parts = String(name || 'K')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'K';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

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
        wrapper.className = 'field';
        wrapper.innerHTML = `
          <label for="${id}">${label}</label>
          <div class="money-input">
            <span class="money-prefix" aria-hidden="true">Rp</span>
            <input type="number" min="0" step="1" id="${id}" value="${defaultValue}" />
          </div>
        `;
        container.append(wrapper);
      }
    }
  }

  function initScenarioCards() {
    const container = $('scenarioCards');
    container.replaceChildren();

    for (const [modeKey, meta] of Object.entries(MODE_META)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scenario-card';
      btn.dataset.mode = modeKey;
      btn.setAttribute('role', 'radio');
      btn.innerHTML = `
        <span class="scenario-card-top">
          <span class="scenario-card-title">${meta.title}</span>
          <span class="scenario-card-tag">${meta.tag}</span>
        </span>
        <span class="scenario-card-desc">${meta.desc}</span>
      `;
      btn.onclick = () => {
        $('mode').value = modeKey;
        render();
      };
      container.append(btn);
    }
  }

  function syncScenarioCards(selectedMode) {
    document.querySelectorAll('.scenario-card').forEach((card) => {
      const isSelected = card.dataset.mode === selectedMode;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-checked', String(isSelected));
    });
  }

  function setStep(step) {
    activeStep = step;
    syncWorkspaceView();
  }

  function setViewMode(mode) {
    viewMode = mode;
    $('viewTabs').classList.toggle('is-active', mode === 'tabs');
    $('viewAll').classList.toggle('is-active', mode === 'all');
    syncWorkspaceView();
  }

  function syncWorkspaceView() {
    const showAll = viewMode === 'all';
    $('stepTabs').classList.toggle('hidden', showAll);

    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.step === activeStep);
    });

    document.querySelectorAll('.step-panel').forEach((panel) => {
      const visible = showAll || panel.dataset.panel === activeStep;
      panel.classList.toggle('hidden', !visible);
    });

    document.querySelectorAll('[data-step-nav]').forEach((nav) => {
      nav.classList.toggle('hidden', showAll);
    });
  }

  function setResultTab(tab) {
    const isBreakdown = tab === 'breakdown';
    $('tabBreakdown').classList.toggle('is-active', isBreakdown);
    $('tabBreakdown').setAttribute('aria-selected', String(isBreakdown));
    $('tabCompare').classList.toggle('is-active', !isBreakdown);
    $('tabCompare').setAttribute('aria-selected', String(!isBreakdown));
    $('paneBreakdown').classList.toggle('hidden', !isBreakdown);
    $('paneCompare').classList.toggle('hidden', isBreakdown);
  }

  function setDbDrawerOpen(open) {
    $('dbDrawer').classList.toggle('hidden', !open);
    $('toggleDb').setAttribute('aria-expanded', String(open));
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

  function appendTableRow(tbody, row) {
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

  function renderPrintSheet(employeeName, mode, result) {
    $('printName').textContent = employeeName;
    $('printPeriodScenario').textContent = `${val('start')} — ${val('end')} · ${MODES[mode]}`;
    $('printNet').textContent = formatRupiah(result.net);
    $('printGross').textContent = formatRupiah(result.gross);
    $('printDeduct').textContent = formatRupiah(result.deductions);

    const dayParts = [];
    if (result.n80) dayParts.push(`${result.n80} hr (80%)`);
    if (result.n100) dayParts.push(`${result.n100} hr (100%)`);
    $('printDays').textContent = `${result.n}/${result.den} hr${dayParts.length ? ' · ' + dayParts.join(' + ') : ''}`;
    $('printAttendance').textContent = `${result.attendance} hr (${formatRupiah(result.attendanceMoney)})`;

    const incomeBody = $('printIncomeBody');
    const deductBody = $('printDeductBody');
    incomeBody.replaceChildren();
    deductBody.replaceChildren();

    for (const row of result.rows) {
      if (row.section === 'income') {
        appendTableRow(incomeBody, row);
      } else if (row.section === 'deduction') {
        appendTableRow(deductBody, row);
      }
    }
  }

  function renderComparisonList(currentMode, currentNet, period, values) {
    const container = $('comparison');
    container.replaceChildren();

    const entries = Object.entries(MODES).map(([modeKey, label]) => {
      try {
        return { modeKey, label, result: calculatePayroll(modeKey, period, values) };
      } catch {
        return { modeKey, label, result: null };
      }
    });

    const maxNet = Math.max(
      1,
      ...entries.map((entry) => (entry.result ? Math.max(0, entry.result.net) : 0))
    );

    for (const { modeKey, label, result } of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'compare-item' + (modeKey === currentMode ? ' is-current' : '');
      btn.onclick = () => {
        $('mode').value = modeKey;
        render();
        showToast(`Skenario diubah: ${label}`);
      };

      const amountText = result
        ? formatRupiah(result.net) + (result.warning ? ' *' : '')
        : '—';

      let badgeHtml = '<span class="delta-badge is-zero">—</span>';
      if (modeKey === currentMode) {
        badgeHtml = '<span class="delta-badge is-active">Sedang Dipilih</span>';
      } else if (result && typeof currentNet === 'number') {
        const diff = result.net - currentNet;
        if (diff > 0) {
          badgeHtml = `<span class="delta-badge is-pos">+${formatRupiah(diff)}</span>`;
        } else if (diff < 0) {
          badgeHtml = `<span class="delta-badge is-neg">−${formatRupiah(Math.abs(diff))}</span>`;
        } else {
          badgeHtml = '<span class="delta-badge is-zero">Sama</span>';
        }
      }

      const barPct = result ? Math.max(0, Math.min(100, (result.net / maxNet) * 100)) : 0;
      const meta = MODE_META[modeKey];

      btn.innerHTML = `
        <span class="compare-top">
          <span class="compare-title">${label}</span>
          <span class="compare-amount">${amountText}</span>
        </span>
        <span class="compare-meta">
          <span>${meta.desc}</span>
          ${badgeHtml}
        </span>
        <span class="compare-bar-track" aria-hidden="true">
          <span class="compare-bar-fill" style="width:${barPct.toFixed(1)}%"></span>
        </span>
      `;
      container.append(btn);
    }
  }

  function render() {
    const mode = val('mode');
    syncScenarioCards(mode);

    document
      .querySelectorAll('.case')
      .forEach((el) => el.classList.toggle('hidden', mode.endsWith('full')));
    $('transitionField').classList.toggle('hidden', mode !== 'transition');

    const employeeName = val('name') || 'Karyawan';
    $('avatarInitials').textContent = getInitials(employeeName);

    const baseSalary = SALARY_FIELDS.reduce((sum, [id]) => sum + num(id), 0);
    $('base80').textContent = formatRupiah(baseSalary * 0.8);
    $('base100').textContent = formatRupiah(baseSalary);
    $('scenarioName').textContent = MODES[mode];
    $('resultName').textContent = `${employeeName} · ${val('start')} — ${val('end')}`;

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
      $('paidDays').textContent = `${result.n} hari`;
      $('count80').textContent = `Kontrak 3 Bln (80%): ${result.n80} hari`;
      $('count100').textContent = `Kontrak 1 Thn (100%): ${result.n100} hari`;
      $('bar80').style.width = `${(100 * result.n80) / result.den}%`;
      $('bar100').style.width = `${(100 * result.n100) / result.den}%`;

      $('attendance').value = result.attendance;
      $('attendanceDaysText').textContent = `${result.attendance} hari`;
      $('attendanceMoneyText').textContent = formatRupiah(result.attendance * ATTENDANCE_RATE);
      $('attendanceMetric').textContent = `${result.attendance} hr`;

      $('net').textContent = formatRupiah(result.net);
      $('gross').textContent = formatRupiah(result.gross);
      $('deductions').textContent = formatRupiah(result.deductions);

      const totalFlow = Math.max(1, result.gross);
      const deductPct = Math.min(100, Math.max(0, (result.deductions / totalFlow) * 100));
      const netPct = Math.max(0, 100 - deductPct);
      $('ratioNet').style.width = `${netPct.toFixed(1)}%`;
      $('ratioDeduct').style.width = `${deductPct.toFixed(1)}%`;

      $('tabBadgeContract').textContent = `${result.n}/${result.den} hr`;
      $('tabBadgeComp').textContent = formatCompactRupiah(result.gross);
      $('tabBadgeDeduct').textContent = formatCompactRupiah(-result.deductions);

      result.rows.forEach((row) => appendTableRow($('breakdown'), row));
      renderComparisonList(mode, result.net, period, values);
      renderPrintSheet(employeeName, mode, result);
    } catch (error) {
      showAlert('dateError', error.message);
      showAlert('resultWarning', error.message);
      showAlert('attendanceError', '');

      for (const id of [
        'net',
        'gross',
        'deductions',
        'attendanceMetric',
        'workdays',
        'paidDays',
        'count80',
        'count100',
      ]) {
        $(id).textContent = '—';
      }
      $('attendance').value = '';
      $('attendanceDaysText').textContent = '—';
      $('attendanceMoneyText').textContent = '—';
      $('bar80').style.width = '0%';
      $('bar100').style.width = '0%';
      $('ratioNet').style.width = '0%';
      $('ratioDeduct').style.width = '0%';
      $('tabBadgeContract').textContent = '!';
    }

    const actionsDisabled = !currentResult || Boolean(currentResult.warning);
    for (const id of ['print', 'topPrint', 'export', 'copy']) {
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
    if ($('quickEmployee')) {
      $('quickEmployee').value = '';
    }
    $('autoBpjs').checked = true;
    render();
    showToast('Simulasi dikembalikan ke contoh awal.');
  }

  function syncEmployeeSelects() {
    const hasDb = employeeDb.length > 0;
    const selects = [$('employee'), $('quickEmployee')];

    for (const sel of selects) {
      sel.replaceChildren(new Option('Isi manual', ''));
      employeeDb.forEach((record, index) => {
        sel.add(new Option(`${record.name} · ${record.id}`, String(index)));
      });
    }

    $('dbCountBadge').textContent = String(employeeDb.length);
    $('dbCountBadge').classList.toggle('hidden', !hasDb);
    $('quickEmpStrip').classList.toggle('hidden', !hasDb);
  }

  async function processUploadedFile(file) {
    if (!file) return;
    const statusEl = $('dbstatus');
    statusEl.className = 'status-text';

    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.json')
        ? JSON.parse(text)
        : parseCSV(text);

      employeeDb = validateDatabase(parsed);
      syncEmployeeSelects();

      statusEl.textContent = `${employeeDb.length} karyawan berhasil dibaca dari ${file.name}.`;
      statusEl.classList.add('is-ok');
      showToast(`${employeeDb.length} karyawan siap dipilih.`);
    } catch (error) {
      statusEl.textContent = 'Impor gagal: ' + error.message;
      statusEl.classList.add('is-err');
      showToast('Gagal membaca file data karyawan.');
    }
  }

  function applyEmployeeIndex(selectedIndex) {
    $('employee').value = selectedIndex;
    $('quickEmployee').value = selectedIndex;
    if (selectedIndex === '') return;

    const record = employeeDb[Number(selectedIndex)];
    if (!record) return;

    $('name').value = record.name;
    for (const [key] of ALL_FIELDS) {
      $(key).value = record[key];
    }
    render();
    showToast(`Data ${record.name} diterapkan.`);
  }

  function handleClearDatabase() {
    employeeDb = [];
    syncEmployeeSelects();
    $('file').value = '';
    const statusEl = $('dbstatus');
    statusEl.className = 'status-text';
    statusEl.textContent = 'Data sesi dihapus. Nilai input saat ini tetap dipertahankan.';
    showToast('Data sesi dihapus.');
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
    link.download = 'simulasi-gaji.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('File CSV berhasil diekspor.');
  }

  async function handleCopySummary() {
    if (!currentResult) return;

    try {
      const header = `${val('name')} | ${MODES[val('mode')]} | ${val('start')} – ${val('end')}\n`;
      const body = currentResult.rows
        .map((row) => `${row.label}: ${formatRupiah(row.amount)}`)
        .join('\n');

      await navigator.clipboard.writeText(header + body);
      showToast('Ringkasan gaji berhasil disalin.');
    } catch {
      showToast('Tidak dapat menyalin; gunakan Ekspor CSV.');
    }
  }

  function bindEvents() {
    $('toggleDb').onclick = () => setDbDrawerOpen($('dbDrawer').classList.contains('hidden'));
    $('closeDb').onclick = () => setDbDrawerOpen(false);

    $('viewTabs').onclick = () => setViewMode('tabs');
    $('viewAll').onclick = () => setViewMode('all');

    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.onclick = () => setStep(tab.dataset.step);
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.onclick = () => {
        setStep(btn.dataset.goto);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    $('tabBreakdown').onclick = () => setResultTab('breakdown');
    $('tabCompare').onclick = () => setResultTab('compare');

    $('file').onchange = () => processUploadedFile($('file').files[0]);

    const dropzone = $('dropzone');
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files?.[0];
      if (file) processUploadedFile(file);
    });

    $('employee').onchange = (e) => applyEmployeeIndex(e.target.value);
    $('quickEmployee').onchange = (e) => applyEmployeeIndex(e.target.value);
    $('clearDb').onclick = handleClearDatabase;

    $('reset').onclick = resetSimulation;
    $('print').onclick = () => window.print();
    $('topPrint').onclick = () => window.print();
    $('export').onclick = handleExportCsv;
    $('copy').onclick = handleCopySummary;

    document.addEventListener('input', (event) => {
      if (
        event.target.matches('input:not([type=file]),select') &&
        event.target.id !== 'employee' &&
        event.target.id !== 'quickEmployee'
      ) {
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
  initScenarioCards();
  bindEvents();
  syncWorkspaceView();
  render();
  runLoaderScreen();
})(window);
