# Subgraph for LiNEAR

## Development

```bash
# copy env and adjust its content
# you can get an access token from https://thegraph.com/explorer/dashboard
cp .env.example .env
# install project dependencies
npm i
# run codegen
npm run codegen
# now you're able to deploy to thegraph via
npm run deploy
```

## Deployment

To be able to deploy to the hosted solution you will need to create a .env file and add `ACCESS_TOKEN` environment variable. You can find this in the dashboard of the TheGraph

```
// For Testnet:
npm run deploy:testnet

// For Mainnet:
npm run deploy:mainnet
```

## Test

To test the deployed subgraph, you can try with the examples from `scripts/query.js`