const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toDevanagariDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\d/g, (d) => DEVANAGARI_DIGITS[Number(d)] ?? d);
}

export function toAsciiDigits(value: string): string {
  return value.replace(/[०-९]/g, (ch) => String(DEVANAGARI_DIGITS.indexOf(ch)));
}

export function formatNum(value: number | string | null | undefined, lang: 'ne' | 'en'): string {
  if (value === null || value === undefined || value === '') return lang === 'ne' ? '०' : '0';
  const str = String(value);
  return lang === 'ne' ? toDevanagariDigits(str) : str;
}

export function formatPct(value: number, lang: 'ne' | 'en', decimals = 1): string {
  const fixed = Number.isFinite(value) ? value.toFixed(decimals) : '0.0';
  return `${lang === 'ne' ? toDevanagariDigits(fixed) : fixed}%`;
}

export const BS_MONTHS_NP = [
  'वैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भदौ',
  'असोज',
  'कात्तिक',
  'मंसिर',
  'पुस',
  'माघ',
  'फागुन',
  'चैत',
];

export const BS_MONTHS_EN = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

export const QUARTERS_META = [
  {
    quarter: 1 as const,
    name_np: 'पहिलो त्रैमासिक (श्रावण–असोज)',
    short_np: 'पहिलो',
    name_en: 'Q1 (Shrawan–Ashwin)',
    range_np: 'श्रावण १ देखि असोज मसान्त सम्म',
    range_en: 'Shrawan 1 to Ashwin End',
  },
  {
    quarter: 2 as const,
    name_np: 'दोस्रो त्रैमासिक (कात्तिक–पुस)',
    short_np: 'दोस्रो',
    name_en: 'Q2 (Kartik–Poush)',
    range_np: 'कात्तिक १ देखि पुस मसान्त सम्म',
    range_en: 'Kartik 1 to Poush End',
  },
  {
    quarter: 3 as const,
    name_np: 'तेस्रो त्रैमासिक (माघ–चैत)',
    short_np: 'तेस्रो',
    name_en: 'Q3 (Magh–Chaitra)',
    range_np: 'माघ १ देखि चैत मसान्त सम्म',
    range_en: 'Magh 1 to Chaitra End',
  },
  {
    quarter: 4 as const,
    name_np: 'चौथो त्रैमासिक (वैशाख–असार)',
    short_np: 'चौथो',
    name_en: 'Q4 (Baisakh–Ashadh)',
    range_np: 'वैशाख १ देखि असार मसान्त सम्म',
    range_en: 'Baisakh 1 to Ashadh End',
  },
];

// Approximate BS date from current AD date for 2024-2028
export function getCurrentBsDate(useDevanagari = false): string {
  const now = new Date();
  // 2026-11-26 is approximately 2083-08-10 BS (Mangsir 10, 2083)
  const adYear = now.getFullYear();
  const adMonth = now.getMonth() + 1;
  const adDay = now.getDate();

  let bsYear = adYear + 56;
  let bsMonth = adMonth + 8;
  let bsDay = adDay + 16;

  if (bsDay > 30) {
    bsDay -= 30;
    bsMonth += 1;
  }
  if (bsMonth > 12) {
    bsMonth -= 12;
    bsYear += 1;
  }

  const mm = String(bsMonth).padStart(2, '0');
  const dd = String(bsDay).padStart(2, '0');
  const formatted = `${bsYear}/${mm}/${dd}`;
  return useDevanagari ? toDevanagariDigits(formatted) : formatted;
}

export function formatBsDateDisplay(dateStr: string | null | undefined, lang: 'ne' | 'en'): string {
  if (!dateStr) return '—';
  return lang === 'ne' ? toDevanagariDigits(dateStr) : toAsciiDigits(dateStr);
}
