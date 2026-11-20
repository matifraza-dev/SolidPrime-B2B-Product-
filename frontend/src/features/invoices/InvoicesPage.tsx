import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchInvoices, fetchInvoice, deleteInvoice } from "./api";
import type { Invoice, InvoiceStatus } from "./api";
import { InvoiceFormModal } from "./InvoiceFormModal";
import { extractErrorMessage } from "@/api/client";
import { useDebounce } from "@/hooks/useDebounce";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { format } from "date-fns";

const statusTone: Record<InvoiceStatus, "success" | "info" | "danger" | "accent" | "warning"> = {
  draft: "info",
  sent: "accent",
  paid: "success",
  overdue: "danger",
  cancelled: "warning",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function parseLocalDate(dateStr: string) {
  return new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
}

export function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["invoices", { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchInvoices({ page, search: debouncedSearch || undefined, status: status || undefined }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      toast.success("Invoice deleted");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  function handleDelete(invoice: Invoice) {
    if (confirm(`Delete ${invoice.invoice_number}? This can't be undone.`)) {
      deleteMutation.mutate(invoice.public_id);
    }
  }

  function openCreate() {
    setEditingInvoice(undefined);
    setShowFormModal(true);
  }

  async function openEdit(invoiceSummary: Invoice) {
    if (loadingDetailId) return;
    setLoadingDetailId(invoiceSummary.public_id);
    try {
      const full = await fetchInvoice(invoiceSummary.public_id);
      setEditingInvoice(full);
      setShowFormModal(true);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingDetailId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">Invoices</h1>
          <p className="text-sm text-muted">Bill customers and track payment status.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search invoice #, customer..."
        />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : !data?.results.length ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Create your first invoice to start billing customers."
          />
        ) : (
          <>
            <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <ul className="divide-y divide-border">
                {data.results.map((invoice) => (
                  <li key={invoice.public_id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-tabular text-sm font-medium text-primary">{invoice.invoice_number}</span>
                        <Badge tone={statusTone[invoice.status]}>{invoice.status_display}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {invoice.customer_name} · Due {format(parseLocalDate(invoice.due_date), "PP")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-tabular text-sm font-semibold text-primary">
                        {currency.format(Number(invoice.total))}
                      </span>
                      <button
                        onClick={() => openEdit(invoice)}
                        disabled={loadingDetailId === invoice.public_id}
                        className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-primary disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice)}
                        className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              totalCount={data.count}
              pageSize={data.page_size}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {showFormModal && (
        <InvoiceFormModal invoice={editingInvoice} onClose={() => setShowFormModal(false)} />
      )}
    </div>
  );
}
