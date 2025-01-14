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

import { BaseEvent, EventQueuer } from '../../base_event';
import { LENGTH_NFT_ID, LENGTH_CHAIN_ID, NftEventResult, NftErrorEventResult } from '../constants';

export interface TransferCrossChainEventData {
	senderAddress: Buffer;
	recipientAddress: Buffer;
	receivingChainID: Buffer;
	nftID: Buffer;
	includeAttributes: boolean;
}

export const transferCrossChainEventSchema = {
	$id: '/nft/events/transferCrossChain',
	type: 'object',
	required: ['senderAddress', 'recipientAddress', 'nftID', 'receivingChainID', 'result'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			format: 'klayr32',
			fieldNumber: 1,
		},
		recipientAddress: {
			dataType: 'bytes',
			format: 'klayr32',
			fieldNumber: 2,
		},
		nftID: {
			dataType: 'bytes',
			minLength: LENGTH_NFT_ID,
			maxLength: LENGTH_NFT_ID,
			fieldNumber: 3,
		},
		receivingChainID: {
			dataType: 'bytes',
			minLength: LENGTH_CHAIN_ID,
			maxLength: LENGTH_CHAIN_ID,
			fieldNumber: 4,
		},
		includeAttributes: {
			dataType: 'boolean',
			fieldNumber: 5,
		},
		result: {
			dataType: 'uint32',
			fieldNumber: 6,
		},
	},
};

export class TransferCrossChainEvent extends BaseEvent<
	TransferCrossChainEventData & { result: NftEventResult }
> {
	public schema = transferCrossChainEventSchema;

	public log(ctx: EventQueuer, data: TransferCrossChainEventData): void {
		this.add(ctx, { ...data, result: NftEventResult.RESULT_SUCCESSFUL }, [
			data.senderAddress,
			data.recipientAddress,
			data.receivingChainID,
		]);
	}

	public error(
		ctx: EventQueuer,
		data: TransferCrossChainEventData,
		result: NftErrorEventResult,
	): void {
		this.add(
			ctx,
			{ ...data, result },
			[data.senderAddress, data.recipientAddress, data.receivingChainID],
			true,
		);
	}
}
