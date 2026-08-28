import {
  FileProtectOutlined,
  FileTextOutlined,
  LaptopOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Badge, Divider, Layout, Popover, Upload, UploadProps } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import React, { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ImageResizer from "react-image-file-resizer";
import { UNSAFE_NavigationContext, useResolvedPath } from "react-router-dom";

import { modal } from "@/AntdGlobalComp";
import { updateBusinessUserInfo } from "@/api/login";
import contact_icon from "@/assets/images/nav/nav_bar_contact.png";
import contact_icon_active from "@/assets/images/nav/nav_bar_contact_active.png";
import message_icon from "@/assets/images/nav/nav_bar_message.png";
import message_icon_active from "@/assets/images/nav/nav_bar_message_active.png";
import change_avatar from "@/assets/images/profile/change_avatar.png";
import OIMAvatar from "@/components/OIMAvatar";
import {
  useContactStore,
  useConversationStore,
  usePortalTypeStore,
  useUserStore,
} from "@/store";
import { PortalType } from "@/types/portal";
import { feedbackToast } from "@/utils/common";
import { emit } from "@/utils/events";
import { uploadFile } from "@/utils/imCommon";

import { OverlayVisibleHandle } from "../../hooks/useOverlayVisible";
import About from "./About";
import styles from "./left-nav-bar.module.scss";
import PersonalSettings from "./PersonalSettings";

const { Sider } = Layout;

// Matches the existing nav icon pair's palette exactly (nav_bar_contact.png
// / _active.png: rgb(136,155,177) / rgb(30,116,222)) — Tickets has no PNG
// pair of its own, so it uses a real @ant-design/icons glyph colored to
// match instead of hand-drawing new artwork (CLAUDE.md §6g).
const NAV_ICON_COLOR = "#889BB1";
const NAV_ICON_COLOR_ACTIVE = "#1E74DE";

interface NavItemType {
  icon?: string;
  icon_active?: string;
  iconNode?: React.ReactNode;
  iconNodeActive?: React.ReactNode;
  // TASK-062 (2026-08-28): replaces a resolved `title: string`. The old
  // version was set once at module load and then mutated BY FIXED ARRAY
  // INDEX from an `i18n.on("languageChanged", ...)` listener below — a
  // latent bug the moment this array becomes conditional/filtered (as it now
  // is, by portal type: an index that meant "devices" for one portal type
  // means something else, or nothing, for another). Resolving the string at
  // render time via useTranslation() instead means there's no index to get
  // wrong, and react-i18next's own bindings already re-render on language
  // change for free — the imperative listener this replaces is deleted.
  titleKey: string;
  path: string;
  // Which portal types see this item. Chat/Contact are customer-only today
  // — /api/openim/token/ (PortalAuthentication) has no credential-minting
  // path for a Django-session staff login or a vendor bearer token, so
  // there's nothing to authenticate a Chat tab with for those two yet.
  portals: PortalType[];
}

const NAV_DEFS: NavItemType[] = [
  {
    icon: message_icon,
    icon_active: message_icon_active,
    titleKey: "placeholder.chat",
    path: "/chat",
    portals: ["customer"],
  },
  {
    icon: contact_icon,
    icon_active: contact_icon_active,
    titleKey: "placeholder.contact",
    path: "/contact",
    portals: ["customer"],
  },
  {
    iconNode: <FileTextOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR }} />,
    iconNodeActive: (
      <FileTextOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR_ACTIVE }} />
    ),
    titleKey: "placeholder.tickets",
    path: "/tickets",
    portals: ["customer", "staff", "vendor"],
  },
  {
    iconNode: <LaptopOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR }} />,
    iconNodeActive: (
      <LaptopOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR_ACTIVE }} />
    ),
    titleKey: "placeholder.devices",
    path: "/devices",
    portals: ["customer"],
  },
  {
    iconNode: (
      <SafetyCertificateOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR }} />
    ),
    iconNodeActive: (
      <SafetyCertificateOutlined
        style={{ fontSize: 20, color: NAV_ICON_COLOR_ACTIVE }}
      />
    ),
    titleKey: "placeholder.security",
    path: "/security",
    portals: ["customer"],
  },
  {
    iconNode: <FileProtectOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR }} />,
    iconNodeActive: (
      <FileProtectOutlined style={{ fontSize: 20, color: NAV_ICON_COLOR_ACTIVE }} />
    ),
    titleKey: "placeholder.contractRates",
    path: "/contract-rates",
    // Read-only link to the vendor's own already-permission-gated Contract
    // Rates page (frontend's VendorPortalContractRatesViewSet) rather than
    // reinventing a detail view here.
    portals: ["vendor"],
  },
];

