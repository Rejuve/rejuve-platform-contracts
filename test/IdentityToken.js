const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityToken", function () {
  let IdentityToken;
  let identityToken;
  let owner;
  let addr1;
  let addr2;
  let pauser;
  let others;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const CHAIN_ID = 31337; // Hardhat local default
  const INITIAL_TOKEN_ID = 1;

  // We'll just reuse the same hex value for identityKey and kycHash in tests
  const kycDataHash =
    "7924fbcf9a7f76ca5412304f2bf47e326b638e9e7c42ecad878ed9c22a8f1428";
  const identityKey = "0x" + kycDataHash;
  const kycHash = "0x" + kycDataHash;

  let nonce;
  let signature;

  before(async function () {
    [owner, addr1, addr2, pauser, ...others] = await ethers.getSigners();
    IdentityToken = await ethers.getContractFactory("IdentityToken");
    identityToken = await IdentityToken.deploy(
      "Rejuve Identities",
      "RUI",
      "1.0.0"
    );

    // no need for waitForDeployment() in Hardhat tests usually
    nonce = 1;
  });

  // --------------------------------------------------------------------------
  // Helper to get EIP-712 signature (matches IdentityToken.sol)
  // --------------------------------------------------------------------------

  async function signIdentity({
    _identityKey,
    _kycHash,
    _signer,
    _tokenUri,
    _nonce,
  }) {
    const domain = {
      name: "Rejuve Identities",
      version: "1.0.0",
      chainId: CHAIN_ID,
      verifyingContract: identityToken.address,
    };

    const types = {
      Identity: [
        { name: "identityKey", type: "bytes32" },
        { name: "kycHash", type: "bytes32" },
        { name: "signer", type: "address" },
        { name: "uri", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      identityKey: _identityKey,
      kycHash: _kycHash,
      signer: _signer.address,
      uri: _tokenUri,
      nonce: _nonce,
    };

    // ethers v5 style
    return _signer._signTypedData(domain, types, value);
  }

  // --------------------------------------------------------------------------
  // Basic metadata
  // --------------------------------------------------------------------------

  it("should assign given name", async function () {
    const name = await identityToken.name();
    expect(name).to.equal("Rejuve Identities");
  });

  it("should assign given symbol", async function () {
    const symbol = await identityToken.symbol();
    expect(symbol).to.equal("RUI");
  });

  // --------------------------------------------------------------------------
  // Roles & pause / unpause
  // --------------------------------------------------------------------------

  it("deployer should have DEFAULT_ADMIN_ROLE, ISSUER_ROLE and PAUSER_ROLE", async function () {
    const DEFAULT_ADMIN_ROLE = await identityToken.DEFAULT_ADMIN_ROLE();
    const ISSUER_ROLE = await identityToken.ISSUER_ROLE();
    const PAUSER_ROLE = await identityToken.PAUSER_ROLE();

    expect(await identityToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be
      .true;
    expect(await identityToken.hasRole(ISSUER_ROLE, owner.address)).to.be.true;
    expect(await identityToken.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
  });

  it("should pause and unpause contract by PAUSER_ROLE only", async function () {
    await identityToken.pause();
    expect(await identityToken.paused()).to.equal(true);

    // non-pauser cannot unpause
    await expect(identityToken.connect(addr1).unpause()).to.be.reverted;

    await identityToken.unpause();
    expect(await identityToken.paused()).to.equal(false);

    // non-pauser cannot pause
    await expect(identityToken.connect(addr1).pause()).to.be.reverted;
  });

  // --------------------------------------------------------------------------
  // Create identity
  // --------------------------------------------------------------------------

  it("should create identity for user 1 with valid signature", async function () {
    const tokenUri = "/tokenURIUser1";

    signature = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr1,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await identityToken
      .connect(owner) // owner has ISSUER_ROLE
      .createIdentity(
        signature,
        identityKey,
        kycHash,
        addr1.address,
        tokenUri,
        nonce
      );

    // Balance and owner identity
    expect(await identityToken.balanceOf(addr1.address)).to.equal(1);
    expect(await identityToken.getOwnerIdentity(addr1.address)).to.equal(
      INITIAL_TOKEN_ID
    );

    // Registration status
    expect(await identityToken.isRegistered(addr1.address)).to.equal(true);

    // Identity key mappings
    const currentToken = await identityToken.getCurrentTokenByIdentityKey(
      identityKey
    );
    expect(currentToken).to.equal(INITIAL_TOKEN_ID);

    const idKeyFromToken = await identityToken.getIdentityKeyByToken(
      INITIAL_TOKEN_ID
    );
    expect(idKeyFromToken).to.equal(identityKey);

    const history = await identityToken.getTokenHistoryByIdentityKey(
      identityKey
    );
    expect(history.length).to.equal(1);
    expect(history[0]).to.equal(INITIAL_TOKEN_ID);
  });

  it("should emit IdentityCreated and IdentityKeyLinked events", async function () {
    const tokenUri = "/tokenURIUser2";
    const identityKey2 =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const kycHash2 =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    nonce += 1;

    const sig2 = await signIdentity({
      _identityKey: identityKey2,
      _kycHash: kycHash2,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig2,
          identityKey2,
          kycHash2,
          addr2.address,
          tokenUri,
          nonce
        )
    )
      .to.emit(identityToken, "IdentityCreated")
      .withArgs(addr2.address, owner.address, 2, tokenUri)
      .and.to.emit(identityToken, "IdentityKeyLinked")
      .withArgs(identityKey2, 2, addr2.address);
  });

  it("should revert creating identity when contract is paused", async function () {
    const tokenUri = "/tokenURI_paused";
    const identityKey3 =
      "0x9999999999999999999999999999999999999999999999999999999999999999";
    const kycHash3 =
      "0x8888888888888888888888888888888888888888888888888888888888888888";

    nonce += 1;
    const sig3 = await signIdentity({
      _identityKey: identityKey3,
      _kycHash: kycHash3,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await identityToken.pause();

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig3,
          identityKey3,
          kycHash3,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.reverted;

    await identityToken.unpause();
  });

  it("should revert if signer is a zero address", async function () {
    const tokenUri = "/tokenURI_zero_signer";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr1,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey,
          kycHash,
          ZERO_ADDRESS,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Zero Address");
  });

  it("should revert if signature is empty", async function () {
    const tokenUri = "/tokenURI_empty_sig";
    const emptySig = "0x";

    nonce += 1;
    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          emptySig,
          identityKey,
          kycHash,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Empty Signature");
  });

  it("should revert if identityKey is empty", async function () {
    const tokenUri = "/tokenURI_empty_identityKey";
    const emptyKey =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: emptyKey,
      _kycHash: kycHash,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          emptyKey,
          kycHash,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Empty Identity Key");
  });

  it("should revert if kycHash is empty", async function () {
    const tokenUri = "/tokenURI_empty_kycHash";
    const emptyKyc =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: emptyKyc,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey,
          emptyKyc,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Empty KYC Hash");
  });

  it("should revert if token URI is empty", async function () {
    const tokenUri = ""; // empty string

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey,
          kycHash,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Empty Token URI");
  });

  it("should revert if nonce is zero", async function () {
    const tokenUri = "/tokenURI_zero_nonce";
    const zeroNonce = 0;

    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: zeroNonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey,
          kycHash,
          addr2.address,
          tokenUri,
          zeroNonce
        )
    ).to.be.revertedWith("REJUVE: Zero Nonce");
  });

  it("should revert if someone without ISSUER_ROLE tries to create identity", async function () {
    const tokenUri = "/tokenURI_no_issuer_role";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr2,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(addr1)
        .createIdentity(
          sig,
          identityKey,
          kycHash,
          addr2.address,
          tokenUri,
          nonce
        )
    ).to.be.reverted;
  });

  it("should revert if creating second identity for same user address", async function () {
    const tokenUri = "/tokenURIUser1_again";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr1,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey,
          kycHash,
          addr1.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: One Identity Per User");
  });

  it("should revert if identityKey is already active for another token", async function () {
    // identityKey2 and kycHash2 were used earlier for addr2 and are still active
    const tokenUri = "/tokenURI_conflict_identity_key";
    const identityKey2 =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const kycHash2 =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const freshUser = others[0]; // has NO identity yet

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey2,
      _kycHash: kycHash2,
      _signer: freshUser,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKey2,
          kycHash2,
          freshUser.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Identity Key Already Active");
  });


  it("should revert if using invalid signature", async function () {
    const tokenUri = "/tokenURI_invalid_sig";

    // fresh identity key & kyc hash never used before
    const badKey =
      "0x4444444444444444444444444444444444444444444444444444444444444444";
    const badKyc =
      "0x5555555555555555555555555555555555555555555555555555555555555555";

    const victim = others[1]; // no identity yet, NotRegistered

    nonce += 1;

    // Manually sign typed data with WRONG wallet (owner), but signer field = victim.address
    const domain = {
      name: "Rejuve Identities",
      version: "1.0.0",
      chainId: CHAIN_ID,
      verifyingContract: identityToken.address,
    };

    const types = {
      Identity: [
        { name: "identityKey", type: "bytes32" },
        { name: "kycHash", type: "bytes32" },
        { name: "signer", type: "address" },
        { name: "uri", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      identityKey: badKey,
      kycHash: badKyc,
      signer: victim.address,
      uri: tokenUri,
      nonce,
    };

    const sig = await owner._signTypedData(domain, types, value);

    await expect(
      identityToken
        .connect(owner)
        .createIdentity(sig, badKey, badKyc, victim.address, tokenUri, nonce)
    ).to.be.revertedWith("REJUVE: Invalid User Signature");
  });

  it("should revert if reusing the same signature (replay protection)", async function () {
    const tokenUri = "/tokenURI_replay";

    const replayUser = others[2]; // completely fresh user

    // new identityKey / kycHash for this test
    const identityKeyReplay =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const kycHashReplay =
      "0x2222222222222222222222222222222222222222222222222222222222222222";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKeyReplay,
      _kycHash: kycHashReplay,
      _signer: replayUser,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    // First time: OK (creates identity + marks _usedMessage[digest] = true)
    await identityToken
      .connect(owner)
      .createIdentity(
        sig,
        identityKeyReplay,
        kycHashReplay,
        replayUser.address,
        tokenUri,
        nonce
      );

    // Burn to reset registration + identityKey mapping, but NOT _usedMessage
    const replayUserToken = await identityToken.getOwnerIdentity(
      replayUser.address
    );
    await identityToken.connect(replayUser).burnIdentity(replayUserToken);

    // Second time with same signature: should now fail at _usedMessage check
    await expect(
      identityToken
        .connect(owner)
        .createIdentity(
          sig,
          identityKeyReplay,
          kycHashReplay,
          replayUser.address,
          tokenUri,
          nonce
        )
    ).to.be.revertedWith("REJUVE: Already Used ID");
  });

  // --------------------------------------------------------------------------
  // Burn identity & reissue with same identityKey
  // --------------------------------------------------------------------------

  it("should revert if burn is called by user other than owner", async function () {
    const user1Token = await identityToken.getOwnerIdentity(addr1.address);

    await expect(
      identityToken.connect(owner).burnIdentity(user1Token)
    ).to.be.revertedWith("REJUVE: Only Owner");
  });

  it("should revert if burn is called when contract is paused", async function () {
    const user1Token = await identityToken.getOwnerIdentity(addr1.address);

    await identityToken.pause();
    await expect(
      identityToken.connect(addr1).burnIdentity(user1Token)
    ).to.be.reverted;
    await identityToken.unpause();
  });

  it("should burn user1 token and clear mappings", async function () {
    const user1Token = await identityToken.getOwnerIdentity(addr1.address);

    await identityToken.connect(addr1).burnIdentity(user1Token);

    expect(await identityToken.balanceOf(addr1.address)).to.equal(0);
    expect(await identityToken.getOwnerIdentity(addr1.address)).to.equal(0);
    expect(await identityToken.isRegistered(addr1.address)).to.equal(false);

    const idKey = await identityToken.getIdentityKeyByToken(user1Token);
    expect(idKey).to.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    const currentToken = await identityToken.getCurrentTokenByIdentityKey(
      identityKey
    );
    expect(currentToken).to.equal(0);
  });

  it("should allow reissuing identity for same identityKey after burn, and append history", async function () {
    const tokenUri = "/tokenURIUser1_reissue";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKey,
      _kycHash: kycHash,
      _signer: addr1,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    await identityToken
      .connect(owner)
      .createIdentity(
        sig,
        identityKey,
        kycHash,
        addr1.address,
        tokenUri,
        nonce
      );

    const newTokenId = await identityToken.getOwnerIdentity(addr1.address);
    expect(newTokenId).to.be.gt(0);

    const currentToken = await identityToken.getCurrentTokenByIdentityKey(
      identityKey
    );
    expect(currentToken).to.equal(newTokenId);

    const history = await identityToken.getTokenHistoryByIdentityKey(
      identityKey
    );
    expect(history.length).to.equal(2);
    // history[0] = old tokenId (1), history[1] = new tokenId
    expect(history[1]).to.equal(newTokenId);
  });

  // --------------------------------------------------------------------------
  // Extra coverage: views for empty/non-existing state
  // --------------------------------------------------------------------------

  it("should return zero for getOwnerIdentity on address with no identity", async function () {
    const someRandom = others[0].address;
    expect(await identityToken.getOwnerIdentity(someRandom)).to.equal(0);
    expect(await identityToken.isRegistered(someRandom)).to.equal(false);
  });

  it("should return zero / empty for identityKey that was never used", async function () {
    const unusedKey =
      "0x3333333333333333333333333333333333333333333333333333333333333333";

    const currentToken =
      await identityToken.getCurrentTokenByIdentityKey(unusedKey);
    const history =
      await identityToken.getTokenHistoryByIdentityKey(unusedKey);

    expect(currentToken).to.equal(0);
    expect(history.length).to.equal(0);
  });

  it("should return zero identityKey for token that was never mapped", async function () {
    const nonExistingTokenId = 9999;
    const key = await identityToken.getIdentityKeyByToken(nonExistingTokenId);
    expect(key).to.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  });

  // --------------------------------------------------------------------------
  // SoulBound transfer restrictions (including approve & setApprovalForAll)
  // --------------------------------------------------------------------------

  it("should revert if user tries to transfer their identity token", async function () {
    const tokenId = await identityToken.getOwnerIdentity(addr1.address);

    await expect(
      identityToken
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, tokenId)
    ).to.be.revertedWith("REJUVE: Non-transferable");

    await expect(
      identityToken
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          addr1.address,
          addr2.address,
          tokenId
        )
    ).to.be.revertedWith("REJUVE: Non-transferable");

    await expect(
      identityToken
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          addr1.address,
          addr2.address,
          tokenId,
          "0x"
        )
    ).to.be.revertedWith("REJUVE: Non-transferable");
  });

  it("should revert on approve and setApprovalForAll (SoulBound)", async function () {
    const tokenId = await identityToken.getOwnerIdentity(addr1.address);

    await expect(
      identityToken.connect(addr1).approve(addr2.address, tokenId)
    ).to.be.revertedWith("REJUVE: Non-transferable");

    await expect(
      identityToken.connect(addr1).setApprovalForAll(addr2.address, true)
    ).to.be.revertedWith("REJUVE: Non-transferable");
  });

  it("should still revert transfer when contract is paused", async function () {
    const tokenId = await identityToken.getOwnerIdentity(addr1.address);

    await identityToken.pause();

    await expect(
      identityToken
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, tokenId)
    ).to.be.revertedWith("REJUVE: Non-transferable");

    await identityToken.unpause();
  });

  // --------------------------------------------------------------------------
  // Supports interface
  // --------------------------------------------------------------------------

  it("should support AccessControl, ERC721 and ERC165 interfaces", async function () {
    const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";
    const ERC721_INTERFACE_ID = "0x80ac58cd";
    const ERC165_INTERFACE_ID = "0x01ffc9a7";

    expect(
      await identityToken.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)
    ).to.equal(true);
    expect(
      await identityToken.supportsInterface(ERC721_INTERFACE_ID)
    ).to.equal(true);
    expect(
      await identityToken.supportsInterface(ERC165_INTERFACE_ID)
    ).to.equal(true);
  });

