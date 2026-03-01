import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserProfile {
    id: string;
    email: string | null;
    full_name: string | null;
}

interface ScheduleCheckInDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    checkInId: string | null;
    initialDate: Date | undefined;
    quarterName: string;
    companyId: string;
    onSuccess?: () => void;
}

export function ScheduleCheckInDialog({
    open,
    onOpenChange,
    checkInId,
    initialDate,
    quarterName,
    companyId,
    onSuccess,
}: ScheduleCheckInDialogProps) {
    const { toast } = useToast();

    const [date, setDate] = useState<Date | undefined>(initialDate);
    const [startTime, setStartTime] = useState<string>("10:00");
    const [duration, setDuration] = useState<string>("60"); // in minutes

    const [companyUsers, setCompanyUsers] = useState<UserProfile[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);

    // Load initial date when dialog opens
    useEffect(() => {
        if (open && initialDate) {
            setDate(initialDate);
        }
    }, [open, initialDate]);

    // Load company users when dialog opens
    useEffect(() => {
        if (open && companyId) {
            loadCompanyUsers();
        }
    }, [open, companyId]);

    const loadCompanyUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, email, full_name")
                .eq("company_id", companyId)
                .eq("is_active", true)
                .not("email", "is", null);

            if (error) throw error;
            setCompanyUsers(data || []);

            // Auto-select all users by default
            if (data) {
                setSelectedUsers(new Set(data.map(u => u.email as string)));
            }
        } catch (error: any) {
            toast({
                title: "Erro ao carregar usuários",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleToggleUser = (email: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(email)) {
            newSelected.delete(email);
        } else {
            newSelected.add(email);
        }
        setSelectedUsers(newSelected);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedUsers(new Set(companyUsers.map(u => u.email as string)));
        } else {
            setSelectedUsers(new Set());
        }
    };

    const generateTimeOptions = () => {
        const options = [];
        for (let i = 6; i <= 20; i++) {
            for (const mins of ["00", "30"]) {
                const hour = i.toString().padStart(2, '0');
                options.push(`${hour}:${mins}`);
            }
        }
        return options;
    };

    const handleSchedule = async () => {
        if (!date || !startTime || !duration || selectedUsers.size === 0) {
            toast({
                title: "Campos obrigatórios",
                description: "Selecione a data, horário, duração e pelo menos um participante.",
                variant: "destructive",
            });
            return;
        }

        setIsScheduling(true);
        try {
            const [hours, minutes] = startTime.split(':').map(Number);
            const startDateTime = new Date(date);
            startDateTime.setHours(hours, minutes, 0, 0);
            const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

            const payload = {
                type: 'schedule',
                checkin_id: checkInId,
                quarter_name: quarterName,
                start_datetime: startDateTime.toISOString(),
                end_datetime: endDateTime.toISOString(),
                attendee_emails: Array.from(selectedUsers),
            };

            const response = await fetch('https://n8n-terj.onrender.com/webhook/wenkey-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Erro ao contatar o servidor de agendamento (${response.status})`);
            }

            // Marcar como agendado no banco de dados para exibir a tag no card
            if (checkInId) {
                const { error: dbError } = await supabase
                    .from('checkins')
                    .update({ is_scheduled: true })
                    .eq('id', checkInId);

                if (dbError) {
                    console.warn("Não foi possível salvar a flag de agendado no banco:", dbError);
                }
            }

            toast({
                title: "Agendado com sucesso",
                description: `Reunião de check-in (${quarterName}) agendada para ${Array.from(selectedUsers).length} participante(s).`,
            });

            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error scheduling:", error);
            toast({
                title: "Erro no agendamento",
                description: error.message || "Não foi possível conectar ao serviço de agendamento.",
                variant: "destructive",
            });
        } finally {
            setIsScheduling(false);
        }
    };


    const allSelected = companyUsers.length > 0 && selectedUsers.size === companyUsers.length;
    const indeterminate = selectedUsers.size > 0 && selectedUsers.size < companyUsers.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-blue-500" />
                        Agendar Reunião de Check-in
                    </DialogTitle>
                    <DialogDescription>
                        Agende este check-in ({quarterName}) no Google Calendar e convide os membros da equipe.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Date & Time Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Data do Evento
                            </label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">
                                Horário de Início
                            </label>
                            <Select value={startTime} onValueChange={setStartTime}>
                                <SelectTrigger className="w-full">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        <SelectValue placeholder="Selecione..." />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {generateTimeOptions().map((time) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Duração</label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 minutos (Check-in Rápido)</SelectItem>
                                <SelectItem value="30">30 minutos</SelectItem>
                                <SelectItem value="45">45 minutos</SelectItem>
                                <SelectItem value="60">1 hora</SelectItem>
                                <SelectItem value="90">1 hora e meia</SelectItem>
                                <SelectItem value="120">2 horas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Participants */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                Convidados ({selectedUsers.size})
                            </label>
                            {companyUsers.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="select-all"
                                        checked={allSelected ? true : indeterminate ? "indeterminate" : false}
                                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                    />
                                    <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                                        Todos
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="border rounded-md">
                            <ScrollArea className="h-[200px] w-full p-4">
                                {isLoadingUsers ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : companyUsers.length === 0 ? (
                                    <p className="text-sm text-center text-muted-foreground mt-4">
                                        Nenhum usuário com e-mail válido encontrado nesta empresa.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {companyUsers.map((user) => (
                                            <div key={user.id} className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`user-${user.id}`}
                                                    checked={selectedUsers.has(user.email!)}
                                                    onCheckedChange={() => handleToggleUser(user.email!)}
                                                />
                                                <div className="grid leading-none">
                                                    <label
                                                        htmlFor={`user-${user.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {user.full_name || "Usuário sem nome"}
                                                    </label>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isScheduling}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSchedule} disabled={isScheduling || selectedUsers.size === 0}>
                        {isScheduling ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Agendando...
                            </>
                        ) : (
                            "Agendar Evento"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
