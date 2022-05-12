require('process')
require('isomorphic-unfetch');
const { BigNumber } = require('bignumber.js')
const { createClient } = require('urql')
const nearAPI = require('near-api-js')
const { connect } = nearAPI
const { keyStores } = require("near-api-js");

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
  subgraphUrl: "https://api.thegraph.com/subgraphs/name/linear-protocol/linear"
};

const client = createClient({
  url: config.subgraphUrl,
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

module.exports = {
  client,
  loadContract,
  getSummaryFromContract,
}
