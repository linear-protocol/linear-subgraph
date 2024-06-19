# LiNEAR Protocol subgraph

## Development

```bash
# copy env and adjust its content
# you can get an access token from https://thegraph.com/explorer/dashboard
cp .env.example .env
# install project dependencies
yarn
# prepare subgraph.yaml
yarn prepare:mainnet
# run codegen
yarn codegen
# now you're able to deploy to thegraph via
yarn deploy
```

## Deployment

To be able to deploy to the hosted solution you will need to create a .env file and add `ACCESS_TOKEN` environment variable. You can find this in the dashboard of the TheGraph

```
// For Testnet:
yarn deploy:testnet

// For Mainnet:
yarn deploy:mainnet
```

## Test

To test the deployed subgraph, you can try querying with the examples.

```bash
yarn
# test APY data
node test/apy.js
# test staking rewards data
node test/stake.js
```
