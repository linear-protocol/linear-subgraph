const { BigNumber } = require('bignumber.js')
const { client, loadContract, queryLatestPriceFromContract, queryLatestPriceFromSubgraph, queryPriceBefore } = require("./helper");

async function queryStakeTime(accountid) {
  const getStakeTimeQuery = `
    query {
      accounts (fisrt: 1, where: {id: "${accountid}"} ){
      id
      startTime
    }
  }`
  // console.log(getStakeTimeQuery)
  let data = await client.query(getStakeTimeQuery).toPromise()
  let queryData = data.data
  if (queryData == null) {
    console.log("fail to query price")
    return
  }
  const timeStampInt = new Number(queryData.accounts[0].startTime.toString())
  const unixTimeStamp = timeStampInt / 1000000
  const date = new Date(unixTimeStamp)
  console.log("user first stake time: ", date)
  return queryData.accounts[0]
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
  // console.log(getTransferEvent)
  let data = await client.query(getTransferEvent).toPromise()
  let queryData = data.data
  //console.log(queryData.accounts[0].transferedIn)
  if (queryData == null) {
    console.log("fail to query transfer event")
    return
  }
  const latestPrice = await queryLatestPriceFromContract()
  //console.log(latestPrice.price)
  const transferIn = queryData.accounts[0].transferedIn
  const transferOut = queryData.accounts[0].transferedOut
  let transferInReward = 0;
  let transferOutReward = 0;
  for (let i in transferIn) {
    let tempPrice = await queryPriceBefore(transferIn[i].timeStamp)
    let tmpReward = transferIn[i].amount * (latestPrice.price - tempPrice.price)
    transferInReward += tmpReward;
  }
  for (let i in transferOut) {
    let tempPrice = await queryPriceBefore(transferOut[i].timeStamp)
    let tmpReward = transferOut[i].amount * (latestPrice.price - tempPrice.price)
    transferOutReward += tmpReward;
  }
  // console.log("transfer reward: ",transferInReward - transferOutReward)
  return transferInReward - transferOutReward
}

async function getUserIncome(accountId, flag) {
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
  if (queryData == null) {
    console.log("fail to query user")
    return
  }
  const latestPrice = await queryLatestPriceFromSubgraph()
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
  } else {
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

async function stakingRewardsDiff(accountId) {
  const [
    rewards_subgraph_with_fee,
    // rewards_subgraph,
    rewards_indexer
  ] = await Promise.all([
    getUserIncome(accountId, true),
    // getUserIncome(accountId, false),
    getStakingReward(accountId)
  ])
  // console.log("diff [subgraph - indexer] =\t\t %s NEAR", rewards_subgraph.minus(rewards_indexer).div(10 ** 24).toFixed(8));
  console.log("diff [subgraph with fee - indexer] =\t %s NEAR", rewards_subgraph_with_fee.minus(rewards_indexer).div(10 ** 24).toFixed(8));
}

async function test() {
  const accountIds = [
    "cookiemonster.near",
    "retitre.near",
    "calmincome1.near",
    "linguists.near",
  ];
  for (const accountId of accountIds) {
    console.log('\nstaking rewards: account: ', accountId);
    await queryStakeTime(accountId);
    await stakingRewardsDiff(accountId);
  }
}

test();
