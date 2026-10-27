import { createContext, useContext } from "react";
import type { Language, Match, Team } from "../shared/types";
import {
  teamDisplayName,
  matchDisplayName,
  competitionDisplayName,
  sourceDisplayName,
  teamSecondaryName,
} from "../shared/names";
export type { Language } from "../shared/types";
export const LanguageContext = createContext<Language>("zh-CN");
let traditionalConverter = (text: string) => text;
let loading: Promise<void> | undefined;
export function loadTraditional() {
  return (loading ??= import("opencc-js/cn2t").then(({ default: OpenCC }) => {
    traditionalConverter = OpenCC.Converter({ from: "cn", to: "tw" });
  }));
}
export function zhTW(text: string) {
  return traditionalConverter(text);
}
export function useT() {
  const lang = useContext(LanguageContext);
  return (cn: string, en?: string) =>
    lang === "en" ? en || cn : lang === "zh-TW" ? zhTW(cn) : cn;
}
export function useNames() {
  const language = useContext(LanguageContext);
  const t = useT();
  return {
    team: (team: Team) => t(teamDisplayName(team, language)),
    secondary: (team: Team) => t(teamSecondaryName(team, language)),
    match: (match: Match) => t(matchDisplayName(match, language)),
    competition: (match: Match) => t(competitionDisplayName(match, language)),
    source: (match: Match) => t(sourceDisplayName(match, language)),
  };
}
