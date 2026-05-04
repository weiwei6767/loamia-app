import { cookies } from "next/headers";
import { translate, DEFAULT_LOCALE, type DictKey, type Locale } from "./dict";

export async function getServerLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get("loamia.locale")?.value;
  return v === "zh" || v === "en" ? v : DEFAULT_LOCALE;
}

export async function getServerT() {
  const locale = await getServerLocale();
  return (key: DictKey) => translate(key, locale);
}
