import { useState, useEffect } from 'react';
import { Loader2, Check, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InterestCategory {
    id: string;
    name: string;
    emoji: string;
}

interface InterestsOnboardingProps {
    open: boolean;
    onComplete: () => void;
    userId: string;
}

export function InterestsOnboarding({ open, onComplete, userId }: InterestsOnboardingProps) {
    const [interests, setInterests] = useState<string[]>([]);
    const [availableInterests, setAvailableInterests] = useState<InterestCategory[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInterests = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('interest_categories')
                .select('*')
                .order('name');

            if (!error && data) {
                setAvailableInterests(data);
            }
            setLoading(false);
        };

        if (open) {
            fetchInterests();
        }
    }, [open]);

    const toggleInterest = (interest: string) => {
        setInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : prev.length < 10
                    ? [...prev, interest]
                    : prev
        );
    };

    const handleSave = async () => {
        if (interests.length < 3) {
            toast.error('Please select at least 3 interests');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    interests: interests
                })
                .eq('user_id', userId);

            if (error) throw error;

            toast.success('Interests saved!');
            onComplete();
        } catch (error) {
            console.error('Error saving interests:', error);
            toast.error('Failed to save interests');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&>button]:hidden bg-slate-950 border-slate-900 text-white">
                <DialogHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 rotate-3">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Your Study Persona
                    </DialogTitle>
                    <DialogDescription className="text-lg text-slate-400">
                        Select 3+ academic interests to find the perfect study buddies.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-slate-400 animate-pulse">Designing your campus life...</p>
                        </div>
                    ) : availableInterests.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-slate-900/50 rounded-2xl border border-slate-800">
                            <p className="text-slate-400 mb-4">No academic categories found.</p>
                            <p className="text-xs text-slate-500 italic">Please ensure your administrator has updated the interest categories table.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {availableInterests.map((interest) => {
                                    const isSelected = interests.includes(interest.name);
                                    return (
                                        <button
                                            key={interest.id}
                                            onClick={() => toggleInterest(interest.name)}
                                            className={cn(
                                                "relative flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300 group overflow-hidden",
                                                isSelected
                                                    ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary),0.2)] hover:bg-primary/20"
                                                    : "bg-slate-900 border-transparent hover:border-slate-700 hover:bg-slate-800"
                                            )}
                                        >
                                            <span className="text-4xl transition-all duration-300 group-hover:scale-125 group-hover:rotate-6">
                                                {interest.emoji}
                                            </span>
                                            <span className={cn(
                                                "text-sm font-semibold tracking-wide transition-colors text-center",
                                                isSelected ? "text-primary" : "text-slate-300"
                                            )}>
                                                {interest.name}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 bg-primary rounded-full p-1 shadow-lg">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-8 border-t border-slate-800 sticky bottom-0 bg-slate-950/90 backdrop-blur-md pb-4 z-20">
                                <div className="flex items-center justify-between mb-6 px-2">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">
                                            Progress
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {interests.length}/10 selected
                                        </span>
                                    </div>
                                    {interests.length < 3 && (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                            Select {3 - interests.length} more
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || interests.length < 3}
                                    className={cn(
                                        "w-full h-14 text-lg font-bold rounded-2xl transition-all duration-300",
                                        interests.length >= 3
                                            ? "bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(var(--primary),0.4)]"
                                            : "bg-slate-800 text-slate-500"
                                    )}
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                                            Saving Persona...
                                        </>
                                    ) : (
                                        'Enter StudyGram'
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
