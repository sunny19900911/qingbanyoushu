import type { InBodyTrendReport, UserId } from "../shared/types";
// Personal measurements and dates are intentionally not distributed.
export async function getInBodyTrendReport(_userId: UserId): Promise<InBodyTrendReport> {
  throw new Error("此备份未包含个人体测资料");
}
