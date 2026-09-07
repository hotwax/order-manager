/**
 * The single write against seed data: creating an order identification type.
 *
 * The write goes to the server, then the worker refetches the affected row into the local
 * database. The enums slice picks the change up through its liveQuery — nothing reloads.
 */

import { api, logger } from "@common";
import { refreshAfterMutation } from "@common/db";

export async function createOrderIdentificationType(payload: { enumId: string; description: string }): Promise<void> {
  await api({
    url: "admin/enums",
    method: "POST",
    data: { ...payload, enumTypeId: "ORDER_IDENTITY" },
  });

  try {
    await refreshAfterMutation("enum", { enumId: payload.enumId });
  } catch (error) {
    logger.warn("[orderIdentification] Failed to refresh the enum after create:", error);
  }
}
