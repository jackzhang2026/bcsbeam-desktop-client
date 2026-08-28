import { ShopOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Segmented } from "antd";
import { t } from "i18next";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import brand_mark from "@/assets/images/brand/bcs-beam-mark.png";
import brand_wordmark from "@/assets/images/brand/bcs-beam-wordmark-on-dark.png";
import WindowControlBar from "@/components/WindowControlBar";
import { APP_NAME, APP_VERSION, SDK_VERSION } from "@/config";
import { usePortalTypeStore } from "@/store";
import { getDefaultRouteForPortalType, PortalType } from "@/types/portal";
import { feedbackToast } from "@/utils/common";
import { getStoredPortalType } from "@/utils/portalType";
import { setIMProfile } from "@/utils/storage";

import styles from "./index.module.scss";

// Phase 1 (TASK-062): sign-in delegates entirely to the real portal/main-
// system login page (opened in its own window by the main process) instead
// of a native form — see electron/main/portalLoginWindow.ts and NOTICE.md's
// "Login architecture finding" for why. This intentionally drops the old
// OpenIM-demo phone/email/register/reset flow (LoginForm/RegisterForm/
// ModifyForm) — those talked to OpenIM's own demo "chat" backend, which BCS
// Beam never runs.
//
// Triple-portal extension (2026-08-28): three genuinely different login
// pages/auth transports exist (see portalLoginWindow.ts's top comment) — the
// choice has to be made BEFORE opening the login window, since that's what
// decides which URL loads. Segmented control per CLAUDE.md §6g (a real
// tab-like switcher, filled colorPrimary on the active item, icon on every
// item), defaulting to whichever type this install last signed in as.
const PORTAL_TYPE_OPTIONS: {
  label: string;
  value: PortalType;
  icon: React.ReactNode;
}[] = [
  { label: "Customer", value: "customer", icon: <UserOutlined /> },
  { label: "Staff", value: "staff", icon: <TeamOutlined /> },
  { label: "Vendor", value: "vendor", icon: <ShopOutlined /> },
];

export const Login = () => {
  const navigate = useNavigate();
  const setPortalType = usePortalTypeStore((state) => state.setPortalType);
  const [selectedType, setSelectedType] = useState<PortalType>(
    () => getStoredPortalType() ?? "customer",
  );
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!window.electronAPI) {
      feedbackToast({
        msg: "Sign-in requires the desktop app (no browser fallback yet).",
      });
      return;
    }
    setSigningIn(true);
    try {
      const result = await window.electronAPI.portalLogin(selectedType);
      // Only `customer` carries OpenIM chat credentials — see
      // src/types/portal.ts's PortalLoginResult for why staff/vendor don't.
      if (result.portalType === "customer") {
        setIMProfile({
          chatToken: "",
          imToken: result.token,
          userID: result.openimUserID,
        });
      }
      setPortalType(result.portalType);
      navigate(getDefaultRouteForPortalType(result.portalType));
    } catch (error) {
      feedbackToast({ error, msg: "Sign-in was not completed." });
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="app-drag relative h-10 bg-[var(--top-search-bar)]">
        <WindowControlBar />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <LeftBar />
        <div
          className={`${styles.login} mr-14 flex h-[450px] w-[350px] flex-col items-center justify-center rounded-md p-11`}
          style={{ boxShadow: "0 0 30px rgba(0,0,0,.1)" }}
        >
          <div className="mb-8 text-center text-xl font-medium">{APP_NAME}</div>
          <Segmented
            block
            size="middle"
            className="mb-6"
            options={PORTAL_TYPE_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
              icon: option.icon,
            }))}
            value={selectedType}
            onChange={(value) => setSelectedType(value as PortalType)}
          />
          <Button
            type="primary"
            size="large"
            block
            loading={signingIn}
            onClick={() => void handleSignIn()}
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </Button>
          <div className="mt-4 text-center text-xs text-gray-400">
            Opens your BCS Beam account in a secure window.
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col items-center text-xs">
        <div className="text-[var(--sub-text)]">{`${APP_NAME} ${APP_VERSION}`}</div>
        <div className="text-[var(--sub-text)]">{SDK_VERSION}</div>
      </div>
    </div>
  );
};

// Branded panel paired with the plain sign-in card — same navy/steel-blue
// system already approved for the app icon and the RustDesk-fork installer
// (beam-remote-client/branding/), not a new design. The card to the right
// already shows APP_NAME as its own heading, so this panel leads with the
// wordmark image instead of repeating the name a third time.
const LeftBar = () => {
  return (
    <div
      className="relative mr-14 flex h-[450px] w-[300px] flex-col items-center justify-center overflow-hidden rounded-md px-8 text-center text-white"
      style={{
        background: "linear-gradient(160deg, #16407a 0%, #0a2049 55%, #04101f 100%)",
      }}
    >
      <div className={styles.beam} aria-hidden="true" />
      <div className="relative z-[1] flex flex-col items-center">
        <img className="mb-6" width={64} src={brand_mark} alt="" />
        <img className="mb-8" width={168} src={brand_wordmark} alt="BCS Beam" />
        <div className="text-lg font-medium text-white">{t("placeholder.title")}</div>
        <div className="mt-2 text-sm text-white/60">{t("placeholder.subTitle")}</div>
      </div>
    </div>
  );
};
