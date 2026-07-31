import type { ReactNode } from "react";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-surface-card p-3 text-xs leading-relaxed text-ink-soft">
      <code>{children}</code>
    </pre>
  );
}

function CmdTable({
  rows,
}: {
  rows: Array<{ name: string; detail: string }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-card text-xs uppercase tracking-wide text-muted-dim">
          <tr>
            <th className="px-3 py-2 font-medium">Comando / acción</th>
            <th className="px-3 py-2 font-medium">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name} className="bg-surface-raised/40">
              <td className="px-3 py-2 align-top font-mono text-xs text-accent">
                {row.name}
              </td>
              <td className="px-3 py-2 text-ink-soft">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommandsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h1 className="text-xl font-bold text-ink">Comandos de operación</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Referencia para controlar la app en local y en Fly. La misma guía vive en
          GitHub:{" "}
          <a
            href="https://github.com/otroarlequin/bgg-core/blob/master/docs/COMMANDS.md"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            docs/COMMANDS.md
          </a>
          . Deploy detallado en{" "}
          <a
            href="https://github.com/otroarlequin/bgg-core/blob/master/DEPLOY.md"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            DEPLOY.md
          </a>
          .
        </p>
      </div>

      <Section title="Arranque local">
        <CodeBlock>{`npm install
npm install --prefix web
cp .env.example .env   # BGG_TOKEN + BGG_USERNAME

npm run dev            # API :3001 + web :5173
npm run dev:api
npm run dev:web`}</CodeBlock>
      </Section>

      <Section title="Sync con BoardGameGeek">
        <p className="text-sm text-muted">
          Refresca colección y partidas en la instancia donde estés (local o Fly).
          No toca duels ni purchase reviews. En Fly hace falta{" "}
          <code className="text-ink-soft">BGG_TOKEN</code> +{" "}
          <code className="text-ink-soft">BGG_USERNAME</code>.
        </p>
        <CmdTable
          rows={[
            {
              name: "Botón «Sincronizar con BGG»",
              detail: "Header de la app (recomendado en Fly y local).",
            },
            {
              name: "POST /api/sync",
              detail: 'Body opcional: { "collection": true, "plays": true }.',
            },
            {
              name: "npm run sync:collection",
              detail: "CLI; --full para sync completa.",
            },
            {
              name: "npm run sync:plays",
              detail: "CLI; --full para sync completa.",
            },
            {
              name: "npm run sync:things",
              detail: "Metadatos /thing; --force para re-sync. No está en el botón.",
            },
          ]}
        />
      </Section>

      <Section title="Reconcile local ↔ Fly">
        <p className="text-sm text-muted">
          Dos SQLite (PC y volumen Fly). Se alinean solo cuando lo pidas para no
          perder duels / reviews.
        </p>
        <CmdTable
          rows={[
            {
              name: "npm run db:status",
              detail: "Reporte de discrepancias; no escribe.",
            },
            {
              name: "npm run db:pull",
              detail: "Fly → local. Backup en data/backups/.",
            },
            {
              name: "npm run db:push",
              detail: "local → Fly. Unión + asserts; fail-closed sin remoto.",
            },
            {
              name: "npm run db:upload",
              detail: "Alias deprecado de db:push.",
            },
          ]}
        />
        <div className="rounded-xl border border-border bg-surface-card/60 p-3 text-sm text-ink-soft">
          <p className="font-medium text-ink">Al volver a casa</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>
              <code className="text-ink-soft">npm run db:status</code>
            </li>
            <li>
              <code className="text-ink-soft">npm run db:pull</code> si Fly tiene
              datos de app nuevos
            </li>
            <li>Opcional: sync BGG en local si collection/plays remotos iban adelante</li>
            <li>
              <code className="text-ink-soft">npm run db:push</code> solo si local
              tiene app data que Fly no
            </li>
          </ol>
        </div>
        <CodeBlock>{`npm run db:status -- --app bgg-core --local ./data/bgg.db
npm run db:push -- --fail-on-conflict
npm run db:push -- --skip-download --old ./tmp/remote.db
npm run db:push -- --local-only --old ./tmp/remote.db --out ./data/bgg-merged.db`}</CodeBlock>
        <p className="text-xs text-muted">
          <code className="text-ink-soft">--i-know-this-can-wipe-app-data</code>{" "}
          permite push sin remoto: peligroso, puede borrar duels/reviews de prod.
        </p>
      </Section>

      <Section title="Deploy (Fly.io)">
        <CodeBlock>{`fly deploy
fly secrets set BGG_TOKEN="…" BGG_USERNAME="…" APP_PASSWORD="…" -a bgg-core
fly apps restart bgg-core
fly machine start -a bgg-core   # si está dormida`}</CodeBlock>
        <p className="text-sm text-muted">
          Guía completa en el repo:{" "}
          <a
            href="https://github.com/otroarlequin/bgg-core/blob/master/DEPLOY.md"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            DEPLOY.md
          </a>
          .
        </p>
      </Section>

      <Section title="Otros CLI">
        <CodeBlock>{`npm run query:collection -- --own --min-rating 8
npm run activity:duel -- create --from 2026-01-01 --to 2026-06-30
npm test
npm run build:all`}</CodeBlock>
      </Section>

      <Section title="Qué no hacer">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            No subas un <code className="text-ink-soft">.db</code> local a Fly con{" "}
            <code className="text-ink-soft">sftp put</code> manual sin merge: puedes
            perder <code className="text-ink-soft">duel_*</code> y{" "}
            <code className="text-ink-soft">purchase_reviews</code>.
          </li>
          <li>
            No configures sync continuo/cron: el diseño es on-demand para no gastar
            Fly ni rate limit de BGG.
          </li>
        </ul>
      </Section>
    </div>
  );
}
