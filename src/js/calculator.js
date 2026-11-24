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
      throw new Error('Periksa tanggal periode gaji (maksimal 367 hari).');
    }

    if (holidays.some((h) => !isValidDate(h))) {
      throw new Error('Format tanggal hari libur tidak valid (gunakan YYYY-MM-DD).');
    }

    const work = buildWorkCalendar(start, end, new Set(holidays));
    if (!work.length) {
      throw new Error('Tidak ada hari kerja dalam periode yang dipilih.');
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
      throw new Error('Periksa tanggal mulai/akhir masuk kerja.');
    }

    if (mode === 'transition' && !isValidDate(period.t)) {
      throw new Error('Isi tanggal mulai kontrak 1 tahun (tarif 100%).');
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

    const phases = [
      ['Kontrak 3 Bln (80%)', 'Subtotal Kontrak 3 Bulan (80%)', n80, 0.8],
      ['Kontrak 1 Thn (100%)', 'Subtotal Kontrak 1 Tahun (100%)', n100, 1],
    ];

    for (const [phaseTag, subtotalLabel, days, rate] of phases) {
      if (!days) continue;

      const factor = (rate * days) / den;
      const subtotal = Math.round(base * factor);
      let used = 0;
      const nonzero = SALARY_FIELDS.filter(([id]) => getAmount(id) > 0);
      const showPrefix = mode === 'transition';

      nonzero.forEach(([id, label], index) => {
        const componentVal = getAmount(id);
        const amount =
          index === nonzero.length - 1 ? subtotal - used : Math.round(componentVal * factor);
        used += amount;
        rows.push({
          label: showPrefix ? `${phaseTag} · ${label}` : label,
          detail: `${formatRupiah(componentVal)} × ${rate * 100}% × ${days}/${den} hari`,
          amount,
          section: 'income',
        });
      });

      rows.push({
        label: subtotalLabel,
        detail: `${days} dari ${den} hari kerja`,
        amount: subtotal,
        type: 'total',
        section: 'income',
      });
      fixedTotal += subtotal;
    }

    const duty = Math.floor(getAmount('dutyDays'));
    const abs = Math.floor(getAmount('absence'));
    const attendance = Math.max(0, n - duty - abs);
    const attendanceMoney = attendance * ATTENDANCE_RATE;

    rows.push({
      label: 'Tunjangan Kehadiran',
      detail: `${n} hari − ${duty} dinas − ${abs} absen = ${attendance} hari × Rp25.000`,
      amount: attendanceMoney,
      section: 'income',
    });

    let gross = fixedTotal + attendanceMoney;
    for (const [id, label] of EXTRA_FIELDS) {
      const amount = Math.round(getAmount(id));
      gross += amount;
      rows.push({
        label,
        amount,
        section: 'income',
      });
    }

    rows.push({
      label: 'Total Pendapatan (Kotor)',
      amount: gross,
      type: 'total',
      section: 'income',
    });

    let deductions = 0;
    for (const [id, label] of DEDUCT_FIELDS) {
      const exempt = mode.startsWith('80') && Boolean(values.autoBpjs) && id.startsWith('bpjs');
      const amount = exempt ? 0 : Math.round(getAmount(id));
      deductions += amount;
      rows.push({
        label,
        detail: exempt ? 'Tidak dipotong (pilihan simulasi kontrak 3 bulan)' : '',
        amount: -amount,
        type: 'negative',
        section: 'deduction',
      });
    }

    rows.push({
      label: 'Total Potongan',
      amount: -deductions,
      type: 'total',
      section: 'deduction',
    });

    const net = gross - deductions;
    rows.push({
      label: 'Gaji Bersih Diterima',
      amount: net,
      type: 'net',
      section: 'net',
    });

    const warning =
      duty + abs > n
        ? 'Jumlah hari dinas + absen melebihi hari kerja dibayar. Periksa kembali angka input.'
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
      attendanceMoney,
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
