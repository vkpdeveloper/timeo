/** "Back · Biceps · Forearms" (or "Back, Biceps, Forearms") as "Back, biceps, forearms". */
export function listText(s: string) {
  return s
    .split(/\s*[·,]\s*/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toLowerCase() + w.slice(1)))
    .join(", ");
}
