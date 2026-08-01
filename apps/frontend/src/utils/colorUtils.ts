export function getTeacherColor(teacherName: string | undefined | null): string {
  if (!teacherName) return "transparent";
  let hash = 0;
  for (let i = 0; i < teacherName.length; i++) {
    hash = teacherName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 80%, 92%)`;
}
