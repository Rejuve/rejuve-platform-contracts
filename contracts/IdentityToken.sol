// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/** 
 * @title Identity Management for data contributors
 * @notice SoulBound: transfers disabled; only mint (from 0) and burn (to 0) allowed.
 * @dev Contract module which provides an identity creation mechanism
 * that allows Rejuve to create identities on behalf of the user,
 * taking their signature as permission to create identity.
 * Also, users can burn their identities any time.
 *
 * IMPORTANT:
 * - `identityKey` is a stable, opaque, off-chain generated key (e.g. random bytes32),
 *   used as the persistent identity anchor.
 * - `kycHash` is a hash of the current KYC payload and may change when KYC provider/schema changes.
*/
contract IdentityToken is Context, ERC721URIStorage, AccessControl, EIP712, Pausable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    enum UserStatus {
        NotRegistered,
        Registered
    }

    // Role that performs pause/unpause operations
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    // Role that performs identity creations
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /**
     * @dev EIP-712 type hash for the Identity struct.
     *
     * struct Identity {
     *     bytes32 identityKey; // stable, random, off-chain generated key
     *     bytes32 kycHash;     // hash of current KYC payload
     *     address signer;      // user wallet signing this identity
     *     string  uri;         // tokenURI / metadata
     *     uint256 nonce;       // replay protection
     * }
     */
    bytes32 public constant IDENTITY_TYPE_HASH = keccak256(
        "Identity(bytes32 identityKey,bytes32 kycHash,address signer,string uri,uint256 nonce)"
    );

    // Mapping from owner address to its current Identity token
    mapping(address => uint256) private ownerToIdentity;

    // Mapping from user address to registration status
    mapping(address => UserStatus) private registrations;

    /**
     * @dev Replay protection mapping.
     * Each signed message digest is stored to prevent reuse.
     * The digest is bound to the EIP-712 domain via _hashTypedDataV4,
     * so it cannot be replayed across chains or different contract instances.
     */
    mapping(bytes32 => bool) private _usedMessage;  

    // -------------------------------------------------------------------------
    // Stable Identity Key Management
    // -------------------------------------------------------------------------

    /**
     * @dev Stable identityKey (random/opaque) => current active tokenId.
     * If 0, no active token is currently associated with this identityKey.
     */
    mapping(bytes32 => uint256) private _identityKeyToCurrentToken;

    /**
     * @dev Stable identityKey => history of all tokenIds ever issued
     * for this identityKey (including burned ones).
     */
    mapping(bytes32 => uint256[]) private _identityKeyToTokenHistory;

    /**
     * @dev tokenId => stable identityKey.
     */
    mapping(uint256 => bytes32) private _tokenIdToIdentityKey;

    /**
     * @dev Emitted when a stable identity key is linked to a token & owner
     * (including reissues after wallet change).
     */
    event IdentityKeyLinked(bytes32 indexed identityKey, uint256 indexed tokenId, address indexed owner);

    /**
     * @dev Emitted when a new Identity is created.
     */
    event IdentityCreated(address indexed identityOwner, address indexed sponsor, uint256 tokenId, string tokenURI);

    /**
     * @dev Emitted when identity owner burns their token.
     */
    event IdentityDestroyed(address indexed identityOwner, uint256 tokenId);

    constructor(
        string memory name, 
        string memory symbol,
        string memory version
    ) 
        ERC721(name, symbol) 
        EIP712(name, version)
    {
        _tokenIdCounter.increment();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ISSUER_ROLE, _msgSender());
        _grantRole(PAUSER_ROLE, _msgSender());
    }

    // -------------------- STEP 1 : Create Identity token ---------------------//

    /**
     * @notice Decentralized identities for data contributors. 
     * @dev Only one identity token per user address at a time.
     * @dev Rejuve admin can create identity token for user. User signature is mandatory.
     * @dev `identityKey` is the stable on-chain identity anchor for this human.
     *
     * @param signature user signature (EIP-712)
     * @param identityKey stable identity key (random/opaque, off-chain generated)
     * @param kycHash hash of the current KYC payload (provider-dependent)
     * @param signer user wallet address
     * @param tokenURI user metadata
     * @param nonce a unique number to prevent replay attacks
     */
    function createIdentity(
        bytes memory signature,
        bytes32 identityKey,
        bytes32 kycHash,
        address signer,
        string memory tokenURI,
        uint256 nonce
    )
        external
        whenNotPaused
        onlyRole(ISSUER_ROLE)
    {
        _checkInputs(signature, identityKey, kycHash, tokenURI, nonce);
        _checkNonZeroAddr(signer);

        // One active token per user address
        require(
            registrations[signer] == UserStatus.NotRegistered,
            "REJUVE: One Identity Per User"
        );

        // One active token per identity key
        require(
            _identityKeyToCurrentToken[identityKey] == 0,
            "REJUVE: Identity Key Already Active"
        );

        _isValidSignature(signature, identityKey, kycHash, signer, tokenURI, nonce);
        _createIdentity(signer, tokenURI, identityKey);
    }

    /**
     * @notice Burn identity token.
     * @dev Only identity owner can burn their token.
     */
    function burnIdentity(
        uint256 tokenId
    ) 
        external 
        whenNotPaused
    {
        require(ownerOf(tokenId) == _msgSender(), "REJUVE: Only Owner");
        _burnIdentity(tokenId);
    }

    //---------------------------- OWNER FUNCTIONS --------------------------------//

    /**
     * @dev Triggers stopped state.
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

    //----------------------------- EXTERNAL VIEWS --------------------------------//

    /**
     * @return token id (current Identity) of the given address.
     */
    function getOwnerIdentity(address owner) external view returns (uint256) {
        return ownerToIdentity[owner];
    }

    /**
     * @return registration status of a given user.
     */
    function isRegistered(address user) external view returns (bool) {
        return registrations[user] == UserStatus.Registered;
    }

    /**
     * @notice Get the stable identity key associated with a given tokenId.
     * @dev Returns bytes32(0) if tokenId has no associated identityKey.
     */
    function getIdentityKeyByToken(uint256 tokenId) external view returns (bytes32) {
        return _tokenIdToIdentityKey[tokenId];
    }

    /**
     * @notice Get the current active tokenId for a given identityKey.
     * @dev Returns 0 if there is no active token.
     */
    function getCurrentTokenByIdentityKey(bytes32 identityKey) external view returns (uint256) {
        return _identityKeyToCurrentToken[identityKey];
    }

    /**
     * @notice Get the full token history for an identityKey.
     * @dev Includes previous tokenIds that may have been burned.
     */
    function getTokenHistoryByIdentityKey(bytes32 identityKey) external view returns (uint256[] memory) {
        return _identityKeyToTokenHistory[identityKey];
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
        override
        (
            ERC721URIStorage, 
            AccessControl
        ) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    function approve(address, uint256) 
        public 
        pure
        override(ERC721, IERC721) 
    { 
        revert("REJUVE: Non-transferable"); 
    }

    function setApprovalForAll(address, bool) 
        public 
        pure
        override(ERC721, IERC721) 
    { 
        revert("REJUVE: Non-transferable"); 
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        // This will call ERC721.transferFrom, which triggers _beforeTokenTransfer
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    // -------------------- Internal ---------------------//

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        require(
            from == address(0) || to == address(0),
            "REJUVE: SoulBound Tokens are non-transferable"
        );
    }

    //----------------------------- PRIVATE FUNCTIONS -----------------------------//

    /**
     * @dev Private function to create identity token.
     * @return uint new token id created against caller
    */
    function _createIdentity(
        address userAccount,
        string memory tokenURI,
        bytes32 identityKey
    ) 
        private 
        returns(uint256) 
    {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        ownerToIdentity[userAccount]  = tokenId;
        registrations[userAccount]    = UserStatus.Registered; 

        // Stable identity key mappings
        _identityKeyToCurrentToken[identityKey] = tokenId;
        _identityKeyToTokenHistory[identityKey].push(tokenId);
        _tokenIdToIdentityKey[tokenId] = identityKey;

        emit IdentityCreated(userAccount, _msgSender(), tokenId, tokenURI);
        emit IdentityKeyLinked(identityKey, tokenId, userAccount);

        _safeMint(userAccount, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        return tokenId;
    }

    /**
     * @dev private function to burn the identity
     */
    function _burnIdentity(
        uint256 tokenId
    ) 
        private 
    {
        address owner = _msgSender();

        registrations[owner]   = UserStatus.NotRegistered;
        ownerToIdentity[owner] = 0;

        // Clear the "current" mapping for the associated identityKey
        bytes32 identityKey = _tokenIdToIdentityKey[tokenId];

        _identityKeyToCurrentToken[identityKey] = 0;
        delete _tokenIdToIdentityKey[tokenId];
        

        emit IdentityDestroyed(owner, tokenId);
        _burn(tokenId);   
    }

    // -------------------- Signature verifiers ---------------------//

    function _isValidSignature(
        bytes memory signature,
        bytes32 identityKey,
        bytes32 kycHash,
        address signer,
        string memory tokenURI,
        uint256 nonce
    ) 
        private
    {
        bytes32 digest = keccak256(
            abi.encode(
                IDENTITY_TYPE_HASH,
                identityKey,
                kycHash,
                signer,
                keccak256(bytes(tokenURI)),
                nonce
            )
        );
        
        require(
            !_usedMessage[digest], 
            "REJUVE: Already Used ID"
        );

        address recoveredSigner = _getSigner(_hashTypedDataV4(digest), signature); 

        require(
            recoveredSigner == signer,
            "REJUVE: Invalid User Signature"
        );   

        _usedMessage[digest] = true;
    }

    function _getSigner(
        bytes32 digest, 
        bytes memory signature
    ) private pure returns (address){      
        return ECDSA.recover(digest, signature);
    }

    // -------------------- Helpers ---------------------//

    function _checkNonZeroAddr(address addr) private pure {
        require(addr != address(0), "REJUVE: Zero Address");
    }
    
    function _checkInputs(   
        bytes memory signature,
        bytes32 identityKey,
        bytes32 kycHash,
        string memory tokenURI,
        uint256 nonce
    ) private pure {
        require(signature.length != 0, "REJUVE: Empty Signature");
        require(identityKey != bytes32(0), "REJUVE: Empty Identity Key");
        require(kycHash != bytes32(0), "REJUVE: Empty KYC Hash");
        require(bytes(tokenURI).length != 0, "REJUVE: Empty Token URI");
        require(nonce != 0, "REJUVE: Zero Nonce");
    }
}
