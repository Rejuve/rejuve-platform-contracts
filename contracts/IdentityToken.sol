// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.21;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/** 
 * @title Identity Management for data contributors
 * @dev Contract module which provides an identity creation mechanism
 * that allows rejuve to create identities on the behalf of user,
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

    // Mapping to keep track of used withdrawal messages
    mapping(bytes32 => bool) private _usedMessage;  

    /**
     * @dev Emitted when a new Identity is created
     */
    event IdentityCreated(address indexed caller, uint256 tokenId, string tokenURI);

    /**
     * @dev Emitted when identity owner burn his token
     */
    event IdentityDestroyed(address indexed owner, uint256 ownerId);

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
     * @notice Decentralized identitiies for data contributors. 
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
        require(
            tokenId == ownerToIdentity[_msgSender()],
            "REJUVE: Only Identity Owner"
        );
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
    function ifRegistered(address userAccount) external view returns (uint8) {
        return uint8(registrations[userAccount]);
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

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
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
        emit IdentityCreated(userAccount, tokenId, tokenURI);
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
            "REJUVE: Already used id"
        );

        address recoveredSigner = _getSigner(_hashTypedDataV4(digest), signature); 

        require(
            recoveredSigner == signer,
            "REJUVE: Invalid user signature"
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
        require(addr != address(0), "REJUVE: Zero address");
    }
    
    function _checkInputs(   
        bytes memory signature,
        bytes32 kyc,
        string memory tokenURI,
        uint256 nonce
    ) private pure {
        require(signature.length != 0, "REJUVE: Empty signature");
        require(kyc != bytes32(0), "REJUVE: Empty KYC data");
        require(bytes(tokenURI).length != 0, "REJUVE: Empty token URI");
        require(nonce != 0, "REJUVE: Zero nonce");
    }
}
