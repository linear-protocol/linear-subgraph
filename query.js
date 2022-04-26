const {createClient, Query} = require('urql')
require('isomorphic-unfetch');
const {BigNumber} = require('bignumber.js')
const APIURL = 'https://api.thegraph.com/subgraphs/name/ha4a4ck/linear'



const client = createClient({
  url: APIURL,
})

async function queryLatestPrice(){
  const GetLatestQuery = `
    query {
      prices (fisrt: 1, orderBy: id, orderDirection: desc){
        id
        timeStamp
        price
      }
    }
  `
  let data = await client.query(GetLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  console.log(queryData.prices[0].timeStamp.toString())
  return queryData.prices[0]
}



async function QueryBefore(timeStamp){
  const getBeforeQuery1 = `
    query {
      prices (fisrt: 1, where: {timeStamp_gt: "`
  const targetTime = Number(timeStamp) - 30 * 24 * 60 * 60 * 1000000000

  const getBeforeQuery2= `"} ){
      id
      timeStamp
      price
    }
  }`
  const finalQuery = getBeforeQuery1 + String(targetTime) + getBeforeQuery2
  console.log(finalQuery)
  let data = await client.query(finalQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  console.log(queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function CalcApy(){
  let latesedPrice = await queryLatestPrice()
  let threeMonthsBefore = await QueryBefore(latesedPrice.timeStamp)
  let price1 = new BigNumber(latesedPrice.price)
  let price2 = new BigNumber(threeMonthsBefore.price)
  console.log(price1, price2)
  let timeGap = new BigNumber(Number(latesedPrice.timeStamp - threeMonthsBefore.timeStamp))
  let times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  let apy = price1.minus(price2).div(timeGap).times(times1)
  console.log("apy: ",apy)

}

CalcApy()