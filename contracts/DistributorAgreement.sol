// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/** 
 * @title Distributor agreement creation
 * @dev Contract module which provides a distributor agreement mechanism
 * that allows a distributor OR anyone with valid distributor's signature
 * to create a business agreement.
*/
contract DistributorAgreement is Ownable, Pausable {
    using ECDSA for bytes32;

    struct Distributor {
        bytes agreement;
        uint productUID;
        uint units;
        uint unitPrice;
        uint percentage;
    }

    // Mapping from distributor to info
    mapping(address => Distributor) private distributors;

    // Mapping from nonce to status
    mapping(uint => bool) private usedNonce;

    /**
     * @dev Emitted when a new agreement is created
    */
    event DistributorCreated(
        address distributor,
        bytes agreement,
        uint productUID,
        uint units,
        uint unitPrice,
        uint percentage
    );

    /**
     * @dev Distributor or anyone with a valid signature can create an agreement
     * @param distributor address 
     * @param sign distributor signature
     * @param agreement hash
     * @param productUID product unique ID on which agreement is made
     * @param totalUnits purchased 
     * @param unitPrice of an item
     * @param percentage agreed percentage, distributor will pay to Rejuve
     * @param nonce a unique number to prevent replay attacks
    */
    function createAgreement(
        address distributor,
        bytes memory sign,
        bytes memory agreement,
        uint productUID,
        uint totalUnits,
        uint unitPrice,
        uint percentage,
        uint nonce
    ) external {
        require(distributor != address(0), "REJUVE: Zero address");
        require(totalUnits > 0, "REJUVE: Total units can not be zero");
        require(unitPrice > 0, "REJUVE: Price can not be zero");
        require(percentage > 0, "REJUVE: Percentage can not be zero");
        require(
            _verifySignature(distributor, sign, agreement, nonce),
            "REJUVE: Invalid signature"
        );

        _createAgreement(
            distributor,
            agreement,
            productUID,
            totalUnits,
            unitPrice,
            percentage
        );
    }

    //---------------------------- OWNER FUNCTIONS --------------//

    /**
     * @dev Triggers stopped state.
    */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Returns to normal state.
    */
    function unpause() external onlyOwner {
        _unpause();
    }

    //-------------------- EXTERNAL VIEWS --------------------//

    /**
     * @return Distributor's agreement information
    */
    function getDistributorData(
        address distributor
    ) external view returns (Distributor memory) {
        return distributors[distributor];
    }

    //-------------------- PRIVATE --------------------------//

    function _createAgreement(
        address distributor,
        bytes memory agreement,
        uint productUID,
        uint totalUnits,
        uint unitPrice,
        uint percentage
    ) private {
        Distributor storage dist = distributors[distributor];
        dist.agreement = agreement;
        dist.productUID = productUID;
        dist.units = totalUnits;
        dist.unitPrice = unitPrice;
        dist.percentage = percentage;

        emit DistributorCreated(
            distributor,
            agreement,
            productUID,
            totalUnits,
            unitPrice,
            percentage
        );
    }

    /**
     * @dev Private function to verify user signature
     * @return bool flag true if valid signature
    */
    function _verifySignature(
        address distributor,
        bytes memory sign,
        bytes memory agreement,
        uint _nonce
    ) private returns (bool) {
        require(!usedNonce[_nonce], "REJUVE: Nonce used already");
        usedNonce[_nonce] = true;
        bytes32 msgHash = keccak256(
            abi.encodePacked(distributor, agreement, _nonce, address(this))
        );
        address signer = msgHash.toEthSignedMessageHash().recover(sign);

        if (signer == distributor) {
            return true;
        } else {
            return false;
        }
    }
}
