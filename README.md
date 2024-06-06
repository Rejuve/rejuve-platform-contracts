# Rejuve.ai
Rejuve.ai revolutionizes data management and monetization by leveraging blockchain technology and NFTs, ensuring secure and transparent transactions while giving users full control and ownership over their data.

# Table of Contents
1. [Project Purpose](#project-purpose)
2. [Rejuve Platform Contracts Repository](#rejuve-platform-contracts-repository)
3. [Specification](#specification)
    - [Project Overview](#project-overview)
    - [Functional, Technical Requirements](#functional-technical-requirements)
4. [Roles](#roles)
5. [Technologies Used](#technologies-used)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Compile Contracts](#compile-contracts)
    - [Run Tests](#run-tests)
    - [View Coverage](#view-coverage)
    - [Deployment](#deployment)
    - [Project Scripts](#project-scripts)
9. [Contact](#contact)


## Project Purpose
The [Rejuve Data NFT](https://www.rejuve.ai/post/rejuve-data-nft) project aims to revolutionize the way data is managed and monetized through the use of Non-Fungible Tokens (NFTs). By leveraging blockchain technology, Rejuve ensures secure, transparent, and efficient data transactions, empowering users to have greater control and ownership over their data.

## Rejuve Platform Contracts Repository
This repository contains the smart contracts for the Rejuve platform, facilitating the core functionalities and operations of our decentralized application.

## Specification

### Project Overview
The Rejuve platform contracts are designed to implement the following functionalities,

1. **Identity Token**
    - Allows Rejuve admin to create identities on the behalf of the user, taking their signature as permission to create identity.
    - ERC721 token Implementation
2. **Data Management**
    - Provides data submission and data access permission features.
    - Allows a caller to request specific data access by taking data owner's signature as permission.

3. **Product NFT**
    - Allow a registered identity to create a product.
    - Allow Linking new data with existing product
    - ERC721 token Implementation

4. **Product Shards**
    - Product shards creation and allocation mechanism
    - ERC1155 token implementation

5. **Future Shards**
    - Shards creation for future contributors.
    - Inherits Product shards

6. **Transfer Shards**
    - Shards Transfer mechanism for both "Tradable" and "Locked" types
    - Inherits Future Shards

7. **Profit Distribution**
    - RJV token submission by users
    - Shard holders profit claim based on their shard holdings

8. **Shards Marketplace**
    - Shards listing 
    - Discounts mechanism 
    - Shards trading

9. **Voting**
    - To store proposal information & voting result on-chain


### Functional, Technical Requirements

1. The [Technical requirements](https://github.com/BushraHussain/rejuve-platform-contracts/tree/main/docs/1_Technical-requirements) for blockchain are detailed and outlined.
2. Refer to the [architecture](https://github.com/BushraHussain/rejuve-platform-contracts/tree/main/docs/2_Blockchain-architecture) for additional context.
3. [Smart contract flows](https://github.com/BushraHussain/rejuve-platform-contracts/tree/main/docs/3_Smart-contract-flows) are provided to illustrate the contract processes.


## Roles

1. **IdentityToken & DataManagement Contracts**

    - `Ownable`:
        - "Ownable" from OpenZeppelin is used to manage various permission.
        - Only owner can pause and unpause the contract.
        - By default, the owner account will be the one that deploys the contract.
        - The owner can transfer ownership to a new account.

2. **Product NFT contract**

    - "AccessControl" from OpenZeppelin is used to manage different roles:
    - `DEFAULT_ADMIN_ROLE`: Can grant and revoke any role.
    - `PAUSER_ROLE`: Can pause and unpause the contract.`
    - `SIGNER_ROLE`: Rejuve admin who signs the dataHashes, credit scores & related. 

3. **ProductShards, FutureShards and TransferShards Contracts**

    - `Ownable`: 
        - "Ownable" from OpenZeppelin is used to manage various permission.
        - Can pause and unpause the contract.
        - Can create & distribute shards to initial & future data contributors
        - By default, the owner account will be the one that deploys the contract.
        - The owner can transfer ownership to a new account.

4. **ProfitDistribution, ShardMarketplace & DistributorAgreement Contracts**

    - `Ownable`: 
        - "Ownable" from OpenZeppelin is used to manage various permission.
        - Can pause and unpause the contract.
        - By default, the owner account will be the one that deploys the contract.
        - The owner can transfer ownership to a new account.

5. **Voting Contract**

    - `Ownable`: 
        - "Ownable" from OpenZeppelin is used to manage various permission.
        - Can pause and unpause the contract.
        - Can Add proposal & voting result
        - By default, the owner account will be the one that deploys the contract.
        - The owner can transfer ownership to a new account.


## Technologies Used

- **Programming Languages & Development tools**

    - **Solidity:** The primary programming language used for smart contract development.
    - **Hardhat:** A comprehensive development environment for compiling, testing, and deploying smart contracts.
    - **Javascript:** Utilized for writing tests and scripts to interact with the smart contracts.

- **Libraries**
    - **Openzeppelin:** A library for secure smart contract development, providing reusable and tested modules.


## Project Structure
```bash 

├── contracts          # Solidity contracts
│   ├── Interfaces     # Contract interfaces
│   ├── mocks          # Mock contracts
├── scripts            # Deployment scripts
├── test               # Unit tests for contracts
├── hardhat.config.js  # Hardhat configuration
└── README.md          # Project documentation

```

## Getting Started

### Prerequisites

Ensure you have the following installed:
- Node.js (>=12.x)
- npm (>=6.x)
- Hardhat (>=2.x)

### Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/Rejuve/rejuve-platform-contracts.git
cd rejuve-platform-contracts
npm install 
```

### Compile Contracts
Compile the smart contracts using Hardhat:

```bash
npx hardhat compile
```

### Run Tests
Run the tests to ensure everything is working correctly:

```bash
npx hardhat test
```

### View Coverage
Run the command below to ensure 100% coverage 

```bash
npx hardhat coverage
```

### Deployment
Replace "deployContractNameHere.js" with file name in scripts folder to deploy a specific contract to the specified network. Check the "Project scripts" section for reference. 

```bash
npx hardhat run scripts/deployContractNameHere.js --network <network-name>
```

### Project Scripts

```bash 

# Deployment script for identity token contract
scripts/deployIdentityToken.js

# Deployment script for data management contract
scripts/deployDataMgt.js

# Deployment script for product NFT contract
scripts/deployProductNFT.js

# Deployment script for product shards contract
scripts/deployProductShards.js

```

### Contact
For questions or support, please contact us at info@rejuve.ai.