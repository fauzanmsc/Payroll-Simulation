'use strict';

(function (global) {
  const PayrollStudio = (global.PayrollStudio = global.PayrollStudio || {});

  const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
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

  PayrollStudio.config = {
    SALARY_FIELDS,
    EXTRA_FIELDS,
    DEDUCT_FIELDS,
    ALL_FIELDS,
    MODES,
    DEFAULT_INPUTS,
    ATTENDANCE_RATE,
    formatRupiah,
  };
})(typeof window !== 'undefined' ? window : globalThis);
