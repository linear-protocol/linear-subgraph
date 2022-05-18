require('process');
require('isomorphic-unfetch');
const { createClient } = require('urql');
const { connect, Contract } = require('near-api-js');

const NETWORK = 'mainnet';
const config = require('./config')[NETWORK];

const client = createClient({
  url: config.subgraph.apiUrl,
})

let contract = null;

async function loadContract() {
  const near = await connect(config.near);
  const account = await near.account("");
  if (!contract) {
    contract = new Contract(
      account, // the account object that is connecting
      config.contract_id,
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
