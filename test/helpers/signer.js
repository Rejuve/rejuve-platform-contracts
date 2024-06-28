const web3 = require("web3");

async function getSign (signer, data) {
    let sign;
    try {
        sign = await signer.provider.send("eth_signTypedData_v4", [signer.address, data]);    
    } catch (error) {
        console.log(error);     
    }
    return sign;
}

const IdentityType = {
    EIP712Domain: [{
       name: 'name',
       type: 'string'
    }, {
       name: 'version',
       type: 'string'
    }, {
       name: 'chainId',
       type: 'uint256'
    }, {
       name: 'verifyingContract',
       type: 'address'
    }],
    Identity: [
       {
           name: "kyc",
           type: "bytes32"
       },
       {
           name:"signer",
           type: "address"   
       },
       {
            name:"uri",
            type: "string"   
        },
       {
           name: "nonce",
           type: "uint256"
       },
   ]
}

const createDomainSeparator = (chainId, verifyingContract) => {
    return {
        name: "Rejuve Identities",
        version: "1.0.0",
        chainId: chainId,
        verifyingContract: verifyingContract
    }
}

const createPayLoad = (message, types, type, chainId, verifyingContract) => {

    const domain = createDomainSeparator(chainId, verifyingContract);
    const payload = JSON.stringify({
        types: types,
        domain: domain,
        primaryType: type,
        message: message
    }) 
    return payload
}

const createIdentityMessage = (kyc,signer,uri, nonce) => {    
    return {
        kyc:kyc,
        signer:signer,
        uri:uri,
        nonce:nonce
    }
}

const identityRequestSignature = async (kyc, signer, uri, nonce, chainId, verifyingContract, account) => {
    const msgParam = createPayLoad(createIdentityMessage(kyc, signer,uri,nonce), IdentityType, "Identity", chainId, verifyingContract);
    let sign = await getSign(account, msgParam);    
    return sign;
}


module.exports.identityRequestSignature = identityRequestSignature;