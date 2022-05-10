require('process')
require('isomorphic-unfetch');
const { BigNumber } = require('bignumber.js')
const APIURL = 'https://api.thegraph.com/subgraphs/name/linear-protocol/linear'
const { createClient, Query } = require('urql')
const nearAPI = require('near-api-js')
const fs = require("fs");
const { connect } = nearAPI
const { keyStores, KeyPair } = require("near-api-js");
const keyStore = new keyStores.InMemoryKeyStore();

BigNumber.config({
  DECIMAL_PLACES: 64
})

const config = {
  networkId: "mainnet",
  keyStore, // optional if not signing transactions
  nodeUrl: process.env.NEAR_CLI_MAINNET_RPC_SERVER_URL || "https://rpc.mainnet.near.org",
  walletUrl: "https://wallet.near.org",
  helperUrl: "https://helper.near.org",
  explorerUrl: "https://explorer.near.org",
};

const client = createClient({
  url: APIURL,
})

let contract = null;

async function loadContract() {
  const near = await connect(config);
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

async function getSummaryFromContract() {
  const contract = await loadContract();
  let response = await contract.get_summary();
  //console.log(response);
  return response
}


async function queryPriceBefore(timeStamp) {
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
  if (queryData == null) {
    console.log("fail to query price")
    return
  }
  // console.log("price at %s : %s",timeStamp.toString(),queryData.prices[0].price.toString())
  return queryData.prices[0]
}

async function queryLatestPriceFromContract() {
  const contract = await loadContract();
  const price = await contract.ft_price();
  return {
    price: price / 10 ** 24,
    timeStamp: Date.now() * 1000000
  }
}


async function queryLatestPriceFromSubgraph() {
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
  if (queryData == null) {
    console.log("fail to query price")
    return
  }
  // console.log("current price: ",queryData.prices[0].price.toString())
  return queryData.prices[0]
}

module.exports = {
  client,
  loadContract,
  getSummaryFromContract,
  queryPriceBefore,
  queryLatestPriceFromContract,
  queryLatestPriceFromSubgraph
}
