import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as A from "./admin.server";

const auth = z.object({ initData: z.string().max(8192) });
const v = <T extends z.ZodRawShape>(shape: T) => (d: unknown) => auth.extend(shape).parse(d);

export const adminMeFn = createServerFn({ method: "POST" }).inputValidator(v({})).handler(({ data }) => A.adminMe(data.initData));
export const adminOverviewFn = createServerFn({ method: "POST" }).inputValidator(v({})).handler(({ data }) => A.adminOverview(data.initData));
export const adminTasksFn = createServerFn({ method: "POST" }).inputValidator(v({})).handler(({ data }) => A.adminListTasks(data.initData));

const task = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(80),
  description: z.string().max(200).nullable().optional(),
  kind: z.enum(["ads_daily", "ads_total", "referrals", "channel", "link", "checkin"]),
  goal: z.number().int().min(1).max(1_000_000),
  reward: z.number().min(0).max(1000),
  url: z.string().max(300).nullable().optional(),
  chat_username: z.string().max(80).nullable().optional(),
  icon: z.string().max(20),
  repeat: z.enum(["once", "daily"]),
  active: z.boolean(),
  sort: z.number().int().min(0).max(100000),
});

export const adminSaveTaskFn = createServerFn({ method: "POST" }).inputValidator(v({ task })).handler(({ data }) => A.adminSaveTask(data.initData, data.task));
export const adminDeleteTaskFn = createServerFn({ method: "POST" }).inputValidator(v({ id: z.string().uuid() })).handler(({ data }) => A.adminDeleteTask(data.initData, data.id));
export const adminSetManagerFn = createServerFn({ method: "POST" }).inputValidator(v({ username: z.string().max(40), add: z.boolean() })).handler(({ data }) => A.adminSetManager(data.initData, data.username, data.add));
export const adminProcessWithdrawalFn = createServerFn({ method: "POST" })
  .inputValidator(v({ id: z.string().uuid(), approve: z.boolean(), note: z.string().max(200).nullable() }))
  .handler(({ data }) => A.adminProcessWithdrawal(data.initData, data.id, data.approve, data.note));
export const adminSetCommunityFn = createServerFn({ method: "POST" }).inputValidator(v({ username: z.string().max(80) })).handler(({ data }) => A.adminSetCommunity(data.initData, data.username));
export const adminSendGiftFn = createServerFn({ method: "POST" }).inputValidator(v({ amount: z.number().positive().max(10) })).handler(({ data }) => A.adminSendGift(data.initData, data.amount));
export const adminBroadcastFn = createServerFn({ method: "POST" }).inputValidator(v({ text: z.string().min(3).max(3500) })).handler(({ data }) => A.adminBroadcast(data.initData, data.text));
export const adminRunTickFn = createServerFn({ method: "POST" }).inputValidator(v({})).handler(({ data }) => A.adminRunTick(data.initData));
