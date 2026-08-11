"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
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

interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference?: string | null;
  status: string;
  rideId?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

const statusTone: Record<string, "gray" | "green" | "amber" | "red"> = {
  PENDING: "amber",
  PROCESSING: "amber",
  SUCCESS: "green",
  FAILED: "red",
  REFUNDED: "gray",
};

export default function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () =>
      api.get<{ items: Payment[]; total: number }>("/payments?pageSize=50"),
  });

  const simulate = useMutation({
    mutationFn: async (paymentId: string) =>
      api.post(`/payments/${paymentId}/simulate-success`),
  });

  const refund = useMutation({
    mutationFn: async (paymentId: string) =>
      api.post(`/payments/${paymentId}/refund`, { reason: "Requested refund" }),
  });

  const payments = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={data ? `${data.total} payment(s)` : undefined}
      />
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState title="No payments yet" />
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatMoney(p.amountCents)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(p.processedAt ?? p.createdAt)} · {p.provider}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[p.status] ?? "gray"}>
                      {p.status}
                    </Badge>
                    {p.status === "PROCESSING" && (
                      <Button
                        variant="outline"
                        loading={simulate.isPending}
                        onClick={() => simulate.mutate(p.id)}
                      >
                        Simulate success
                      </Button>
                    )}
                    {p.status === "SUCCESS" && (
                      <Button
                        variant="ghost"
                        loading={refund.isPending}
                        onClick={() => refund.mutate(p.id)}
                      >
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
