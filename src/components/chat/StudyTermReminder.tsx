import { useAuth } from '@/hooks/useAuth';
import type { StudyDetails } from '@/lib/studyDetails';
import { Button } from '@/components/ui/button';
export function StudyTermReminder({ onReview }: { onReview: () => void }) {
  const { user, profile } = useAuth();
  const details: StudyDetails | undefined = profile?.study_details || user?.user_metadata?.study_details;
  const due = details?.next_review && Date.parse(details.next_review) <= Date.now();
  if (!due) return null;
  return <div role="status" className="mx-4 mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs">New semester? Review your year and semester so buddies see the right study details.</p><Button variant="link" size="sm" onClick={onReview}>Review studies</Button></div>;
}
