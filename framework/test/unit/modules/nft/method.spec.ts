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

import { codec } from '@liskhq/lisk-codec';
import { utils } from '@liskhq/lisk-cryptography';
import { NFTMethod } from '../../../../src/modules/nft/method';
import { NFTModule } from '../../../../src/modules/nft/module';
import { EventQueue } from '../../../../src/state_machine';
import { MethodContext, createMethodContext } from '../../../../src/state_machine/method_context';
import { PrefixedStateReadWriter } from '../../../../src/state_machine/prefixed_state_read_writer';
import { InMemoryPrefixedStateDB } from '../../../../src/testing/in_memory_prefixed_state';
import {
	ALL_SUPPORTED_NFTS_KEY,
	FEE_CREATE_NFT,
	LENGTH_ADDRESS,
	LENGTH_CHAIN_ID,
	LENGTH_COLLECTION_ID,
	LENGTH_NFT_ID,
	NFT_NOT_LOCKED,
	NftEventResult,
} from '../../../../src/modules/nft/constants';
import { NFTStore } from '../../../../src/modules/nft/stores/nft';
import { UserStore } from '../../../../src/modules/nft/stores/user';
import { DestroyEvent, DestroyEventData } from '../../../../src/modules/nft/events/destroy';
import { SupportedNFTsStore } from '../../../../src/modules/nft/stores/supported_nfts';
import { CreateEvent } from '../../../../src/modules/nft/events/create';

