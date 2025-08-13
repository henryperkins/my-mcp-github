// src/utils/languageAnalyzers.ts
export const languageAnalyzers: Record<string, string> = {
  english: 'en.microsoft',
  french: 'fr.microsoft',
  german: 'de.microsoft',
  spanish: 'es.microsoft',
  italian: 'it.microsoft',
  portuguese: 'pt-BR.microsoft',
  dutch: 'nl.microsoft',
  russian: 'ru.microsoft',
  japanese: 'ja.microsoft',
  chinese: 'zh-Hans.microsoft',
  korean: 'ko.microsoft',
  arabic: 'ar.microsoft',
  hindi: 'hi.microsoft'
};

export function resolveAnalyzerForLanguage(language?: string, defaultAnalyzer = 'standard.lucene'): string | undefined {
  if (!language) return undefined;
  const key = language.toLowerCase();
  return languageAnalyzers[key] ?? defaultAnalyzer;
}