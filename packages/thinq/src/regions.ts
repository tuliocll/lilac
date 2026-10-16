/**
 * País → região do servidor ThinQ (api-<região>.lgthinq.com). Gerado a partir
 * de thinqconnect/country.py (SDK oficial da LG, Apache-2.0 © LG Electronics).
 */
export const REGIONS: Record<string, string> = {
  kic: 'AU BD CN HK ID IN JP KH KR LA LK MM MY NP NZ PH SG TH TW VN',
  aic: 'AG AR AW BB BO BR BS BZ CA CL CO CR CU DM DO EC GD GT GY HN HT JM KN LC MX NI PA PE PR PY SR SV TT US UY VC VE',
  eic: 'AE AF AL AM AO AT AZ BA BE BF BG BH BJ BY CD CF CG CH CI CM CV CY CZ DE DJ DK DZ EE EG ES ET FI FR GA GB GE GH GM GN GQ GR HR HU IE IL IQ IR IS IT JO KE KG KW KZ LB LR LT LU LV LY MA MD ME MK ML MR MT MU MW NE NG NL NO OM PK PL PS PT QA RO RS RU RW SA SD SE SI SK SL SN SO ST SY TD TG TN TR TZ UA UG UZ XK YE ZA ZM',
};

/** 'BR' → 'aic'; null se a LG não atende o país. */
export function regionOf(country: string): string | null {
  const code = country.trim().toUpperCase();
  for (const [region, countries] of Object.entries(REGIONS)) if (countries.split(' ').includes(code)) return region;
  return null;
}
