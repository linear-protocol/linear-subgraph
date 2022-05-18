
const { utils } = require('near-api-js')
const { client, loadContract } = require("./helper");

async function queryPriceBefore(timestamp) {
  const getBeforeQuery = `
      query {
        prices (first: 1, where: {timestamp_gt: "${timestamp}"} ){
          id
          timestamp
          price
        }
      }`
  //console.log(getBeforeQuery)
  let data = await client.query(getBeforeQuery).toPromise()
  let queryData = data.data
  if (queryData == null) {
    throw new Error("fail to query price")
  }
  // console.log("price at %s : %s",timestamp.toString(),queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function queryLatestPriceFromContract() {
  const contract = await loadContract();
  const price = await contract.ft_price();
  return {
    price: utils.format.formatNearAmount(price),
    timestamp: Date.now() * 1000000
  }
}

async function queryLatestPriceFromSubgraph() {
  const getLatestQuery = `
      query {
        prices (first: 1, orderBy: timestamp, orderDirection: desc){
          id
          timestamp
          price
        }
      }
    `
  let data = await client.query(getLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null) {
    throw new Error("fail to query price")
  }
  // console.log("current price: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}

module.exports = {
  queryPriceBefore,
  queryLatestPriceFromContract,
  queryLatestPriceFromSubgraph
}
