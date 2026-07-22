import { createRootRoute, Outlet } from "@tanstack/react-router";
import Layout from "../app/layout";
import { useNotificationHandler } from "../hooks/useNotificationHandler";
import { ReceiveProjectDialog } from "../components/share/ReceiveProjectDialog";

function RootRouteComponent() {
  useNotificationHandler();
  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <ReceiveProjectDialog />
    </>
  );
}

export const rootRoute = createRootRoute({
  component: RootRouteComponent,
});
