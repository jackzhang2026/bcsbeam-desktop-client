/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CHAT_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_PORTAL_TICKETS_URL?: string;
  readonly VITE_PORTAL_DEVICES_URL?: string;
  readonly VITE_PORTAL_SECURITY_URL?: string;
  // TASK-062 (2026-08-28) triple-portal Tickets/Contract Rates URL overrides
  // — see src/pages/tickets/index.tsx and src/pages/contractRates/index.tsx.
  readonly VITE_CUSTOMER_TICKETS_URL?: string;
  readonly VITE_STAFF_TICKETS_URL?: string;
  readonly VITE_VENDOR_TICKETS_URL?: string;
  readonly VITE_VENDOR_CONTRACT_RATES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
