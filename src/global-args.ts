import { args, boolean, choice, short, withDefault } from "gunshi/combinators";
import { nonEmptyStringArg } from "./value-arg.js";

export const globalArgs = args({
  format: short(
    choice(["json", "table"] as const, { description: "Output format (default: table)" }),
    "f",
  ),
  profile: nonEmptyStringArg("profile", 'OAuth profile name (default: "default")'),
  color: withDefault(
    boolean({ negatable: true, description: "Enable or disable colored output" }),
    true,
  ),
});
