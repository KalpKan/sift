/**
 * Shared footer for every app on kalpkan.com: names the app, links back to
 * the hub and to this app's own health route. Keep the "part of kalpkan.com"
 * wording; the hub's registry row and this line are how a visitor knows the
 * subdomains belong together.
 */
export default function Footer({ service }: { service: string }) {
  return (
    <footer className="mt-auto border-t border-zinc-200 px-4 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <p className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono">{service}</span>
        <a href="https://kalpkan.com" className="hover:underline">
          part of kalpkan.com
        </a>
        <a href="/api/health" className="font-mono hover:underline">
          /api/health
        </a>
      </p>
    </footer>
  );
}
