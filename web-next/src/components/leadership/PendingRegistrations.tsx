"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCcw, ShieldCheck, X } from 'lucide-react';
import { normalizeTag } from '@/lib/tags';
import { showToast } from '@/lib/toast';
import { GlassCard, Button } from '@/components/ui';
import { useLeadership } from '@/hooks/useLeadership';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { PendingRegistration } from '@/types';

type RegistrationStatusFilter = 'pending' | 'approved' | 'rejected' | 'expired' | 'all';

interface RegistrationView extends PendingRegistration {
  playerName: string | null;
  snapshotDate: string | null;
}

const STATUS_LABELS: Record<RegistrationStatusFilter, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  all: 'All',
};

const STATUS_COLOR: Record<RegistrationStatusFilter, string> = {
  pending: 'bg-amber-500/20 text-amber-100 border-amber-400/40',
  approved: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40',
  rejected: 'bg-rose-500/20 text-rose-100 border-rose-400/40',
  expired: 'bg-slate-500/20 text-slate-100 border-slate-500/40',
  all: 'bg-slate-500/10 text-slate-100 border-slate-500/30',
};

interface PendingRegistrationsProps {
  clanTag?: string | null;
}

export default function PendingRegistrations({ clanTag: inputClanTag }: PendingRegistrationsProps) {
  const dashboardClanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const clanTag = normalizeTag(inputClanTag || dashboardClanTag || '');
  const { permissions } = useLeadership();
  const [filter, setFilter] = useState<RegistrationStatusFilter>('pending');
  const [registrations, setRegistrations] = useState<RegistrationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canModerate = permissions.canManageAccess;

  const filterTabs = useMemo(
    () => [
      { key: 'pending', label: 'Pending' },
      { key: 'approved', label: 'Approved' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'expired', label: 'Expired' },
      { key: 'all', label: 'All' },
    ] as Array<{ key: RegistrationStatusFilter; label: string }>,
    [],
  );

  const loadRegistrations = useCallback(async () => {
    if (!clanTag || !canModerate) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ clanTag });
      params.set('status', filter);
      const res = await fetch(`/api/register/pending?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load registrations');
      }
      const data = (payload.data?.registrations || []) as RegistrationView[];
      setRegistrations(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [clanTag, filter, canModerate]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  const handleAction = useCallback(
    async (registrationId: string, action: 'approve' | 'reject') => {
      try {
        setProcessingId(`${registrationId}:${action}`);
        const res = await fetch(`/api/register/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId }),
        });
        const payload = await res.json();
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || `Failed to ${action} registration`);
        }
        showToast(action === 'approve' ? 'Registration approved' : 'Registration rejected', 'success');
        await loadRegistrations();
      } catch (err: any) {
        showToast(err?.message || 'Action failed', 'error');
      } finally {
        setProcessingId(null);
      }
    },
    [loadRegistrations],
  );

  if (!clanTag || !canModerate) {
    return null;
  }

  const renderStatusPill = (status: RegistrationStatusFilter) => (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );

  const formatDateTime = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const hasRegistrations = registrations.length > 0;

  return (
    <GlassCard
      title="Pending Registrations"
      subtitle="Approve or reject dashboard access requests submitted via /register."
      icon={<ShieldCheck className="h-5 w-5" />}
      className="bg-slate-900/70 border border-slate-800/80"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? 'primary' : 'ghost'}
              size="sm"
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                filter === tab.key ? 'bg-clash-gold text-slate-900' : 'text-slate-200'
              }`}
              onClick={() => setFilter(tab.key)}
              disabled={loading}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => void loadRegistrations()}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing
            </>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {!hasRegistrations && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-800/50 p-6 text-sm text-slate-300 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-slate-400" />
          No registrations match this filter.
        </div>
      )}

      {hasRegistrations && (
        <div className="space-y-4">
          {registrations.map((registration) => {
            const isPending = registration.status === 'pending';
            return (
              <div
                key={registration.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 text-base font-semibold text-white">
                      <span>{registration.playerTag}</span>
                      {registration.playerName && (
                        <span className="text-slate-300 text-sm font-normal">({registration.playerName})</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Requested {formatDateTime(registration.createdAt)} &middot; Expires{' '}
                      {formatDateTime(registration.expiresAt)}
                    </p>
                  </div>
                  {renderStatusPill(registration.status as RegistrationStatusFilter)}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 font-mono text-sm text-white">
                    {registration.verificationCode}
                  </div>
                  <span>Last roster snapshot: {formatDateTime(registration.snapshotDate)}</span>
                </div>
                {isPending && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      onClick={() => void handleAction(registration.id, 'approve')}
                      disabled={processingId !== null}
                    >
                      {processingId === `${registration.id}:approve` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl border border-rose-500/50 text-rose-200 hover:bg-rose-500/10"
                      onClick={() => void handleAction(registration.id, 'reject')}
                      disabled={processingId !== null}
                    >
                      {processingId === `${registration.id}:reject` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
