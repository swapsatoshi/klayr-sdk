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

// import { codec } from '../src/codec';

import { testCases as objectTestCases } from '../fixtures/objects_encodings.json';
import { codec } from '../src/codec';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cloneDeep = require('lodash.clonedeep');

describe('addSchema', () => {
	// Arrange
	const objectFixtureInput = objectTestCases[0].input;

	it('should add schema and keep it in cache', () => {
		const message = objectFixtureInput.object;
		// Replace the JSON representation of buffer with an actual buffer
		(message as any).address = Buffer.from((message as any).address.data);
		// Fix number not being bigint
		(message as any).balance = BigInt(message.balance);

		const { schema } = objectFixtureInput;

		codec.encode(schema as any, message as any);

		expect((codec as any)._compileSchemas.object11).toMatchSnapshot();
	});

	it('should throw if schema does not have fieldNumber in properties at root level', () => {
		const { schema } = objectFixtureInput;
		const customSchema = cloneDeep(schema);
		// Remove the field number in properties at root level
		delete customSchema.properties.asset.fieldNumber;

		expect(() => codec.addSchema(customSchema)).toThrow(
			'Invalid schema. Missing "fieldNumber" in properties',
		);
	});

	it('should throw if schema does not have fieldNumber in properties at nested level 1', () => {
		const { schema } = objectFixtureInput;
		const customSchema = cloneDeep(schema);
		// Remove the field number in properties at nested level 1
		delete customSchema.properties.asset.properties.fooBar.fieldNumber;

		expect(() => codec.addSchema(customSchema)).toThrow(
			'Invalid schema. Missing "fieldNumber" in properties',
		);
	});

	it('should throw if schema does not have fieldNumber in properties at nested level 2', () => {
		const { schema } = objectFixtureInput;
		const customSchema = cloneDeep(schema);
		// Remove the field number in properties at nested level 2
		delete customSchema.properties.asset.properties.fooBar.properties.foo.fieldNumber;

		expect(() => codec.addSchema(customSchema)).toThrow(
			'Invalid schema. Missing "fieldNumber" in properties',
		);
	});
});
