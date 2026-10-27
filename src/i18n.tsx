import { createContext, useContext } from "react";
export type Language = "zh-CN" | "zh-TW" | "en";
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
