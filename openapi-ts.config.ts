import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "/Users/delamtt28/Downloads/openapi.json",
  output: {
    path: "src/types/withings",
  },
  plugins: [
    "@hey-api/typescript",
    { name: "@hey-api/client-fetch", throwOnError: true },
    "@hey-api/sdk",
  ],
});
