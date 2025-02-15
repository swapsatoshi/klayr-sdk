/*
 * Copyright © 2021 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import { objects as objectUtils } from '@klayr/utils';
import { codec } from '@klayr/codec';
import { validator } from '@klayr/validator';
import { BaseModule, ModuleInitArgs, ModuleMetadata } from '../base_module';
import {
	GenesisBlockExecuteContext,
	TransactionExecuteContext,
	TransactionVerifyContext,
	VerificationResult,
	VerifyStatus,
} from '../../state_machine';
import { AuthMethod } from './method';
import { ADDRESS_LENGTH, defaultConfig } from './constants';
import { AuthEndpoint } from './endpoint';
import {
	addressRequestSchema,
	configSchema,
	genesisAuthStoreSchema,
	multisigRegMsgSchema,
	sortMultisignatureGroupResponseSchema,
	sortMultisignatureGroupRequestSchema,
	transactionRequestSchema,
	verifyResultSchema,
	multiSigRegMsgTagSchema,
} from './schemas';
import { GenesisAuthStore } from './types';
import { verifyNonce, verifySignatures } from './utils';
import { authAccountSchema, AuthAccountStore } from './stores/auth_account';
import { MultisignatureRegistrationEvent } from './events/multisignature_registration';
import { RegisterMultisignatureCommand } from './commands/register_multisignature';
import { InvalidSignatureEvent } from './events/invalid_signature';
import { InvalidNonceError } from './errors';

export class AuthModule extends BaseModule {
	public method = new AuthMethod(this.stores, this.events);
	public endpoint = new AuthEndpoint(this.stores, this.offchainStores);
	public configSchema = configSchema;

	private readonly _registerMultisignatureCommand = new RegisterMultisignatureCommand(
		this.stores,
		this.events,
	);

	public commands = [this._registerMultisignatureCommand];

	private _moduleConfig!: { maxNumberOfSignatures: number };

	public constructor() {
		super();
		this.stores.register(AuthAccountStore, new AuthAccountStore(this.name, 0));
		this.events.register(
			MultisignatureRegistrationEvent,
			new MultisignatureRegistrationEvent(this.name),
		);
		this.events.register(InvalidSignatureEvent, new InvalidSignatureEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			...this.baseMetadata(),
			endpoints: [
				{
					name: this.endpoint.getAuthAccount.name,
					request: addressRequestSchema,
					response: authAccountSchema,
				},
				{
					name: this.endpoint.isValidNonce.name,
					request: transactionRequestSchema,
					response: verifyResultSchema,
				},
				{
					name: this.endpoint.isValidSignature.name,
					request: transactionRequestSchema,
					response: verifyResultSchema,
				},
				{
					name: this.endpoint.getMultiSigRegMsgSchema.name,
					response: multisigRegMsgSchema,
				},
				{
					name: this.endpoint.sortMultisignatureGroup.name,
					request: sortMultisignatureGroupRequestSchema,
					response: sortMultisignatureGroupResponseSchema,
				},
				{
					name: this.endpoint.getMultiSigRegMsgTag.name,
					response: multiSigRegMsgTagSchema,
				},
			],
			assets: [
				{
					version: 0,
					data: genesisAuthStoreSchema,
				},
			],
		};
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs): Promise<void> {
		const { moduleConfig } = args;
		const config = objectUtils.mergeDeep({}, defaultConfig, moduleConfig);
		validator.validate<{ maxNumberOfSignatures: number }>(configSchema, config);

		this._moduleConfig = { maxNumberOfSignatures: config.maxNumberOfSignatures };

		this._registerMultisignatureCommand.init({
			maxNumberOfSignatures: config.maxNumberOfSignatures,
		});
	}

	public async initGenesisState(context: GenesisBlockExecuteContext): Promise<void> {
		const assetBytes = context.assets.getAsset(this.name);
		// if there is no asset, do not initialize
		if (!assetBytes) {
			return;
		}
		const genesisStore = codec.decode<GenesisAuthStore>(genesisAuthStoreSchema, assetBytes);
		const store = this.stores.get(AuthAccountStore);
		const keys = [];
		for (const { address, authAccount } of genesisStore.authDataSubstore) {
			if (address.length !== ADDRESS_LENGTH) {
				throw new Error('Invalid store key length for auth module.');
			}
			keys.push(address);

			validator.validate(authAccountSchema, authAccount);

			const { mandatoryKeys, optionalKeys, numberOfSignatures } = authAccount;

			if (!objectUtils.isBufferArrayOrdered(mandatoryKeys)) {
				throw new Error(
					'Invalid store value for auth module. MandatoryKeys are not sorted lexicographically.',
				);
			}
			if (!objectUtils.bufferArrayUniqueItems(mandatoryKeys)) {
				throw new Error('Invalid store value for auth module. MandatoryKeys are not unique.');
			}

			if (!objectUtils.isBufferArrayOrdered(optionalKeys)) {
				throw new Error(
					'Invalid store value for auth module. OptionalKeys are not sorted lexicographically.',
				);
			}
			if (!objectUtils.bufferArrayUniqueItems(optionalKeys)) {
				throw new Error('Invalid store value for auth module. OptionalKeys are not unique.');
			}

			if (mandatoryKeys.length + optionalKeys.length > this._moduleConfig.maxNumberOfSignatures) {
				throw new Error(
					`The count of Mandatory and Optional keys should be maximum ${this._moduleConfig.maxNumberOfSignatures}.`,
				);
			}

			const repeatedKeys = mandatoryKeys.filter(
				value => optionalKeys.find(optional => optional.equals(value)) !== undefined,
			);
			if (repeatedKeys.length > 0) {
				throw new Error(
					'Invalid combination of Mandatory and Optional keys. Repeated keys across Mandatory and Optional were found.',
				);
			}

			// Check if key count is less than number of required signatures
			if (mandatoryKeys.length + optionalKeys.length < numberOfSignatures) {
				throw new Error(
					'The numberOfSignatures is bigger than the count of Mandatory and Optional keys.',
				);
			}
			if (mandatoryKeys.length > numberOfSignatures) {
				throw new Error('The numberOfSignatures is smaller than the count of Mandatory keys.');
			}

			await store.set(context, address, authAccount);
		}
		if (!objectUtils.bufferArrayUniqueItems(keys)) {
			throw new Error('Duplicate address in the for auth module.');
		}
	}

	public async verifyTransaction(context: TransactionVerifyContext): Promise<VerificationResult> {
		const { transaction, chainID } = context;
		const authAccountStore = this.stores.get(AuthAccountStore);
		const senderAccount = await authAccountStore.getOrDefault(context, transaction.senderAddress);

		// Verify nonce of the transaction, it can be FAILED, PENDING or OK
		const nonceStatus = verifyNonce(transaction, senderAccount);

		if (nonceStatus.status === VerifyStatus.FAIL) {
			throw new InvalidNonceError(
				`Transaction with id:${transaction.id.toString('hex')} nonce is lower than account nonce.`,
				transaction.nonce,
				senderAccount.nonce,
			);
		}

		verifySignatures(transaction, chainID, senderAccount);

		return nonceStatus;
	}

	public async beforeCommandExecute(context: TransactionExecuteContext): Promise<void> {
		const { transaction } = context;
		const authAccountStore = this.stores.get(AuthAccountStore);

		const senderAccount = await authAccountStore.getOrDefault(context, transaction.senderAddress);

		await authAccountStore.set(context, transaction.senderAddress, {
			nonce: senderAccount.nonce + BigInt(1),
			numberOfSignatures: senderAccount.numberOfSignatures,
			mandatoryKeys: senderAccount.mandatoryKeys,
			optionalKeys: senderAccount.optionalKeys,
		});
	}
}
