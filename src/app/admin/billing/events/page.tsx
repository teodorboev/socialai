import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Force dynamic rendering

interface PageProps {
  searchParams: Promise<{ org?: string; type?: string }>;
}

async function getEvents(orgId?: string, eventType?: string) {
  const where: any = {};
  if (orgId) where.organizationId = orgId;
  if (eventType) where.eventType = eventType;

  return prismaAdmin.billingEvent.findMany({
    where,
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function getOrganizations() {
  return prismaAdmin.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

const EVENT_TYPES = [
  "subscription_created",
  "subscription_activated",
  "subscription_canceled",
  "subscription_paused",
  "subscription_resumed",
  "plan_changed",
  "payment_succeeded",
  "payment_failed",
  "payment_past_due",
  "trial_ending",
];

function formatEventType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventColor(type: string): string {
  if (type.includes("cancel") || type.includes("fail") || type.includes("past_due")) {
    return "destructive";
  }
  if (type.includes("succeeded") || type.includes("activated") || type.includes("resumed")) {
    return "default";
  }
  if (type.includes("trial")) {
    return "secondary";
  }
  return "outline";
}

export default async function BillingEventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await getEvents(params.org, params.type);
  const organizations = await getOrganizations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing Events</h1>
        <p className="text-muted-foreground">
          View all billing events and transaction history
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <form className="flex gap-2">
          <select
            name="org"
            defaultValue={params.org || ""}
            className="h-10 rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={params.type || ""}
            className="h-10 rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">All Event Types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEventType(type)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Date</th>
                <th className="text-left p-3 text-sm font-medium">Organization</th>
                <th className="text-left p-3 text-sm font-medium">Event</th>
                <th className="text-left p-3 text-sm font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="p-3 text-sm">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-sm">
                    {event.organization?.name || "System"}
                  </td>
                  <td className="p-3">
                    <Badge variant={getEventColor(event.eventType) as any}>
                      {formatEventType(event.eventType)}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {event.data ? JSON.stringify(event.data) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No billing events found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
