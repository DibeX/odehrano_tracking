import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  beforeLoad: async () => {
    // TODO: Check authentication here
    // If not authenticated, redirect to login
  },
});

function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to the Tabletop Game Tracking application!</p>
    </div>
  );
}
