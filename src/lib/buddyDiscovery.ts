import type { Profile } from '@/types/chat';
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function buddyRecentlyActive(profile: Pick<Profile, 'last_seen'>, now = Date.now()) {
  const seen = Date.parse(profile.last_seen || '');
  return Number.isFinite(seen) && seen >= now - 24 * 60 * 60 * 1000 && seen <= now + 60000;
}
export function sharedBuddyInterests(profile: Pick<Profile, 'interests'>, mine: string[] = []) {
  const interests = new Set(mine.map(normalize));
  return [...new Set(profile.interests || [])].filter(interest => interests.has(normalize(interest)));
}
export function filterBuddyProfiles(profiles: Profile[], query: string, sharedOnly: boolean, onlineOnly: boolean, mine: string[] = []) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return profiles.filter(profile => {
    const text = normalize([profile.full_name, profile.username, profile.bio, profile.study_details?.course, profile.study_details?.qualification, profile.study_details?.institution, profile.study_details?.cohort, ...(profile.interests || [])].filter(Boolean).join(' '));
    return terms.every(term => text.includes(term)) && (!onlineOnly || buddyRecentlyActive(profile)) && (!sharedOnly || sharedBuddyInterests(profile, mine).length > 0);
  }).sort((a, b) => sharedBuddyInterests(b, mine).length - sharedBuddyInterests(a, mine).length);
}
