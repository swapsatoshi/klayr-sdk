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

import { EndpointHandler, EndpointHandlers } from './types';

const reservedEndpointName = ['constructor', 'init', 'addDependencies'];

export const isReservedEndpointFunction = (key: string): boolean =>
	key.startsWith('_') || reservedEndpointName.includes(key);

export const getEndpointHandlers = (endpoint: Record<string, unknown>): EndpointHandlers => {
	const endpointHandlers: EndpointHandlers = {};
	for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(endpoint))) {
		const val = endpoint[key];
		if (!isReservedEndpointFunction(key) && typeof val === 'function') {
			endpointHandlers[key] = val.bind(endpoint) as EndpointHandler;
		}
	}
	return endpointHandlers;
};

export const mergeEndpointHandlers = (...handlers: EndpointHandlers[]): EndpointHandlers =>
	handlers.reduce(
		(prev, curr) => ({
			...prev,
			...curr,
		}),
		{},
	);

export const getEndpointPath = (namespace: string, method: string) => `${namespace}_${method}`;