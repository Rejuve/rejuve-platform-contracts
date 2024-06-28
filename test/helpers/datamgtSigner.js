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

const DataSubmissionType = {
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
    DataSubmission: [
       {
           name:"signer",
           type: "address"   
       },
       {
            name:"dhash",
            type: "bytes"   
        },
       {
           name: "nonce",
           type: "uint256"
       }
   ]
}

const createDomainSeparator = (chainId, verifyingContract) => {
    return {
        name: "Data management",
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

const createDataMessage = (signer,dhash,nonce) => {    
    return {
        signer:signer,
        dhash:dhash,
        nonce:nonce
    }
}

const dataSubmissionSignature = async (signer, dhash, nonce, chainId, verifyingContract, account) => {
    const msgParam = createPayLoad(createDataMessage(signer,dhash,nonce), DataSubmissionType, "DataSubmission", chainId, verifyingContract);
    let sign = await getSign(account, msgParam);   
    return sign;
}

module.exports.dataSubmissionSignature = dataSubmissionSignature;