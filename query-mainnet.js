require('process')
require('isomorphic-unfetch');
const {BigNumber} = require('bignumber.js')
const APIURL = 'https://api.thegraph.com/subgraphs/name/ha4a4ck/linearmainnet'
const {createClient, Query} = require('urql')
const nearAPI = require('near-api-js')
const fs = require("fs");
const {connect} = nearAPI
const { keyStores,  KeyPair} = require("near-api-js");
const keyStore = new keyStores.InMemoryKeyStore();

BigNumber.config({
  DECIMAL_PLACES: 64
})

const configs = {
    networkId: "mainnet",
    keyStore, // optional if not signing transactions
    nodeUrl: "https://public-rpc.blockpi.io/http/near",
    walletUrl: "https://wallet.near.org",
    helperUrl: "https://helper.near.org",
    explorerUrl: "https://explorer.near.org",
};

const client = createClient({
  url: APIURL,
})

async function getSummaryFromContract(){
  const near = await connect(configs);
  const account = await near.account("");
  const contract = new nearAPI.Contract(
    account, // the account object that is connecting
    "linear-protocol.near",
    {
      // name of contract you're connecting to
      viewMethods: ["get_summary"], // view methods do not change state but usually return a value
      changeMethods: [],// change methods modify state
      //, // account object to initialize and sign transactions.
    }
  );
  let response = await contract.get_summary();
  //console.log(response);
  return response
}

async function  getLatestFeesPayed() {
  const getLatestQuery = `
    query {
      lpApies (first: 1, orderBy: timeStamp, orderDirection: desc){
        id
        timeStamp
        feesPayed
      }
    }
  `
  let data = await client.query(getLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query latest lpApies")
    return
  }
  console.log("current fees: ",queryData.lpApies[0].feesPayed.toString())
  return queryData.lpApies[0]
}

async function getTargetTimeFeesPayed(timeStamp) {
  // 3 days before
  const targetTimeForFees = timeStamp - 3 * 24 * 60 * 60 * 1000000000
  const getBeforeFeesPayed = `
    query {
      lpApies (first: 1, where: {timeStamp_gt: "${targetTimeForFees}"} ){
        id
        feesPayed
        timeStamp
     }
  }`
  //console.log(getBeforeFeesPayed)
  let data = await client.query(getBeforeFeesPayed).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query before lpApies")
    return
  }
  //console.log(queryData)
  console.log("init fees: ",queryData.lpApies[0].feesPayed)
  return queryData.lpApies[0]
}

async function calcCurrentLpTVL() {
  let response = await getSummaryFromContract();
  const tmpLinearShares = new BigNumber(response.lp_staked_share)
  const tmpNEARShares = new BigNumber(response.lp_near_amount)
  const tmpPrice = new BigNumber(response.ft_price).div(1000000000000000000000000)
  const tmpLpTVL = tmpLinearShares.times(tmpPrice).plus(tmpNEARShares)
  console.log("tmpLpTVL",tmpLpTVL.toString())
  const tmpFeesPayed = await getLatestFeesPayed()
  const initFeesPayed = await getTargetTimeFeesPayed(tmpFeesPayed.timeStamp)
  const secsCurrent = new BigNumber(tmpFeesPayed.timeStamp)
  const secsInit = new BigNumber(initFeesPayed.timeStamp)
  const days = secsCurrent.minus(secsInit).div(24).div(60*60).div(1000000000)
  console.log("days ",days.toString())
  const feesCurrent = new BigNumber(tmpFeesPayed.feesPayed)
  const feesInit = new BigNumber(initFeesPayed.feesPayed)
  //console.log("feesCurrent,feesInit",feesCurrent,feesInit)
  const lpApy = feesCurrent.minus(feesInit).div(days).times(365).times(tmpPrice).div(tmpLpTVL)
  console.log("final lp apy is ",lpApy.toString());
}

async function queryStakeTime(accountid){
  const getStakeTimeQuery = `
    query {
      accounts (fisrt: 1, where: {id: "${accountid}"} ){
      id
      startTime
    }
  }`
  console.log(getStakeTimeQuery)
  let data = await client.query(getStakeTimeQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  let timeStampInt = new Number(queryData.accounts[0].startTime.toString())
  const unixTimeStamp = timeStampInt / 1000000
  const date = new Date(unixTimeStamp)
  console.log("user first stake time: ",date)
  return queryData.accounts[0]
}

async function queryLatestPrice(){
  const getLatestQuery = `
    query {
      prices (fisrt: 1, orderBy: id, orderDirection: desc){
        id
        timeStamp
        price
      }
    }
  `
  let data = await client.query(getLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  console.log("current price: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function queryBefore(timeStamp){
  const targetTime = Number(timeStamp) - 30 * 24 * 60 * 60 * 1000000000
  const getBeforeQuery = `
    query {
      prices (fisrt: 1, where: {timeStamp_gt: "${targetTime}"} ){
        id
        timeStamp
        price
      }
    }`
  //console.log(getBeforeQuery)
  let data = await client.query(getBeforeQuery).toPromise()
  let queryData = data.data
  if (queryData == null){
    console.log("fail to query price")
    return
  }
  console.log("price 30 days before: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function calcStakePoolApy(){
  const latesdPrice = await queryLatestPrice()
  const threeMonthsBefore = await queryBefore(latesdPrice.timeStamp)
  const price1 = new BigNumber(latesdPrice.price)
  const price2 = new BigNumber(threeMonthsBefore.price)
  //console.log(price1, price2)
  const timeGap = new BigNumber(Number(latesdPrice.timeStamp - threeMonthsBefore.timeStamp))
  const times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  const apy = price1.minus(price2).div(timeGap).times(times1)
  console.log("apy: ",apy.toString())
}

async function getUserIncome(accountId,flag) {
  let getIncomeQuery = `
    query {
      accounts (fisrt: 1, where: {id: "${accountId}"} ){
        id
        mintedLinear
        stakedNEAR
        unstakeLinear
        unstakeGetNear
        feesPayed
      }
    }`
  //console.log(finalQuery)
  let data = await client.query(getIncomeQuery).toPromise()
  //console.log(data)
  let queryData = data.data.accounts[0]
  if (queryData == null){
    console.log("fail to query user")
    return
  }
  const latestPrice = await queryLatestPrice()
  const price1 = new BigNumber(latestPrice.price)
  const mintedLinear = new BigNumber(queryData.mintedLinear)
  const StakedNEAR = new BigNumber(queryData.stakedNEAR)
  const unstakedLinear = new BigNumber(queryData.unstakeLinear)
  const unstakedGetNEAR = new BigNumber(queryData.unstakeGetNear)
  const fessPayed = new BigNumber(queryData.feesPayed)
  const currentLinear = mintedLinear.minus(unstakedLinear);
  const reward = currentLinear.times(price1).integerValue().minus(StakedNEAR).plus(unstakedGetNEAR);
  if (flag) {
    rewardFinal = reward.minus(fessPayed)
    console.log(rewardFinal.toString())
    return rewardFinal
  }else {
    console.log(reward.toString())
    return reward
  }
}
// calcStakePoolApy()
// queryStakeTime("goldman.near")
// getUserIncome("goldman.near",true)
// getUserIncome("goldman.near",false)
// getPriceFromContract()
// queryLatestPrice()
// calcLpApy()
// calcCurrentLpTVL()