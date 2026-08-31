/**
 * Watchlist price monitoring.
 *
 * Compares each watched product's best current observation against the price
 * recorded when the user last saw it, and raises an in-app notification (plus
 * an email when a provider is configured) on a change. Prices are only ever
 * read from stored observations; nothing is fetched or inferred here.
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { formatMoney } from "@/lib/units";

export interface PriceCheckResult {
  watched: number;
  changed: number;
  notified: number;
  emailsQueued: number;
}

export async function runPriceCheck(): Promise<PriceCheckResult> {
  const items = await prisma.watchlistItem.findMany({
    include: {
      owner: { select: { id: true, email: true, plan: true } },
      product: {
        select: {
          id: true,
          slug: true,
          productName: true,
          manufacturer: { select: { name: true } },
          prices: { where: { isCurrent: true }, orderBy: { amountCents: "asc" }, take: 1 },
        },
      },
    },
  });

  let changed = 0;
  let notified = 0;
  let emailsQueued = 0;

  for (const item of items) {
    const price = item.product.prices[0];
    if (!price) continue;
    const current = price.salePriceCents ?? price.amountCents;
    const previous = item.lastSeenPriceCents;
    if (previous === null) {
      await prisma.watchlistItem.update({
        where: { id: item.id },
        data: { lastSeenPriceCents: current },
      });
      continue;
    }
    if (current === previous) continue;

    changed += 1;
    const dropped = current < previous;
    const hitTarget = item.targetPriceCents !== null && current <= item.targetPriceCents;
    const label = `${item.product.manufacturer.name} ${item.product.productName}`;
    const title = dropped
      ? `Price drop: ${item.product.productName}`
      : `Price increase: ${item.product.productName}`;
    const body = `${label} moved from ${formatMoney(previous)} to ${formatMoney(current)}${
      hitTarget ? `, at or below your ${formatMoney(item.targetPriceCents)} target` : ""
    }.`;

    const shouldEmail = item.notifyByEmail;
    if (item.notifyInApp) {
      await prisma.notification.create({
        data: {
          userId: item.ownerId,
          kind: dropped ? "PRICE_DROP" : "PRICE_RISE",
          title,
          body,
          href: `/catalog/${item.product.slug}`,
          emailQueuedAt: shouldEmail ? new Date() : null,
        },
      });
      notified += 1;
    }

    if (shouldEmail) {
      emailsQueued += 1;
      await sendEmail({ to: item.owner.email, subject: title, body });
    }

    await prisma.watchlistItem.update({
      where: { id: item.id },
      data: { lastSeenPriceCents: current },
    });
  }

  return { watched: items.length, changed, notified, emailsQueued };
}
