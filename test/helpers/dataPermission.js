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

const AccessPermissionType = {
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
    Permission: [
       {
           name:"dataowner",
           type: "address"   
       },
       {
            name:"requesterId",
            type: "uint256"   
       },
       {
            name:"dhash",
            type: "bytes"   
        },
        {
            name: "productId",
            type: "uint256"
        },
        {
           name: "nonce",
           type: "uint256"
        },
        {
            name: "expiration",
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

const createPermissionMessage = (dataowner,requesterId,dhash,productId,nonce,expiration) => {    
    return {
        dataowner:dataowner,
        requesterId:requesterId,
        dhash:dhash,
        productId:productId,
        nonce:nonce,
        expiration:expiration
    }
}

const accessPermissionSignature = async (dataowner,requesterId,dhash,productId,nonce,expiration, chainId, verifyingContract, account) => {
    const msgParam = createPayLoad(createPermissionMessage(dataowner,requesterId,dhash,productId,nonce,expiration), AccessPermissionType, "Permission", chainId, verifyingContract);
    let sign = await getSign(account, msgParam);   
    return sign;
}

module.exports.accessPermissionSignature  = accessPermissionSignature ;