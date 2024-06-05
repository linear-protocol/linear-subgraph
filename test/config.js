const { keyStores } = require('near-api-js');
const { BigNumber } = require('bignumber.js');

const keyStore = new keyStores.InMemoryKeyStore();

BigNumber.config({
  DECIMAL_PLACES: 64,
});

const config = {
  mainnet: {
    near: {
      networkId: 'mainnet',
      keyStore, // optional if not signing transactions
      nodeUrl:
        process.env.NEAR_CLI_MAINNET_RPC_SERVER_URL ||
        'https://rpc.mainnet.near.org',
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.near.org',
      explorerUrl: 'https://explorer.near.org',
    },
    subgraph: {
      apiUrl:
        'https://api.studio.thegraph.com/query/76854/linear/version/latest',
    },
    contract_id: 'linear-protocol.near',
  },
  testnet: {
    near: {
      networkId: 'testnet',
      keyStore, // optional if not signing transactions
      nodeUrl:
        process.env.NEAR_CLI_TESTNET_RPC_SERVER_URL ||
        'https://rpc.testnet.near.org',
      walletUrl: 'https://wallet.testnet.near.org',
      helperUrl: 'https://helper.testnet.near.org',
      explorerUrl: 'https://explorer.testnet.near.org',
    },
    subgraph: {
      apiUrl:
        'https://api.studio.thegraph.com/query/76854/linear-testnet/version/latest',
    },
    contract_id: 'linear-protocol.testnet',
  },
};

module.exports = config;
