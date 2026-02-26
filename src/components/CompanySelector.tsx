import { useCompany } from '@/contexts/CompanyContext';
import { Building2 } from 'lucide-react';

export function CompanySelector() {
  const { selectedCompany } = useCompany();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent border border-sidebar-border text-sidebar-foreground">
      <div className="w-8 h-8 rounded-md bg-sidebar-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="w-4 h-4 text-sidebar-primary" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-sidebar-foreground/60">Empresa</span>
        <span className="text-sm font-semibold truncate" title={selectedCompany?.name || ''}>
          {selectedCompany?.name || 'Carregando...'}
        </span>
      </div>
    </div>
  );
}
