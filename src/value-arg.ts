import { combinator } from "gunshi/combinators";
import { CliError } from "./errors.js";

export function nonEmptyStringArg(name: string, description: string) {
  return combinator({
    description,
    parse: (value) => {
      if (!value) throw new CliError(`${name} requires a value.`);
      return value;
    },
  });
}
