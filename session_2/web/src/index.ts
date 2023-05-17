import algosdk from 'algosdk';
// import WalletConnectSession from './wallets/walletconnect';
// import PeraSession from './wallets/pera';
// import Utils from './utils'

try {
  // @ts-ignore
  const account = algosdk.generateAccount();
  console.log(`Generated Algorand account: ${account.addr}`);
  document.getElementById('status').innerHTML = 'SDK Status: Working!';
} catch (e) {
  console.error(e);
  document.getElementById('status').innerHTML = `SDK Status: Error - ${e.message}`;
}
