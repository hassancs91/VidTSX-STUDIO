// ─── Homepage types ───
export type WhatsNewEntryType = 'feature' | 'improvement' | 'fix';

export interface WhatsNewEntry {
  id: string;
  text: string;
  type: WhatsNewEntryType;
}

export interface WhatsNewSection {
  enabled?: boolean;
  appVersion?: string;
  entries?: WhatsNewEntry[];
}

export interface GettingStartedGuide {
  id: string;
  title: string;
  url: string;
}

export interface GettingStartedSection {
  enabled?: boolean;
  guides?: GettingStartedGuide[];
}

export type NewsCategory = 'tutorial' | 'update' | 'tip' | 'announcement';

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: NewsCategory;
  date: string;
  url?: string;
}

export interface NewsAndTipsSection {
  enabled?: boolean;
  items?: NewsItem[];
}

export interface AdImage {
  url: string;
  alt: string;
  position?: 'top' | 'background';
}

export interface AdCta {
  label: string;
  url: string;
}

export interface AdItem {
  id: string;
  title: string;
  body?: string;
  label?: string;
  accentColor?: string;
  image?: AdImage;
  cta?: AdCta;
}

export interface AdsSection {
  enabled?: boolean;
  items?: AdItem[];
}

export interface HomepageData {
  version?: string;
  whatsNew?: WhatsNewSection;
  gettingStarted?: GettingStartedSection;
  newsAndTips?: NewsAndTipsSection;
  ads?: AdsSection;
}

export interface HomepageGetResponse {
  success: boolean;
  data?: HomepageData;
  error?: string;
}
