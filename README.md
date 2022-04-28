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
➜  linear-subgraph git:(master) ✗ npm run query-reward xxx.testnet 
xxx.testnet
current price:  1.014600270592324547860091872901709
2.686232441115759019967320289808995893490975865947665006e+21
```
