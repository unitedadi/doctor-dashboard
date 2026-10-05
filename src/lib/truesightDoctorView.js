// What a doctor sees of TrueSight for one patient (RealBackend /doctor/truesight/patients/:id/summary and
// /conversation). Pure helpers so the panel stays a thin renderer and the wording is tested.

const SUPPLY_LABEL = {
  DELIVERED: "Delivered",
  ON_ITS_WAY: "On its way",
  PAID: "Paid, not delivered yet",
  NOT_PAID: "Prescribed, not paid",
  UNKNOWN: "Unknown",
};

const UNIT_LABEL = { h: " h", ms: " ms", bpm: " bpm", steps: " steps" };

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatNumber(value, unit) {
  if (!present(value)) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (unit === "steps") return Math.round(number).toLocaleString("en-US");
  if (unit === "h") return (Math.round(number * 10) / 10).toFixed(1);
  return String(Math.round(number));
}

export function formatDubaiDate(value, withTime = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Dubai",
  }).format(date);
}

function bodyLine(row) {
  if (!row?.available || !present(row.value)) return null;
  const unit = UNIT_LABEL[row.unit] || "";
  const usual = present(row.usual) ? ` (usually ${formatNumber(row.usual, row.unit)}${unit})` : "";
  return `${formatNumber(row.value, row.unit)}${unit}${usual}`;
}

function weightLine(weight) {
  if (!weight?.available || !present(weight.current_kg)) return null;
  const change = present(weight.change_kg)
    ? ` · ${Number(weight.change_kg) > 0 ? "+" : ""}${(Math.round(Number(weight.change_kg) * 10) / 10).toFixed(1)} kg since start`
    : "";
  const goal = present(weight.goal_kg) ? ` · goal ${weight.goal_kg} kg` : "";
  return `${weight.current_kg} kg${change}${goal}`;
}

function rows(pairs) {
  return pairs.filter(([, value]) => present(value)).map(([label, value]) => ({ label, value: String(value) }));
}

// The summary as the five layers, each with only the lines it has. Null when TrueSight has nothing to show.
export function trueSightSummaryLayers(summary) {
  if (!summary?.available) return null;
  const understand = summary.understand || {};
  const measure = summary.measure;
  const help = summary.help || {};
  const follow = summary.follow_through || {};
  const counts = help.last_14_days || {};
  const doses = measure?.doses_on_time;
  return [
    {
      key: "understand",
      title: "Understand",
      rows: rows([
        ["Programme", understand.programme],
        ["Treatment", [understand.medicine, understand.dose_label].filter(Boolean).join(" · ") || understand.treatment_line],
        ["Supply", SUPPLY_LABEL[understand.supply]],
        ["Next dose", formatDubaiDate(understand.next_dose_on)],
      ]),
    },
    {
      key: "measure",
      title: "Measure",
      rows: measure ? rows([
        ["Weight", weightLine(measure.weight)],
        ["Doses on time", doses && doses.expected ? `${doses.taken} of ${doses.expected}` : null],
        ["Sleep", bodyLine(measure.sleep)],
        ["Resting heart rate", bodyLine(measure.resting_heart_rate)],
        ["HRV", bodyLine(measure.hrv)],
        ["Steps", bodyLine(measure.steps)],
        ["Devices", measure.devices?.connected?.length ? measure.devices.connected.map((name) => name === "apple" ? "Apple Health" : name[0].toUpperCase() + name.slice(1)).join(", ") : null],
      ]) : [],
      empty: "No numbers recorded yet.",
    },
    {
      key: "find",
      title: "Find",
      rows: summary.find?.noticed ? rows([
        [formatDubaiDate(summary.find.noticed.noticed_at) || "Noticed", summary.find.noticed.headline],
        ["Why it matters", summary.find.noticed.why_it_matters],
      ]) : [],
      empty: "Nothing noticed to share yet.",
    },
    {
      key: "help",
      title: "Help",
      rows: rows([
        ["Last 14 days", `${counts.sent ?? 0} sent · ${counts.seen ?? 0} seen · ${counts.answered ?? 0} answered`],
        ["Patient wrote", present(counts.patient_messages) ? `${counts.patient_messages} message${counts.patient_messages === 1 ? "" : "s"}` : null],
        ...(help.recent || []).map((item) => [formatDubaiDate(item.at, true), item.headline]),
      ]),
    },
    {
      key: "follow",
      title: "Follow through",
      rows: rows([
        ...(follow.questions || []).map((question) => [
          question.overdue ? "Question · overdue" : question.urgency === "ROUTINE" ? "Question" : `Question · ${question.urgency.toLowerCase()}`,
          question.question,
        ]),
        ...(follow.watching || []).map((check) => [`Checks ${formatDubaiDate(check.due_at, true)}`, check.purpose]),
      ]),
      empty: "Nothing scheduled.",
    },
  ];
}

// One line per entry for the thread: TrueSight's words with how they landed, the patient's in their own voice.
export function trueSightConversationEntries(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item.side === "TRUESIGHT") {
      const landed = item.answered_at ? "Answered" : item.seen_at ? `Seen ${formatDubaiDate(item.seen_at, true)}` : "Delivered";
      return {
        id: item.id,
        side: "truesight",
        at: item.at,
        title: item.headline || null,
        body: item.message || "",
        meta: [
          item.options?.length ? `Choices: ${item.options.join(" · ")}` : null,
          item.push?.sent ? "Push sent" : null,
          landed,
        ].filter(Boolean).join(" · "),
      };
    }
    return {
      id: item.id,
      side: "patient",
      at: item.at,
      title: null,
      body: item.text || "",
      meta: item.via === "TAP" ? "Tapped" : item.via === "TYPED_ANSWER" ? "Answered in their words" : "Wrote to TrueSight",
    };
  });
}