describe('NFTMethod', () => {
	const module = new NFTModule();
	const method = new NFTMethod(module.stores, module.events);

	let methodContext!: MethodContext;

	const nftStore = module.stores.get(NFTStore);
	const userStore = module.stores.get(UserStore);

	const nftID = utils.getRandomBytes(LENGTH_NFT_ID);
	let owner: Buffer;

	const checkEventResult = <EventDataType>(
		eventQueue: EventQueue,
		length: number,
		EventClass: any,
		index: number,
		expectedResult: EventDataType,
		result: any = 0,
	) => {
		expect(eventQueue.getEvents()).toHaveLength(length);
		expect(eventQueue.getEvents()[index].toObject().name).toEqual(new EventClass('nft').name);

		const eventData = codec.decode<Record<string, unknown>>(
			new EventClass('nft').schema,
			eventQueue.getEvents()[index].toObject().data,
		);

		expect(eventData).toEqual({ ...expectedResult, result });
	};

	beforeEach(() => {
		owner = utils.getRandomBytes(LENGTH_ADDRESS);

		methodContext = createMethodContext({
			stateStore: new PrefixedStateReadWriter(new InMemoryPrefixedStateDB()),
			eventQueue: new EventQueue(0),
			contextStore: new Map(),
		});
	});

	describe('getChainID', () => {
		it('should throw if nftID has invalid length', () => {
			expect(() => {
				method.getChainID(utils.getRandomBytes(LENGTH_NFT_ID - 1));
			}).toThrow(`NFT ID must have length ${LENGTH_NFT_ID}`);
		});

		it('should return the first bytes of length LENGTH_CHAIN_ID from provided nftID', () => {
			expect(method.getChainID(nftID)).toEqual(nftID.slice(0, LENGTH_CHAIN_ID));
		});
	});

	describe('getNFTOwner', () => {
		it('should fail if NFT does not exist', async () => {
			await expect(method.getNFTOwner(methodContext, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should return the owner if NFT exists', async () => {
			await nftStore.save(methodContext, nftID, {
				owner,
				attributesArray: [],
			});

			await expect(method.getNFTOwner(methodContext, nftID)).resolves.toEqual(owner);
		});
	});

	describe('getLockingModule', () => {
		it('should fail if NFT does not exist', async () => {
			await expect(method.getLockingModule(methodContext, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should fail if NFT is escrowed', async () => {
			owner = utils.getRandomBytes(LENGTH_CHAIN_ID);

			await nftStore.save(methodContext, nftID, {
				owner,
				attributesArray: [],
			});

			await expect(method.getLockingModule(methodContext, nftID)).rejects.toThrow(
				'NFT is escrowed to another chain',
			);
		});

		it('should return the lockingModule for the owner of the NFT', async () => {
			const lockingModule = 'nft';

			await nftStore.save(methodContext, nftID, {
				owner,
				attributesArray: [],
			});

			await userStore.set(methodContext, userStore.getKey(owner, nftID), {
				lockingModule,
			});

			await expect(method.getLockingModule(methodContext, nftID)).resolves.toEqual(lockingModule);
		});
	});

	describe('destroy', () => {
		let existingNFT: { nftID: any; owner: any };
		let lockedExistingNFT: { nftID: any; owner: any };
		let escrowedNFT: { nftID: any; owner: any };

		beforeEach(async () => {
			existingNFT = {
				owner: utils.getRandomBytes(LENGTH_ADDRESS),
				nftID: utils.getRandomBytes(LENGTH_NFT_ID),
			};

			lockedExistingNFT = {
				owner: utils.getRandomBytes(LENGTH_ADDRESS),
				nftID: utils.getRandomBytes(LENGTH_NFT_ID),
			};

			escrowedNFT = {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				nftID: utils.getRandomBytes(LENGTH_NFT_ID),
			};

			await nftStore.save(methodContext, existingNFT.nftID, {
				owner: existingNFT.owner,
				attributesArray: [],
			});

			await userStore.set(methodContext, userStore.getKey(existingNFT.owner, existingNFT.nftID), {
				lockingModule: NFT_NOT_LOCKED,
			});

			await nftStore.save(methodContext, lockedExistingNFT.nftID, {
				owner: lockedExistingNFT.owner,
				attributesArray: [],
			});

			await userStore.set(
				methodContext,
				userStore.getKey(lockedExistingNFT.owner, lockedExistingNFT.nftID),
				{
					lockingModule: 'token',
				},
			);

			await nftStore.save(methodContext, escrowedNFT.nftID, {
				owner: escrowedNFT.owner,
				attributesArray: [],
			});

			await userStore.set(methodContext, userStore.getKey(escrowedNFT.owner, escrowedNFT.nftID), {
				lockingModule: NFT_NOT_LOCKED,
			});
		});

		it('should fail and emit Destroy event if NFT does not exist', async () => {
			const address = utils.getRandomBytes(LENGTH_ADDRESS);

			await expect(method.destroy(methodContext, address, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);

			checkEventResult<DestroyEventData>(
				methodContext.eventQueue,
				1,
				DestroyEvent,
				0,
				{
					address,
					nftID,
				},
				NftEventResult.RESULT_NFT_DOES_NOT_EXIST,
			);
		});

		it('should fail and emit Destroy event if NFT is not owned by the provided address', async () => {
			const notOwner = utils.getRandomBytes(LENGTH_ADDRESS);

			await expect(method.destroy(methodContext, notOwner, existingNFT.nftID)).rejects.toThrow(
				'Not initiated by the NFT owner',
			);

			checkEventResult<DestroyEventData>(
				methodContext.eventQueue,
				1,
				DestroyEvent,
				0,
				{
					address: notOwner,
					nftID: existingNFT.nftID,
				},
				NftEventResult.RESULT_INITIATED_BY_NONOWNER,
			);
		});

		it('should fail and emit Destroy event if NFT is escrowed', async () => {
			await expect(
				method.destroy(methodContext, escrowedNFT.owner, escrowedNFT.nftID),
			).rejects.toThrow('NFT is escrowed to another chain');

			checkEventResult<DestroyEventData>(
				methodContext.eventQueue,
				1,
				DestroyEvent,
				0,
				{
					address: escrowedNFT.owner,
					nftID: escrowedNFT.nftID,
				},
				NftEventResult.RESULT_NFT_ESCROWED,
			);
		});

		it('should fail and emit Destroy event if NFT is locked', async () => {
			await expect(
				method.destroy(methodContext, lockedExistingNFT.owner, lockedExistingNFT.nftID),
			).rejects.toThrow('Locked NFTs cannot be destroyed');

			checkEventResult<DestroyEventData>(
				methodContext.eventQueue,
				1,
				DestroyEvent,
				0,
				{
					address: lockedExistingNFT.owner,
					nftID: lockedExistingNFT.nftID,
				},
				NftEventResult.RESULT_NFT_LOCKED,
			);
		});

		it('should delete NFTStore and UserStore entry and emit Destroy event', async () => {
			await expect(
				method.destroy(methodContext, existingNFT.owner, existingNFT.nftID),
			).resolves.toBeUndefined();

			await expect(nftStore.has(methodContext, existingNFT.nftID)).resolves.toBeFalse();
			await expect(
				userStore.has(methodContext, Buffer.concat([existingNFT.owner, escrowedNFT.nftID])),
			).resolves.toBeFalse();

			checkEventResult<DestroyEventData>(methodContext.eventQueue, 1, DestroyEvent, 0, {
				address: existingNFT.owner,
				nftID: existingNFT.nftID,
			});
		});
	});

	describe('getCollectionID', () => {
		it('should throw if entry does not exist in the nft substore for the nft id', async () => {
			await expect(method.getCollectionID(methodContext, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should return the first bytes of length LENGTH_CHAIN_ID from provided nftID', async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: [],
			});
			const expectedValue = nftID.slice(LENGTH_CHAIN_ID, LENGTH_CHAIN_ID + LENGTH_COLLECTION_ID);
			const receivedValue = await method.getCollectionID(methodContext, nftID);
			expect(receivedValue).toEqual(expectedValue);
		});
	});

	describe('isNFTSupported', () => {
		beforeEach(async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: [],
			});
		});

		it('should throw if entry does not exist in the nft substore for the nft id', async () => {
			await nftStore.del(methodContext, nftID);
			await expect(method.isNFTSupported(methodContext, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should return true if nft chain id equals own chain id', async () => {
			const ownChainID = nftID.slice(0, LENGTH_CHAIN_ID);
			const config = {
				ownChainID,
				escrowAccountInitializationFee: BigInt(50000000),
				userAccountInitializationFee: BigInt(50000000),
			};
			method.init(config);

			const isSupported = await method.isNFTSupported(methodContext, nftID);
			expect(isSupported).toBe(true);
		});

		it('should return true if nft chain id does not equal own chain id but all nft keys are supported', async () => {
			const ownChainID = utils.getRandomBytes(LENGTH_CHAIN_ID);
			const config = {
				ownChainID,
				escrowAccountInitializationFee: BigInt(50000000),
				userAccountInitializationFee: BigInt(50000000),
			};
			method.init(config);
			const supportedNFTsStore = module.stores.get(SupportedNFTsStore);
			await supportedNFTsStore.set(methodContext, ALL_SUPPORTED_NFTS_KEY, {
				supportedCollectionIDArray: [],
			});

			const isSupported = await method.isNFTSupported(methodContext, nftID);
			expect(isSupported).toBe(true);
		});

		it('should return true if nft chain id does not equal own chain id but nft chain id is supported and corresponding supported collection id array is empty', async () => {
			const ownChainID = utils.getRandomBytes(LENGTH_CHAIN_ID);
			const config = {
				ownChainID,
				escrowAccountInitializationFee: BigInt(50000000),
				userAccountInitializationFee: BigInt(50000000),
			};
			method.init(config);
			const supportedNFTsStore = module.stores.get(SupportedNFTsStore);
			await supportedNFTsStore.set(methodContext, nftID.slice(0, LENGTH_CHAIN_ID), {
				supportedCollectionIDArray: [],
			});

			const isSupported = await method.isNFTSupported(methodContext, nftID);
			expect(isSupported).toBe(true);
		});

		it('should return true if nft chain id does not equal own chain id but nft chain id is supported and corresponding supported collection id array includes collection id for nft id', async () => {
			const ownChainID = utils.getRandomBytes(LENGTH_CHAIN_ID);
			const config = {
				ownChainID,
				escrowAccountInitializationFee: BigInt(50000000),
				userAccountInitializationFee: BigInt(50000000),
			};
			method.init(config);
			const supportedNFTsStore = module.stores.get(SupportedNFTsStore);
			await supportedNFTsStore.set(methodContext, nftID.slice(0, LENGTH_CHAIN_ID), {
				supportedCollectionIDArray: [
					{ collectionID: nftID.slice(LENGTH_CHAIN_ID, LENGTH_CHAIN_ID + LENGTH_COLLECTION_ID) },
					{ collectionID: utils.getRandomBytes(LENGTH_COLLECTION_ID) },
				],
			});

			const isSupported = await method.isNFTSupported(methodContext, nftID);
			expect(isSupported).toBe(true);
		});

		it('should return false if nft chain id does not equal own chain id and nft chain id is supported but corresponding supported collection id array does not include collection id for nft id', async () => {
			const ownChainID = utils.getRandomBytes(LENGTH_CHAIN_ID);
			const config = {
				ownChainID,
				escrowAccountInitializationFee: BigInt(50000000),
				userAccountInitializationFee: BigInt(50000000),
			};
			method.init(config);
			const supportedNFTsStore = module.stores.get(SupportedNFTsStore);
			await supportedNFTsStore.set(methodContext, nftID.slice(0, LENGTH_CHAIN_ID), {
				supportedCollectionIDArray: [
					{ collectionID: utils.getRandomBytes(LENGTH_COLLECTION_ID) },
					{ collectionID: utils.getRandomBytes(LENGTH_COLLECTION_ID) },
				],
			});

			const isSupported = await method.isNFTSupported(methodContext, nftID);
			expect(isSupported).toBe(false);
		});
	});

	describe('getAttributesArray', () => {
		const expectedAttributesArray = [
			{ module: 'customMod1', attributes: Buffer.alloc(5) },
			{ module: 'customMod2', attributes: Buffer.alloc(2) },
		];

		it('should throw if entry does not exist in the nft substore for the nft id', async () => {
			await expect(method.getAttributesArray(methodContext, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should return attributes array if entry exists in the nft substore for the nft id', async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: expectedAttributesArray,
			});
			const returnedAttributesArray = await method.getAttributesArray(methodContext, nftID);
			expect(returnedAttributesArray).toStrictEqual(expectedAttributesArray);
		});
	});

	describe('getAttributes', () => {
		const module1 = 'customMod1';
		const module2 = 'customMod2';
		const module3 = 'customMod3';
		const expectedAttributesArray = [
			{ module: module1, attributes: Buffer.alloc(5) },
			{ module: module2, attributes: Buffer.alloc(2) },
		];

		beforeEach(async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: expectedAttributesArray,
			});
		});

		it('should throw if entry does not exist in the nft substore for the nft id', async () => {
			await nftStore.del(methodContext, nftID);
			await expect(method.getAttributes(methodContext, module1, nftID)).rejects.toThrow(
				'NFT substore entry does not exist',
			);
		});

		it('should return attributes if entry exists in the nft substore for the nft id and attributes exists for the requested module', async () => {
			const returnedAttributes = await method.getAttributes(methodContext, module1, nftID);
			expect(returnedAttributes).toStrictEqual(expectedAttributesArray[0].attributes);
		});

		it('should throw if entry exists in the nft substore for the nft id but no attributes exists for the requested module', async () => {
			await expect(method.getAttributes(methodContext, module3, nftID)).rejects.toThrow(
				'Specific module did not set any attributes.',
			);
		});
	});

	describe('getNextAvailableIndex', () => {
		const attributesArray1 = [
			{ module: 'customMod1', attributes: Buffer.alloc(5) },
			{ module: 'customMod2', attributes: Buffer.alloc(2) },
		];
		const attributesArray2 = [{ module: 'customMod3', attributes: Buffer.alloc(7) }];
		const collectionID = nftID.slice(LENGTH_CHAIN_ID, LENGTH_CHAIN_ID + LENGTH_COLLECTION_ID);

		beforeEach(async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: attributesArray1,
			});
		});

		it('should return index count 0 if entry does not exist in the nft substore for the nft id', async () => {
			await nftStore.del(methodContext, nftID);
			const returnedIndex = await method.getNextAvailableIndex(
				methodContext,
				utils.getRandomBytes(LENGTH_COLLECTION_ID),
			);
			expect(returnedIndex).toBe(0);
		});

		it('should return index count 0 if entry exists in the nft substore for the nft id and no key matches the given collection id', async () => {
			const returnedIndex = await method.getNextAvailableIndex(
				methodContext,
				utils.getRandomBytes(LENGTH_COLLECTION_ID),
			);
			expect(returnedIndex).toBe(0);
		});

		it('should return index count 1 if entry exists in the nft substore for the nft id and a key matches the given collection id', async () => {
			const returnedIndex = await method.getNextAvailableIndex(methodContext, collectionID);
			expect(returnedIndex).toBe(1);
		});

		it('should return non zero index count if entry exists in the nft substore for the nft id and more than 1 key matches the given collection id', async () => {
			const newKey = Buffer.concat([utils.getRandomBytes(LENGTH_CHAIN_ID), collectionID]);
			await nftStore.save(methodContext, newKey, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: attributesArray2,
			});
			const returnedIndex = await method.getNextAvailableIndex(methodContext, collectionID);
			expect(returnedIndex).toBe(2);
		});
	});

	describe('create', () => {
		const interopMethod = {
			send: jest.fn(),
			error: jest.fn(),
			terminateChain: jest.fn(),
		};
		const feeMethod = { payFee: jest.fn() };
		const attributesArray1 = [
			{ module: 'customMod1', attributes: Buffer.alloc(5) },
			{ module: 'customMod2', attributes: Buffer.alloc(2) },
		];
		const attributesArray2 = [{ module: 'customMod3', attributes: Buffer.alloc(7) }];
		const attributesArray3 = [{ module: 'customMod3', attributes: Buffer.alloc(9) }];
		const config = {
			ownChainID: Buffer.alloc(LENGTH_CHAIN_ID, 1),
			escrowAccountInitializationFee: BigInt(50000000),
			userAccountInitializationFee: BigInt(50000000),
		};
		const collectionID = nftID.slice(LENGTH_CHAIN_ID, LENGTH_CHAIN_ID + LENGTH_COLLECTION_ID);
		const address = utils.getRandomBytes(LENGTH_ADDRESS);

		beforeEach(() => {
			method.addDependencies(interopMethod, feeMethod);
			method.init(config);
			jest.spyOn(feeMethod, 'payFee');
		});

		it('should set data to stores with correct key and emit successfull create event when there is no entry in the nft substore', async () => {
			const expectedKey = Buffer.concat([config.ownChainID, collectionID, Buffer.from('0')]);

			await method.create(methodContext, address, collectionID, attributesArray3);
			const nftStoreData = await nftStore.get(methodContext, expectedKey);
			const userStoreData = await userStore.get(
				methodContext,
				userStore.getKey(address, expectedKey),
			);
			expect(feeMethod.payFee).toHaveBeenCalledWith(methodContext, BigInt(FEE_CREATE_NFT));
			expect(nftStoreData.owner).toStrictEqual(address);
			expect(nftStoreData.attributesArray).toEqual(attributesArray3);
			expect(userStoreData.lockingModule).toEqual(NFT_NOT_LOCKED);
			checkEventResult(methodContext.eventQueue, 1, CreateEvent, 0, {
				address,
				nftID: expectedKey,
				collectionID,
			});
		});

		it('should set data to stores with correct key and emit successfull create event when there is some entry in the nft substore', async () => {
			await nftStore.save(methodContext, nftID, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: attributesArray1,
			});
			const newKey = Buffer.concat([utils.getRandomBytes(LENGTH_CHAIN_ID), collectionID]);
			await nftStore.save(methodContext, newKey, {
				owner: utils.getRandomBytes(LENGTH_CHAIN_ID),
				attributesArray: attributesArray2,
			});
			const expectedKey = Buffer.concat([config.ownChainID, collectionID, Buffer.from('2')]);

			await method.create(methodContext, address, collectionID, attributesArray3);
			const nftStoreData = await nftStore.get(methodContext, expectedKey);
			const userStoreData = await userStore.get(
				methodContext,
				userStore.getKey(address, expectedKey),
			);
			expect(feeMethod.payFee).toHaveBeenCalledWith(methodContext, BigInt(FEE_CREATE_NFT));
			expect(nftStoreData.owner).toStrictEqual(address);
			expect(nftStoreData.attributesArray).toEqual(attributesArray3);
			expect(userStoreData.lockingModule).toEqual(NFT_NOT_LOCKED);
			checkEventResult(methodContext.eventQueue, 1, CreateEvent, 0, {
				address,
				nftID: expectedKey,
				collectionID,
			});
		});
	});
});
