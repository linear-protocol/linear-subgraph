# Subgraph for LiNEAR
[Testnet Playground address](https://thegraph.com/hosted-service/subgraph/ha4a4ck/linear?selected=playground)
[Mainnet Playground address](https://thegraph.com/hosted-service/subgraph/ha4a4ck/linearmainnet?selected=playground)

## deploy
* ```graph auth --product hosted-service xxxxx ```
* testnet: ```graph deploy --product hosted-service ha4a4ck/linear ```
* mainnet: change the  
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
