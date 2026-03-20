import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Pricing() {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAnnual, setIsAnnual] = useState<boolean>(false);
    const { toast } = useToast();

    const plan = {
        name: "Pro",
        description: "Ideal para empresas em crescimento precisando de recursos avançados.",
        monthlyPrice: "R$ 24,90",
        annualPrice: "R$ 238,80",
        monthlyEquivalent: "R$ 19,90",
        monthlyPeriod: "/mês",
        annualPeriod: "/ano",
        features: [
            "Usuários ilimitados",
            "Suporte prioritário 24/7",
            "Integrações avançadas",
            "Análise Preditiva de KRs",
            "Treinamento dedicado",
        ],
        monthlyPriceId: "price_mensal_1XYZ", // Replace with actual Stripe Price ID
        annualPriceId: "price_anual_2XYZ",   // Replace with actual Stripe Price ID
    };

    const currentPrice = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    const currentPeriod = isAnnual ? plan.annualPeriod : plan.monthlyPeriod;
    const currentPriceId = isAnnual ? plan.annualPriceId : plan.monthlyPriceId;

    const handleSubscribe = async (priceId: string) => {
        try {
            setIsLoading(true);

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
            setIsLoading(false);
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

            <div className="mt-12 flex justify-center items-center gap-4">
                <span className={`text-sm font-semibold transition-colors ${!isAnnual ? 'text-[#2563eb]' : 'text-muted-foreground'}`}>
                    Mensal
                </span>
                <Switch 
                    checked={isAnnual} 
                    onCheckedChange={setIsAnnual} 
                    className="data-[state=checked]:bg-gray-400 data-[state=unchecked]:bg-gray-200"
                />
                <span className={`text-sm font-semibold transition-colors ${isAnnual ? 'text-[#2563eb]' : 'text-muted-foreground'}`}>
                    Anual
                </span>
            </div>

            <div className="mx-auto w-full max-w-[380px] mt-10">
                <Card className="relative border-2 shadow-sm rounded-xl">
                    {isAnnual && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <span className="bg-[#2563eb] text-white text-xs font-bold px-4 py-1.5 rounded-[0.4rem] tracking-wide">
                                Mais Popular
                            </span>
                        </div>
                    )}

                    <CardHeader className="pt-10 pb-2 text-left px-8">
                        <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
                            {plan.name}
                        </CardTitle>
                        <div className="flex items-baseline mt-3">
                            <span className="text-[3rem] leading-none font-medium text-foreground tracking-tight">
                                {currentPrice}
                            </span>
                            <span className="text-lg text-muted-foreground ml-2 font-normal">
                                {currentPeriod}
                            </span>
                        </div>
                        {isAnnual && (
                            <div className="text-sm font-medium text-[#2563eb] mt-2">
                                Equivalente a {plan.monthlyEquivalent} /mês
                            </div>
                        )}
                        <p className="text-base text-muted-foreground mt-3">
                            O melhor valor para a sua empresa
                        </p>
                    </CardHeader>

                    <CardContent className="px-8 pb-6">
                        <ul className="space-y-4 mt-2">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <Check className="h-5 w-5 text-[#2563eb] shrink-0 mt-0.5" strokeWidth={2.5} />
                                    <span className="text-foreground text-base">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4 px-8 pb-8 pt-2">
                        <Button
                            className="w-full h-12 text-base font-medium bg-white text-black border border-gray-200 hover:bg-gray-50 shadow-sm rounded-lg"
                            disabled={isLoading}
                            onClick={() => handleSubscribe(currentPriceId)}
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Assinar {currentPrice}
                        </Button>
                        <p className="text-[13px] text-muted-foreground text-center leading-relaxed">
                            {currentPrice} por usuário cobrado {isAnnual ? "anualmente" : "mensalmente"}.<br />
                            Cancele a qualquer momento.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
