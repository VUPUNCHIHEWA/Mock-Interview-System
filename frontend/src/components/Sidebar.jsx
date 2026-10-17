import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Video,
  Plus,
  LayoutDashboard,
  ChartLine,
  History,
  ListPlus,
  FileText,
  User,
  LogOut,
  X,
} from "lucide-react";
import { APP_NAME } from "../config/Brand";
import { useCurrentUser } from "../utils/currentUser";

// ---------------------------------------------------------------------------
// Sidebar navigation, grouped in the standard way:
//   main action (New interview) → Overview → Practice → Career → account.
// `match` lists extra paths that keep an item highlighted (e.g. a report
// opened from My interviews keeps "My interviews" active).
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/"] },
      { to: "/progress", label: "Progress", icon: ChartLine },
    ],
  },
  {
    label: "Practice",
    items: [
      { to: "/history", label: "My interviews", icon: History, match: ["/interview-results"] },
      { to: "/custom-practice", label: "Custom practice", icon: ListPlus, match: ["/practice-history"] },
    ],
  },
  {
    label: "Career",
    items: [{ to: "/cv", label: "CV builder", icon: FileText }],
  },
];

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

const NavItem = ({ item, active, onNavigate }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon size={18} />
      {item.label}
    </Link>
  );
};

function SidebarContent({ onNavigate, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useCurrentUser(); // Profile name if filled in, else Sign up name

  const isActive = (item) => pathname === item.to || (item.match || []).includes(pathname);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("consentAccepted");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
            <Video size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Main action */}
      <div className="px-4 pt-5">
        <Link
          to="/InterviewSetup"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={16} strokeWidth={2.4} />
          New interview
        </Link>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 pt-6" aria-label="Main">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="mt-2 space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} active={isActive(item)} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user.name || "Student"}</p>
            <p className="truncate text-xs text-slate-500">{user.email || ""}</p>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
          <Link
            to="/profile"
            onClick={onNavigate}
            aria-current={pathname === "/profile" ? "page" : undefined}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors ${
              pathname === "/profile" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <User size={16} />
            Profile
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop: fixed sidebar on the left (md and up).
 * Phone:   hidden; opens as a slide-in drawer when `mobileOpen` is true.
 */
const Sidebar = ({ mobileOpen = false, onClose = () => {} }) => {
  const { pathname } = useLocation();

  // Close the drawer after moving to another page
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close the drawer with the Escape key
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 md:block">
        <SidebarContent />
      </aside>

      {/* Phone drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
            <SidebarContent onNavigate={onClose} onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;