const resizeFile = (file: File): Promise<File> =>
  new Promise((resolve) => {
    ImageResizer.imageFileResizer(
      file,
      400,
      400,
      "webp",
      90,
      0,
      (uri) => {
        resolve(uri as File);
      },
      "file",
    );
  });

const NavItem = ({
  nav: { icon, icon_active, iconNode, iconNodeActive, titleKey, path },
}: {
  nav: NavItemType;
}) => {
  // Named to avoid shadowing this file's module-level `t` import (i18next's
  // static function, still used below by profileMenuList) — this one is the
  // reactive react-i18next hook binding, the actual fix for the bug in
  // NavItemType's titleKey comment above.
  const { t: translate } = useTranslation();
  const title = translate(titleKey);
  const resolvedPath = useResolvedPath(path);
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const toPathname = navigator.encodeLocation
    ? navigator.encodeLocation(path).pathname
    : resolvedPath.pathname;
  const locationPathname = location.pathname;
  const isActive =
    locationPathname === toPathname ||
    (locationPathname.startsWith(toPathname) &&
      locationPathname.charAt(toPathname.length) === "/") ||
    location.hash.startsWith(`#${toPathname}`);

  const unReadCount = useConversationStore((state) => state.unReadCount);
  const unHandleFriendApplicationCount = useContactStore(
    (state) => state.unHandleFriendApplicationCount,
  );
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );

  const tryNavigate = () => {
    if (isActive) {
      return;
    }

    // TODO Keep answering when jumping back to chat from another page (if there is one)
    navigator.push(path);
  };

  const getBadge = () => {
    if (path === "/chat") {
      return unReadCount;
    }
    if (path === "/contact") {
      return unHandleFriendApplicationCount + unHandleGroupApplicationCount;
    }
    return 0;
  };

  return (
    <Badge size="small" count={getBadge()}>
      <div
        className={clsx(
          "mb-3 flex h-[52px] w-12 cursor-pointer flex-col items-center justify-center rounded-md",
          { "bg-[#e9e9eb]": isActive },
        )}
        onClick={tryNavigate}
      >
        {icon ? (
          <img width={20} src={isActive ? icon_active : icon} alt="" />
        ) : (
          (isActive ? iconNodeActive : iconNode) ?? null
        )}
        <div className="mt-1 text-xs text-gray-500">{title}</div>
      </div>
    </Badge>
  );
};

const profileMenuList = [
  {
    title: t("placeholder.myInfo"),
    gap: true,
    idx: 0,
  },
  {
    title: t("placeholder.accountSetting"),
    gap: true,
    idx: 1,
  },
  {
    title: t("placeholder.about"),
    gap: false,
    idx: 2,
  },
  {
    title: t("placeholder.logOut"),
    gap: false,
    idx: 3,
  },
];

i18n.on("languageChanged", () => {
  profileMenuList[0].title = t("placeholder.myInfo");
  profileMenuList[1].title = t("placeholder.accountSetting");
  profileMenuList[2].title = t("placeholder.about");
  profileMenuList[3].title = t("placeholder.logOut");
});

