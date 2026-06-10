export const globalArgs = {
  format: {
    type: "string" as const,
    short: "f",
    description: "Output format: json | table",
    default: "table",
  },
  profile: {
    type: "string" as const,
    description: "OAuth profile name",
    default: "default",
  },
  quiet: {
    type: "boolean" as const,
    short: "q",
    description: "Suppress non-essential output",
    default: false,
  },
  "no-color": {
    type: "boolean" as const,
    description: "Disable colored output",
    default: false,
  },
};
