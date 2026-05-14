// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface MeineGewohnheiten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    gewohnheit_name?: string;
    gewohnheit_kategorie?: string;
    gewohnheit_beschreibung?: string;
    gewohnheit_icon?: string;
    gewohnheit_aktiv?: boolean;
  };
}

export interface TaeglicherCheckIn {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    erledigte_gewohnheiten?: string;
    stimmung?: LookupValue;
    anzahl_erledigt?: number;
    notizen?: string;
    motto?: string;
  };
}

export const APP_IDS = {
  MEINE_GEWOHNHEITEN: '6a05eab89a466f5a8cf44662',
  TAEGLICHER_CHECK_IN: '6a05eabcff4368d63491383b',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'taeglicher_check_in': {
    stimmung: [{ key: "super", label: "😊 Super" }, { key: "gut", label: "🙂 Gut" }, { key: "okay", label: "😐 Okay" }, { key: "nicht_so_gut", label: "😕 Nicht so gut" }, { key: "schlecht", label: "😞 Schlecht" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'meine_gewohnheiten': {
    'gewohnheit_name': 'string/text',
    'gewohnheit_kategorie': 'string/text',
    'gewohnheit_beschreibung': 'string/textarea',
    'gewohnheit_icon': 'string/text',
    'gewohnheit_aktiv': 'bool',
  },
  'taeglicher_check_in': {
    'datum': 'date/date',
    'erledigte_gewohnheiten': 'multipleapplookup/select',
    'stimmung': 'lookup/radio',
    'anzahl_erledigt': 'number',
    'notizen': 'string/textarea',
    'motto': 'string/text',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMeineGewohnheiten = StripLookup<MeineGewohnheiten['fields']>;
export type CreateTaeglicherCheckIn = StripLookup<TaeglicherCheckIn['fields']>;