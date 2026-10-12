/** A Moodle category's path as a topic: `$course$/top/Chapter 1` → `Chapter 1`;
 *  `null` when it names only Moodle's own levels. `//` is a slash in a name.
 *  Shared by Moodle XML and GIFT, which both carry Moodle categories. */
export function categoryTopic(path: string): string | null {
  const parts = path
    .replace(/\/\//g, '')
    .split('/')
    .map((part) => part.replace(//g, '/').trim())
    .filter((part) => part && !/^\$[a-z0-9]+\$$/i.test(part) && part.toLowerCase() !== 'top' && !/^default for\b/i.test(part))
  return parts.at(-1) ?? null
}
