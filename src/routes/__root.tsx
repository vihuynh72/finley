import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { Loader2 } from "lucide-react";
import { AppProvider, useApp } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/dashboard" className="btn btn-primary">Go to overview</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="btn btn-primary">Try again</button>
          <a href="/" className="btn">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { title: "Finley — Reforecast signals and scenarios" },
      { name: "description", content: "Outside news that tests forecast assumptions, plus transparent scenario modeling for analysts and fractional CFOs." },
      { property: "og:title", content: "Finley — Reforecast signals and scenarios" },
      { property: "og:description", content: "Outside news that tests forecast assumptions, plus transparent scenario modeling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <AppProvider>
        <ShellGate />
      </AppProvider>
    </QueryClientProvider>
  );
}

const Loading = ({ label }: { label: string }) => (
  <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> {label}</div>
);

// Public pages render as they are. Everything else needs a signed-in user and a loaded client;
// with no clients yet, the analyst starts by adding one.
function ShellGate() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const app = useApp();
  if (path === "/" || path === "/login") return <Outlet />;
  if (!app.authChecked) return <Loading label="Signing in…" />;
  // Browsing works signed out when the Base44 app allows it; a refused read means sign in first.
  if (app.needsSignIn) return <Navigate to="/login" />;
  if (app.clientsLoading) return <Loading label="Loading clients…" />;
  if (path === "/clients/new") return <AppShell><Outlet /></AppShell>;
  if (!app.clients.length && !app.loadError) return <Navigate to="/clients/new" />;
  return (
    <AppShell>
      {app.loadError ? <div className="card p-5 text-sm">Couldn't load data from Base44: {app.loadError}</div>
        : !app.client ? <Loading label="Loading client…" /> : <Outlet />}
    </AppShell>
  );
}
