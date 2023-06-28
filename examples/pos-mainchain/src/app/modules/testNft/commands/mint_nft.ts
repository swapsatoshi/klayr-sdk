/*
 * Copyright © 2023 Lisk Foundation
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

import { validator } from '@liskhq/lisk-validator';
import {
	BaseCommand,
	CommandVerifyContext,
	CommandExecuteContext,
	VerificationResult,
	VerifyStatus,
	NFTMethod,
} from 'lisk-sdk';
import { NFTAttributes, mintNftParamsSchema } from '../types';

interface Params {
	address: Buffer;
	collectionID: Buffer;
	attributesArray: NFTAttributes[];
}

export class MintNftCommand extends BaseCommand {
	public schema = mintNftParamsSchema;
	private _nftMethod!: NFTMethod;

	public init(args: { nftMethod: NFTMethod }): void {
		this._nftMethod = args.nftMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(context: CommandVerifyContext<Params>): Promise<VerificationResult> {
		const { params } = context;

		validator.validate<Params>(this.schema, params);

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(context: CommandExecuteContext<Params>): Promise<void> {
		const { params } = context;

		await this._nftMethod.create(
			context.getMethodContext(),
			params.address,
			params.collectionID,
			params.attributesArray,
		);
	}
}
