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
    ['basic', 'Gaji Pokok', 2400000],
    ['position', 'Tunjangan Jabatan', 1000000],
    ['grade', 'Tunjangan Grade', 800000],
    ['group', 'Tunjangan Golongan', 200000],
    ['communication', 'Tunjangan Komunikasi', 200000],
    ['otherFixed', 'Tunjangan Tetap Lainnya', 0],
  ];

  const EXTRA_FIELDS = [
    ['incentive', 'Insentif', 0],
    ['bonus', 'Bonus', 0],
    ['dutyMoney', 'Uang Dinas', 0],
    ['otherIncome', 'Tambahan Lainnya', 0],
  ];

  const DEDUCT_FIELDS = [
    ['bpjsTK', 'BPJS Ketenagakerjaan', 90000],
    ['bpjsKes', 'BPJS Kesehatan', 48787],
    ['tax', 'PPh 21 (Pajak)', 0],
    ['otherDeduction', 'Potongan Lainnya', 0],
  ];

  const ALL_FIELDS = [...SALARY_FIELDS, ...EXTRA_FIELDS, ...DEDUCT_FIELDS];

  const MODES = {
    '80full': 'Kontrak 3 Bulan · Penuh (80%)',
    '80pro': 'Kontrak 3 Bulan · Sesuai Hari Kerja (80%)',
    transition: 'Pindah Kontrak 3 Bulan → 1 Tahun (80% ke 100%)',
    '100full': 'Kontrak 1 Tahun · Penuh (100%)',
    '100pro': 'Kontrak 1 Tahun · Sesuai Hari Kerja (100%)',
  };

  const MODE_META = {
    '80full': {
      title: 'Kontrak 3 Bulan · Penuh',
      tag: 'Tarif 80%',
      desc: 'Masuk penuh 1 periode, terima 80% gaji bulanan',
    },
    '80pro': {
      title: 'Kontrak 3 Bulan · Sebagian Hari',
      tag: '80% Sesuai Hari',
      desc: 'Dihitung sesuai jumlah hari aktif kerja (tarif 80%)',
    },
    transition: {
      title: 'Pindah Kontrak 3 Bulan → 1 Tahun',
      tag: '80% → 100%',
      desc: 'Hari awal tarif 80%, mulai tanggal efektif naik jadi 100%',
    },
    '100full': {
      title: 'Kontrak 1 Tahun · Penuh',
      tag: 'Tarif 100%',
      desc: 'Masuk penuh 1 periode, terima 100% gaji bulanan',
    },
    '100pro': {
      title: 'Kontrak 1 Tahun · Sebagian Hari',
      tag: '100% Sesuai Hari',
      desc: 'Dihitung sesuai jumlah hari aktif kerja (tarif 100%)',
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
