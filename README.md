# Subgraph for LiNEAR
[Testnet Playground address](https://thegraph.com/hosted-service/subgraph/ha4a4ck/linear?selected=playground)
[Mainnet Playground address](https://thegraph.com/hosted-service/subgraph/ha4a4ck/linearmainnet?selected=playground)

## deploy
* ```yarn auth ${your_access_token}```
* ```yarn deploy ${your_subgraph_name} ```

## usage
* ```npm install```
* ```node query.js```

## query
use ```query.js``` to query the testnet graph and ```query-mainnet.js``` to query mainnet graph
```
// calcStakePoolApy()
// queryStakeTime("goldman.near")
// getUserIncome("cookiemonster.near", true)
// getStakingReward(accountId)
// getUserIncome("cookiemonster.near",false)
// getPriceFromContract()
// queryLatestPrice()
// calcLpApy()
// calcCurrentLpTVL()
// getTransferIncome("cookiemonster.near")
```
