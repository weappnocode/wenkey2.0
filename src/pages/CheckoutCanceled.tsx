import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutCanceled() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <div className="flex flex-col items-center text-center space-y-6 max-w-md p-8 border rounded-lg shadow-sm bg-card">
                <XCircle className="w-20 h-20 text-muted-foreground mb-4" />
                <h1 className="text-3xl font-bold tracking-tight">Pagamento Cancelado</h1>
                <p className="text-muted-foreground text-lg">
                    Seu processo de assinatura foi interrompido e nenhuma cobrança foi feita.
                </p>
                <div className="pt-6 w-full space-y-3">
                    <Button onClick={() => navigate("/pricing")} className="w-full h-12 text-lg">
                        Tentar Novamente
                    </Button>
                    <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12 text-lg">
                        Voltar ao Início
                    </Button>
                </div>
            </div>
        </div>
    );
}
