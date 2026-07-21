import { createRootRoute, Outlet } from "@tanstack/react-router";
import Layout from "../app/layout";
import { useNotificationHandler } from "../hooks/useNotificationHandler";

function RootRouteComponent() {
  useNotificationHandler();
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export const rootRoute = createRootRoute({
  component: RootRouteComponent,
});
