const { BigNumber } = require('bignumber.js')
const { client, getSummaryFromContract } = require("./helper");
const { queryLatestPriceFromSubgraph, queryPriceBefore } = require("./price");

async function getLatestFeesPaid() {
  const getLatestQuery = `
    query {
      totalSwapFees (first: 1, orderBy: timestamp, orderDirection: desc){
        id
        timestamp
        feesPaid
      }
    }
  `
  let data = await client.query(getLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null) {
    throw new Error("fail to query latest totalSwapFees")
  }
  // console.log("current fees: ", queryData.totalSwapFees[0].feesPaid.toString())
  return queryData.totalSwapFees[0]
}

async function getTargetTimeFeesPaid(timestamp) {
  // 
  const getBeforeFeesPayed = `
    query {
      totalSwapFees (first: 1, where: {timestamp_gt: "${timestamp}"} ){
        id
        feesPaid
        timestamp
     }
  }`
  // console.log('query', getBeforeFeesPayed);
  //console.log(getBeforeFeesPayed)
  let data = await client.query(getBeforeFeesPayed).toPromise()
  let queryData = data.data
  if (queryData == null) {
    throw new Error("fail to query before totalSwapFees")
  }
  //console.log(queryData)
  // console.log("init fees: ", queryData.totalSwapFees[0].feesPaid)
  return queryData.totalSwapFees[0]
}

async function calcLpApy() {
  let response = await getSummaryFromContract();
  const tmpLinearShares = new BigNumber(response.lp_staked_share)
  const tmpNEARShares = new BigNumber(response.lp_near_amount)
  const tmpPrice = new BigNumber(response.ft_price).div(1000000000000000000000000)
  const tmpLpTVL = tmpLinearShares.times(tmpPrice).plus(tmpNEARShares)
  // console.log("tmpLpTVL", tmpLpTVL.toString())
  const tmpFeesPaid = await getLatestFeesPaid()
  const targetTimeForFees = tmpFeesPaid.timestamp - 3 * 24 * 60 * 60 * 1000000000
  const initFeesPayed = await getTargetTimeFeesPaid(targetTimeForFees)
  const secsCurrent = new BigNumber(tmpFeesPaid.timestamp)
  const secsInit = new BigNumber(initFeesPayed.timestamp)
  const days = 3; // secsCurrent.minus(secsInit).div(24).div(60*60).div(1000000000)
  // console.log("days", days.toString())
  const feesCurrent = new BigNumber(tmpFeesPaid.feesPaid)
  const feesInit = new BigNumber(initFeesPayed.feesPaid)
  // console.log("feesCurrent,feesInit", feesCurrent.toString(), feesInit.toString())
  const lpApy = feesCurrent.minus(feesInit).div(days).times(365).times(tmpPrice).div(tmpLpTVL)
  console.log("Liquidity Pool APY:", lpApy.toFixed(4));
}

async function calcStakePoolApy() {
  const latesdPrice = await queryLatestPriceFromSubgraph()
  const targetTime = Number(latesdPrice.timestamp) - 30 * 24 * 60 * 60 * 1000000000
  const price30DaysAgo = await queryPriceBefore(targetTime)
  const price1 = new BigNumber(latesdPrice.price)
  const price2 = new BigNumber(price30DaysAgo.price)
  // console.log(latesdPrice, price30DaysAgo)
  const days = new BigNumber(24 * 60 * 60 * 1000000000 * 30)
  const timeGap = new BigNumber(Number(latesdPrice.timestamp - price30DaysAgo.timestamp))
  const times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  // console.log('prices',
  //   price1.toString(),
  //   price2.toString(),
  //   new Date(latesdPrice.timestamp / 1000000),
  //   new Date(price30DaysAgo.timestamp / 1000000),
  // );
  const apy = price1.minus(price2).div(price2).times(times1).div(days)
  console.log("Staking APY:", apy.toFixed(4))
}

async function test() {
  await calcStakePoolApy();
  await calcLpApy();
}

test();
