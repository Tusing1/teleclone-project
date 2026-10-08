import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Loader2, MessageCircle, Search, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { useFindFriends } from '@/hooks/useFindFriends';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';
import { buddyRecentlyActive, filterBuddyProfiles, sharedBuddyInterests } from '@/lib/buddyDiscovery';

interface FindFriendsDialogProps {
  open: boolean; onClose: () => void; onOpenConversation: (id: string) => void;
  onEditProfile?: () => void;
}
type Tab = 'discover' | 'connections' | 'requests';
const buddyTabs: Tab[] = ['discover', 'connections', 'requests'];

function BuddyCard({ profile, interests, action, pending, disabled, onConnect, onPass }: {
  profile: Profile; interests: string[]; action: string; pending: boolean; disabled: boolean;
  onConnect: () => void; onPass?: () => void;
}) {
  const common = sharedBuddyInterests(profile, interests);
  return <article className="rounded-3xl border border-border/60 bg-card/75 p-4">
    <div className="flex items-center gap-3"><Avatar name={profile.full_name || profile.username} src={profile.avatar_url} size="md" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{profile.full_name || profile.username}</h3><p className="mt-1 truncate text-xs text-muted-foreground">@{profile.username}</p></div>{buddyRecentlyActive(profile) && <span title="Active within the last 24 hours" className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-500">Recently active</span>}</div>
    {profile.bio && <p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>}
    {common.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary"><BookOpen size={13} />{common.length} shared {common.length === 1 ? 'interest' : 'interests'}</p>}
    {!!profile.interests?.length && <div className="mt-3 flex flex-wrap gap-1.5">{profile.interests.slice(0, 5).map(interest => <span key={interest} className={cn('max-w-full truncate rounded-lg px-2 py-1 text-[11px]', common.includes(interest) ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>{interest}</span>)}{profile.interests.length > 5 && <span className="px-2 py-1 text-[11px] text-muted-foreground">+{profile.interests.length - 5}</span>}</div>}
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/40 pt-3">{onPass && <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" disabled={disabled} onClick={onPass}>Pass</Button>}<Button size="sm" className="gap-2 rounded-xl" disabled={disabled} onClick={onConnect}>{pending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}{action}</Button></div>
  </article>;
}

export function FindFriendsDialog({ open, onClose, onOpenConversation, onEditProfile }: FindFriendsDialogProps) {
  const { profile } = useAuth();
  const { profiles, matches, likedByUsers, loading, error, swipe, refetch } = useFindFriends();
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('');
  const [sharedOnly, setSharedOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const [connected, setConnected] = useState<{ name: string; id: string } | null>(null);
  const interests = profile?.interests || [];
  const visible = filterBuddyProfiles(profiles, query, sharedOnly, onlineOnly, interests);
  const requested = likedByUsers.filter(like => like.profile && filterBuddyProfiles([like.profile], query, false, false).length > 0);
  const connections = matches.filter(match => match.matchedUser && filterBuddyProfiles([match.matchedUser], query, false, false).length > 0);
  function message(id: string) { onOpenConversation(id); onClose(); }
  async function decide(id: string, direction: 'left' | 'right') {
    if (lock.current) return;
    lock.current = true; setPending(id);
    try {
      const result = await swipe(direction, id);
      if (result?.matched && result.user && result.conversationId) setConnected({ name: result.user.full_name || result.user.username, id: result.conversationId });
    } finally { lock.current = false; setPending(null); }
  }
  const empty = (title: string, description: string) => <div className="rounded-3xl border border-dashed border-border p-7 text-center"><Users className="mx-auto mb-3 text-primary" size={28} /><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="left-0 top-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:rounded-none">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col safe-top safe-bottom">
        <DialogHeader className="px-5 pb-4 pt-5"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[.18em] text-primary"><Users size={14} />BETTER TOGETHER</div><DialogTitle className="text-2xl font-bold tracking-tight">Study buddies</DialogTitle><DialogDescription className="mt-1 text-xs">Find a shared interest. Start a useful conversation.</DialogDescription></DialogHeader>
        <div className="px-5"><div role="tablist" aria-label="Buddy sections" className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/60 p-1">{buddyTabs.map(value => <button key={value} role="tab" id={`buddy-tab-${value}`} aria-controls="buddy-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={event => {
            const index = buddyTabs.indexOf(value);
            const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
            if (next < 0) return;
            event.preventDefault(); setTab(buddyTabs[next]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }} className={cn('min-h-11 rounded-xl px-1 text-xs font-semibold transition-colors', tab === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')} onClick={() => setTab(value)}>{value === 'discover' ? 'Discover' : value === 'connections' ? `Buddies${matches.length ? ` · ${matches.length}` : ''}` : `Requests${likedByUsers.length ? ` · ${likedByUsers.length}` : ''}`}</button>)}</div>
          <div className="relative mt-4"><Search className="absolute left-3 top-3.5 text-muted-foreground" size={16} /><Input aria-label="Search loaded study buddies" placeholder={tab === 'discover' ? 'Name, interest or bio…' : 'Search people…'} value={query} onChange={event => setQuery(event.target.value)} className="h-11 rounded-2xl border-border/50 bg-card pl-10" /></div>
          {tab === 'discover' && <div className="flex flex-wrap items-center gap-2 py-3"><SlidersHorizontal size={14} className="text-muted-foreground" />{[{ label: 'Shared interests', value: sharedOnly, action: () => setSharedOnly(value => !value) }, { label: 'Active in 24h', value: onlineOnly, action: () => setOnlineOnly(value => !value) }].map(filter => <button key={filter.label} aria-pressed={filter.value} className={cn('min-h-9 rounded-full border px-3 text-xs', filter.value ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground')} onClick={filter.action}>{filter.value && <Check className="mr-1 inline" size={12} />}{filter.label}</button>)}</div>}
        </div>
        <main id="buddy-panel" role="tabpanel" aria-labelledby={`buddy-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
          {connected && <div role="status" className="mb-4 rounded-2xl border border-primary/20 bg-primary/10 p-4"><p className="text-sm font-semibold">You and {connected.name} are connected.</p><div className="mt-3 flex items-center justify-between"><Button size="sm" className="gap-2 rounded-xl" onClick={() => message(connected.id)}><MessageCircle size={15} />Say hello</Button><Button variant="ghost" size="icon" aria-label="Dismiss new connection" onClick={() => setConnected(null)}><X size={16} /></Button></div></div>}
          {tab === 'discover' && onEditProfile && (!profile?.bio || interests.length === 0) && <button className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left" onClick={() => { onClose(); onEditProfile(); }}><div><p className="text-xs font-semibold">Give people something to connect over</p><p className="mt-1 text-xs text-muted-foreground">Add a short bio and interests. Photos are optional.</p></div><ArrowRight size={17} className="shrink-0 text-primary" /></button>}
          {loading ? <div role="status" className="space-y-3"><span className="sr-only">Loading study buddies</span>{[0, 1, 2].map(key => <div key={key} className="h-36 rounded-3xl bg-secondary/60 motion-safe:animate-pulse" />)}</div> : error ? <div role="alert" className="rounded-2xl bg-card p-5 text-sm"><p>{error}</p><Button className="mt-3" variant="secondary" onClick={() => void refetch()}>Retry</Button></div> : <>
            {tab === 'discover' && <><div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground"><span>{visible.length} {visible.length === 1 ? 'person' : 'people'} to discover</span><span>Shared interests first</span></div><div className="space-y-3">{visible.map(person => <BuddyCard key={person.user_id} profile={person} interests={interests} action="Connect" pending={pending === person.user_id} disabled={!!pending} onConnect={() => void decide(person.user_id, 'right')} onPass={() => void decide(person.user_id, 'left')} />)}</div>{!visible.length && empty(query || sharedOnly || onlineOnly ? 'No one matches these filters' : 'You’re caught up', query || sharedOnly || onlineOnly ? 'Try a broader search or turn off a filter. Search covers the profiles currently loaded.' : 'New people will appear here as the community grows. Your connections are in Buddies.')}<p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">Connect sends interest. You become buddies when both people connect.</p></>}
            {tab === 'connections' && <div className="space-y-3">{connections.map(match => <article key={match.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4"><Avatar name={match.matchedUser!.full_name || match.matchedUser!.username} src={match.matchedUser!.avatar_url} size="md" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{match.matchedUser!.full_name || match.matchedUser!.username}</h3><p className="mt-1 truncate text-xs text-muted-foreground">@{match.matchedUser!.username}</p></div><Button size="sm" className="gap-1.5 rounded-xl" disabled={!match.conversation_id} onClick={() => match.conversation_id && message(match.conversation_id)}><MessageCircle size={14} />{match.conversation_id ? 'Chat' : 'Unavailable'}</Button></article>)}{!connections.length && empty('Your study circle starts here', 'When you both connect, you can open your conversation here.')}</div>}
            {tab === 'requests' && <div className="space-y-3">{requested.map(like => <BuddyCard key={like.id} profile={like.profile!} interests={interests} action="Connect back" pending={pending === like.profile!.user_id} disabled={!!pending} onConnect={() => void decide(like.profile!.user_id, 'right')} />)}{!requested.length && empty('No new requests', 'People who want to connect with you will appear here.')}</div>}
          </>}
        </main>
      </div>
    </DialogContent>
  </Dialog>;
}
