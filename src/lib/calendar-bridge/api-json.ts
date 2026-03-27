export function eventToJson(e: {
  id: string;
  uid: string;
  recurrenceId: string | null;
  summary: string | null;
  location: string | null;
  description: string | null;
  startAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
  subscriptionId: string;
  subscription: { resourceHref: string; displayName: string | null };
}) {
  return {
    id: e.id,
    uid: e.uid,
    recurrenceId: e.recurrenceId,
    summary: e.summary,
    location: e.location,
    description: e.description,
    startAt: e.startAt?.toISOString() ?? null,
    endAt: e.endAt?.toISOString() ?? null,
    allDay: e.allDay,
    subscriptionId: e.subscriptionId,
    calendar: {
      resourceHref: e.subscription.resourceHref,
      displayName: e.subscription.displayName,
    },
  };
}
