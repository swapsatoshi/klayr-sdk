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

import * as React from 'react';
import styles from './Dialog.module.scss';
import { DialogChildProps } from './Dialog';

const DialogBody: React.FC<DialogChildProps> = props => {
	const childrenWithProps = React.Children.map(props.children, child => {
		// checking isValidElement is the safe way and avoids a typescript error too
		if (React.isValidElement(child)) {
			return React.cloneElement(child, { closeDialog: props.closeDialog });
		}
		return child;
	});

	return <div className={styles.body}>{childrenWithProps}</div>;
};

export default DialogBody;
