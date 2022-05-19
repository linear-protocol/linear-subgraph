export default {
  "src/**/*.ts": [
    () => "tsc --project tsconfig.json --alwaysStrict",
    "prettier --write",
    "eslint --ext .ts --fix",
  ],
  "*.js": [
    "prettier --write",
  ]
}
