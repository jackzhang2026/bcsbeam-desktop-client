import { useMount } from "ahooks";
import { Layout, Spin } from "antd";
import { t } from "i18next";
import { Outlet, useMatches, useNavigate } from "react-router-dom";

import { usePortalTypeStore, useUserStore } from "@/store";
import { getDefaultRouteForPortalType } from "@/types/portal";

import LeftNavBar from "./LeftNavBar";
import TopSearchBar from "./TopSearchBar";
import { useGlobalEvent } from "./useGlobalEvents";

export const MainContentLayout = () => {
  useGlobalEvent();
  const matches = useMatches();
  const navigate = useNavigate();

  const progress = useUserStore((state) => state.progress);
  const syncState = useUserStore((state) => state.syncState);
  const reinstall = useUserStore((state) => state.reinstall);
  const isLogining = useUserStore((state) => state.isLogining);
  // TASK-062 (2026-08-28): falls back to "customer" for the same reason
  // LeftNavBar/index.tsx does — defensive only, this layout never mounts
  // pre-login (see routes/index.tsx: it's nested under the authenticated tree).
  const portalType = usePortalTypeStore((state) => state.portalType) ?? "customer";

  useMount(() => {
    const isRoot = !matches.find((item) => item.pathname !== "/");
    // A mid-conversation deep link only makes sense for the customer portal's
    // chat — staff/vendor never have a "chat" route to be in at all.
    const inConversation =
      portalType === "customer" && matches.some((item) => item.params.conversationID);
    if (isRoot || inConversation) {
      navigate(getDefaultRouteForPortalType(portalType), {
        replace: true,
      });
    }
  });

  const loadingTip = isLogining ? t("toast.loading") : `${progress}%`;
  const showLockLoading = isLogining || (reinstall && syncState === "loading");

  return (
    <Spin className="!max-h-none" spinning={showLockLoading} tip={loadingTip}>
      <Layout className="h-full">
        <TopSearchBar />
        <Layout>
          <LeftNavBar />
          <Outlet />
        </Layout>
      </Layout>
    </Spin>
  );
};
