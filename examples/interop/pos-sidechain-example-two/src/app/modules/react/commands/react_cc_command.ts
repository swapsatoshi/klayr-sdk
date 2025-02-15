/* eslint-disable class-methods-use-this */

import { Modules, StateMachine, codec } from 'klayr-sdk';
import { CROSS_CHAIN_COMMAND_REACT } from '../constants';
import { CCReactCommandParamsSchema, CCReactMessageParamsSchema } from '../schemas';
import { CCReactMessageParams, CCReactCommandParams, InteroperabilityMethod } from '../types';

export class CrossChainReactCommand extends Modules.BaseCommand {
	private _interoperabilityMethod!: InteroperabilityMethod;
	public schema = CCReactCommandParamsSchema;

	public get name(): string {
		return CROSS_CHAIN_COMMAND_REACT;
	}

	public init(args: { interoperabilityMethod: InteroperabilityMethod }) {
		this._interoperabilityMethod = args.interoperabilityMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		context: StateMachine.CommandVerifyContext<CCReactCommandParams>,
	): Promise<StateMachine.VerificationResult> {
		const { params, logger } = context;

		logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
		logger.info(params);
		logger.info('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');

		try {
			if (params.receivingChainID.equals(context.chainID)) {
				throw new Error('Receiving chain cannot be the sending chain.');
			}
		} catch (err) {
			return {
				status: StateMachine.VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		return {
			status: StateMachine.VerifyStatus.OK,
		};
	}

	public async execute(
		context: StateMachine.CommandExecuteContext<CCReactCommandParams>,
	): Promise<void> {
		const {
			params,
			transaction: { senderAddress },
		} = context;

		const ccReactMessageParams: CCReactMessageParams = {
			reactionType: params.reactionType,
			data: params.data,
			helloMessageID: params.helloMessageID,
		};

		await this._interoperabilityMethod.send(
			context.getMethodContext(),
			senderAddress,
			'hello',
			CROSS_CHAIN_COMMAND_REACT,
			params.receivingChainID,
			params.messageFee,
			codec.encode(CCReactMessageParamsSchema, ccReactMessageParams),
			context.header.timestamp,
		);
	}
}
