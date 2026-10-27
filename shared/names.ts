import type { Language, Match, Team } from "./types";

/** Display translations never replace canonical names used by the parser. */
export function translatedName(
  original: string,
  english: string | undefined,
  language: Language,
): string {
  return language === "en" && english?.trim() ? english.trim() : original;
}
export function teamDisplayName(team: Team, language: Language): string {
  return translatedName(team.name, team.englishName, language);
}
export function matchDisplayName(match: Match, language: Language): string {
  return translatedName(match.title, match.englishTitle, language);
}
export function competitionDisplayName(
  match: Match,
  language: Language,
): string {
  const known: Record<string, string> = {
    英超: "Premier League",
    西甲: "La Liga",
  };
  return translatedName(
    match.competition,
    match.englishCompetition || known[match.competition],
    language,
  );
}
export function sourceDisplayName(match: Match, language: Language): string {
  return translatedName(match.source, match.englishSource, language);
}
export function teamSecondaryName(team: Team, language: Language): string {
  const secondary =
    language === "en" ? team.short : team.englishName || team.short;
  return secondary === teamDisplayName(team, language) ? "" : secondary;
}
export function matchMatchesQuery(
  match: Match,
  query: string,
  localizedNames: string[] = [],
): boolean {
  const text = [
    match.title,
    match.englishTitle,
    match.competition,
    match.englishCompetition,
    match.home.name,
    match.home.englishName,
    match.home.short,
    match.away.name,
    match.away.englishName,
    match.away.short,
    ...localizedNames,
  ]
    .filter(Boolean)
    .join(" ");
  return text.toLowerCase().includes(query.trim().toLowerCase());
}
