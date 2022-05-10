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

let contract = null;

async function loadContract() {
  const near = await connect(configs);
  const account = await near.account("");
  if (!contract) {
    contract = new nearAPI.Contract(
      account, // the account object that is connecting
      "linear-protocol.near",
      {
        // name of contract you're connecting to
        viewMethods: ["ft_price", "get_summary", "ft_balance_of", "get_account"], // view methods do not change state but usually return a value
        changeMethods: [],// change methods modify state
        //, // account object to initialize and sign transactions.
      }
    );
  }
  return contract;
}

async function getSummaryFromContract(){
  const contract = await loadContract();
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
  // 
  const getBeforeFeesPayed = `
    query {
      lpApies (first: 1, where: {timeStamp_gt: "${timeStamp}"} ){
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
  const targetTimeForFees = tmpFeesPayed.timeStamp - 3 * 24 * 60 * 60 * 1000000000
  const initFeesPayed = await getTargetTimeFeesPayed(targetTimeForFees)
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
  const timeStampInt = new Number(queryData.accounts[0].startTime.toString())
  const unixTimeStamp = timeStampInt / 1000000
  const date = new Date(unixTimeStamp)
  console.log("user first stake time: ",date)
  return queryData.accounts[0]
}

async function queryBefore(timeStamp){
  const getBeforeQuery = `
    query {
      prices (fisrt: 1, where: {timeStamp_gt: "${timeStamp}"} ){
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
  console.log("price at %s : %s",timeStamp.toString(),queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function queryLatestPrice() {
  const contract = await loadContract();
  const price = await contract.ft_price();
  return {
    price: price / 10 ** 24,
    timeStamp: Date.now() * 1000000
  }
}
async function getTransferIncome(accountID) {
  const getTransferEvent = `
    query {
      accounts(first: 1,where:{id:"${accountID}"}) {
        id
        transferedIn {
          amount
          timeStamp
        }
        transferedOut {
          amount
          timeStamp
        }
      }
  }`
  console.log(getTransferEvent)
  let data = await client.query(getTransferEvent).toPromise()
  let queryData = data.data
  //console.log(queryData.accounts[0].transferedIn)
  if (queryData == null){
    console.log("fail to query transfer event")
    return
  }
  const latestPrice = await queryLatestPrice()
  //console.log(latestPrice.price)
  const transferIn = queryData.accounts[0].transferedIn
  const transferOut = queryData.accounts[0].transferedOut
  let transferInReward = 0;
  let transferOutReward = 0;
  for (var i in transferIn) {
    let tempPrice = await queryBefore(transferIn[i].timeStamp)
    let tmpReward = transferIn[i].amount * (latestPrice.price - tempPrice.price)
    transferInReward+=tmpReward;
  }
  for (var i in transferOut) {
    let tempPrice = await queryBefore(transferOut[i].timeStamp)
    let tmpReward = transferOut[i].amount * (latestPrice.price - tempPrice.price)
    transferOutReward+=tmpReward;
  }
  console.log("transfer reward: ",transferInReward - transferOutReward)
  return transferInReward - transferOutReward
}

async function queryLatestPrice2(){
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

async function calcStakePoolApy(){
  const latesdPrice = await queryLatestPrice2()
  const targetTime = Number(latesdPrice.timeStamp) - 30 * 24 * 60 * 60 * 1000000000
  const threeMonthsBefore = await queryBefore(targetTime)
  const price1 = new BigNumber(latesdPrice.price)
  const price2 = new BigNumber(threeMonthsBefore.price)
  //console.log(price1, price2)
  const timeGap = new BigNumber(Number(latesdPrice.timeStamp - threeMonthsBefore.timeStamp))
  const times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  const apy = price1.minus(price2).div(timeGap).times(times1)
  console.log("apy: ",apy.toString())
}

async function getUserIncome(accountId,flag) {
  const getIncomeQuery = `
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
  const latestPrice = await queryLatestPrice2()
  const price1 = new BigNumber(latestPrice.price)
  const mintedLinear = new BigNumber(queryData.mintedLinear)
  const StakedNEAR = new BigNumber(queryData.stakedNEAR)
  const unstakedLinear = new BigNumber(queryData.unstakeLinear)
  const unstakedGetNEAR = new BigNumber(queryData.unstakeGetNear)
  const fessPayed = new BigNumber(queryData.feesPayed)
  const currentLinear = mintedLinear.minus(unstakedLinear);
  const transferReward = await getTransferIncome(accountId);
  const tfReward = new BigNumber(transferReward);
  const reward = currentLinear.times(price1).integerValue().minus(StakedNEAR).plus(unstakedGetNEAR).plus(tfReward);
  // console.log("calc [subgraph]",
  //   mintedLinear.toString(),
  //   unstakedLinear.toString(),
  //   price1.toString(),
  //   StakedNEAR.toString(),
  //   unstakedGetNEAR.toString()
  // );

  if (flag) {
    rewardFinal = reward.plus(fessPayed)
    console.log("rewards [subgraph with fee] =\t\t %s NEAR", rewardFinal.div(10 ** 24).toFixed(8))
    return rewardFinal
  }else {
    console.log("rewards [subgraph without fee] =\t %s NEAR", reward.div(10 ** 24).toFixed(8))
    return reward
  }
}

async function getDeposits(accountId) {
  const result = await fetch(`https://api.linearprotocol.org/deposits/${accountId}`);
  const json = await result.json();
  return json.deposits;
};

async function getStakingReward(accountId) {
  const contract = await loadContract();
  const [
    liNearPrice,
    account,
    linearBalance,
    deposits
  ] = await Promise.all([
    contract.ft_price(),
    contract.get_account({ account_id: accountId }),
    contract.ft_balance_of({ account_id: accountId }),
    getDeposits(accountId)
  ]);

  const near_reward = BigNumber(linearBalance)
    .minus(deposits.linear)
    .times(liNearPrice)
    .div(10 ** 24)
    .plus(account.unstaked_balance || 0)
    .minus(deposits.near);

  // console.log("calc [indexer]",
  //   linearBalance.toString(),
  //   deposits.linear.toString(),
  //   liNearPrice.toString(),
  //   account.unstaked_balance?.toString(),
  //   deposits.near.toString(),
  // );

  console.log("rewards [indexer] =\t\t\t %s NEAR", near_reward.div(10 ** 24).toFixed(8));
  return near_reward;
}

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

async function diff(accountId) {
  const [
    rewards_subgraph_with_fee,
    rewards_subgraph,
    rewards_indexer
  ] = await Promise.all([
    getUserIncome(accountId, true),
    getUserIncome(accountId, false),
    getStakingReward(accountId)
  ])

  console.log("diff [subgraph - indexer] =\t\t %s NEAR", rewards_subgraph.minus(rewards_indexer).div(10 ** 24).toFixed(8));
  console.log("diff [subgraph with fee - indexer] =\t %s NEAR", rewards_subgraph_with_fee.minus(rewards_indexer).div(10 ** 24).toFixed(8));
}

async function test() {
  const accountId = "cookiemonster.near" 
    // "retitre.near"
    // "calmincome1.near"
    // "linguists.near"
  await diff(accountId);
}

// test();