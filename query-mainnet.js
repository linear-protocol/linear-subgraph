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

async function queryLatestPrice() {
  const contract = await loadContract();
  const price = await contract.ft_price();
  return {
    price: price / 10 ** 24,
    timeStamp: Date.now() * 1000000
  }
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

  console.log("calc [subgraph]", 
    mintedLinear.toString(),
    unstakedLinear.toString(),
    price1.toString(),
    StakedNEAR.toString(),
    unstakedGetNEAR.toString()
  );

  // calc 
  /// 1.4081004735276945813529575e+25
  // 9.692062036875873253059014e+24
  // 1.012066972718325905007148032747872
  // 1.4099999999999999999999996e+25
  // 9.733291012715018297650809e+24

  // current calculation

  // console.log("calc",
  //   linearBalance.toString(),
  //   deposits.linear.toString(),
  //   liNnearPrice.toString(),
  //   account.unstaked_balance?.toString(),
  //   deposits.near.toString(),
  // );

  // calc
  // 3899219892615260567678430
  // 1500000000000000000000000
  // 1.012066972718325905
  // 1000000000000000000000003
  // 5366708987284981702349190

  if (flag) {
    rewardFinal = reward.plus(fessPayed)
    console.log("rewards [subgraph]", rewardFinal.toString())
    return rewardFinal
  }else {
    console.log(reward.toString())
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

  console.log("calc [indexer]",
    linearBalance.toString(),
    deposits.linear.toString(),
    liNearPrice.toString(),
    account.unstaked_balance?.toString(),
    deposits.near.toString(),
  );

  console.log("rewards [indexer]", near_reward.toString());
  return near_reward;
}

// calcStakePoolApy()
// queryStakeTime("goldman.near")
// getUserIncome(accountId, true)
// getStakingReward(accountId)
// getUserIncome("goldman.near",false)
// getPriceFromContract()
// queryLatestPrice()
// calcLpApy()
// calcCurrentLpTVL()


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

  console.log("diff [subgraph - indexer]", rewards_subgraph.minus(rewards_indexer).div(10 ** 24).toString());
  console.log("diff [subgraph with fee - indexer]", rewards_subgraph_with_fee.minus(rewards_indexer).div(10 ** 24).toString());
}

async function test() {
  const accountId = "cookiemonster.near" 
    // "retitre.near"
    // "calmincome1.near"
    // "linguists.near"
  await diff(accountId);
}

test();
