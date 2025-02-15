/*
 * Copyright © 2020 Lisk Foundation
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

import * as cryptography from '@klayr/cryptography';
import { BaseCommand } from '../../base_command';
import {
	CommandExecuteContext,
	CommandVerifyContext,
	VerificationResult,
	VerifyStatus,
} from '../../../state_machine';
import { TokenMethod } from '../method';
import { transferParamsSchema } from '../schemas';
import { UserStore } from '../stores/user';
import { TokenID } from '../types';
import { InternalMethod } from '../internal_method';
import { InsufficientBalanceError } from '../../../errors';

/** Interface for the parameters of the Token Transfer Command */
export interface Params {
	/**	ID of the tokens being transferred. `TokenID` must be 8 bytes (16 characters). The first 4 bytes correspond to the `chainID`. */
	tokenID: TokenID;
	/** Amount of tokens to be transferred in Beddows. */
	amount: bigint;
	/** Address of the recipient. */
	recipientAddress: Buffer;
	/** Optional message / data field. */
	data: string;
}

/**
 * The `transfer` command of the {@link TokenModule} transfers tokens from one account to another.
 *
 * - name: `transfer`
 * - module: {@link TokenModule | `token`}
 */
export class TransferCommand extends BaseCommand {
	public schema = transferParamsSchema;
	private _method!: TokenMethod;
	private _internalMethod!: InternalMethod;

	/**
	 * The `init()` hook of a command is called by the Klayr Framework when the node starts.
	 *
	 * In this context, you have the opportunity to validate and cache the module config or perform initializations that are intended to occur only once.
	 *
	 * @see [Command initialization](https://klayr.xyz/documentation/beta/understand-blockchain/sdk/modules-commands.html#command-initialization)
	 *
	 * @param args Contains the module methods and internal module methods.
	 */
	public init(args: { method: TokenMethod; internalMethod: InternalMethod }) {
		this._method = args.method;
		this._internalMethod = args.internalMethod;
	}

	/**
	 * Checks if the sender has enough balance to send the specified amount of tokens.
	 *
	 * For more info about the `verify()` method, please refer to the {@link BaseCommand}
	 *
	 * @param context
	 */
	public async verify(context: CommandVerifyContext<Params>): Promise<VerificationResult> {
		const { params } = context;

		const availableBalance = await this._method.getAvailableBalance(
			context.getMethodContext(),
			context.transaction.senderAddress,
			params.tokenID,
		);
		if (availableBalance < params.amount) {
			throw new InsufficientBalanceError(
				cryptography.address.getKlayr32AddressFromAddress(context.transaction.senderAddress),
				availableBalance.toString(),
				params.amount.toString(),
			);
		}
		return {
			status: VerifyStatus.OK,
		};
	}

	/**
	 * Transfers the specified amount of tokens from the sender to the recipient account.
	 *
	 * For more info about the `execute()` method, please refer to the {@link BaseCommand}.
	 *
	 * @param context
	 */
	public async execute(context: CommandExecuteContext<Params>): Promise<void> {
		const { params } = context;

		const userStore = this.stores.get(UserStore);

		const recipientAccountKey = userStore.getKey(params.recipientAddress, params.tokenID);

		const recipientAccountExists = await userStore.has(context, recipientAccountKey);

		if (!recipientAccountExists) {
			await this._internalMethod.initializeUserAccount(
				context.getMethodContext(),
				params.recipientAddress,
				params.tokenID,
			);
		}

		await this._internalMethod.transfer(
			context.getMethodContext(),
			context.transaction.senderAddress,
			params.recipientAddress,
			params.tokenID,
			params.amount,
		);
	}
}
