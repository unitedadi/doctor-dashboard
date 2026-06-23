import * as React from "react";
import {
  BookOpenCheck,
  CalendarCheck2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Droplet,
  FlaskConical,
  House,
  ListFilter,
  MapPin,
  MessageSquareText,
  Mic,
  Minus,
  MoreHorizontal,
  Paperclip,
  Phone,
  Pill,
  Plus,
  Printer,
  Search,
  SendHorizontal,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";

/* global React */
// Reusable bits — icons (lucide-style strokes), avatar, sidebar.

const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// Icons
// ============================================================
const Icon = ({ d, size = 18, fill = "none", stroke = "currentColor", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const L = (IconComponent, size = 18) => <IconComponent size={size} strokeWidth={1.8} />;

const I = {
  calendar: L(CalendarCheck2),
  user: L(UsersRound),
  message: L(MessageSquareText),
  pill: L(Pill),
  search: L(Search),
  send: L(SendHorizontal),
  plus: L(Plus),
  minus: L(Minus),
  x: L(X),
  chevronRight: L(ChevronRight),
  chevronLeft: L(ChevronLeft),
  chevronDown: L(ChevronDown),
  phone: L(Phone),
  video: L(Video),
  home: L(House),
  paperclip: L(Paperclip),
  mic: L(Mic),
  check: L(Check),
  checks: L(CheckCheck),
  warn: L(TriangleAlert),
  filter: L(ListFilter),
  download: L(Download),
  printer: L(Printer),
  more: L(MoreHorizontal),
  pin: L(MapPin),
  fileText: L(FlaskConical),
  stethoscope: L(Stethoscope),
  shield: L(BookOpenCheck),
  shieldCheck: L(ShieldCheck),
  drop: L(Droplet),
  dot: <Circle size={12} fill="currentColor" strokeWidth={0} />,
};

// ============================================================
// Avatar
// ============================================================
function Avatar({ initials, name, size = "md", online }) {
  const cls = ["avatar", size === "lg" ? "lg" : size === "xl" ? "xl" : size === "sm" ? "sm" : ""].filter(Boolean).join(" ");
  // Subtle colour variety per name (deterministic), but tan-toned
  const palette = [
    { bg: "#F2E6D2", fg: "#173B3D" },
    { bg: "#E5DACA", fg: "#173B3D" },
    { bg: "#EFE5D5", fg: "#173B3D" },
    { bg: "#F7EEE0", fg: "#173B3D" },
  ];
  const idx = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  const c = palette[idx];
  if (online) {
    return (
      <span className="avatar-wrap">
        <span className={cls + " online"} style={{ background: c.bg, color: c.fg, position: "relative" }}>
          {initials}
        </span>
      </span>
    );
  }
  return <span className={cls} style={{ background: c.bg, color: c.fg }}>{initials}</span>;
}

// ============================================================
// Sidebar
// ============================================================
function Sidebar({ active, onNav, appointmentCount, clinicalInboxCount, unreadChats, pendingRefills }) {
  const items = [
    { id: "appointments", label: "Schedule", icon: I.calendar, count: appointmentCount },
    { id: "clinical-inbox", label: "Clinical Inbox", icon: I.shieldCheck, count: clinicalInboxCount, urgent: true },
    { id: "patients", label: "Patients", icon: I.user, count: null },
    { id: "chat", label: "Chat", icon: I.message, count: unreadChats },
    { id: "refills", label: "Refills", icon: I.drop, count: pendingRefills, urgent: true },
    { id: "quickwlp", label: "Quick WLP", icon: I.stethoscope, count: null },
  ];
  const D = window.DD_DATA.DOCTOR;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="assets/logo-dardoc-teal.svg" alt="DarDoc" />
      </div>

      <div className="nav-section-label">Workspace</div>
      {items.map((it) => (
        <div key={it.id}
             className={"nav-item" + (active === it.id ? " active" : "")}
             onClick={() => onNav(it.id)}>
          {it.icon}
          <span>{it.label}</span>
          {it.count != null && it.count > 0 ? (
            <span className={"count" + (it.urgent ? " urgent" : "")}>{it.count}</span>
          ) : null}
        </div>
      ))}

      <div className="sidebar-doctor">
        <Avatar initials={D.initials} name={D.name} size="md" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: "500 13px/1.2 var(--dd-font)", color: "var(--dd-text-primary)" }}>{D.name}</div>
          <div style={{ font: "400 11px/1.3 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 2 }}>{D.title}</div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// Topbar
// ============================================================
function Topbar({ title, subtitle, right, search, onSearch }) {
  return (
    <div className="topbar">
      {(title || subtitle) ? (
        <div style={{ minWidth: 0, flex: 1 }}>
          {title && <h1>{title}</h1>}
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      ) : <div style={{ minWidth: 0, flex: 1 }} />}
      {search != null && (
        <div className="search">
          {I.search}
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search patients, drugs, notes" />
        </div>
      )}
      {right}
    </div>
  );
}

window.DD_UI = { I, Icon, Avatar, Sidebar, Topbar };
