"use client";
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  ChevronRight,
  FileSpreadsheet,
  FolderClosed,
  LayoutDashboard,
  Settings,
  Tags,
  Target,
  Wallet,
  X,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "At a glance",
    items: [
      ["Overview", LayoutDashboard],
      ["Analysis", ChartNoAxesCombined],
    ],
  },
  {
    label: "Activity",
    items: [
      ["Transactions", ArrowLeftRight],
      ["Statements", FileSpreadsheet],
    ],
  },
  {
    label: "Plan & organize",
    items: [
      ["Budgets", Target],
      ["Accounts", Wallet],
      ["Categories", Tags],
    ],
  },
];

export default function AppSidebar({
  open,
  page,
  onNavigate,
  onClose,
  displayName,
  vaultPath,
  platform,
  reviewCount,
}) {
  const initials =
    displayName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "C";
  const folder =
    vaultPath?.split(/[\\/]/).filter(Boolean).at(-1) || "Markdown vault";
  return (
    <aside
      id="clarity-navigation"
      className={`sidebar ${open ? "open" : ""}`}
      aria-label="Clarity navigation"
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
    >
      <div className="rail-brand-block">
        <div className="rail-brand-row">
          <a
            className="brand"
            href="#"
            aria-label="Clarity overview"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("Overview");
            }}
          >
            <img className="clarity-mark" src="/brand/clarity.svg" alt="" />
            <span className="rail-wordmark">
              clarity<span>.</span>
            </span>
          </a>
          <button
            type="button"
            className="icon-button rail-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <p className="rail-caption">Personal finance. Your files.</p>
      </div>
      <nav className="rail-navigation" aria-label="Main navigation">
        {navigationGroups.map((group) => (
          <section
            className="rail-group"
            key={group.label}
            aria-label={group.label}
          >
            <p className="rail-section-label">{group.label}</p>
            {group.items.map(([label, Icon]) => (
              <button
                type="button"
                key={label}
                className={page === label ? "active" : ""}
                aria-current={page === label ? "page" : undefined}
                onClick={() => onNavigate(label)}
              >
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                <span className="rail-label">{label}</span>
                {label === "Transactions" && reviewCount > 0 ? (
                  <span
                    className="count"
                    title={`${reviewCount} transactions need review in the selected range`}
                  >
                    {reviewCount}
                  </span>
                ) : page === label ? (
                  <ChevronRight
                    className="rail-current-arrow"
                    size={14}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className="rail-footer">
        <button
          type="button"
          className="rail-vault"
          aria-label="Vault storage settings"
          title={vaultPath}
          onClick={() => onNavigate("Settings")}
        >
          <FolderClosed size={17} strokeWidth={1.7} />
          <span>
            <strong>
              {platform === "server" ? "Files on your server" : "Local files"}
            </strong>
            <small>{folder}</small>
          </span>
          <span className="rail-status-dot" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rail-profile ${page === "Settings" ? "active" : ""}`}
          aria-label="Settings"
          aria-current={page === "Settings" ? "page" : undefined}
          onClick={() => onNavigate("Settings")}
        >
          <span className="rail-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="rail-profile-copy">
            <strong>{displayName?.trim() || "Your journal"}</strong>
            <small>Settings & preferences</small>
          </span>
          <Settings size={17} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
