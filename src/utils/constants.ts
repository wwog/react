export const breakpoints = [
  "base",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
] as const;

export const DefBreakpointDesc: BreakpointDesc = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  "3xl": 1920,
};
export type BreakpointName = (typeof breakpoints)[number];

export type BreakpointDesc = Partial<Record<BreakpointName, number>>;

export type Responsive<T> = T | Partial<Record<BreakpointName, T>>;
