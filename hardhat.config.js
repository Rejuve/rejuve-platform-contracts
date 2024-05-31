require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('solidity-coverage');
require('@openzeppelin/test-helpers');
require('dotenv').config();

/**
 * @dev Replace keys in .env file to deploy contracts to a remote network
 */
const _ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const _GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  /**
   * @dev uncomment code below to deploy contracts to a remote network
  */
  // networks: {
  //   goerli: {
  //     url: `https://eth-goerli.alchemyapi.io/v2/${_ALCHEMY_API_KEY}`,
  //     accounts: [_GOERLI_PRIVATE_KEY].filter(key => key !== undefined)
  //   }
  // },

  gasReporter: {
    currency: 'USD',
    gasPrice: 36,
    outputFile: 'gas-report.txt',
    noColors: true,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 100000,
  }
};