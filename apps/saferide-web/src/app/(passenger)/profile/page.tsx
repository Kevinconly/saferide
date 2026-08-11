"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
} from "@/components/ui";

interface Profile {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  role: string;
  isVerified: boolean;
  status: string;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [error, setError] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => api.get<Profile>("/users/me"),
  });

  const update = useMutation({
    mutationFn: async () =>
      api.patch<Profile>("/users/me", {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (err) => setError(isApiError(err) ? err.message : "Update failed"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    update.mutate();
  }

  return (
    <Card>
      <CardHeader
        title="Profile"
        subtitle={profile ? formatPhone(profile.phone) : undefined}
      />
      <CardBody>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={update.isPending}>
            Save changes
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
