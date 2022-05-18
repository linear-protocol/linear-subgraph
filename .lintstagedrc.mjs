export default {
  "src/**/*.ts?(x)": [
    "prettier --write",
    "eslint --ext .ts"
  ]
}
