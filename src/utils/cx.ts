export type CxInput = string | string[] | Record<string, boolean> | undefined | null | false

export function cx(...args: CxInput[]): string {
  const classes = new Set<string>()

  for (const arg of args) {
    if (!arg) {
      continue
    }

    if (typeof arg === 'string') {
      classes.add(arg)
    } else if (Array.isArray(arg)) {
      arg.forEach((item) => classes.add(item))
    } else if (typeof arg === 'object') {
      for (const [key, value] of Object.entries(arg)) {
        if (value) {
          classes.add(key)
        }
      }
    }
  }

  return Array.from(classes).join(' ')
}
