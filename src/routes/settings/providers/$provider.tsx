import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { ProviderSettingsPage } from "@/components/settings/ProviderSettingsPage";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface ProviderSettingsParams {
  provider: string;
}

export const providerSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/providers/$provider",
  params: {
    parse: (params: { provider: string }): ProviderSettingsParams => ({
      provider: params.provider,
    }),
  },
  beforeLoad: ({ params }) => {
    if (params.provider === "auto") {
      throw redirect({ to: "/settings" });
    }
  },
  component: function ProviderSettingsRouteComponent() {
    const { provider } = providerSettingsRoute.useParams();
    const navigate = useNavigate();

    return (
      <main className="caide-provider-settings">
        <header>
          <button
            type="button"
            aria-label="Back to settings"
            onClick={() => navigate({ to: "/settings" })}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <span>CAIDE / PROVIDERS</span>
            <strong>Model connection</strong>
          </div>
          <div className="caide-provider-status">
            <KeyRound size={13} /> User-managed credentials
          </div>
        </header>
        <section>
          <ProviderSettingsPage provider={provider} />
        </section>
      </main>
    );
  },
});
