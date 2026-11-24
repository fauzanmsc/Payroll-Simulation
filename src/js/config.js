'use strict';

(function (global) {
  const PayrollStudio = (global.PayrollStudio = global.PayrollStudio || {});

  const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });

  const COMPACT_FORMATTER = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const SALARY_FIELDS = [
    ['basic', 'Gaji pokok', 2400000],
    ['position', 'Tunjangan jabatan', 1000000],
    ['grade', 'Tunjangan grade', 800000],
    ['group', 'Tunjangan golongan', 200000],
    ['communication', 'Tunjangan komunikasi', 200000],
    ['otherFixed', 'Tunjangan tetap lainnya', 0],
  ];

  const EXTRA_FIELDS = [
    ['incentive', 'Insentif', 0],
    ['bonus', 'Bonus', 0],
    ['dutyMoney', 'Uang dinas', 0],
    ['otherIncome', 'Pendapatan lainnya', 0],
  ];

  const DEDUCT_FIELDS = [
    ['bpjsTK', 'BPJS Ketenagakerjaan', 90000],
    ['bpjsKes', 'BPJS Kesehatan', 48787],
    ['tax', 'PPh 21', 0],
    ['otherDeduction', 'Potongan lainnya', 0],
  ];

  const ALL_FIELDS = [...SALARY_FIELDS, ...EXTRA_FIELDS, ...DEDUCT_FIELDS];

  const MODES = {
    '80full': 'Kontrak 3 bulan · Full',
    '80pro': 'Kontrak 3 bulan · Prorata',
    transition: 'Transisi 3 bulan → 1 tahun · Prorata',
    '100full': 'Kontrak 1 tahun · Full',
    '100pro': 'Kontrak 1 tahun · Prorata',
  };

  const MODE_META = {
    '80full': {
      title: 'Kontrak 3 Bulan',
      tag: '80% Full',
      desc: 'Periode penuh tanpa prorata',
    },
    '80pro': {
      title: 'Kontrak 3 Bulan',
      tag: '80% Prorata',
      desc: 'Berdasarkan hari aktif kerja',
    },
    transition: {
      title: 'Transisi 3 Bln → 1 Thn',
      tag: '80% → 100%',
      desc: 'Berubah tarif di tanggal efektif',
    },
    '100full': {
      title: 'Kontrak 1 Tahun',
      tag: '100% Full',
      desc: 'Periode penuh tarif 100%',
    },
    '100pro': {
      title: 'Kontrak 1 Tahun',
      tag: '100% Prorata',
      desc: 'Tarif 100% sesuai hari aktif',
    },
  };

  const DEFAULT_INPUTS = {
    name: 'Karyawan Contoh',
    start: '2026-10-24',
    end: '2026-11-23',
    mode: 'transition',
    activeStart: '',
    activeEnd: '',
    transition: '2026-11-13',
    holidays: '',
    dutyDays: 2,
    absence: 0,
    employee: '',
  };

  const ATTENDANCE_RATE = 25000;

  function formatRupiah(amount) {
    return CURRENCY_FORMATTER.format(amount);
  }

  function formatCompactRupiah(amount) {
    if (amount === 0) return 'Rp0';
    const prefix = amount < 0 ? '-Rp' : 'Rp';
    return prefix + COMPACT_FORMATTER.format(Math.abs(amount));
  }

  PayrollStudio.config = {
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
