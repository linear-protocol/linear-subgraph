export default {
  "src/**/*.ts": [
    () => "tsc --project tsconfig.json --alwaysStrict --noEmit",
    "prettier --write",
    "eslint --ext .ts --fix",
  ],
  "*.js": [
    "prettier --write",
  ]
}
