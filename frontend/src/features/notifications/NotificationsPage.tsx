import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fetchNotifications, markRead, markAllRead, type NotificationItem } from "./api";
import { extractErrorMessage } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow } from "date-fns";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const hasUnread = notifications?.some((n) => !n.is_read);

  function handleOpen(n: NotificationItem) {
    if (!n.is_read) markReadMutation.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  if (isLoading) return <PageSpinner />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">Notifications</h1>
          <p className="text-sm text-muted">Updates on tasks assigned to you and deals you own.</p>
        </div>
        {hasUnread && (
          <Button variant="ghost" onClick={() => markAllReadMutation.mutate()} isLoading={markAllReadMutation.isPending}>
            <Check className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {!notifications?.length ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll see updates here when a task is assigned to you or a deal you own changes stage."
          />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <div className="flex-1 text-sm text-secondary hover:text-primary">
                  <span className={n.is_read ? "" : "font-medium text-primary"}>{n.verb}</span>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
