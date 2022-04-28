# Subgraph for LiNEAR
[Playground address](https://thegraph.com/hosted-service/subgraph/ha4a4ck/linear?selected=playground)
## deploy
* ```graph auth --product hosted-service xxxxx ```
*  ```graph deploy --product hosted-service ha4a4ck/linear ```
## usage
* ```npm install```
* ```node query.js```

## query
### apy
```
➜  linear-subgraph git:(master) ✗ npm run query-apy
current price:  1.014600270592324547860091872901709
price 30 days before:  1
apy:  0.24061968
```
### price
```
➜  linear-subgraph git:(master) ✗ npm run query-price
1.014600270592324547860091872901709
```
### reward
```
➜  linear-subgraph npm run query-reward-with-fees xxx.testnet 
xxx.testnet
current price:  1.016043489065001774757570094662082
-1.759572366706130126747750839614409258608899161186572321678e+24
```

```
➜  linear-subgraph npm run query-reward-without-fees xxx.testnet   
xxx.testnet
current price:  1.016043489065001774757570094662082
-8.30369755887065801767001839614409258608899161186572321678e+23
```
```
➜  linear-subgraph npm run query-stake-time xxx.testnet
xxx.testnet
user first stake time:  2022-04-17T15:35:00.547Z
```
