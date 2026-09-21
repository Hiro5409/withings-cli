import * as v from "valibot";

const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty());

export const UserIdSchema = v.union([
  v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number), v.safeInteger()),
]);

export const TokenSetSchema = v.object({
  userid: v.optional(UserIdSchema),
  clientId: NonEmptyStringSchema,
  clientSecret: NonEmptyStringSchema,
  accessToken: NonEmptyStringSchema,
  refreshToken: NonEmptyStringSchema,
  expiresAt: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  scope: v.optional(v.string()),
  tokenType: v.optional(v.string()),
  csrfToken: v.optional(v.string()),
});

export type TokenSet = v.InferOutput<typeof TokenSetSchema>;

export function parseTokenSet(input: unknown): TokenSet | undefined {
  const result = v.safeParse(TokenSetSchema, input);
  return result.success ? result.output : undefined;
}
