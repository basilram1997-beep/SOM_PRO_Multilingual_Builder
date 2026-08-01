const palette = [
  { bg: "#dbeafe", border: "#60a5fa", text: "#0f172a" },
  { bg: "#dcfce7", border: "#4ade80", text: "#0f172a" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#0f172a" },
  { bg: "#fee2e2", border: "#f87171", text: "#0f172a" },
  { bg: "#ede9fe", border: "#a78bfa", text: "#0f172a" },
  { bg: "#cffafe", border: "#22d3ee", text: "#0f172a" },
  { bg: "#fce7f3", border: "#f472b6", text: "#0f172a" },
  { bg: "#e0f2fe", border: "#38bdf8", text: "#0f172a" },
  { bg: "#ecfccb", border: "#84cc16", text: "#0f172a" },
  { bg: "#ffedd5", border: "#fb923c", text: "#0f172a" },
  { bg: "#f5f3ff", border: "#8b5cf6", text: "#0f172a" },
  { bg: "#ccfbf1", border: "#14b8a6", text: "#0f172a" }
];

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function teacherColorKey(teacher?: { id?: string | null; name?: string | null } | null) {
  return String(teacher?.id || teacher?.name || "").trim();
}

export function teacherColorStyle(teacher?: { id?: string | null; name?: string | null } | null) {
  const key = teacherColorKey(teacher);
  if (!key) return {};
  const color = palette[hashText(key) % palette.length];
  return {
    backgroundColor: color.bg,
    borderColor: color.border,
    color: color.text,
    boxShadow: `inset 0 0 0 2px ${color.border}`
  };
}

export function chartColor(index: number) {
  return palette[index % palette.length].border;
}
