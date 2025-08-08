import { Navbar } from "@/components/Navbar";
import { UploadPanel } from "@/components/UploadPanel";
import { QueryView } from "@/components/QueryView";
import { useState } from "react";

const Index = () => {
  const [selectedTable, setSelectedTable] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-background">
      <Navbar selectedTable={selectedTable} onSelectTable={setSelectedTable} />
      <main className="container mx-auto py-8 space-y-8">
        <h1 className="sr-only">Crunchy Analytics — Fast CSV/Excel Upload & Query</h1>
        <UploadPanel onComplete={(t) => t && setSelectedTable(t)} />
        <QueryView selectedTable={selectedTable} onSelectTable={setSelectedTable} />
      </main>
    </div>
  );
};

export default Index;
