import * as algokit from '@algorandfoundation/algokit-utils';
import { ApplicationClient } from '@algorandfoundation/algokit-utils/types/app-client';
import algosdk from 'algosdk';
import appspec from '../../artifacts/application.json';
import PeraSession from './wallets/pera';

declare let NETWORK : 'localnet' | 'testnet';

const BOX_CREATE_COST = 0.0025e6;
const BOX_BYTE_COST = 0.0004e6;

const pera = new PeraSession();

const algodClient = algokit.getAlgoClient(NETWORK === 'localnet' ? algokit.getDefaultLocalNetConfig('algod') : algokit.getAlgoNodeConfig('testnet', 'algod'));
const indexerClient = algokit.getAlgoIndexerClient(NETWORK === 'localnet' ? algokit.getDefaultLocalNetConfig('indexer') : algokit.getAlgoNodeConfig('testnet', 'indexer'));
const kmdClient = NETWORK === 'localnet' ? new algosdk.Kmd('a'.repeat(64), 'http://localhost', 4002) : undefined;

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
  if (NETWORK === 'localnet') {
    const acct = await algokit.getDispenserAccount(algodClient, kmdClient);
    return algosdk.makeBasicAccountTransactionSigner(acct)(txns, txns.map((_, i) => i));
  }

  return pera.signTxns(txns);
}

buttons.connect.onclick = async () => {
  if (NETWORK === 'localnet') {
    const acct = await algokit.getDispenserAccount(algodClient, kmdClient);
    accountsMenu.add(new Option(acct.addr, acct.addr));
  } else {
    await pera.getAccounts();
    pera.accounts.forEach((account) => {
      accountsMenu.add(new Option(account, account));
    });
  }

  buttons.create.disabled = false;
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

  document.getElementById('status').innerHTML = `App created with id ${appId} and address ${appAddress} in tx ${transaction.txID()}. See it <a href='https://app.dappflow.org/explorer/application/${appId}'>here</a>`;

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

  const proposalKeyType = algosdk.ABIType.from('(address,uint64)');
  const proposalKeyPrefix = new Uint8Array(Buffer.from('p-'));
  const proposalKey = new Uint8Array([
    ...proposalKeyPrefix,
    ...proposalKeyType.encode([sender.addr, proposalId]),
  ]);

  const boxMbr = BOX_CREATE_COST + (Object.values(proposalObject)
    .reduce((totalLength, v) => totalLength + v.length, 0) + proposalKey.byteLength
  ) * BOX_BYTE_COST;

  const payment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    suggestedParams: await algodClient.getTransactionParams().do(),
    amount: 100_000 + boxMbr,
    from: sender.addr,
    to: algosdk.getApplicationAddress(daoAppId),
  });

  const args = [Object.values(proposalObject), proposalId, { txn: payment, signer }];

  await daoApp.call({
    method: 'add_proposal',
    methodArgs: { args, boxes: [{ appIndex: 0, name: proposalKey }] },
    sender,
  });

  document.getElementById('status').innerHTML = `Proposal submitted! See the app <a href='https://app.dappflow.org/explorer/application/${daoAppId}'>here</a>`;
};
