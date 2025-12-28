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
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&>button]:hidden">
                <DialogHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold">What are you into?</DialogTitle>
                    <DialogDescription className="text-base">
                        Pick at least 3 to help us find the best study buddies for you.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading interests...</p>
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
                                                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 group",
                                                isSelected
                                                    ? "bg-primary/5 border-primary shadow-sm hover:bg-primary/10"
                                                    : "bg-card border-transparent hover:border-border hover:bg-secondary/50"
                                            )}
                                        >
                                            <span className="text-3xl transition-transform duration-200 group-hover:scale-110">
                                                {interest.emoji}
                                            </span>
                                            <span className={cn(
                                                "text-sm font-medium transition-colors",
                                                isSelected ? "text-primary" : "text-muted-foreground"
                                            )}>
                                                {interest.name}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2">
                                                    <Check className="h-4 w-4 text-primary" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t sticky bottom-0 bg-background pb-2">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-muted-foreground">
                                        Selected: {interests.length}/10
                                    </span>
                                    {interests.length < 3 && (
                                        <span className="text-xs text-amber-500 font-medium italic">
                                            Need {3 - interests.length} more
                                        </span>
                                    )}
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || interests.length < 3}
                                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Get Started'
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
