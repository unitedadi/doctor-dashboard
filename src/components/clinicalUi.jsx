import * as React from "react";

const { useEffect, useId, useRef } = React;

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function StatusChip({ label, tone = "idle", className = "" }) {
  if (!label) return null;
  return (
    <span className={`v2-status-chip ${tone} ${className}`.trim()}>
      <span className="v2-status-chip-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function ClinicalThread({ steps = [], layout = "vertical", label = "Clinical thread" }) {
  const visibleSteps = Array.isArray(steps) ? steps.filter((step) => step?.label) : [];
  if (!visibleSteps.length) return null;

  return (
    <div
      className={`v2-clinical-thread ${layout}`}
      aria-label={label}
      style={{ "--v2-thread-count": visibleSteps.length }}
    >
      {visibleSteps.map((step, index) => {
        const state = ["done", "current", "risk", "pending"].includes(step.state) ? step.state : "pending";
        const meta = step.meta || (state === "pending" ? "Pending" : "");
        return (
          <div className={`v2-clinical-thread-step ${state}`} key={step.id || `${step.label}-${index}`}>
            <span className="v2-clinical-thread-marker" aria-hidden="true" />
            <span className="v2-clinical-thread-copy">
              <span className="v2-clinical-thread-label">
                {step.label}
                {state === "current" ? <span className="v2-clinical-thread-current">Current</span> : null}
              </span>
              {meta ? <span className="v2-clinical-thread-meta">{meta}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ClinicalContextBanner({ allergies, conditions, riskExplanation = "", label = "Clinical context", always = false }) {
  const allergyList = toList(allergies);
  const conditionList = toList(conditions);
  if (!always && !allergyList.length && !conditionList.length && !riskExplanation) return null;

  const risk = Boolean(allergyList.length || riskExplanation);
  return (
    <div className={`v2-clinical-context ${risk ? "risk" : "neutral"}`} role={risk ? "alert" : undefined}>
      {risk ? (
        <svg className="v2-clinical-context-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ) : null}
      <span className="v2-clinical-context-copy">
        <strong>{label}</strong>
        {" · "}
        {allergyList.length ? `Allergies: ${allergyList.join(", ")}.` : ""}
        {allergyList.length && conditionList.length ? " " : ""}
        {conditionList.length ? `Conditions: ${conditionList.join(", ")}.` : ""}
        {riskExplanation ? ` ${riskExplanation}` : ""}
        {!allergyList.length && !conditionList.length && !riskExplanation ? "No allergies or conditions recorded." : ""}
      </span>
    </div>
  );
}

function ConfirmationModal({
  open = true,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousActiveElement = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [busy, onCancel, open]);

  if (!open) return null;
  return (
    <div className="v2-confirm-backdrop" role="presentation">
      <div ref={dialogRef} className={`v2-confirm-dialog ${variant === "compact" ? "compact" : ""}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        <div className="v2-confirm-actions">
          <button type="button" className="v2-button secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`v2-button ${tone}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ActionToast({ message, icon }) {
  if (!message) return null;
  return (
    <div className="v2-action-toast" role="status" aria-live="polite">
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{message}</span>
    </div>
  );
}

window.DD_UI = {
  ...window.DD_UI,
  StatusChip,
  ClinicalThread,
  ClinicalContextBanner,
  ConfirmationModal,
  ActionToast,
};
