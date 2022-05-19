const { BigNumber } = require('bignumber.js');
const { client, loadContract } = require('./helper');
const { queryLatestPriceFromSubgraph } = require('./price');

async function queryStakeTime(accountid) {
  const getStakeTimeQuery = `
    query {
      users (first: 1, where: {id: "${accountid}"} ){
      id
      firstStakingTime
    }
  }`;
  // console.log(getStakeTimeQuery)
  let data = await client.query(getStakeTimeQuery).toPromise();
  let queryData = data.data;
  if (queryData == null) {
    throw new Error('fail to query price');
  }
  const timestampInt = Number(queryData.users[0].firstStakingTime.toString());
  const unixTimestamp = timestampInt / 1000000;
  const date = new Date(unixTimestamp);
  console.log('user first stake time: ', date);
  return queryData.users[0];
}

async function getTransferIncome(accountID) {
  const getTransferEvent = `
    query {
      users(first: 1,where:{id:"${accountID}"}) {
        id
        transferedInShares
        transferedInValue
        transferedOutShares
        transferedOutValue
      }
  }`;
  // console.log(getTransferEvent)
  let data = await client.query(getTransferEvent).toPromise();
  let queryData = data.data;
  //console.log(queryData.users[0])
  if (queryData == null) {
    throw new Error('Fail to query transfer event');
  }
  const latestPrice = await queryLatestPriceFromSubgraph();
  //console.log(latestPrice.price)
  const transferInShares = queryData.users[0].transferedInShares;
  const tranfserInValue = queryData.users[0].transferedInValue;
  const transferOutShares = queryData.users[0].transferedOutShares;
  const tranfserOutValue = queryData.users[0].transferedOutValue;
  //console.log(transferInShares,tranfserInValue)
  let transferInReward = latestPrice.price * transferInShares - tranfserInValue;
  let transferOutReward =
    latestPrice.price * transferOutShares - tranfserOutValue;

  // console.log("transfer reward: ",transferInReward - transferOutReward)
  return transferInReward - transferOutReward;
}

async function getUserIncome(accountId, flag) {
  const getIncomeQuery = `
    query {
      users (first: 1, where: {id: "${accountId}"} ){
        id
        mintedLinear
        stakedNear
        unstakedLinear
        unstakeReceivedNear
        feesPaid
      }
    }`;
  // console.log(getIncomeQuery)
  let data = await client.query(getIncomeQuery).toPromise();
  //console.log(data)
  let queryData = data.data.users[0];
  if (queryData == null) {
    throw new Error('fail to query user');
  }
  const latestPrice = await queryLatestPriceFromSubgraph();
  const price1 = new BigNumber(latestPrice.price);
  const mintedLinear = new BigNumber(queryData.mintedLinear);
  const stakedNear = new BigNumber(queryData.stakedNear);
  const unstakedLinear = new BigNumber(queryData.unstakedLinear);
  const unstakedGetNEAR = new BigNumber(queryData.unstakeReceivedNear);
  const fessPaid = new BigNumber(queryData.feesPaid);
  const currentLinear = mintedLinear.minus(unstakedLinear);
  const transferReward = await getTransferIncome(accountId);
  const tfReward = new BigNumber(transferReward);
  const reward = currentLinear
    .times(price1)
    .integerValue()
    .minus(stakedNear)
    .plus(unstakedGetNEAR)
    .plus(tfReward);
  // console.log("calc [subgraph]",
  //   mintedLinear.toString(),
  //   unstakedLinear.toString(),
  //   price1.toString(),
  //   stakedNear.toString(),
  //   unstakedGetNEAR.toString()
  // );

  if (flag) {
    const rewardFinal = reward.plus(fessPaid);
    console.log(
      'rewards [subgraph with fee] =\t\t %s NEAR',
      rewardFinal.div(10 ** 24).toFixed(8)
    );
    return rewardFinal;
  } else {
    console.log(
      'rewards [subgraph without fee] =\t %s NEAR',
      reward.div(10 ** 24).toFixed(8)
    );
    return reward;
  }
}

async function getDeposits(accountId) {
  const result = await fetch(
    `https://api.linearprotocol.org/deposits/${accountId}`
  );
  const json = await result.json();
  return json.deposits;
}

async function getStakingReward(accountId) {
  const contract = await loadContract();
  const [liNearPrice, account, linearBalance, deposits] = await Promise.all([
    contract.ft_price(),
    contract.get_account({ account_id: accountId }),
    contract.ft_balance_of({ account_id: accountId }),
    getDeposits(accountId),
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

  console.log(
    'rewards [indexer] =\t\t\t %s NEAR',
    near_reward.div(10 ** 24).toFixed(8)
  );
  return near_reward;
}

async function stakingRewardsDiff(accountId) {
  const [
    rewards_subgraph_with_fee,
    // rewards_subgraph,
    rewards_indexer,
  ] = await Promise.all([
    getUserIncome(accountId, true),
    // getUserIncome(accountId, false),
    getStakingReward(accountId),
  ]);
  // console.log("diff [subgraph - indexer] =\t\t %s NEAR", rewards_subgraph.minus(rewards_indexer).div(10 ** 24).toFixed(8));
  console.log(
    'diff [subgraph with fee - indexer] =\t %s NEAR',
    rewards_subgraph_with_fee
      .minus(rewards_indexer)
      .div(10 ** 24)
      .toFixed(8)
  );
}

async function test() {
  const accountIds = [
    'cookiemonster.near',
    'retitre.near',
    'calmincome1.near',
    'linguists.near',
  ];
  for (const accountId of accountIds) {
    console.log('\nstaking rewards: account: ', accountId);
    await queryStakeTime(accountId);
    await stakingRewardsDiff(accountId);
  }
}

test();
