const { expect } = require("chai");
let _getSign = require("./modules/GetSign");
let deploy = require("./modules/DeployContract");
let identity = require("./modules/CreateIdentity");
let data = require("./modules/DataSubmission");
let _testTime = require("./modules/TestTime");
let prod = require("./modules/Contracts")

let zero_address = "0x0000000000000000000000000000000000000000";

describe("Product shards - 1155", function () {

  let _identityToken;
  let identityToken;
  let _dataMgt;
  let dataMgt;
  let _productNFT;
  let productNFT;


  let _productShards;
  let productShards;
  let dataOwner1;
  let dataOwner2;
  let rejuveSponsor;
  let lab;
  let labID;
  let rejuveAdmin;
  let clinic;
  let dataOwner3; // new data owner
  let addr3;
  let addrs;
  let nonce = 1;

  let dataHash1 =
    "0x622b1092273fe26f6a2c370a5c34a690337e7f802f2fa5006b40790bd3f7d69b";
  let dataHash2 =
    "0x7012f98e24c6b2f609d365c959c99a9bc691d6939cc7162e679fb1226697a56b";
  let newDataHash =
    "0x1988284e7250800b37f11b3fbe7b25ad52b72cb5caff67934f69015a4263ffb5";

  let productUID = 200;
  let expiration = 2;
  expiration = expiration * 24 * 60 * 60;
  const shareTarget = 100;
  const shareDecimal = 2;
  const calculatedTarget = shareTarget * 10 ** shareDecimal;

  let daysLocked = 2;
  let lockPeriod = daysLocked * 24 * 60 * 60;

  before(async function () {
    [
      dataOwner1,
      dataOwner2,
      rejuveSponsor,
      addr3,
      lab,
      rejuveAdmin,
      clinic,
      dataOwner3,
      ...addrs
    ] = await ethers.getSigners();

    //-------------------- Deploy contracts ----------------------/

    _identityToken = await ethers.getContractFactory("IdentityToken");
    identityToken = await  _identityToken.deploy("Rejuve Identities","RI");

    _dataMgt = await ethers.getContractFactory("DataManagement");
    dataMgt = await _dataMgt.deploy(identityToken.address);

    _productNFT = await ethers.getContractFactory("ProductNFT"); 
    productNFT = await _productNFT.deploy(
      "Rejuve Products",
      "RP", 
      rejuveAdmin.address, 
      identityToken.address, 
      dataMgt.address
    );

    _productShards = await ethers.getContractFactory("TransferShards");
    productShards = await _productShards.deploy(
      "rejuveshards/",
      productNFT.address
    );

    prod.setContractAddress(productShards, productShards.address);

    //------------------ Create Identities -------------------------/

    // Create identity by rejuve sponsor for data owner 1
    await identity.createIdentity(
      dataOwner1.address,
      "/tokenURIHere",
      identityToken.address,
      dataOwner1,
      rejuveSponsor,
      identityToken
    );

    // Create identity by rejuve sponsor for data owner 2
    await identity.createIdentity(
      dataOwner2.address,
      "/tokenURIHere",
      identityToken.address,
      dataOwner2,
      rejuveSponsor,
      identityToken
    );

    // Create identity by rejuve sponsor for data owner 3
    await identity.createIdentity(
      dataOwner3.address,
      "/tokenURIHere",
      identityToken.address,
      dataOwner3,
      rejuveSponsor,
      identityToken
    );

    //Create identity by lab for itself
    await identity.createIdentity(
      lab.address,
      "/tokenURIHere",
      identityToken.address,
      lab,
      lab,
      identityToken
    );

    //------------------- Data Submission -------------------------/

    // submit data on the behalf of data owner 1
    await data.submitDataHash(
      dataOwner1.address,
      dataHash1,
      dataMgt.address,
      dataOwner1,
      rejuveSponsor,
      dataMgt
    );

    // submit data on the behalf of data owner 2
    await data.submitDataHash(
      dataOwner2.address,
      dataHash2,
      dataMgt.address,
      dataOwner2,
      rejuveSponsor,
      dataMgt
    );

    // submit data on the behalf of data owner 3
    await data.submitDataHash(
      dataOwner3.address,
      newDataHash,
      dataMgt.address,
      dataOwner3,
      rejuveSponsor,
      dataMgt
    );

    //----------------- Get Permission -------------------------------/

    // Get lab token ID (data requestor ID)
    labID = await identityToken.getOwnerIdentity(lab.address);

    // Get permission from data owner 1
    await data.getAccessPermission(
      dataOwner1.address,
      labID,
      dataHash1,
      productUID,
      expiration,
      dataMgt.address,
      dataOwner1,
      lab,
      dataMgt
    );

    // Get permission from data owner 2
    await data.getAccessPermission(
      dataOwner2.address,
      labID,
      dataHash2,
      productUID,
      expiration,
      dataMgt.address,
      dataOwner2,
      lab,
      dataMgt
    );
  });

  //----------------- Create Product -------------------------------//

  it("Should create productt ", async function () {

    // Get concatenated hash 
    let dataHashes = [dataHash1, dataHash2];
    let dataHashConcatenated = await _getSign.concatenatedHash(dataHashes);
    
    // Get sign on credit scores from an authorized signer 
    let signForProduct = await _getSign.getSignForProduct(
      productUID,
      nonce,
      "/ProductURI",
      rejuveAdmin.address,
      dataHashConcatenated,
      [10,20],
      lab.address,
      productNFT.address,
      rejuveAdmin
    );  
    
    // Product Creation by lab (lab)
    await productNFT
      .connect(lab)
      .createProduct(
        productUID,
        nonce,
        "/ProductURI",
        rejuveAdmin.address,
        signForProduct,
        [dataHash1,
        dataHash2],
        [10, 20]
      );
    ++nonce;      
    expect(await productNFT.ownerOf(productUID)).to.equal(lab.address);
    expect(await productNFT.tokenURI(productUID)).to.equal("/ProductURI");
  });

  //----------------- Create Shards -------------------------------//
  //------ Initial values
  //----- Product shards - initial

  it("Should revert if target supply is zero", async function () {
    await expect( productShards.distributeInitialShards(
      productUID,
      0,
      30,
      lockPeriod,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Target supply cannot be zero");
  })

  it("Should revert if lab credit is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      0,
      lockPeriod,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Lab credit cannot be zero");
  })

  it("Should revert if lock period is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      0,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Lock period cannot be zero");
  })

  it("Should revert if initial percent is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      0,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Initial percent cannot be zero");
  })

  it("Should revert if Rejuve percent is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      0,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Rejuve percent cannot be zero");
  })

  it("Should revert if Lab address is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      20,
      zero_address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Lab address cannot be zero");
  })

  it("Should revert if Rejuve address is zero", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      20,
      lab.address,
      zero_address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("REJUVE: Rejuve address cannot be zero");
  })

  it("Should revert if URIs are empty ", async function () {
    await expect(productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      []
    )).to.be.revertedWith("REJUVE: URIs length cannot be zero");
  })

  it("Should revert if createShard is called by address other than owner", async function () {
    await expect( productShards.connect(rejuveSponsor).distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should revert if create shard function is called when contract is paused", async function () {
    await productShards.pause();
    await expect( productShards.distributeInitialShards(
      productUID,
      100,
      30,
      lockPeriod,
      30,
      20,
      lab.address,
      rejuveAdmin.address,
      ["/product1Locked", "/product1Traded"]
    )).to.be.revertedWith("Pausable: paused");

  });

it("Should create 1155 based shards", async function () {
  await productShards.unpause();
  await productShards.distributeInitialShards(
    productUID,
    100,
    30,
    lockPeriod,
    30,
    20,
    lab.address,
    rejuveAdmin.address,
    ["/product1Locked", "/product1Traded"]
  );

  await _testTime.setLockPeriod(daysLocked);

  expect(await productShards.totalShardSupply(productUID)).to.equal(48);
  expect(await productShards.targetSupply(productUID)).to.equal(100);
  expect(await productShards.uri(0)).to.equal("/product1Locked");
  expect(await productShards.uri(1)).to.equal("/product1Traded");

  let productIds = await productShards.getProductIDs(productUID)
  expect(productIds[0]).to.equal(0);
  expect(productIds[1]).to.equal(1);
  expect(await productShards.getInitialDistributionStatus(productUID)).to.equal(true);
  
  let values = await productShards.getShardsConfig(productUID);
  expect(values).to.be.an('array').that.is.not.empty;

  //console.log("Shards Config :: ", values);

  expect(await productShards.balanceOf(dataOwner1.address, 0)).to.equal(2);
  expect(await productShards.balanceOf(dataOwner1.address, 1)).to.equal(2);
  expect(await productShards.balanceOf(dataOwner2.address, 0)).to.equal(4);
  expect(await productShards.balanceOf(dataOwner2.address, 1)).to.equal(5);
  expect(await productShards.balanceOf(rejuveAdmin.address, 0)).to.equal(10);
  expect(await productShards.balanceOf(rejuveAdmin.address, 1)).to.equal(10);
  expect(await productShards.balanceOf(lab.address, 0)).to.equal(7);
  expect(await productShards.balanceOf(lab.address, 1)).to.equal(8);

  let initialContributors = await productShards.getInitialContributors(productUID);
  expect(initialContributors).to.be.an('array').that.is.not.empty;

  let allShards = await productShards.getInitialContributorShards(productUID);
  expect(allShards).to.be.an('array').that.is.not.empty;  
});

it("Should revert if trying to create initial shards again", async function () {
  await expect(productShards.distributeInitialShards(
    productUID,
    100,
    30,
    lockPeriod,
    30,
    20,
    lab.address,
    rejuveAdmin.address,
    ["/product1Locked", "/product1Traded"]
  )).to.be.revertedWith("REJUVE: Initial shards distributed already");
})

//-------------------------------- Initial Ended --------------------------------//

//--------------------------------- Future Shards Start------------------------------------//

  it("Should revert if called by address other than owner", async function () {
    await expect (productShards.connect(rejuveSponsor).distributeFutureShards(
      productUID,
      40,
      [30, 50],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("Ownable: caller is not the owner"); 
  })

  it("Should revert if called when contract is paused", async function () {
    await productShards.pause();
    await expect (productShards.distributeFutureShards(
      productUID,
      40,
      [30, 50],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("Pausable: paused"); 
  })

  it("Should revert if lengths of credits and addresses array are not equal", async function () {
    await productShards.unpause();
    await expect (productShards.distributeFutureShards(
      productUID,
      40,
      [30, 50, 30],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("REJUVE: Not equal length"); 
  })

  it("Should revert if future contributor share percentage is zero", async function () {
    await expect (productShards.distributeFutureShards(
      productUID,
      0,
      [30, 50],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("REJUVE: Future percent cannot be zero"); 
  })

  it("Should create future shards - exceed limit shud fail", async function () {
    await expect(productShards.distributeFutureShards(
      productUID,
      60,
      [30, 50],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("REJUVE: Future percent exceeds available limit");

   })

  it("Should create future shards", async function () {
    await productShards.distributeFutureShards(
      productUID,
      40,
      [30, 50],
      [dataOwner3.address, clinic.address]
    );

    expect(await productShards.totalShardSupply(productUID)).to.equal(86);
    expect(await productShards.getFutureDistributionStatus(productUID)).to.equal(true);  

    expect(await productShards.balanceOf(dataOwner3.address, 0)).to.equal(7);
    expect(await productShards.balanceOf(dataOwner3.address, 1)).to.equal(7);

    expect(await productShards.balanceOf(clinic.address, 0)).to.equal(12);
    expect(await productShards.balanceOf(clinic.address, 1)).to.equal(12);

    let futureContributors = await productShards.getFutureContributors(productUID);
    expect(futureContributors).to.be.an('array').that.is.not.empty;
  
    let futureContributorShards = await productShards.getFutureContributorShards(productUID);
    expect(futureContributorShards).to.be.an('array').that.is.not.empty;
  })

  it("Should create future shards again - shud fail", async function () { 
    await expect(productShards.distributeFutureShards(
      productUID,
      40,
      [30, 50],
      [dataOwner3.address, clinic.address]
    )).to.be.revertedWith("REJUVE: Future shards distributed already"); 
  })
//------------------------------------- Future ended ------------------------------//

//----------------------------------- Transfer shard start -------------------------//

it("Should revert if contract is paused", async function () {
  await productShards.pause();
  await expect( 
    productShards.connect(dataOwner2).safeTransferFrom(
      dataOwner2.address,
      dataOwner3.address,
      1,
      2,
      "0x00"
    )).to.be.revertedWith("Pausable: paused");
});


  it("Should revert if contract is paused by address other than owner", async function () {
    await expect(productShards.connect(rejuveSponsor).pause()).to.be.revertedWith("Ownable: caller is not the owner");
  })

  it("Should revert if contract is unpause by address other than owner", async function () {
    await expect(productShards.connect(rejuveSponsor).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
  })


  it("Should transfer shards", async function () {
    await productShards.unpause(); 
    await productShards.safeTransferFrom(
      dataOwner1.address,
      dataOwner3.address,
      1,
      2,
      "0x00"
    );
  });

  it("Should lock shards", async function () { 
    await _testTime.checkTimeAfter(1);

    await expect( 
      productShards.connect(dataOwner2).safeTransferFrom(
        dataOwner2.address,
        dataOwner3.address,
        0,
        2,
        "0x00"
      )).to.be.revertedWith("REJUVE: Cannot sale 50% of shards before locking period");
  });

  it("Should unlock shards to be tranfered", async function () {
    await _testTime.checkTimeAfter(3);
    
    await productShards.connect(dataOwner2).safeTransferFrom(
      dataOwner2.address,
      dataOwner3.address,
      0,
      2,
      "0x00"
    );
  });

  it("Should revert if caller is not owner or an approved address", async function () {
    await expect(
      productShards.safeTransferFrom(
        rejuveSponsor.address,
        dataOwner3.address,
        1,
        2,
        "0x00"
      )
    ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
  });

  it("Should approve another address", async function () {
    await productShards
      .connect(dataOwner2)
      .setApprovalForAll(rejuveSponsor.address, true);
    expect(
      await productShards.isApprovedForAll(
        dataOwner2.address,
        rejuveSponsor.address
      )
    ).to.equal(true);

    await productShards
      .connect(rejuveSponsor)
      .safeTransferFrom(dataOwner2.address, dataOwner3.address, 1, 2, "0x00");

    expect(await productShards.balanceOf(dataOwner3.address, 1)).to.equal(11);
  });

  //----------------------------------- Other ----------------------------------------//

  it("should revert if contract is paused", async function () {
    await productShards.pause();
    expect(await productShards.paused()).to.equal(true);

    await expect(
      productShards.safeTransferFrom(
        dataOwner2.address,
        dataOwner3.address,
        1,
        2,
        "0x00"
      )
    ).to.be.revertedWith("Pausable: paused");
  });

  it("should unpause contract", async function () {
    await productShards.unpause();
    expect(await productShards.paused()).to.equal(false);
  });

});
