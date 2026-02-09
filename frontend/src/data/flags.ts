/** Map team name → ISO 3166-1 alpha-2 code for flagcdn.com */
const FLAGS: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  Croatia: "hr",
  Curacao: "cw",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  Spain: "es",
  Switzerland: "ch",
  Tunisia: "tn",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
};

export const ALL_TEAM_NAMES = Object.keys(FLAGS).sort();

export function getFlagUrl(team: string): string | null {
  const code = FLAGS[team];
  if (!code) return null;
  return `https://flagcdn.com/w80/${code}.png`;
}

export function displayName(team: string): string {
  return FLAGS[team] ? team : "TBD";
}
