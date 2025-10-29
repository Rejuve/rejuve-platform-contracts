const { expect } = require("chai");
// let _getSign = require ('./modules/GetSign');
let getSignature = require("./helpers/signer");

describe("Identity Token Contract", function () {

    let _identityToken;
    let identityToken;
    let owner;
    let addr1;
    let addr2;
    let sponsor;
    let pauser;
    let addrs;
    let tokenId=1;
    const balance = 1;
    let userAddress1;
    let userAddress2;
    let nonce = 1;
    let chainID = 31337;
    let signature;
    const kycDataHash= "7924fbcf9a7f76ca5412304f2bf47e326b638e9e7c42ecad878ed9c22a8f1428";
    const kyc = "0x" + kycDataHash;
    const zero_address = "0x0000000000000000000000000000000000000000";

    before(async function () {
        [owner, addr1, addr2, sponsor, pauser, ...addrs] = await ethers.getSigners();
        _identityToken = await ethers.getContractFactory("IdentityToken");
        identityToken = await _identityToken.deploy("Rejuve Identities", "RUI", "1.0.0", sponsor.address);
        userAddress1 = addr1.address;
        userAddress2 = addr2.address;
    });  

    it("should assign given name", async function () {
        const name = await identityToken.name();
        expect("Rejuve Identities").to.equal(name);
    });

    it("should assign given symbol", async function () {
        const symbol = await identityToken.symbol();
        expect("RUI").to.equal(symbol);
    });

    //------------ Pause / Unpause contract -------

    it("Should pause/unpause contract", async function () {
        await identityToken.pause();
        expect(await identityToken.paused()).to.equal(true);
        await identityToken.unpause();
    });

    it("Should revert if trying to pause contract by address other than pauser role", async function () {
        await expect(identityToken.connect(addr1).pause())
        .to.be.reverted;

        await identityToken.pause();
    });

    it("Should revert if trying to unpause contract by address other than pauser role", async function () {
        await expect(identityToken.connect(addr1).unpause())
        .to.be.reverted;

        await identityToken.unpause();
    });

    //------------ Create identity token -------

    it("Should create identity", async function () {
        let tokenUri = "/tokenURIHere";
        signature = await getSignature.identityRequestSignature(kyc, addr1.address, tokenUri, nonce, chainID, identityToken.address, addr1); 

        await identityToken.connect(sponsor).createIdentity(signature, kyc, addr1.address, tokenUri, nonce);
       
        expect (await identityToken.balanceOf(userAddress1)).to.equal(balance);
        expect (await identityToken.getOwnerIdentity(userAddress1)).to.equal(tokenId);
        expect (await identityToken.ifRegistered(userAddress1)).to.equal(1);      

        console.log("<---- Trying to make account again for same user---> ");
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr1.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: One Identity Per User");
    });

    it("Should revert creating identity when contract is paused", async function () {
        await identityToken.pause();
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, "/tokenURIHere", nonce))
        .to.be.reverted;
        await identityToken.unpause();
    });

    it("Should revert if signer is a zero address", async function () {
        let tokenUri = "/tokenURIHere";
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, zero_address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Zero address");
    });

    it("Should revert if signature is empty", async function () {
        let tokenUri = "/tokenURIHere";
        let emptySignature = "0x"; // Representing an empty bytes array
        await expect(identityToken.connect(sponsor).createIdentity(emptySignature, kyc, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Empty signature");
    });

    it("Should revert if KYC is empty", async function () {
        let tokenUri = "/tokenURIHere";
        let emptyKYC = "0x0000000000000000000000000000000000000000000000000000000000000000"; // Representing an empty bytes32
        
        signature = await getSignature.identityRequestSignature(emptyKYC, addr2.address, tokenUri, nonce, chainID, identityToken.address, addr2); 
    
        await expect(identityToken.connect(sponsor).createIdentity(signature, emptyKYC, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Empty KYC data");
    });

    it("Should revert if empty token URI", async function () {
        let tokenUri = "";
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Empty token URI");
    });

    it("Should revert if nonce is zero", async function () {
        let tokenUri = "/tokenURI";
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, 0))
        .to.be.revertedWith("REJUVE: Zero nonce");
    });

    it("Should revert if someone other than sponsor is creating identity", async function () {
        let tokenUri = "/tokenURI";
        signature = await getSignature.identityRequestSignature(kyc, addr2.address, tokenUri, nonce, chainID, identityToken.address, addr2); 
    
        await expect(identityToken.connect(addr2).createIdentity(signature, kyc, addr2.address, tokenUri, nonce))
        .to.be.reverted;
    });

    it("Should create identity for user 2", async function () {
        let tokenUri = "/tokenURIHere";
        tokenId++;
        nonce++;
        signature = await getSignature.identityRequestSignature(kyc, addr2.address, tokenUri, nonce, chainID, identityToken.address, addr2); 
    
        await identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce);
       
        expect (await identityToken.balanceOf(userAddress2)).to.equal(balance);
        expect (await identityToken.getOwnerIdentity(userAddress2)).to.equal(tokenId);
        expect (await identityToken.ifRegistered(userAddress2)).to.equal(1);      

        console.log("<---- Trying to make account again for same user 2---> ");
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: One Identity Per User");

        //--------- Burn identity -----//
        await identityToken.connect(addr2).burnIdentity(identityToken.getOwnerIdentity(userAddress2));

        console.log("<---- Trying to make account using same signature for user 2---> ");
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Already used id");
    });

    it("Should revert if using invalid signature for user 2 ", async function () {
        let tokenUri = "/tokenURIHere";
        nonce++;
        signature = await getSignature.identityRequestSignature(kyc, addr2.address, tokenUri, nonce, chainID, identityToken.address, sponsor); 
    
        await expect(identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce))
        .to.be.revertedWith("REJUVE: Invalid user signature");
    });

    it("Should create identity for user 2 again", async function () {
        let tokenUri = "/tokenURIHere";
        tokenId++;
        nonce++;
        signature = await getSignature.identityRequestSignature(kyc, addr2.address, tokenUri, nonce, chainID, identityToken.address, addr2); 
    
        await identityToken.connect(sponsor).createIdentity(signature, kyc, addr2.address, tokenUri, nonce);
       
        expect (await identityToken.balanceOf(userAddress2)).to.equal(balance);
        expect (await identityToken.getOwnerIdentity(userAddress2)).to.equal(tokenId);
        expect (await identityToken.ifRegistered(userAddress2)).to.equal(1);   
    });

    //------------ Burn identity token -------

    it("Should revert if burn is called by user other than owner", async function () {
        await expect(identityToken.burnIdentity(identityToken.getOwnerIdentity(userAddress1)))
        .to.be.revertedWith("REJUVE: Only Identity Owner");
    });

    it("Should revert if burn is called when contract is paused", async function () {
        await identityToken.pause()
        await expect(identityToken.connect(addr1).burnIdentity(identityToken.getOwnerIdentity(userAddress1)))
        .to.be.reverted;
        await identityToken.unpause()
    });

    it("Should revert if will called transfer token", async function () {
        await expect(
          identityToken
            .connect(addr1)
            .transferFrom(await addr1.getAddress(), await addr2.getAddress(), 1)
        ).to.be.revertedWith("REJUVE: SoulBound Tokens are non-transferable");
    });

    it("Should burn given token Id", async function () {
        await identityToken.connect(addr1).burnIdentity(identityToken.getOwnerIdentity(userAddress1));        
        expect (await identityToken.balanceOf(userAddress1)).to.equal(0);
        expect (await identityToken.getOwnerIdentity(userAddress1)).to.equal(0);
        expect (await identityToken.ifRegistered(userAddress1)).to.equal(0);
    });

    //------------ Support interface -------

    it("should support AccessControl interface", async function () {
        const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";
        expect(await identityToken.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.equal(true);
    });
});
