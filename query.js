const {createClient, Query} = require('urql')
require('isomorphic-unfetch');
const {BigNumber} = require('bignumber.js')
const APIURL = 'https://api.thegraph.com/subgraphs/name/ha4a4ck/linear'
require('process')


const client = createClient({
  url: APIURL,
})
async function queryStakeTime(accountid){
  const getStakeTimeQuery1 = `
    query {
      accounts (fisrt: 1, where: {id: "`

  const getStakeTimeQuery2= `"} ){
      id
      StartTime
    }
  }`
  let finalQuery = getStakeTimeQuery1 + String(accountid) + getStakeTimeQuery2
  //console.log(finalQuery)
  let data = await client.query(finalQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  let timeStampInt = new Number(queryData.accounts[0].StartTime.toString())
  let unixTimeStamp = timeStampInt / 1000000
  var date = new Date(unixTimeStamp)
  console.log("user first stake time: ",date)
  return queryData.accounts[0]

}
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
  console.log("current price: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}



async function queryBefore(timeStamp){
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
  let finalQuery = getBeforeQuery1 + String(targetTime) + getBeforeQuery2
  //console.log(finalQuery)
  let data = await client.query(finalQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  console.log("price 30 days before: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function calcApy(){
  let latesdPrice = await queryLatestPrice()
  let threeMonthsBefore = await queryBefore(latesdPrice.timeStamp)
  let price1 = new BigNumber(latesdPrice.price)
  let price2 = new BigNumber(threeMonthsBefore.price)
  //console.log(price1, price2)
  let timeGap = new BigNumber(Number(latesdPrice.timeStamp - threeMonthsBefore.timeStamp))
  let times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  let apy = price1.minus(price2).div(timeGap).times(times1)
  console.log("apy: ",apy.toString())

}

async function getUserIncomeWithoutFeesPayed(accoutd) {

  let getIncomeQuery1 = `
    query {
      accounts (fisrt: 1, where: {id: "`

  let targetAccount = accoutd

  let getIncomeQuery2= `"} ){
      id
      MintedLinear
      StakedNEAR
      UnstakeLinear
      UnstakeGetNear
    }
  }`
  let finalQuery = getIncomeQuery1 + String(targetAccount) + getIncomeQuery2
  //console.log(finalQuery)
  let data = await client.query(finalQuery).toPromise()
  let queryData = data.data.accounts[0]
  if (queryData == null){
    console.log("fail to query user")
    return
  }
  let LatestPrice = await queryLatestPrice()
  let price1 = new BigNumber(LatestPrice.price)
  let mintedLinear = new BigNumber(queryData.MintedLinear)
  let StakedNEAR = new BigNumber(queryData.StakedNEAR)
  let unstakedLinear = new BigNumber(queryData.UnstakeLinear)
  let unstakedGetNEAR = new BigNumber(queryData.UnstakeGetNear)
  let reward1 = mintedLinear.times(price1).minus(StakedNEAR)
  let reward2 = unstakedLinear.times(price1).minus(unstakedGetNEAR)
  let reward = reward1.minus(reward2)
  console.log(reward.toString())
  return reward
}

async function getUserIncomeWithFeesPayed(accoutd) {

  let getIncomeQuery1 = `
    query {
      accounts (fisrt: 1, where: {id: "`

  let targetAccount = accoutd

  let getIncomeQuery2= `"} ){
      id
      MintedLinear
      StakedNEAR
      UnstakeLinear
      UnstakeGetNear
      FeesPayed
    }
  }`
  let finalQuery = getIncomeQuery1 + String(targetAccount) + getIncomeQuery2
  //console.log(finalQuery)
  let data = await client.query(finalQuery).toPromise()
  let queryData = data.data.accounts[0]
  if (queryData == null){
    console.log("fail to query user")
    return
  }
  let LatestPrice = await queryLatestPrice()
  let price1 = new BigNumber(LatestPrice.price)
  let mintedLinear = new BigNumber(queryData.MintedLinear)
  let StakedNEAR = new BigNumber(queryData.StakedNEAR)
  let unstakedLinear = new BigNumber(queryData.UnstakeLinear)
  let unstakedGetNEAR = new BigNumber(queryData.UnstakeGetNear)
  let fessPayed = new BigNumber(queryData.FeesPayed)
  let reward1 = mintedLinear.times(price1).minus(StakedNEAR)
  let reward2 = unstakedLinear.times(price1).minus(unstakedGetNEAR)
  let reward = reward1.minus(reward2)
  let rewardFinal = reward.minus(fessPayed)
  console.log(rewardFinal.toString())
  return reward
}


if (process.argv.length == 4) {
  var arguments = process.argv.splice(2);
  const callFuntionName = arguments[0];
  const targetAccount = arguments[1];
  console.log(targetAccount)
  if (callFuntionName == "getRewardWithoutFeesPayed") {
      getUserIncomeWithoutFeesPayed(targetAccount)
      return
  } else if (callFuntionName == "getRewardWithFeesPayed")  {
      getUserIncomeWithFeesPayed(targetAccount)
      return
  } else if (callFuntionName == 'getStakeTime'){
      queryStakeTime(targetAccount)
      return
  } else {
      console.log("invalid parameter")
      return
  }
}

if (process.argv.length == 3) {
  var arguments = process.argv.splice(2);
  const callFuntionName = arguments[0];
  if (callFuntionName == "getPrice") {
      queryLatestPrice()
  } else if (callFuntionName == "getApy"){
      calcApy()
  }
}