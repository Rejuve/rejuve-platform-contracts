# Rejuve Platform Contracts
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

## Project Structure
```bash 

├── contracts          # Solidity contracts
│   ├── interfaces     # Contract interfaces
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