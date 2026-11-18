/**
 * Shared footer for every app on kalpkan.com: names the app, links back to
 * the hub and to this app's own health route. Keep the "part of kalpkan.com"
 * wording; the hub's registry row and this line are how a visitor knows the
 * subdomains belong together.
 */
export default function Footer({ service }: { service: string }) {
  const link = "underline-offset-4 hover:underline";
  return (
    <footer className="mt-auto border-t border-rule font-mono text-[11px] leading-[1.3] text-ink-faint">
      <p className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-8">
        <span>{service}</span>
        <a href="https://kalpkan.com" className={link}>
          part of kalpkan.com
        </a>
        <a href="/api/health" className={link}>
          /api/health
        </a>
      </p>
    </footer>
  );
}
