// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IProductNFT is IERC721 {

    function createProduct(uint _productCreatorId, uint _productUID, string memory _productURI, bytes[] memory _dataHashes, uint[] memory _creditScores) external;
    function linkNewData(uint _productUID, bytes[] memory _newDataHashes, uint[] memory _creditScores) external;
    function getProductToData(uint _productUID) external view returns (bytes[] memory);
    function getDataCredit(bytes _dHash, uint _productUID) external view returns(uint);
    function getDataOwnerAddress(bytes _dHash) external view returns(address);
}

