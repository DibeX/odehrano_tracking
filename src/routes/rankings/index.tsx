import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { RankingYear } from "@/types";

export const Route = createFileRoute("/rankings/")({
  component: RankingsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function RankingsPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user, isAdmin, isModerator } = useAuthContext();
  const [years, setYears] = useState<RankingYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadYears();
  }, []);

  async function loadYears() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ranking_years")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      setYears(data || []);
    } catch (error: any) {
      toast({
        title: _(t`Error loading years`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function createCurrentYear() {
    const currentYear = new Date().getFullYear();

    try {
      const { error } = await supabase.from("ranking_years").insert({
        year: currentYear,
        is_locked: false,
        is_public: false,
      });

      if (error) throw error;

      toast({
        title: _(t`Year created`),
        description: _(t`Ranking year ${currentYear} has been created`),
      });

      loadYears();
    } catch (error: any) {
      toast({
        title: _(t`Error creating year`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>My Rankings</Trans>
            </h1>
            <p className="text-muted-foreground">
              <Trans>Rank your favorite games by year</Trans>
            </p>
          </div>

          {(isAdmin || isModerator) && (
            <div className="flex gap-2">
              <Button onClick={createCurrentYear}>
                <Trans>Create Current Year</Trans>
              </Button>
              <Link to="/rankings/manage">
                <Button variant="outline">
                  <Trans>Manage Years</Trans>
                </Button>
              </Link>
            </div>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : years.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  <Trans>No ranking years available yet</Trans>
                </p>
                {(isAdmin || isModerator) && (
                  <Button onClick={createCurrentYear}>
                    <Trans>Create Year {new Date().getFullYear()}</Trans>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {years.map((year) => (
              <Card key={year.id}>
                <CardHeader>
                  <CardTitle>{year.year}</CardTitle>
                  <CardDescription>
                    {year.is_locked ? (
                      <span className="text-orange-500">
                        <Trans>Locked</Trans>
                      </span>
                    ) : (
                      <span className="text-green-500">
                        <Trans>Open for submissions</Trans>
                      </span>
                    )}
                    {year.is_public && (
                      <>
                        {" • "}
                        <span className="text-blue-500">
                          <Trans>Results Public</Trans>
                        </span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {year.deadline && (
                    <p className="text-sm text-muted-foreground">
                      <Trans>
                        Deadline: {new Date(year.deadline).toLocaleDateString()}
                      </Trans>
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <Link
                      to="/rankings/$year"
                      params={{ year: year.year.toString() }}
                    >
                      <Button className="w-full" disabled={year.is_locked}>
                        {year.is_locked ? (
                          <Trans>View Rankings</Trans>
                        ) : (
                          <Trans>Manage Rankings</Trans>
                        )}
                      </Button>
                    </Link>

                    {year.is_public && (
                      <Link to="/results" search={{ year: year.year }}>
                        <Button variant="outline" className="w-full">
                          <Trans>View Results</Trans>
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
