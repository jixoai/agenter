import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY_PATTERN = /^0x[a-fA-F0-9]{64}$/u;

export interface WalletAuthIdentity {
	authId: string;
	address: string;
	privateKey: Hex;
}

export const normalizePrivateKey = (value: string): Hex | null => {
	const normalized = value.trim();
	if (!PRIVATE_KEY_PATTERN.test(normalized)) {
		return null;
	}
	return normalized.toLowerCase() as Hex;
};

export const resolveWalletAuthIdentity = (privateKeyDraft: string): WalletAuthIdentity => {
	const privateKey = normalizePrivateKey(privateKeyDraft);
	if (!privateKey) {
		throw new Error('private key must be a 0x-prefixed 32-byte hex string');
	}
	const account = privateKeyToAccount(privateKey);
	const address = account.address.toLowerCase();
	return {
		privateKey,
		address,
		authId: `wallet_evm:${address}`,
	};
};

export const signWalletAuthChallenge = async (
	privateKeyDraft: string,
	challengeText: string,
): Promise<{ authId: string; address: string; signature: string }> => {
	const identity = resolveWalletAuthIdentity(privateKeyDraft);
	const account = privateKeyToAccount(identity.privateKey);
	const signature = await account.signMessage({ message: challengeText });
	return {
		authId: identity.authId,
		address: identity.address,
		signature,
	};
};
