'use client';

interface PlayerErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PlayerError({ error, reset }: PlayerErrorProps) {
  return (
    <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6 text-rose-100">
      <h2 className="text-lg font-semibold">Unable to load player profile</h2>
      <p className="mt-2 text-sm text-rose-200/80">{error.message || 'An unexpected error occurred.'}</p>
      <button
        type="button"
        className="mt-4 rounded-full border border-rose-400/60 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/20"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
