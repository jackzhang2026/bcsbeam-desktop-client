import { Button } from "antd";
import { t } from "i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import login_bg from "@/assets/images/login/login_bg.png";
import WindowControlBar from "@/components/WindowControlBar";
import { APP_NAME, APP_VERSION, SDK_VERSION } from "@/config";
import { feedbackToast } from "@/utils/common";
import { setIMProfile } from "@/utils/storage";

import styles from "./index.module.scss";

// Phase 1 (TASK-062): sign-in delegates entirely to the real customer-portal
// login page (opened in its own window by the main process) instead of a
// native form — see electron/main/portalLoginWindow.ts and NOTICE.md's
// "Login architecture finding" for why. This intentionally drops the old
// OpenIM-demo phone/email/register/reset flow (LoginForm/RegisterForm/
// ModifyForm) — those talked to OpenIM's own demo "chat" backend, which BCS
// Beam never runs.
export const Login = () => {
  const navigate = useNavigate();
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
      const { openimUserID, token } = await window.electronAPI.portalLogin();
      setIMProfile({ chatToken: "", imToken: token, userID: openimUserID });
      navigate("/chat");
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
          <Button
            type="primary"
            size="large"
            block
            loading={signingIn}
            onClick={() => void handleSignIn()}
          >
            {signingIn ? "Signing in…" : "Sign in with BCS Beam Portal"}
          </Button>
          <div className="mt-4 text-center text-xs text-gray-400">
            Opens your existing customer portal login in a new window.
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

const LeftBar = () => {
  return (
    <div className="flex min-h-[420]">
      <div className="mr-14 text-center">
        <div className="text-2xl">{t("placeholder.title")}</div>
        <span className="text-sm  text-gray-400">{t("placeholder.subTitle")}</span>
        <img src={login_bg} alt="login_bg" />
      </div>
    </div>
  );
};