const LeftNavBar = memo(() => {
  const aboutRef = useRef<OverlayVisibleHandle>(null);
  const personalSettingsRef = useRef<OverlayVisibleHandle>(null);
  const [showProfile, setShowProfile] = useState(false);
  const selfInfo = useUserStore((state) => state.selfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  // Falls back to "customer" for the same reason src/pages/tickets/index.tsx
  // does — defensive only, every route this bar renders on is post-login.
  const portalType = usePortalTypeStore((state) => state.portalType) ?? "customer";
  const navList = NAV_DEFS.filter((nav) => nav.portals.includes(portalType));

  const profileMenuClick = (idx: number) => {
    switch (idx) {
      case 0:
        emit("OPEN_USER_CARD", {
          isSelf: true,
          userID: useUserStore.getState().selfInfo.userID,
        });
        break;
      case 1:
        personalSettingsRef.current?.openOverlay();
        break;
      case 2:
        aboutRef.current?.openOverlay();
        break;
      case 3:
        tryLogout();
        break;
      default:
        break;
    }
    setShowProfile(false);
  };

  const tryLogout = () => {
    modal.confirm({
      title: t("placeholder.logOut"),
      content: t("toast.confirmlogOut"),
      onOk: async () => {
        try {
          await userLogout();
        } catch (error) {
          feedbackToast({ error });
        }
      },
    });
  };

  const customUpload: NonNullable<UploadProps["customRequest"]> = ({
    file,
    onError,
    onSuccess,
  }) => {
    if (!(file instanceof File)) return;
    void (async () => {
      try {
        const resizedFile = await resizeFile(file);
        const filePath = await window.electronAPI?.saveFileToDisk({
          sync: true,
          file,
        });
        const {
          data: { url },
        } = await uploadFile(resizedFile, filePath);
        const newInfo = {
          faceURL: url,
        };
        await updateBusinessUserInfo(newInfo);
        updateSelfInfo(newInfo);
        onSuccess?.(newInfo);
      } catch (error) {
        feedbackToast({ error: t("toast.updateAvatarFailed") });
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  };

  const ProfileContent = (
    <div className="w-72 px-2.5 pb-3 pt-5.5">
      <div className="mb-4.5 ml-3 flex items-center">
        <Upload
          accept=".jpeg,.png,.webp"
          showUploadList={false}
          customRequest={customUpload}
        >
          <div className={styles["avatar-wrapper"]}>
            <OIMAvatar src={selfInfo.faceURL} text={selfInfo.nickname} />
            <div className={styles["mask"]}>
              <img src={change_avatar} width={19} alt="" />
            </div>
          </div>
        </Upload>
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 truncate text-base font-medium">{selfInfo.nickname}</div>
        </div>
      </div>
      {profileMenuList.map((menu) => (
        <div key={menu.idx}>
          <div
            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-4 hover:bg-[var(--primary-active)]"
            onClick={() => profileMenuClick(menu.idx)}
          >
            <div>{menu.title}</div>
            <RightOutlined rev={undefined} />
          </div>
          {menu.gap && (
            <div className="px-3">
              <Divider className="my-1.5 border-[var(--gap-text)]" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Sider
      className="no-mobile border-r border-gray-200 !bg-[#F4F4F4] dark:border-gray-800 dark:!bg-[#141414]"
      width={60}
      theme="light"
    >
      <div className="mt-6 flex flex-col items-center">
        <Popover
          content={ProfileContent}
          trigger="click"
          placement="rightBottom"
          overlayClassName="profile-popover"
          title={null}
          arrow={false}
          open={showProfile}
          onOpenChange={(vis) => setShowProfile(vis)}
        >
          <OIMAvatar
            className="mb-6 cursor-pointer"
            src={selfInfo.faceURL}
            text={selfInfo.nickname}
          />
        </Popover>

        {navList.map((nav) => (
          <NavItem nav={nav} key={nav.path} />
        ))}
      </div>
      <PersonalSettings ref={personalSettingsRef} />
      <About ref={aboutRef} />
    </Sider>
  );
});

export default LeftNavBar;
