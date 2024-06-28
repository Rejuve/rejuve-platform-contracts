// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Interfaces/IIdentityToken.sol";

/**
 * @title Data & permission management 
 * @dev Contract module which provides data submission and data access permission features.
 * It allows a caller to request specific data access by taking data owner's signature 
 * as permission.
*/
contract DataManagement is Context, AccessControl, EIP712, Pausable {
    
    // Role that perform pause/unpause operations
    bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

    // Role that perform data submission 
    bytes32 public constant SPONSOR_ROLE = keccak256('SPONSOR_ROLE');

    bytes32 public constant DATA_SUBMISSION_TYPE_HASH = keccak256(
        "DataSubmission(address signer,bytes dhash,uint256 nonce)"
    );

    bytes32 public constant PERMISSION_TYPE_HASH = keccak256(
        "Permission(address dataowner,uint256 requesterId,bytes dhash,uint256 productId,uint256 nonce,uint256 expiration)"
    );

    enum PermissionState {
        NotPermitted,
        Permitted
    }

    IIdentityToken private _identityToken;

    // Array to store all data hashes
    bytes[] private _dataHashes;

    // Mapping from data hash to owner identity
    mapping(bytes => uint256) private dataToOwner;

    // Mapping from owner identity to permission hashes
    mapping(uint256 => bytes32[]) private ownerToPermissions;

    // Mapping from owner identity to indexes => [dataHashes]
    mapping(uint256 => uint256[]) private ownerToDataIndexes;

    // Mapping from data hash to nextProductUID to permission state
    mapping(bytes => mapping(uint256 => PermissionState)) private dataToProductPermission;

    // Mapping from data hash to nextProductUID to permission deadline
    mapping(bytes => mapping(uint256 => uint256)) private dataToProductToExpiry;

    // Mapping to keep track of used withdrawal messages
    mapping(bytes32 => bool) private _usedMessage;  

    /**
     * @dev Emitted when a new data hash is submitted
    */
    event DataSubmitted(address indexed dataOwner, uint256 indexed dataOwnerId, bytes dataHash);

    /**
     * @dev Emitted when permission is granted to access requested data
     * to be used in a specific product
    */
    event PermissionGranted(
        uint256 indexed dataOwnerId,
        uint256 requesterId,
        uint256 nextProductUID,
        bytes dataHash,
        bytes32 permissionHash
    );

    constructor(
        string memory name,
        string memory version,
        address sponsor,
        IIdentityToken identityToken_
    )
        EIP712(name, version)
    {
        _checkNonZeroAddr(sponsor);
        _identityToken = identityToken_;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(SPONSOR_ROLE, sponsor);
        _grantRole(PAUSER_ROLE, _msgSender());
    }

    // ---------------------------- STEP 2 : Data Submission ------------------------

    /**
     * @notice Allow rejuve/sponsor to execute the transaction
     * @param signer is a data owner address who wants to submit data
     * @param signature - signer's signature (used here as permission for data submission)
     * @param dHash - Actual data hash in bytes
     * @param nonce A unique number to prevent replay attacks
     * @dev Allow only registered data owners
     * @dev check if data owner's signature is valid
     * @dev Link data owner's ID to submitted data hash
    */
    function submitData(
        address signer,
        bytes memory signature,
        bytes memory dHash,
        uint256 nonce
    )
        external
        whenNotPaused
        onlyRole(SPONSOR_ROLE)
    {
        _checkNonZeroAddr(signer);
        _isRegistered(signer);
        _isValidSignature(signature, signer, dHash, nonce);
        _submitData(signer, dHash);
    }

    //--------- Step 3: Get Permission By requester to access data ---------------------

    /**
     * @notice Requester is executing transaction
     * @dev Requester should be a registered identity
     * - check if requester provided correct data owner address
     * - check if valid signature is provided
     * @param signer Data owner address
     * @param signature Data owner's signature
     * @param dHash Data hash
     * @param nextProductUID General product ID used by requester (Lab)
     * @param nonce A unique number to prevent replay attacks
     * @param expiration A deadline
    */
    function getPermission(
        address signer,
        bytes memory signature,
        bytes memory dHash,
        uint256 nextProductUID,
        uint256 nonce,
        uint256 expiration
    ) 
        external 
        whenNotPaused 
    {
        _checkNonZeroAddr(signer);
        _isRegistered(signer);
        _isRegistered(_msgSender());
        
        uint256 requesterId = _identityToken.getOwnerIdentity(_msgSender());

        _preValidations(
            signer,
            signature,
            dHash,
            requesterId,
            nextProductUID,
            nonce,
            expiration
        );

        _getPermission(
            signer,
            dHash,
            requesterId,
            nextProductUID,
            expiration
        );
    }

    //--------------------- OWNER FUNCTIONS --------------------------------//
    /**
     * @dev Triggers stopped state.
     *
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Returns to normal state.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    //----------------------- OTHER SPPORTIVE VIEWS ---------------------------//

    /**
     * @dev Get index of [datahashes]
     * Get data based on index
     */
    function getDataByTokenId(
        uint256 tokenId,
        uint256 index
    ) external view returns (bytes memory) {
        uint256 dataIndex = ownerToDataIndexes[tokenId][index];
        return _dataHashes[dataIndex];
    }

    /**
     * @notice permission status of a datahash for a product UID
     * @return uint8 0 for not-permitted and 1 for permitted
     */
    function getPermissionStatus(
        bytes memory dHash,
        uint256 productUID
    ) external view returns (uint8) {
        return uint8(dataToProductPermission[dHash][productUID]);
    }

    // Return data owner identity token ID
    function getDataOwnerId(bytes memory dHash) external view returns (uint256) {
        return dataToOwner[dHash];
    }

    /** @notice A Data hash is allowed to be used in a product for a specific time (deadline)
     *  @return uint expiration time in seconds
     */
    function getPermissionDeadline(
        bytes memory dHash,
        uint256 nextProductUID
    ) external view returns (uint256) {
        return dataToProductToExpiry[dHash][nextProductUID];
    }

    /** 
     *  @return all permission hashes for a given owner
    */
    function getPermissionHashes(address owner) external view returns (bytes32[] memory) {
        return ownerToPermissions[_identityToken.getOwnerIdentity(owner)];
    }

    // -------------------- Public ---------------------//

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(
        bytes4 interfaceId
    ) 
        public 
        view 
        override(
            AccessControl
        ) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    //------------------------ PRIVATE FUNCTIONS -----------------------------//

    /**
     * @dev Private function to submit data
     * - Link index of data hash to user identity
     * - Save owner againt data
     */
    function _submitData(address dataOwner, bytes memory dHash) private {
        _dataHashes.push(dHash);
        uint256 index = _dataHashes.length - 1;
        uint256 tokenId = _identityToken.getOwnerIdentity(dataOwner);
        ownerToDataIndexes[tokenId].push(index);
        dataToOwner[dHash] = tokenId;

        emit DataSubmitted(dataOwner, tokenId, dHash);
    }

    /**
     * @dev Private function to get permission
     * - Generate permission hash via ~keccak256
     * - Save all permissions against each data owner ID
     * - Mark data as "permitted" to be used in a general/next product
     */
    function _getPermission(
        address dataOwner,
        bytes memory dHash,
        uint256 requesterId,
        uint256 nextProductUID,
        uint256 expiration
    ) private {
        bytes32 permissionHash = _generatePermissionHash(
            requesterId,
            dHash,
            nextProductUID
        );
        uint256 dataOwnerId = _identityToken.getOwnerIdentity(dataOwner);
        ownerToPermissions[dataOwnerId].push(permissionHash); // save all permissions hashes
        dataToProductPermission[dHash][nextProductUID] = PermissionState
            .Permitted;
        dataToProductToExpiry[dHash][nextProductUID] = _calculateDeadline(
            expiration
        );

        emit PermissionGranted(
            dataOwnerId,
            requesterId,
            nextProductUID,
            dHash,   
            permissionHash
        );
    }

    /**
     * @dev Pre-validations before data access permission
     * - check if caller is provided correct data owner
     * - check if valid signature is provided
     */
    function _preValidations(
        address signer,
        bytes memory signature,
        bytes memory dhash,
        uint256 requesterId,
        uint256 nextProductUID,
        uint256 nonce,
        uint256 expiration
    ) 
        private 
    {
        uint256 id = dataToOwner[dhash];
        require(
            id == _identityToken.getOwnerIdentity(signer),
            "REJUVE: Not a Data Owner"
        );

        _isValidPermissionSign(
            signature,
            signer,
            requesterId,
            dhash,
            nextProductUID,
            nonce,
            expiration
        );
    }

    function _isValidPermissionSign(
        bytes memory signature,
        address signer,
        uint256 requesterId,
        bytes memory dhash,
        uint256 nextProductUID,
        uint256 nonce,
        uint256 expiration
    ) 
        private
    {
        bytes32 digest =  keccak256(abi.encode(
            PERMISSION_TYPE_HASH,
            signer,
            requesterId,
            keccak256(dhash),
            nextProductUID,
            nonce,
            expiration
        ));
        
        require(
            !_usedMessage[digest], 
            "REJUVE: Already used id"
        );

        address recoveredSigner = _getSigner(_hashTypedDataV4(digest), signature); 

        require(
            recoveredSigner == signer,
            "REJUVE: Invalid user signature"
        );   

        _usedMessage[digest] = true;
    }

    function _isValidSignature(
        bytes memory signature,
        address signer, 
        bytes memory dhash,
        uint256 nonce
    ) 
        private
    {
        bytes32 digest =  keccak256(abi.encode(
            DATA_SUBMISSION_TYPE_HASH,
            signer,
            keccak256(dhash),
            nonce
        ));
        
        require(
            !_usedMessage[digest], 
            "REJUVE: Already used id"
        );

        address recoveredSigner = _getSigner(_hashTypedDataV4(digest), signature); 

        require(
            recoveredSigner == signer,
            "REJUVE: Invalid user signature"
        );   

        _usedMessage[digest] = true;
    }

    // -------------------- Helpers ---------------------//

    /**
     * @dev calculate permission expiration
     */
    function _calculateDeadline(uint256 expiration) private view returns (uint256) {
        uint256 deadline = block.timestamp + expiration;
        return deadline;
    }

    function _isRegistered(address user) private view {
        require(
            _identityToken.ifRegistered(user) == 1,
            "REJUVE: Not Registered"
        );
    }

    function _generatePermissionHash(
        uint256 requesterId,
        bytes memory dHash,
        uint256 nextProductUID
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(requesterId, dHash, nextProductUID)
        );
    }  

    function _getSigner(
        bytes32 digest, 
        bytes memory signature
    ) private pure returns (address){      
        return ECDSA.recover(digest, signature);
    }

    function _checkNonZeroAddr(address addr) private pure {
        require(addr != address(0), "REJUVE: Zero address");
    }
}