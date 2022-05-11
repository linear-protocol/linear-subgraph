const { BigNumber } = require('bignumber.js')
const { client, getSummaryFromContract, queryLatestPriceFromSubgraph, queryPriceBefore } = require("./helper");

async function getLatestFeesPayed() {
  const getLatestQuery = `
    query {
      totalSwapFees (first: 1, orderBy: timeStamp, orderDirection: desc){
        id
        timeStamp
        feesPayed
      }
    }
  `
  let data = await client.query(getLatestQuery).toPromise()
  let queryData = data.data
  if (queryData == null) {
    console.log("fail to query latest lpApies")
    return
  }
  // console.log("current fees: ", queryData.lpApies[0].feesPayed.toString())
  return queryData.lpApies[0]
}

async function getTargetTimeFeesPayed(timeStamp) {
  // 
  const getBeforeFeesPayed = `
    query {
      totalSwapFees (first: 1, where: {timeStamp_gt: "${timeStamp}"} ){
        id
        feesPayed
        timeStamp
     }
  }`
  //console.log(getBeforeFeesPayed)
  let data = await client.query(getBeforeFeesPayed).toPromise()
  let queryData = data.data
  if (queryData == null) {
    console.log("fail to query before lpApies")
    return
  }
  //console.log(queryData)
  // console.log("init fees: ", queryData.lpApies[0].feesPayed)
  return queryData.lpApies[0]
}

async function calcLpApy() {
  let response = await getSummaryFromContract();
  const tmpLinearShares = new BigNumber(response.lp_staked_share)
  const tmpNEARShares = new BigNumber(response.lp_near_amount)
  const tmpPrice = new BigNumber(response.ft_price).div(1000000000000000000000000)
  const tmpLpTVL = tmpLinearShares.times(tmpPrice).plus(tmpNEARShares)
  // console.log("tmpLpTVL", tmpLpTVL.toString())
  const tmpFeesPayed = await getLatestFeesPayed()
  const targetTimeForFees = tmpFeesPayed.timeStamp - 3 * 24 * 60 * 60 * 1000000000
  const initFeesPayed = await getTargetTimeFeesPayed(targetTimeForFees)
  const secsCurrent = new BigNumber(tmpFeesPayed.timeStamp)
  const secsInit = new BigNumber(initFeesPayed.timeStamp)
  const days = 3; // secsCurrent.minus(secsInit).div(24).div(60*60).div(1000000000)
  // console.log("days", days.toString())
  const feesCurrent = new BigNumber(tmpFeesPayed.feesPayed)
  const feesInit = new BigNumber(initFeesPayed.feesPayed)
  //console.log("feesCurrent,feesInit",feesCurrent,feesInit)
  const lpApy = feesCurrent.minus(feesInit).div(days).times(365).times(tmpPrice).div(tmpLpTVL)
  console.log("Liquidity Pool APY:", lpApy.toFixed(4));
}

async function calcStakePoolApy() {
  const latesdPrice = await queryLatestPriceFromSubgraph()
  const targetTime = Number(latesdPrice.timeStamp) - 30 * 24 * 60 * 60 * 1000000000
  const price30DaysAgo = await queryPriceBefore(targetTime)
  const price1 = new BigNumber(latesdPrice.price)
  const price2 = new BigNumber(price30DaysAgo.price)
  // console.log(latesdPrice, price30DaysAgo)
  const days = new BigNumber(24 * 60 * 60 * 1000000000 * 30)
  const timeGap = new BigNumber(Number(latesdPrice.timeStamp - price30DaysAgo.timeStamp))
  const times1 = new BigNumber(24 * 60 * 60 * 1000000000 * 365)
  const apy = price1.minus(price2).div(price2).times(times1).div(days)
  console.log("Staking APY:", apy.toFixed(4))
}

async function test() {
  await calcStakePoolApy();
  await calcLpApy();
}

test();
