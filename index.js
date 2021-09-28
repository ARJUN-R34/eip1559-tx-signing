const Web3 = require('web3');
const { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx');
const Common = require('@ethereumjs/common').default;
const { Chain, Hardfork } = require('@ethereumjs/common');
const bn = require('bn.js');
const dotenv = require('dotenv');

const Helper = require('./helper');

dotenv.config();

const web3 = new Web3(new Web3.providers.HttpProvider(`https://ropsten.infura.io/v3/${process.env.INFURA_KEY}`));

async function init({ from, to, value, gasLimit, data, nonce }) {
    const rawTx = await constructRawTx(web3, from, to, value);

    const { response: signedTransaction, error } = await signTransaction(rawTx);

    if (error) {
      return { error };
    }

    const response = await sendTx({signedTransaction})

    console.log('Transaction : ', response);

    return { response };
}

async function constructRawTx(web3, fromAddress, to, value) {  
    const count = await web3.eth.getTransactionCount(fromAddress);
  
    const defaultNonce = await web3.utils.toHex(count);

    const url = 'https://gas-api.metaswap.codefi.network/networks/1/suggestedGasFees';

    const { response } = await Helper.getRequest({url});
  
    const rawTx = {
      to,
      from: fromAddress,
      value: web3.utils.toHex(value),
      gasLimit: web3.utils.numberToHex(40000),
      maxPriorityFeePerGas: new bn(response.suggestedMaxPriorityFeePerGas),
      maxFeePerGas: parseInt(response.suggestedMaxFeePerGas),
      data: '0x00',
      nonce: defaultNonce,
      type: '0x1'
    };
  
    return rawTx;
}

async function signTransaction(rawTx) {
    await web3.eth.net.getNetworkType().then((e) => network = e);

    const privateKey = process.env.PRIVATE_KEY;

    const pkey = Buffer.from(privateKey, 'hex'); 

    const common = new Common({ chain: Chain.Ropsten, hardfork: Hardfork.London });

    const tx = FeeMarketEIP1559Transaction.fromTxData(rawTx, { common });
    
    const signedTx = tx.sign(pkey);

    const serializedTx = signedTx.serialize()

    return { response: serializedTx };
}

async function sendTx({ signedTransaction }) {
    try {
      const response = await web3.eth.sendSignedTransaction(signedTransaction);

      return response.transactionHash;
    } catch (error) {
      if (error.message === 'Returned error: insufficient funds for gas * price + value') {
        return { error: 'INSUFFICIENT_FUNDS' };
      }
      if (error.message === 'Returned error: base fee exceeds gas limit' || error.message === 'Returned error: intrinsic gas too low') {
        return { error: 'LOW_GAS_LIMIT' };
      }

      return { error: 'INSUFFICIENT_FUNDS' };
    }
}

async function test() {
  const response = await init({
      from: process.env.FROM_ADDRESS, to: process.env.TO_ADDRESS, value: process.env.VALUE,
  })

  console.log(response);
}

test()