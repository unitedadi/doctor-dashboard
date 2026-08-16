import * as React from "react";
import {
  calendarDaysForMonth,
  combineDubaiFollowUpValue,
  minimumDubaiFollowUpValue,
  shiftCalendarMonth,
  splitDubaiFollowUpValue,
} from "../lib/consultOutcome.js";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00"];

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00+04:00`);
}

function monthLabel(monthKey) {
  const date = dateFromKey(`${monthKey}-01`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(date);
}

function dateAriaLabel(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(dateFromKey(dateKey));
}

function followUpSummary(value) {
  const date = new Date(`${value}:00+04:00`);
  if (Number.isNaN(date.getTime())) return "Choose a date and time";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(date);
}

export function ConsultFollowUpPicker({ value, onChange, disabled = false }) {
  const minimum = minimumDubaiFollowUpValue();
  const todayKey = minimum.slice(0, 10);
  const minimumTime = minimum.slice(11);
  const { dateKey, time } = splitDubaiFollowUpValue(value);
  const [visibleMonth, setVisibleMonth] = React.useState(dateKey.slice(0, 7) || todayKey.slice(0, 7));

  React.useEffect(() => {
    if (dateKey) setVisibleMonth(dateKey.slice(0, 7));
  }, [dateKey]);

  const days = calendarDaysForMonth(visibleMonth);
  const earliestMonth = todayKey.slice(0, 7);

  const chooseDate = (nextDateKey) => {
    let nextTime = time || minimumTime;
    if (nextDateKey === todayKey && nextTime < minimumTime) nextTime = minimumTime;
    onChange(combineDubaiFollowUpValue(nextDateKey, nextTime));
  };

  const chooseTime = (nextTime) => {
    if (!dateKey) return;
    const safeTime = dateKey === todayKey && nextTime < minimumTime ? minimumTime : nextTime;
    onChange(combineDubaiFollowUpValue(dateKey, safeTime));
  };

  return (
    <section className="consult-follow-up-picker" aria-labelledby="consult-follow-up-title">
      <div className="consult-follow-up-summary">
        <div>
          <span id="consult-follow-up-title">Support follows up</span>
          <strong>{followUpSummary(value)}</strong>
        </div>
        <span className="consult-follow-up-zone">Dubai time</span>
      </div>

      <div className="consult-follow-up-controls">
        <div className="consult-calendar">
          <div className="consult-calendar-head">
            <strong>{monthLabel(visibleMonth)}</strong>
            <div>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setVisibleMonth(shiftCalendarMonth(visibleMonth, -1))}
                disabled={disabled || visibleMonth <= earliestMonth}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setVisibleMonth(shiftCalendarMonth(visibleMonth, 1))}
                disabled={disabled}
              >
                →
              </button>
            </div>
          </div>
          <div className="consult-calendar-grid" role="grid" aria-label={monthLabel(visibleMonth)}>
            {WEEKDAYS.map((weekday) => <span className="consult-calendar-weekday" key={weekday}>{weekday}</span>)}
            {days.map((day, index) => day ? (
              <button
                type="button"
                className={day === dateKey ? "selected" : ""}
                key={day}
                aria-label={dateAriaLabel(day)}
                aria-pressed={day === dateKey}
                aria-current={day === todayKey ? "date" : undefined}
                disabled={disabled || day < todayKey}
                onClick={() => chooseDate(day)}
              >
                {Number(day.slice(-2))}
              </button>
            ) : <span className="consult-calendar-empty" key={`empty-${index}`} />)}
          </div>
        </div>

        <div className="consult-follow-up-time">
          <label htmlFor="consult-follow-up-time">Follow-up time</label>
          <input
            id="consult-follow-up-time"
            type="time"
            value={time}
            min={dateKey === todayKey ? minimumTime : undefined}
            onChange={(event) => chooseTime(event.target.value)}
            disabled={disabled || !dateKey}
            required
          />
          <div className="consult-follow-up-time-shortcuts" aria-label="Suggested follow-up times">
            {QUICK_TIMES.map((quickTime) => (
              <button
                type="button"
                key={quickTime}
                className={time === quickTime ? "selected" : ""}
                aria-pressed={time === quickTime}
                onClick={() => chooseTime(quickTime)}
                disabled={disabled || !dateKey || (dateKey === todayKey && quickTime < minimumTime)}
              >
                {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  .format(new Date(`2026-01-01T${quickTime}:00`))}
              </button>
            ))}
          </div>
          <small>Choose an exact time or use a shortcut.</small>
        </div>
      </div>
    </section>
  );
}
