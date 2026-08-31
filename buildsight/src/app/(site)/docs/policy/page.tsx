import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ALLOWED_CAPABILITIES, RESTRICTED_CAPABILITIES } from "@/lib/policy/policy";

export const metadata: Metadata = { title: "Product boundary" };

export default function PolicyPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Product boundary</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          BuildSight is scoped to configuration, visualization, compatibility documentation,
          inventory tracking and purchasing planning. The boundary is enforced by a deterministic
          policy layer applied to every free-text surface — the SCOPE assistant, the natural-language
          builder and user-submitted catalog text — so it cannot drift with a prompt.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="label-micro text-signal-green">Supported</p>
            <ul className="mt-3 space-y-1.5">
              {ALLOWED_CAPABILITIES.map((item) => (
                <li key={item} className="text-xs text-ink-muted">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="label-micro text-signal-red">Refused</p>
            <ul className="mt-3 space-y-1.5">
              {RESTRICTED_CAPABILITIES.map((item) => (
                <li key={item} className="text-xs text-ink-muted">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">How refusals work</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            A restricted request is classified before it reaches the search layer or any model. The
            assistant states plainly that the request falls outside the product boundary and offers
            the catalog, the Build Studio and this documentation as alternatives. It does not explain
            how to accomplish the restricted task, and does not partially answer it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">Regulated products</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Products classified as serialized components or NFA items are labelled throughout the
            interface and in every export. BuildSight has no checkout: a regulated item&rsquo;s
            shopping-list entry links to the manufacturer&rsquo;s or retailer&rsquo;s own purchasing
            process, which is where the applicable legal requirements are handled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
