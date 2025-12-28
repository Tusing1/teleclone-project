import { useState } from 'react';
import {
    Users,
    UserPlus,
    Search,
    MessageCircle,
    Loader2,
    Upload,
    Smartphone,
    Check
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from './Avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyBuddies } from '@/hooks/useStudyBuddies';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface StudyBuddiesDialogProps {
    open: boolean;
    onClose: () => void;
    onSelectUser: (userId: string) => void;
}

export function StudyBuddiesDialog({ open, onClose, onSelectUser }: StudyBuddiesDialogProps) {
    const { user } = useAuth();
    const { buddies, loading: loadingBuddies } = useStudyBuddies();
    const [searchQuery, setSearchQuery] = useState('');

    // Sync State
    const [manualNumbers, setManualNumbers] = useState('');
    const [syncResults, setSyncResults] = useState<Profile[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const filteredBuddies = buddies.filter(b =>
        b.profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.profile.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleManualSync = async () => {
        if (!manualNumbers.trim()) return;

        setIsSyncing(true);
        try {
            // Split by commas, newlines, or spaces
            const numbers = manualNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(n => n.length > 5);

            if (numbers.length === 0) {
                toast.error("No valid phone numbers found");
                return;
            }

            // Normalize simple search (matches exact or partial)
            // Note: In real app, normalization should be robust (e.g. libphonenumber-js)
            // Here we allow partial match against stored numbers

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .neq('user_id', user?.id);

            if (error) throw error;

            // Client-side filtering for demo (better to use RPC for large scale)
            const found = data?.filter(p => {
                if (!p.phone_number) return false;
                const targetClean = p.phone_number.replace(/[^0-9]/g, '');
                return numbers.some(n => {
                    const inputClean = n.replace(/[^0-9]/g, '');
                    return targetClean.includes(inputClean) || inputClean.includes(targetClean);
                });
            }) || [];

            setSyncResults(found as Profile[]);
            if (found.length === 0) {
                toast.info("No users found matching these numbers");
            } else {
                toast.success(`Found ${found.length} users!`);
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to sync contacts");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleNativeSync = async () => {
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            toast.error("Contact access not supported on this device/browser.");
            return;
        }

        try {
            const props = ['name', 'tel'];
            const opts = { multiple: true };

            // @ts-ignore
            const contacts = await navigator.contacts.select(props, opts);

            if (contacts.length === 0) return;

            const numbers: string[] = [];
            // @ts-ignore
            contacts.forEach(c => {
                // @ts-ignore
                c.tel.forEach(t => numbers.push(t));
            });

            setManualNumbers(numbers.join(', '));
            // Optionally auto-trigger search
            toast.success(`Imported ${numbers.length} numbers. Click 'Find Friends' to search.`);

        } catch (ex) {
            console.error(ex);
            toast.error("Failed to access contacts");
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            // Simple CSV regex or split
            // Assume single column of numbers or comma separated
            const numbers = text.match(/[0-9+() -]{6,}/g);
            if (numbers) {
                setManualNumbers(prev => (prev ? prev + '\n' : '') + numbers.join(', '));
                toast.success(`Loaded ${numbers.length} potential numbers`);
            } else {
                toast.error("No numbers found in file");
            }
        };
        reader.readAsText(file);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        StudyBuddies
                    </DialogTitle>
                    <DialogDescription>
                        Connect with your study partners
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="buddies" className="flex-1 flex flex-col h-full overflow-hidden">
                    <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-2">
                        <TabsTrigger value="buddies">My Buddies</TabsTrigger>
                        <TabsTrigger value="sync">Find & Sync</TabsTrigger>
                    </TabsList>

                    {/* My Buddies Tab */}
                    <TabsContent value="buddies" className="flex-1 overflow-hidden flex flex-col p-0 data-[state=active]:flex mt-2">
                        <div className="px-6 mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search buddies..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6">
                            {loadingBuddies ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredBuddies.length > 0 ? (
                                <div className="space-y-2 pb-6">
                                    {filteredBuddies.map(buddy => (
                                        <div key={buddy.profile.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors border">
                                            <Avatar
                                                src={buddy.profile.avatar_url}
                                                name={buddy.profile.full_name || buddy.profile.username}
                                                isOnline={buddy.profile.is_online}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium truncate">{buddy.profile.full_name || buddy.profile.username}</h4>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    @{buddy.profile.username} • {buddy.source === 'match' ? 'Matched' : 'Friend'}
                                                </p>
                                            </div>
                                            <Button size="icon" variant="ghost" onClick={() => {
                                                onSelectUser(buddy.profile.user_id);
                                                onClose();
                                            }}>
                                                <MessageCircle className="h-5 w-5 text-primary" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>No buddies yet.</p>
                                    <Button variant="link" onClick={() => (document.querySelector('[value="sync"]') as HTMLElement)?.click()}>
                                        Find friends now
                                    </Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Sync Tab */}
                    <TabsContent value="sync" className="flex-1 overflow-y-auto p-6 data-[state=active]:block mt-0">
                        <div className="space-y-6">

                            {/* Native / File Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleNativeSync}>
                                    <Smartphone className="h-6 w-6 text-blue-500" />
                                    <span className="text-xs font-medium">Sync form Device</span>
                                </Button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".txt,.csv,.vcf"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileUpload}
                                    />
                                    <Button variant="outline" className="h-24 w-full flex-col gap-2 pointer-events-none">
                                        <Upload className="h-6 w-6 text-green-500" />
                                        <span className="text-xs font-medium">Upload File</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Or enter numbers manually:</label>
                                <Textarea
                                    placeholder="Paste phone numbers here (comma or new line separated)..."
                                    value={manualNumbers}
                                    onChange={e => setManualNumbers(e.target.value)}
                                    className="min-h-[100px]"
                                />
                                <Button className="w-full" onClick={handleManualSync} disabled={isSyncing || !manualNumbers}>
                                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                    Find Friends
                                </Button>
                            </div>

                            {/* Results */}
                            {syncResults.length > 0 && (
                                <div className="pt-4 border-t">
                                    <h4 className="font-medium mb-3">Found Users ({syncResults.length})</h4>
                                    <div className="space-y-2">
                                        {syncResults.map(user => (
                                            <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
                                                <Avatar src={user.avatar_url} name={user.full_name || user.username} size="sm" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm">{user.full_name || user.username}</div>
                                                    <div className="text-xs text-muted-foreground">@{user.username}</div>
                                                </div>
                                                <Button size="sm" variant="secondary" onClick={() => {
                                                    // Ideally open profile or send request. For now select to message/view.
                                                    onSelectUser(user.user_id);
                                                    onClose();
                                                }}>
                                                    View
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
