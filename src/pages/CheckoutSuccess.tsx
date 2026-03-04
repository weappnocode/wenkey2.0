import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccess() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <div className="flex flex-col items-center text-center space-y-6 max-w-md p-8 border rounded-lg shadow-sm bg-card">
                <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
                <h1 className="text-3xl font-bold tracking-tight">Pagamento Confirmado!</h1>
                <p className="text-muted-foreground text-lg">
                    Obrigado por assinar! Sua conta foi atualizada com sucesso. Bem-vindo(a) ao seu novo plano.
                </p>
                <div className="pt-6 w-full">
                    <Button onClick={() => navigate("/")} className="w-full h-12 text-lg">
                        Ir para o Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}