// --------------------------------------------------------------------------
// Extra coverage: burn-mapping branch and _beforeTokenTransfer
// --------------------------------------------------------------------------

  it("should hit _beforeTokenTransfer on mint (from == 0, whenNotPaused)", async function () {
    const user = others[4]; // another fresh user
    const tokenUri = "/mint_coverage_tokenURI";

    const localIdentityKey =
      "0x9999999999999999999999999999999999999999999999999999999999999999";
    const localKycHash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: localIdentityKey,
      _kycHash: localKycHash,
      _signer: user,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    // Contract should be unpaused here; this will hit _beforeTokenTransfer(from=0,to=user)
    await identityToken
      .connect(owner)
      .createIdentity(
        sig,
        localIdentityKey,
        localKycHash,
        user.address,
        tokenUri,
        nonce
      );

    const tokenId = await identityToken.getOwnerIdentity(user.address);
    expect(tokenId).to.be.gt(0); // confirms mint succeeded and hook ran
  });

  it("should clear identityKey mappings on burn (covers if(identityKey != 0) block)", async function () {
    const user = others[3];
    const tokenUri = "/burn_coverage_tokenURI";

    // valid bytes32 values using ethers v5
    const localIdentityKey = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("identity-key-burn-clear")
    );
    const localKycHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("kyc-hash-burn-clear")
    );

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: localIdentityKey,
      _kycHash: localKycHash,
      _signer: user,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    // mint identity
    await identityToken
      .connect(owner)
      .createIdentity(
        sig,
        localIdentityKey,
        localKycHash,
        user.address,
        tokenUri,
        nonce
      );

    const tokenId = await identityToken.getOwnerIdentity(user.address);

    // BEFORE burn
    expect(await identityToken.getCurrentTokenByIdentityKey(localIdentityKey)).to.equal(tokenId);
    expect(await identityToken.getIdentityKeyByToken(tokenId)).to.equal(localIdentityKey);

    // BURN (executes the if(identityKey != 0) block)
    await identityToken.connect(user).burnIdentity(tokenId);

    // AFTER burn
    expect(await identityToken.getCurrentTokenByIdentityKey(localIdentityKey)).to.equal(0);
    expect(await identityToken.getIdentityKeyByToken(tokenId)).to.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  });

  it("should hit _beforeTokenTransfer on burn (to == 0, whenNotPaused)", async function () {
    const user = others[4]; // fresh user that didn't mint before in these extra tests
    const tokenUri = "/burn_whenNotPaused_coverage";

    // ensure NOT paused
    if (await identityToken.paused()) {
      await identityToken.connect(owner).unpause();
    }

    const identityKeyBurn = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("identity-key-burn-whenNotPaused-unique")
    );
    const kycHashBurn = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("kyc-hash-burn-whenNotPaused-unique")
    );

    nonce += 1;
    const sig = await signIdentity({
      _identityKey: identityKeyBurn,
      _kycHash: kycHashBurn,
      _signer: user,
      _tokenUri: tokenUri,
      _nonce: nonce,
    });

    // mint — this hits _beforeTokenTransfer(from = 0, to = user)
    await identityToken
      .connect(owner)
      .createIdentity(
        sig,
        identityKeyBurn,
        kycHashBurn,
        user.address,
        tokenUri,
        nonce
      );

    const tokenId = await identityToken.getOwnerIdentity(user.address);
    expect(tokenId).to.be.gt(0);

    // burn — this hits _beforeTokenTransfer(from = user, to = 0) with whenNotPaused
    await identityToken.connect(user).burnIdentity(tokenId);

    expect(await identityToken.balanceOf(user.address)).to.equal(0);
    expect(await identityToken.getOwnerIdentity(user.address)).to.equal(0);
  });

});
