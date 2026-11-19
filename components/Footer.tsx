/**
 * Shared footer for every app on kalpkan.com: names the app, links back to
 * the hub and to this app's own health route. Keep the "part of kalpkan.com"
 * wording; the hub's registry row and this line are how a visitor knows the
 * subdomains belong together.
 */
export default function Footer({ service }: { service: string }) {
  const link = "underline-offset-4 hover:underline";
  return (
    <footer className="mt-auto font-mono text-[11px] leading-[1.3] text-ink-faint">
      {/* The rule is on the inner column, so it ends where every other rule ends. */}
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule py-4">
          <span>{service}</span>
          <a href="https://kalpkan.com" className={link}>
            part of kalpkan.com
          </a>
          <a href="/api/health" className={link}>
            /api/health
          </a>
        </p>
      </div>
    </footer>
  );
}
