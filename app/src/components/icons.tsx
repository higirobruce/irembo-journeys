/* Friendly line icons. AgencyIcons: one per office (on every node). JourneyIcons: one per goal card. */
import type { ReactNode } from "react";

const S = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);

export const AgencyIcons: Record<string, ReactNode> = {
  self: S(<g><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /></g>),
  nida: S(<g><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16c.5-1.6 1.8-2.4 3-2.4s2.5.8 3 2.4M14.5 9.5h4M14.5 13h3" /></g>),
  rdb: S(<g><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-5h6v5" /><path d="M9 10.5h.01M15 10.5h.01" /></g>),
  rra: S(<g><path d="M6 3h9l4 4v14H6z" /><path d="M9 9h6M9 12.5h6M9 16h4" /></g>),
  district: S(<g><path d="M3 21h18M5 21V10l7-4 7 4v11" /><path d="M9 21v-6h6v6" /></g>),
  health: S(<g><path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21z" /><path d="M12 10v4M10 12h4" /></g>),
  rssb: S(<g><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9.5 11.5l1.8 1.8 3.2-3.4" /></g>),
  bank: S(<g><path d="M3 9l9-5 9 5" /><path d="M5 9v8M9.5 9v8M14.5 9v8M19 9v8" /><path d="M3 20h18" /></g>),
  rlmua: S(<g><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></g>),
  notary: S(<g><path d="M12 3v6M9 9h6l-1 4h-4z" /><path d="M7 21c0-3 2-4 5-4s5 1 5 4z" /><path d="M10 13h4" /></g>),
  civil: S(<g><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /><circle cx="17" cy="17" r="2.4" fill="none" /></g>),
  police: S(<g><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M12 8v6M9 11h6" /></g>),
  immigration: S(<g><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" /></g>),
  court: S(<g><path d="M12 3v18M5 21h14M7 10l-2.5 4.5a3 3 0 0 0 5 0L7 10zM17 10l-2.5 4.5a3 3 0 0 0 5 0L17 10z" /><path d="M5 7h14M8 5l8-2" /></g>),
};

export const JourneyIcons: Record<string, ReactNode> = {
  business: S(<g><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" /><path d="M9 11h.01M15 11h.01" /></g>),
  land: S(<g><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v6l9 4 9-4V7" /><path d="M12 11v10" /></g>),
  birth: S(<g><circle cx="12" cy="8" r="4" /><path d="M5 21c0-4 3-7 7-7s7 3 7 7" /></g>),
  passport: S(<g><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M9 17h6" /></g>),
  driving: S(<g><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M13 10h5M13 14h5" /></g>),
  marriage: S(<g><circle cx="8" cy="14" r="5" /><circle cx="16" cy="14" r="5" /><path d="M8 3l2 4M16 3l-2 4" /></g>),
};
