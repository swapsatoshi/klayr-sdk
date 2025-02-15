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
import { utils } from '@klayr/cryptography';
import {
	DB_KEY_LEGACY_BRACKET,
	DB_KEY_TRANSACTIONS_BLOCK_ID,
	DB_KEY_TRANSACTIONS_ID,
	DB_KEY_BLOCKS_ID,
	DB_KEY_BLOCKS_HEIGHT,
} from './constants';

// INFO: Here ID refers to hashed value of 32 length
export const buildTxIDDbKey = (id: Buffer): Buffer =>
	Buffer.from(`${DB_KEY_TRANSACTIONS_ID}:${id.toString('binary')}`);

export const buildBlockIDDbKey = (id: Buffer): Buffer =>
	Buffer.from(`${DB_KEY_BLOCKS_ID}:${id.toString('binary')}`);

export const buildTxsBlockIDDbKey = (id: Buffer): Buffer =>
	Buffer.from(`${DB_KEY_TRANSACTIONS_BLOCK_ID}:${id.toString('binary')}`);

export const buildBlockHeightDbKey = (height: number): Buffer =>
	Buffer.from(`${DB_KEY_BLOCKS_HEIGHT}:${utils.intToBuffer(height, 4).toString('binary')}`);

export const buildLegacyBracketDBKey = (snapshotBlockID: Buffer): Buffer =>
	Buffer.concat([DB_KEY_LEGACY_BRACKET, snapshotBlockID]);
