import { KeitaroSettingsCard } from "@/components/integrations/KeitaroSettingsCard";

export default function KeitaroSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Keitaro Integration</h2>
        <p className="text-muted-foreground mt-1">
          Configure your Keitaro tracker connection, postback URL, and campaign mappings.
        </p>
      </div>

      <KeitaroSettingsCard />
    </div>
  );
}
