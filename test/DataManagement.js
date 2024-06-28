const { expect } = require("chai");
let _getSign = require ('./modules/GetSign');
let getSignature = require("./helpers/signer");
let getDataSign = require("./helpers/datamgtSigner");
let permissionSign = require("./helpers/dataPermission");

const { zeroAddress } = require("ethereumjs-util");

describe("Data Management Contract", function () {

    let _identityToken;
    let identityToken;
    let _dataMgt;
    let dataMgt;
    let owner;
    let addr1;
    let addr2;
    let sponsor;
    let lab;
    let reseracher;
    let addrs;
    let index=0;
    let signature;
    let signature2;
    let dataHash = "0x622b1092273fe26f6a2c370a5c34a690337e7f802f2fa5006b40790bd3f7d69b"; 
    let dataHash2 = "0x622b1092273fe26f6a2c370a5c34a690337e7f802f2fa5006b40790bd3f7d68c"; 

    const kycDataHash= "7924fbcf9a7f76ca5412304f2bf47e326b638e9e7c42ecad878ed9c22a8f1428";
    const zero_address = "0x0000000000000000000000000000000000000000";
    const kyc = "0x" + kycDataHash;
    let nonce = 1;
    let chainID = 31337;
    let expiration = 2; // 2 days 
    let nextProductId = 1001;

    before(async function () {
        [owner, addr1, addr2, sponsor, lab, reseracher, ...addrs] = await ethers.getSigners();

        _identityToken = await ethers.getContractFactory("IdentityToken");
        identityToken = await _identityToken.deploy("Rejuve Identities", "RUI", "1.0.0", sponsor.address);

        _dataMgt = await ethers.getContractFactory("DataManagement");
        dataMgt = await _dataMgt.deploy("Data management", "1.0.0", sponsor.address, identityToken.address);
    }); 

    it("Should revert if trying to pause contract by address other than owner", async function () {
        await expect(dataMgt.connect(addr1).pause())
        .to.be.reverted;
    });

    //-------------------------------------- Data submission -----------------------------------//

    it("Should revert if trying dat asubmission when contract is paused", async function () {
        await dataMgt.pause();
        // Get data signature from data owner 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr1.address, dataHash, nonce, chainID, dataMgt.address, addr1);
        await expect(dataMgt.connect(sponsor).submitData(addr1.address, dataSignature, dataHash, nonce))
        .to.be.reverted;

        await expect(dataMgt.connect(addr1).unpause())
        .to.be.reverted;

        await dataMgt.unpause();
    });

    it("Should revert if someone other than sponser is submitting data", async function () {
        // Get data signature from data owner 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr1.address, dataHash, nonce, chainID, dataMgt.address, addr1);
        await expect(dataMgt.connect(addr1).submitData(addr1.address, dataSignature, dataHash, nonce))
        .to.be.reverted;
    });

    it("Should revert if data owner is not registered", async function () {
        // Get data signature from data owner 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr1.address, dataHash, nonce, chainID, dataMgt.address, addr1);

        await expect(dataMgt.connect(sponsor).submitData(addr1.address, dataSignature, dataHash, nonce))
        .to.be.revertedWith("REJUVE: Not Registered");
    });

    it("Should allow submitting data on the behalf of user 1", async function () {
        // create identity for user 1
        let tokenUri = "/tokenURIHere";
        let identitySignature = await getSignature.identityRequestSignature(kyc, addr1.address, tokenUri, nonce, chainID, identityToken.address, addr1); 
        await identityToken.connect(sponsor).createIdentity(identitySignature, kyc, addr1.address, "/tokenURIHere", nonce);

        // Get data signature from data owner 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr1.address, dataHash, nonce, chainID, dataMgt.address, addr1);

        // Revert if signer is a zero address 
        await expect(dataMgt.connect(sponsor).submitData(zero_address, dataSignature, dataHash, nonce))
        .to.be.revertedWith("REJUVE: Zero address");

        // data submission 
        await dataMgt.connect(sponsor).submitData(addr1.address, dataSignature, dataHash, nonce);

        expect(await dataMgt.getDataByTokenId(identityToken.getOwnerIdentity(addr1.address),index))
        .to.equal(dataHash);

        expect (await dataMgt.getDataOwnerId(dataHash))
       .to.equal(await identityToken.getOwnerIdentity(addr1.address));

        await expect(dataMgt.connect(sponsor).submitData(addr1.address, dataSignature, dataHash, nonce))
        .to.be.revertedWith("REJUVE: Already used id");
    });

    it("Should revert if invalid signature is used for submitting data", async function () {
        ++nonce;

        // create identity for user 2
        let tokenUri = "/tokenURIHere";
        let identitySignature = await getSignature.identityRequestSignature(kyc, addr2.address, tokenUri, nonce, chainID, identityToken.address, addr2); 
        await identityToken.connect(sponsor).createIdentity(identitySignature, kyc, addr2.address, tokenUri, nonce);

        // Get data signature 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr2.address, dataHash, nonce, chainID, dataMgt.address, sponsor);

        // data submission with invalid signature
        await expect (dataMgt.connect(sponsor).submitData(addr1.address, dataSignature, dataHash, nonce))
        .to.be.revertedWith("REJUVE: Invalid user signature");
    });

    it("Should allow submitting data on the behalf of user 2", async function () {
        ++nonce;
        // Get data signature 
        let dataSignature = await getDataSign.dataSubmissionSignature(addr2.address, dataHash2, nonce, chainID, dataMgt.address, addr2);

        // data submission 
        await dataMgt.connect(sponsor).submitData(addr2.address, dataSignature, dataHash2, nonce);

        const tokenId = await identityToken.getOwnerIdentity(addr2.address);
        expect(await dataMgt.getDataByTokenId(tokenId, index))
        .to.equal(dataHash2);

        expect (await dataMgt.getDataOwnerId(dataHash2))
       .to.equal(await identityToken.getOwnerIdentity(addr2.address));
    });

    //-------------------------------------- Requester Permission -----------------------------------//

    it("Should permit lab to use data", async function () {
        ++nonce;
        // Create identity for lab
        let tokenUri = "/tokenURIHere";
        let identitySignature = await getSignature.identityRequestSignature(kyc, lab.address, tokenUri, nonce, chainID, identityToken.address, lab); 
        await identityToken.connect(sponsor).createIdentity(identitySignature, kyc, lab.address, tokenUri, nonce);
   
        //const labIdentityId = await identityToken.getOwnerIdentity(lab.address);

        // Get the current block timestamp
        let currentBlock = await ethers.provider.getBlock('latest');
        let currentTimestamp = currentBlock.timestamp;
    
        // Define the expected deadline
        let expectedDeadline = currentTimestamp + expiration;

        const invalidSign = await permissionSign.accessPermissionSignature(addr2.address, 3, dataHash2, nextProductId, nonce, expiration, chainID, dataMgt.address, sponsor)

        // Access permission with invalid signature
        await expect (dataMgt.connect(lab).getPermission(addr2.address, invalidSign, dataHash2, nextProductId, nonce, expiration))
        .to.be.revertedWith("REJUVE: Invalid user signature");

        const p_signature = await permissionSign.accessPermissionSignature(addr2.address, 3, dataHash2, nextProductId, nonce, expiration, chainID, dataMgt.address, addr2)
        
        await dataMgt.pause();

        // Access permission with invalid signature
        await expect (dataMgt.connect(lab).getPermission(addr2.address, p_signature, dataHash2, nextProductId, nonce, expiration))
        .to.be.reverted;

        await dataMgt.unpause();

        // Get permission
        await dataMgt.connect(lab).getPermission(addr2.address, p_signature, dataHash2, nextProductId, nonce, expiration);

        // Check permission status
        expect(await dataMgt.getPermissionStatus(dataHash2, nextProductId)).to.equal(1);
    
        // Calculate the permission hash
        const requestorID = await identityToken.getOwnerIdentity(lab.address);

        const permissionHash = ethers.utils.solidityKeccak256(
            ['uint256', 'bytes', 'uint256'],
            [requestorID, dataHash2, nextProductId]
        );
    
        // Retrieve all permissions and verify the permission hash
        const allPermissions = await dataMgt.getPermissionHashes(addr2.address);
        expect(allPermissions[0]).to.equal(permissionHash);
    
        // Verify the permission deadline
        let deadline = await dataMgt.getPermissionDeadline(dataHash2, nextProductId);
        let buffer = 5; // Buffer of 5 seconds
        expect(deadline).to.be.at.least(expectedDeadline);
        expect(deadline).to.be.at.most(expectedDeadline + buffer);

        await expect(dataMgt.connect(lab).getPermission(addr2.address, p_signature, dataHash2, nextProductId, nonce, expiration))
        .to.be.revertedWith("REJUVE: Already used id");

        // Not a data owner 
        const p_signature_2 = await permissionSign.accessPermissionSignature(addr1.address, 3, dataHash2, nextProductId, nonce, expiration, chainID, dataMgt.address, addr1)
        await expect (dataMgt.connect(lab).getPermission(addr1.address, p_signature_2, dataHash2, nextProductId, nonce, expiration))
        .to.be.revertedWith("REJUVE: Not a Data Owner");
    });

    //------------ Support interface -------

    it("should support AccessControl interface", async function () {
        const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";
        expect(await dataMgt.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.equal(true);
    });
});