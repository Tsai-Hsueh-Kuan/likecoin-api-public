// eslint-disable-next-line import/no-extraneous-dependencies
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { ISCNQueryClient, ISCNSigningClient } from '@likecoin/iscn-js';
import { getLikeWalletAddress } from '@likecoin/iscn-js/dist/iscn/addressParsing';
import { getAccountInfo } from '.';
import { getUserWithCivicLikerProperties } from '../api/users/getPublicInfo';
import { COSMOS_PRIVATE_KEY } from '../../../config/secret';
import { COSMOS_RPC_ENDPOINT, COSMOS_SIGNING_RPC_ENDPOINT } from '../../../config/config';

export { parseTxInfoFromIndexedTx } from '@likecoin/iscn-js/dist/messages/parsing';

let queryClient = null;
let signingClient = null;
let signingWallet = null;
let signingAccountNumber = null;

export async function getISCNQueryClient() {
  if (!queryClient) {
    const client = new ISCNQueryClient();
    await client.connect(COSMOS_RPC_ENDPOINT);
    queryClient = client;
  }
  return queryClient;
}

export async function createISCNSigningClient(privateKey) {
  const privateKeyBytes = Buffer.from(privateKey, 'hex');
  const signer = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, 'like');
  const [wallet] = await signer.getAccounts();
  const client = new ISCNSigningClient();
  await client.connectWithSigner(COSMOS_SIGNING_RPC_ENDPOINT, signer);
  return { client, wallet };
}

export async function getISCNSigningClient() {
  if (!signingClient) {
    const { client, wallet } = await createISCNSigningClient(COSMOS_PRIVATE_KEY);
    signingWallet = wallet;
    signingClient = client;
  }
  return signingClient;
}

export async function getISCNSigningAddressInfo() {
  if (!signingWallet) await getISCNSigningClient();
  if (!signingAccountNumber) {
    const { accountNumber } = await getAccountInfo(signingWallet.address);
    signingAccountNumber = accountNumber;
  }
  return {
    address: signingWallet.address,
    accountNumber: signingAccountNumber,
  };
}

export function getISCNPrefix(input) {
  const res = /^(iscn:\/\/likecoin-chain\/[A-Za-z0-9-_]+)(?:\/([0-9]*))?$/.exec(input);
  if (!res) throw new Error(`Invalid ISCN ID ${input}`);
  const [, prefix] = res;
  return prefix;
}

export async function getLikeWalletAndLikerIdFromId(id) {
  let likeWallet = null;
  let likerId = null;

  const res = id.match(/^https:\/\/like\.co\/([a-z0-9_-]{6,20})/);
  if (res) {
    [, likerId] = res;
    const info = await getUserWithCivicLikerProperties(likerId);
    if (info) {
      ({ likeWallet } = info);
    }
  } else {
    likeWallet = getLikeWalletAddress(id);
  }
  return { likeWallet, likerId };
}
