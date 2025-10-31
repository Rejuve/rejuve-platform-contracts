// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.21;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/** 
 * @title Identity Management for data contributors
 * @notice SoulBound: transfers disabled; only mint (from 0) and burn (to 0) allowed.
 * @dev Contract module which provides an identity creation mechanism
 * that allows rejuve to create identities on behalf of the user,
 * taking their signature as permission to create identity.
 * Also, users can burn their identities any time
*/
contract IdentityToken is Context, ERC721URIStorage, AccessControl, EIP712, Pausable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    enum UserStatus {
        NotRegistered,
        Registered
    }

    // Role that perform pause/unpause operations
    bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

    // Role that perform identity creations
    bytes32 public constant SPONSOR_ROLE = keccak256('SPONSOR_ROLE');

    bytes32 public constant IDENTITY_TYPE_HASH = keccak256(
        "Identity(bytes32 kyc,address signer,string uri,uint256 nonce)"
    );

    // Mapping from owner to Identity token
    mapping(address => uint256) private ownerToIdentity;

    // Mapping from user to registration status
    mapping(address => UserStatus) private registrations;

    /**
     * @dev Replay protection mapping.
     * Each signed message digest is stored to prevent reuse.
     * Note: The digest is hashed through _hashTypedDataV4(), which binds it
     * to the EIP-712 domain (including chainId, contract name, and version),
     * ensuring signatures cannot be replayed across different chains or
     * contract versions.
     */
    mapping(bytes32 => bool) private _usedMessage;  

    /**
     * @dev Emitted when a new Identity is created
     */
    event IdentityCreated(address indexed identityOwner, address indexed sponsor, uint256 tokenId, string tokenURI);

    /**
     * @dev Emitted when identity owner burn his token
     */
    event IdentityDestroyed(address indexed identityOwner, uint256 tokenId);

    constructor(
        string memory name, 
        string memory symbol,
        string memory version,
        address sponsor
    ) 
        ERC721(name, symbol) 
        EIP712(name, version)
    {
        _checkNonZeroAddr(sponsor);
        _tokenIdCounter.increment();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(SPONSOR_ROLE, sponsor);
        _grantRole(PAUSER_ROLE, _msgSender());
    }

    // -------------------- STEP 1 : Create Identity token ---------------------//

    /**
     * @notice Decentralized identities for data contributors. 
     * @dev Only one identity token per user
     * @dev Rejuve/sponsor can create identity token for user. User signature is mandatory
     * @param signature user signature
     * @param signer user address
     * @param tokenURI user metadata
     * @param nonce a unique number to prevent replay attacks
     */
    function createIdentity(
        bytes memory signature,
        bytes32 kyc,
        address signer,
        string memory tokenURI,
        uint256 nonce
    )
        external
        whenNotPaused
        onlyRole(SPONSOR_ROLE)
    {
        _checkInputs(signature, kyc, tokenURI, nonce);
        _checkNonZeroAddr(signer);
        require(
            registrations[signer] == UserStatus.NotRegistered,
            "REJUVE: One Identity Per User"
        );

        _isValidSignature(signature, kyc, signer, tokenURI, nonce);
        _createIdentity(signer, tokenURI);
    }

    /**
     * @notice Burn identity token
     * @dev only identity owner can burn his token
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
     * @return token id (Identity) of the given address.
     */
    function getOwnerIdentity(address owner) external view returns (uint256) {
        return ownerToIdentity[owner];
    }

    /**
     * @return caller registration status.
     */
    function isRegistered(address user) external view returns (bool) {
        return registrations[user] == UserStatus.Registered;
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
            ERC721URIStorage, 
            AccessControl
        ) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    function approve(address, uint256) public pure override { 
        revert("REJUVE: Non-transferable"); 
    }

    function setApprovalForAll(address, bool) public pure override { 
        revert("REJUVE: Non-transferable"); 
    }

    function transferFrom(address, address, uint256) public pure override { 
        revert("REJUVE: Non-transferable"); 
    }

    function safeTransferFrom(address, address, uint256) public pure override { 
        revert("REJUVE: Non-transferable"); 
    }
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override { 
        revert("REJUVE: Non-transferable"); 
    }

    // -------------------- Internal ---------------------//

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
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
        string memory tokenURI
    ) 
        private 
        returns(uint256) 
    {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        ownerToIdentity[userAccount] = tokenId;
        registrations[userAccount] = UserStatus.Registered; 
        emit IdentityCreated(userAccount, _msgSender(), tokenId, tokenURI);
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
        registrations[_msgSender()] = UserStatus.NotRegistered;
        ownerToIdentity[_msgSender()] = 0;
        emit IdentityDestroyed(_msgSender(), tokenId);
        _burn(tokenId);   
    }

    // -------------------- Signature verifiers ---------------------//

    function _isValidSignature(
        bytes memory signature,
        bytes32 kyc,
        address signer,
        string memory tokenURI,
        uint256 nonce
    ) 
        private
    {
        bytes32 digest =  keccak256(abi.encode(
            IDENTITY_TYPE_HASH,
            kyc,
            signer,
            keccak256(bytes(tokenURI)),
            nonce
        ));
        
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
        bytes32 kyc,
        string memory tokenURI,
        uint256 nonce
    ) private pure {
        require(signature.length != 0, "REJUVE: Empty Signature");
        require(kyc != bytes32(0), "REJUVE: Empty KYC Data");
        require(bytes(tokenURI).length != 0, "REJUVE: Empty Token URI");
        require(nonce != 0, "REJUVE: Zero Nonce");
    }
}
