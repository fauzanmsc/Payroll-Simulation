'use strict';

(function (global) {
  const PayrollStudio = (global.PayrollStudio = global.PayrollStudio || {});
  const { SALARY_FIELDS, EXTRA_FIELDS, DEDUCT_FIELDS, ATTENDANCE_RATE, formatRupiah } =
    PayrollStudio.config;

  const MS_PER_DAY = 86400000;

  function isValidDate(dateStr) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(dateStr) &&
      !Number.isNaN(Date.parse(dateStr)) &&
      new Date(dateStr + 'T00:00:00Z').toISOString().slice(0, 10) === dateStr
    );
  }

  function buildWorkCalendar(start, end, holidaySet) {
    const dates = [];
    for (let t = Date.parse(start); t <= Date.parse(end); t += MS_PER_DAY) {
      const date = new Date(t);
      const iso = date.toISOString().slice(0, 10);
      if (date.getUTCDay() !== 0 && !holidaySet.has(iso)) {
        dates.push(iso);
      }
    }
    return dates;
  }

  function parsePeriodInputs({ start, end, activeStart, activeEnd, transition, holidaysRaw }) {
    const holidays = holidaysRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (
      !isValidDate(start) ||
      !isValidDate(end) ||
      start > end ||
      (Date.parse(end) - Date.parse(start)) / MS_PER_DAY > 366
    ) {
      throw new Error('Periksa periode payroll (maksimal 367 hari).');
    }

    if (holidays.some((h) => !isValidDate(h))) {
      throw new Error('Format hari libur tambahan tidak valid.');
    }

    const work = buildWorkCalendar(start, end, new Set(holidays));
    if (!work.length) {
      throw new Error('Tidak ada hari kerja dalam periode payroll.');
    }

    return {
      s: start,
      e: end,
      a: activeStart,
      b: activeEnd,
      t: transition,
      work,
    };
  }

  function calculatePayroll(mode, period, values) {
    const isFull = mode.endsWith('full');

    if (
      !isFull &&
      ((period.a && !isValidDate(period.a)) ||
        (period.b && !isValidDate(period.b)) ||
        (period.a && period.b && period.a > period.b))
    ) {
      throw new Error('Periksa tanggal hak upah.');
    }

    if (mode === 'transition' && !isValidDate(period.t)) {
      throw new Error('Isi tanggal efektif kontrak 1 tahun.');
    }

    const activeDays = isFull
      ? period.work
      : period.work.filter((day) => (!period.a || day >= period.a) && (!period.b || day <= period.b));

    const n = activeDays.length;
    const den = period.work.length;
    const n80 = mode.startsWith('80')
      ? n
      : mode === 'transition'
        ? activeDays.filter((day) => day < period.t).length
        : 0;
    const n100 = n - n80;

    const getAmount = (key) => Math.max(0, Number(values[key]) || 0);
    const rows = [];
    const base = SALARY_FIELDS.reduce((sum, [id]) => sum + getAmount(id), 0);
    let fixedTotal = 0;

    for (const [code, days, rate] of [
      ['A80', n80, 0.8],
      ['A100', n100, 1],
    ]) {
      if (!days) continue;

      const factor = (rate * days) / den;
      const subtotal = Math.round(base * factor);
      let used = 0;
      const nonzero = SALARY_FIELDS.filter(([id]) => getAmount(id) > 0);

      nonzero.forEach(([id, label], index) => {
        const componentVal = getAmount(id);
        const amount =
          index === nonzero.length - 1 ? subtotal - used : Math.round(componentVal * factor);
        used += amount;
        rows.push({
          label: `${code} · ${label}`,
          detail: `${formatRupiah(componentVal)} × ${rate * 100}% × ${days}/${den}`,
          amount,
        });
      });

      rows.push({
        label: `Subtotal ${code}`,
        detail: `${days} hari kerja / ${den} hari`,
        amount: subtotal,
        type: 'total',
      });
      fixedTotal += subtotal;
    }

    const duty = Math.floor(getAmount('dutyDays'));
    const abs = Math.floor(getAmount('absence'));
    const attendance = Math.max(0, n - duty - abs);
    const attendanceMoney = attendance * ATTENDANCE_RATE;

    rows.push({
      label: 'Tunjangan kehadiran',
      detail: `${n} − ${duty} dinas − ${abs} absen = ${attendance} hari × Rp25.000`,
      amount: attendanceMoney,
    });

    let gross = fixedTotal + attendanceMoney;
    for (const [id, label] of EXTRA_FIELDS) {
      const amount = Math.round(getAmount(id));
      gross += amount;
      rows.push({ label, amount });
    }

    rows.push({
      label: 'Gross salary',
      amount: gross,
      type: 'total',
    });

    let deductions = 0;
    for (const [id, label] of DEDUCT_FIELDS) {
      const exempt = mode.startsWith('80') && Boolean(values.autoBpjs) && id.startsWith('bpjs');
      const amount = exempt ? 0 : Math.round(getAmount(id));
      deductions += amount;
      rows.push({
        label,
        detail: exempt ? 'Dinonaktifkan sesuai pilihan simulasi' : '',
        amount: -amount,
        type: 'negative',
      });
    }

    rows.push({
      label: 'Total potongan',
      amount: -deductions,
      type: 'total',
    });

    const net = gross - deductions;
    rows.push({
      label: 'Take-home pay',
      amount: net,
      type: 'net',
    });

    const warning =
      duty + abs > n
        ? 'Hari dinas + absen melebihi hari hak upah. Koreksi input; tunjangan sementara Rp0.'
        : '';

    return {
      rows,
      net,
      gross,
      deductions,
      n,
      n80,
      n100,
      den,
      attendance,
      warning,
    };
  }

  PayrollStudio.calculator = {
    isValidDate,
    buildWorkCalendar,
    parsePeriodInputs,
    calculatePayroll,
  };
})(typeof window !== 'undefined' ? window : globalThis);
