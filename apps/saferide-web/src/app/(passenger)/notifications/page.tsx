"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
} from "@/components/ui";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      api.get<{ items: Notification[]; total: number; hasMore: boolean }>(
        "/notifications?pageSize=50",
      ),
  });

  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all", {}),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`, {}),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.total} notification(s)` : undefined}
        action={
          <Button variant="outline" onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications"
            hint="Ride updates and alerts will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-70" : ""}>
              <CardBody>
                <button
                  className="w-full text-left"
                  onClick={() => {
                    if (!n.isRead) markOne.mutate(n.id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {formatDate(n.createdAt)}
                      </span>
                      {!n.isRead && <Badge tone="green">new</Badge>}
                    </div>
                  </div>
                  {n.body && (
                    <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                  )}
                </button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
