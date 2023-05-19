import * as algokit from '@algorandfoundation/algokit-utils';
import { ApplicationClient } from '@algorandfoundation/algokit-utils/types/app-client';
import algosdk from 'algosdk';
import appspec from '../../artifacts/application.json';
import PeraSession from './wallets/pera';

const BOX_CREATE_COST = 0.0025e6;
const BOX_BYTE_COST = 0.0004e6;

const pera = new PeraSession();
const algodClient = algokit.getAlgoClient(algokit.getAlgoNodeConfig('testnet', 'algod'));
const indexerClient = algokit.getAlgoIndexerClient(algokit.getAlgoNodeConfig('testnet', 'indexer'));

let daoAppId: number;
let daoApp: ApplicationClient;

const accountsMenu = document.getElementById('accounts') as HTMLSelectElement;

const urlInput = document.getElementById('url') as HTMLInputElement;
const hashInput = document.getElementById('hash') as HTMLInputElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const unitNameInput = document.getElementById('unit') as HTMLInputElement;
const reserveInput = document.getElementById('reserve') as HTMLInputElement;

const buttonIds = ['connect', 'create', 'submit'];
const buttons: { [key: string]: HTMLButtonElement } = {};
buttonIds.forEach((id) => {
  buttons[id] = document.getElementById(id) as HTMLButtonElement;
});

async function signer(txns: algosdk.Transaction[]) {
  return pera.signTxns(txns);
}

buttons.connect.onclick = async () => {
  await pera.getAccounts();
  buttons.create.disabled = false;
  pera.accounts.forEach((account) => {
    accountsMenu.add(new Option(account, account));
  });
};

buttons.create.onclick = async () => {
  document.getElementById('status').innerHTML = 'Creating DAO...';
  const sender = {
    addr: accountsMenu.selectedOptions[0].value,
    signer,
  };

  daoApp = algokit.getAppClient(
    {
      app: JSON.stringify(appspec),
      sender,
      creatorAddress: sender.addr,
      indexer: indexerClient,
    },
    algodClient,
  );

  const { appId, appAddress, transaction } = await daoApp.create();

  daoAppId = appId;

  document.getElementById('status').innerHTML = `App created with id ${appId} and address ${appAddress} in tx ${transaction.txID()}. See it <a href='https://testnet.algoscan.app/app/${appId}'>here</a>`;

  buttons.submit.disabled = false;
  buttons.create.disabled = true;
};

buttons.submit.onclick = async () => {
  document.getElementById('status').innerHTML = 'Sending proposal...';
  const sender = {
    addr: accountsMenu.selectedOptions[0].value,
    signer,
  };

  const proposalObject = {
    url: urlInput.value,
    hash: Buffer.from(hashInput.value, 'hex'),
    name: nameInput.value,
    unitName: unitNameInput.value,
    reserve: reserveInput.value,
  };


  // TODO get current proposal ID
  const proposalId = 0;

  const proposalKeyType = algosdk.ABIType.from('(address,uint64)')
  const proposalKeyPrefix = new Uint8Array(Buffer.from("p-"))
  const proposalKey = new Uint8Array([...proposalKeyPrefix, ...proposalKeyType.encode([sender.addr, proposalId])])

  const boxMbr = (proposalObject.url.length + proposalObject.hash.byteLength + proposalObject.name.length + proposalObject.unitName.length + proposalObject.reserve.length + proposalKey.byteLength) * BOX_BYTE_COST + BOX_CREATE_COST

  const payment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    suggestedParams: await algodClient.getTransactionParams().do(),
    amount: 100_000 + boxMbr,
    from: sender.addr,
    to: algosdk.getApplicationAddress(daoAppId),
  });
  
  const args = [Object.values(proposalObject), proposalId, { txn: payment, signer }]

  await daoApp.call({
    method: 'add_proposal',
    methodArgs: { args, boxes: [ { appIndex: 0, name: proposalKey } ] },
    sender,
  });

  document.getElementById('status').innerHTML = `Proposal submitted! See the app <a href='https://testnet.algoscan.app/app/${daoAppId}'>here</a>`;
};
