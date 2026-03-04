import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Define your pricing plans here. In a real scenario, fetch these IDs from your database or env.
const PRICING_PLANS = [
    {
        id: "basic",
        name: "Básico",
        description: "Perfeito para indivíduos ou pequenas equipes começando com OKRs.",
        price: "R$ 49",
        period: "/mês",
        features: ["Até 10 usuários", "OKRs ilimitados", "Suporte por email", "Dashboard Básico"],
        priceId: "price_1XYZ", // Replace with actual Stripe Price ID
        highlight: false,
    },
    {
        id: "pro",
        name: "Pro",
        description: "Ideal para empresas em crescimento precisando de recursos avançados.",
        price: "R$ 149",
        period: "/mês",
        features: [
            "Usuários ilimitados",
            "Suporte prioritário 24/7",
            "Integrações avançadas",
            "Análise Preditiva de KRs",
            "Treinamento dedicado",
        ],
        priceId: "price_2XYZ", // Replace with actual Stripe Price ID
        highlight: true,
    },
];

export default function Pricing() {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const { toast } = useToast();

    const handleSubscribe = async (priceId: string) => {
        try {
            setIsLoading(priceId);

            const returnUrl = `${window.location.origin}/checkout-success`;

            const { data, error } = await supabase.functions.invoke("create-checkout-session", {
                body: { priceId, returnUrl },
            });

            if (error) throw error;

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("Não foi possível gerar a URL de checkout.");
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Ocorreu um erro ao processar o pagamento.",
                variant: "destructive",
            });
            setIsLoading(null);
        }
    };

    return (
        <div className="container py-12 md:py-24 lg:py-32">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">Planos Simples e Transparentes</h2>
                <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                    Escolha o plano que melhor atende às necessidades da sua empresa e comece a alcançar seus objetivos hoje.
                </p>
            </div>
            <div className="mx-auto grid justify-center gap-8 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-2 lg:gap-12 mt-12">
                {PRICING_PLANS.map((plan) => (
                    <Card
                        key={plan.id}
                        className={`flex flex-col justify-between ${plan.highlight ? "border-primary shadow-lg scale-105 relative" : ""
                            }`}
                    >
                        {plan.highlight && (
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
                                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Mais Popular
                                </span>
                            </div>
                        )}
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            <CardDescription className="pt-1.5 h-10">{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center flex-1">
                            <div className="mb-6 flex items-baseline text-5xl font-extrabold">
                                {plan.price}
                                <span className="text-xl font-medium text-muted-foreground ml-1">{plan.period}</span>
                            </div>
                            <ul className="w-full space-y-2 text-sm">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center">
                                        <Check className="mr-2 h-4 w-4 text-primary" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={plan.highlight ? "default" : "outline"}
                                disabled={!!isLoading}
                                onClick={() => handleSubscribe(plan.priceId)}
                            >
                                {isLoading === plan.priceId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isLoading === plan.priceId ? "Processando..." : "Assinar Agora"}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
