import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as G from "./game.server";

const auth = z.object({ initData: z.string().max(8192) });
const v = <T extends z.ZodRawShape>(shape: T) => (d: unknown) => auth.extend(shape).parse(d);

export const fetchState = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.getState(data.initData));

export const fetchCatalog = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.getCatalog(data.initData));

export const fetchMissions = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.getMissions(data.initData));

export const fetchSquad = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.getSquad(data.initData));

export const fetchWallet = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.getWallet(data.initData));

export const claimMiningFn = createServerFn({ method: "POST" })
  .inputValidator(v({ double: z.boolean() }))
  .handler(({ data }) => G.claimMining(data.initData, data.double));

export const recordAdFn = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.recordAd(data.initData));

export const buyWithBalanceFn = createServerFn({ method: "POST" })
  .inputValidator(v({ kind: z.enum(["server", "operator"]), ref: z.string().max(40) }))
  .handler(({ data }) => G.buyWithBalance(data.initData, data.kind, data.ref));

export const createPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(v({ purpose: z.enum(["server", "operator", "boost"]), ref: z.string().max(40) }))
  .handler(({ data }) => G.createPayment(data.initData, data.purpose, data.ref));

export const verifyPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(v({ paymentId: z.string().uuid() }))
  .handler(({ data }) => G.verifyPayment(data.initData, data.paymentId));

export const claimFreeServerFn = createServerFn({ method: "POST" })
  .inputValidator(v({ kind: z.enum(["ads", "squad"]) }))
  .handler(({ data }) => G.claimFreeServer(data.initData, data.kind));

export const equipOperatorFn = createServerFn({ method: "POST" })
  .inputValidator(v({ id: z.string().max(40) }))
  .handler(({ data }) => G.equipOperator(data.initData, data.id));

export const claimTaskFn = createServerFn({ method: "POST" })
  .inputValidator(v({ taskId: z.string().uuid() }))
  .handler(({ data }) => G.claimTask(data.initData, data.taskId));

export const checkCommunityFn = createServerFn({ method: "POST" })
  .inputValidator(v({}))
  .handler(({ data }) => G.checkCommunity(data.initData));

export const requestWithdrawFn = createServerFn({ method: "POST" })
  .inputValidator(v({ amount: z.number().positive().max(1_000_000), wallet: z.string().min(10).max(80) }))
  .handler(({ data }) => G.requestWithdraw(data.initData, data.amount, data.wallet));

export const cancelWithdrawFn = createServerFn({ method: "POST" })
  .inputValidator(v({ id: z.string().uuid() }))
  .handler(({ data }) => G.cancelWithdraw(data.initData, data.id));

export const payWithdrawFeeFn = createServerFn({ method: "POST" })
  .inputValidator(v({ id: z.string().uuid() }))
  .handler(({ data }) => G.payWithdrawFeeAgain(data.initData, data.id));
