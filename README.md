# Subgraph for Surprise
This is the sub-graph for surprise index service, just try it on [here](https://thegraph.com/hosted-service/subgraph/dispa1r/superise)

## How to build
* config the contract address and start block in ```subgraph.yaml```
* go to the graph website to create a subgraph
* config the access token in your env
* graph deploy --product hosted-service ****
* go to the hosted-service playground to query

## Features
* allow user to query the prizepool they created, joined, whitelisted and winned
* add the record and activity, any user could clearly check where their assets come from and go to
* user could check the distribution of the prizes
* you can find the prize-pools which have been deleted in contracts
