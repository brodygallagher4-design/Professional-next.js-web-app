// Country calling codes + national phone-number length rules.
// Single source of truth generated alongside server/countries.mjs — keep in sync.
export interface Country { iso: string; name: string; flag: string; dial: string; min: number; max: number }

export const COUNTRIES: Country[] = [
  { iso: "NG", name: "Nigeria", flag: "\ud83c\uddf3\ud83c\uddec", dial: "+234", min: 10, max: 10 },
  { iso: "US", name: "United States", flag: "\ud83c\uddfa\ud83c\uddf8", dial: "+1", min: 10, max: 10 },
  { iso: "CA", name: "Canada", flag: "\ud83c\udde8\ud83c\udde6", dial: "+1", min: 10, max: 10 },
  { iso: "GB", name: "United Kingdom", flag: "\ud83c\uddec\ud83c\udde7", dial: "+44", min: 10, max: 10 },
  { iso: "GH", name: "Ghana", flag: "\ud83c\uddec\ud83c\udded", dial: "+233", min: 9, max: 9 },
  { iso: "KE", name: "Kenya", flag: "\ud83c\uddf0\ud83c\uddea", dial: "+254", min: 9, max: 9 },
  { iso: "ZA", name: "South Africa", flag: "\ud83c\uddff\ud83c\udde6", dial: "+27", min: 9, max: 9 },
  { iso: "EG", name: "Egypt", flag: "\ud83c\uddea\ud83c\uddec", dial: "+20", min: 10, max: 10 },
  { iso: "MA", name: "Morocco", flag: "\ud83c\uddf2\ud83c\udde6", dial: "+212", min: 9, max: 9 },
  { iso: "DZ", name: "Algeria", flag: "\ud83c\udde9\ud83c\uddff", dial: "+213", min: 9, max: 9 },
  { iso: "TN", name: "Tunisia", flag: "\ud83c\uddf9\ud83c\uddf3", dial: "+216", min: 8, max: 8 },
  { iso: "ET", name: "Ethiopia", flag: "\ud83c\uddea\ud83c\uddf9", dial: "+251", min: 9, max: 9 },
  { iso: "TZ", name: "Tanzania", flag: "\ud83c\uddf9\ud83c\uddff", dial: "+255", min: 9, max: 9 },
  { iso: "UG", name: "Uganda", flag: "\ud83c\uddfa\ud83c\uddec", dial: "+256", min: 9, max: 9 },
  { iso: "RW", name: "Rwanda", flag: "\ud83c\uddf7\ud83c\uddfc", dial: "+250", min: 9, max: 9 },
  { iso: "CM", name: "Cameroon", flag: "\ud83c\udde8\ud83c\uddf2", dial: "+237", min: 9, max: 9 },
  { iso: "CI", name: "Ivory Coast", flag: "\ud83c\udde8\ud83c\uddee", dial: "+225", min: 10, max: 10 },
  { iso: "SN", name: "Senegal", flag: "\ud83c\uddf8\ud83c\uddf3", dial: "+221", min: 9, max: 9 },
  { iso: "BJ", name: "Benin", flag: "\ud83c\udde7\ud83c\uddef", dial: "+229", min: 8, max: 10 },
  { iso: "TG", name: "Togo", flag: "\ud83c\uddf9\ud83c\uddec", dial: "+228", min: 8, max: 8 },
  { iso: "IN", name: "India", flag: "\ud83c\uddee\ud83c\uddf3", dial: "+91", min: 10, max: 10 },
  { iso: "PK", name: "Pakistan", flag: "\ud83c\uddf5\ud83c\uddf0", dial: "+92", min: 10, max: 10 },
  { iso: "BD", name: "Bangladesh", flag: "\ud83c\udde7\ud83c\udde9", dial: "+880", min: 10, max: 10 },
  { iso: "LK", name: "Sri Lanka", flag: "\ud83c\uddf1\ud83c\uddf0", dial: "+94", min: 9, max: 9 },
  { iso: "NP", name: "Nepal", flag: "\ud83c\uddf3\ud83c\uddf5", dial: "+977", min: 10, max: 10 },
  { iso: "CN", name: "China", flag: "\ud83c\udde8\ud83c\uddf3", dial: "+86", min: 11, max: 11 },
  { iso: "JP", name: "Japan", flag: "\ud83c\uddef\ud83c\uddf5", dial: "+81", min: 10, max: 10 },
  { iso: "KR", name: "South Korea", flag: "\ud83c\uddf0\ud83c\uddf7", dial: "+82", min: 9, max: 10 },
  { iso: "PH", name: "Philippines", flag: "\ud83c\uddf5\ud83c\udded", dial: "+63", min: 10, max: 10 },
  { iso: "ID", name: "Indonesia", flag: "\ud83c\uddee\ud83c\udde9", dial: "+62", min: 9, max: 12 },
  { iso: "MY", name: "Malaysia", flag: "\ud83c\uddf2\ud83c\uddfe", dial: "+60", min: 9, max: 10 },
  { iso: "SG", name: "Singapore", flag: "\ud83c\uddf8\ud83c\uddec", dial: "+65", min: 8, max: 8 },
  { iso: "TH", name: "Thailand", flag: "\ud83c\uddf9\ud83c\udded", dial: "+66", min: 9, max: 9 },
  { iso: "VN", name: "Vietnam", flag: "\ud83c\uddfb\ud83c\uddf3", dial: "+84", min: 9, max: 10 },
  { iso: "AE", name: "United Arab Emirates", flag: "\ud83c\udde6\ud83c\uddea", dial: "+971", min: 9, max: 9 },
  { iso: "SA", name: "Saudi Arabia", flag: "\ud83c\uddf8\ud83c\udde6", dial: "+966", min: 9, max: 9 },
  { iso: "QA", name: "Qatar", flag: "\ud83c\uddf6\ud83c\udde6", dial: "+974", min: 8, max: 8 },
  { iso: "KW", name: "Kuwait", flag: "\ud83c\uddf0\ud83c\uddfc", dial: "+965", min: 8, max: 8 },
  { iso: "BH", name: "Bahrain", flag: "\ud83c\udde7\ud83c\udded", dial: "+973", min: 8, max: 8 },
  { iso: "OM", name: "Oman", flag: "\ud83c\uddf4\ud83c\uddf2", dial: "+968", min: 8, max: 8 },
  { iso: "JO", name: "Jordan", flag: "\ud83c\uddef\ud83c\uddf4", dial: "+962", min: 9, max: 9 },
  { iso: "IL", name: "Israel", flag: "\ud83c\uddee\ud83c\uddf1", dial: "+972", min: 9, max: 9 },
  { iso: "TR", name: "Turkey", flag: "\ud83c\uddf9\ud83c\uddf7", dial: "+90", min: 10, max: 10 },
  { iso: "DE", name: "Germany", flag: "\ud83c\udde9\ud83c\uddea", dial: "+49", min: 10, max: 11 },
  { iso: "FR", name: "France", flag: "\ud83c\uddeb\ud83c\uddf7", dial: "+33", min: 9, max: 9 },
  { iso: "IT", name: "Italy", flag: "\ud83c\uddee\ud83c\uddf9", dial: "+39", min: 9, max: 10 },
  { iso: "ES", name: "Spain", flag: "\ud83c\uddea\ud83c\uddf8", dial: "+34", min: 9, max: 9 },
  { iso: "PT", name: "Portugal", flag: "\ud83c\uddf5\ud83c\uddf9", dial: "+351", min: 9, max: 9 },
  { iso: "NL", name: "Netherlands", flag: "\ud83c\uddf3\ud83c\uddf1", dial: "+31", min: 9, max: 9 },
  { iso: "BE", name: "Belgium", flag: "\ud83c\udde7\ud83c\uddea", dial: "+32", min: 8, max: 9 },
  { iso: "CH", name: "Switzerland", flag: "\ud83c\udde8\ud83c\udded", dial: "+41", min: 9, max: 9 },
  { iso: "AT", name: "Austria", flag: "\ud83c\udde6\ud83c\uddf9", dial: "+43", min: 10, max: 11 },
  { iso: "SE", name: "Sweden", flag: "\ud83c\uddf8\ud83c\uddea", dial: "+46", min: 9, max: 9 },
  { iso: "NO", name: "Norway", flag: "\ud83c\uddf3\ud83c\uddf4", dial: "+47", min: 8, max: 8 },
  { iso: "DK", name: "Denmark", flag: "\ud83c\udde9\ud83c\uddf0", dial: "+45", min: 8, max: 8 },
  { iso: "FI", name: "Finland", flag: "\ud83c\uddeb\ud83c\uddee", dial: "+358", min: 9, max: 10 },
  { iso: "PL", name: "Poland", flag: "\ud83c\uddf5\ud83c\uddf1", dial: "+48", min: 9, max: 9 },
  { iso: "CZ", name: "Czechia", flag: "\ud83c\udde8\ud83c\uddff", dial: "+420", min: 9, max: 9 },
  { iso: "RO", name: "Romania", flag: "\ud83c\uddf7\ud83c\uddf4", dial: "+40", min: 9, max: 9 },
  { iso: "GR", name: "Greece", flag: "\ud83c\uddec\ud83c\uddf7", dial: "+30", min: 10, max: 10 },
  { iso: "UA", name: "Ukraine", flag: "\ud83c\uddfa\ud83c\udde6", dial: "+380", min: 9, max: 9 },
  { iso: "RU", name: "Russia", flag: "\ud83c\uddf7\ud83c\uddfa", dial: "+7", min: 10, max: 10 },
  { iso: "BR", name: "Brazil", flag: "\ud83c\udde7\ud83c\uddf7", dial: "+55", min: 10, max: 11 },
  { iso: "MX", name: "Mexico", flag: "\ud83c\uddf2\ud83c\uddfd", dial: "+52", min: 10, max: 10 },
  { iso: "AR", name: "Argentina", flag: "\ud83c\udde6\ud83c\uddf7", dial: "+54", min: 10, max: 10 },
  { iso: "CO", name: "Colombia", flag: "\ud83c\udde8\ud83c\uddf4", dial: "+57", min: 10, max: 10 },
  { iso: "CL", name: "Chile", flag: "\ud83c\udde8\ud83c\uddf1", dial: "+56", min: 9, max: 9 },
  { iso: "PE", name: "Peru", flag: "\ud83c\uddf5\ud83c\uddea", dial: "+51", min: 9, max: 9 },
  { iso: "AU", name: "Australia", flag: "\ud83c\udde6\ud83c\uddfa", dial: "+61", min: 9, max: 9 },
  { iso: "NZ", name: "New Zealand", flag: "\ud83c\uddf3\ud83c\uddff", dial: "+64", min: 8, max: 10 },
];

export const countryByIso = (iso?: string | null): Country | undefined =>
  COUNTRIES.find((c) => c.iso === (iso ?? "").toUpperCase());

/* Validates a national phone number for a country. Returns the normalized
   international number (dial + national digits) or an error message. */
// Flat (non-discriminated) result — this project builds with `strict: false`, so
// TS won't narrow a discriminated union on `!result.ok`; a flat shape keeps
// `.error` / `.e164` always accessible without narrowing.
export function validatePhone(iso: string, raw: string): { ok: boolean; e164?: string; error?: string } {
  const c = countryByIso(iso);
  if (!c) return { ok: false, error: "Select your country." };
  const digits = raw.replace(/[\s\-().]/g, "");
  if (!/^\d+$/.test(digits)) return { ok: false, error: "Phone number can only contain digits." };
  const national = digits.replace(/^0+/, "");
  const span = c.min === c.max ? String(c.min) : c.min + "-" + c.max;
  if (national.length < c.min || national.length > c.max) {
    return { ok: false, error: "A valid " + c.name + " phone number has " + span + " digits." };
  }
  if (/^(\d)\1+$/.test(national)) return { ok: false, error: "Enter a real phone number." };
  return { ok: true, e164: c.dial + national };
}
