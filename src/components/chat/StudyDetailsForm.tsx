import { Input } from '@/components/ui/input';
import { QUALIFICATIONS, type StudyDetails } from '@/lib/studyDetails';

export function StudyDetailsForm({ value, onChange }: { value: StudyDetails; onChange: (value: StudyDetails) => void }) {
  const change = <K extends keyof StudyDetails>(key: K, next: StudyDetails[K]) => onChange({ ...value, [key]: next });
  return <fieldset className="space-y-3 rounded-2xl border border-border p-4">
    <legend className="px-2 text-sm font-semibold">Your studies</legend>
    <p className="text-xs text-muted-foreground">Course, level and current semester help students find relevant buddies. These details can appear on your profile.</p>
    <label className="block space-y-1 text-xs">Course / class<Input value={value.course} maxLength={120} placeholder="e.g. Nursing" onChange={e => change('course', e.target.value)} /></label>
    <label className="block space-y-1 text-xs">Qualification level<select value={value.qualification} onChange={e => change('qualification', e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Choose level</option>{QUALIFICATIONS.map(level => <option key={level}>{level}</option>)}</select></label>
    <div className="grid grid-cols-3 gap-2">
      <label className="space-y-1 text-xs">Calendar year<Input type="number" min={2000} max={2100} value={value.calendar_year} onChange={e => change('calendar_year', Number(e.target.value))} /></label>
      <label className="space-y-1 text-xs">Year of study<Input type="number" min={1} max={10} value={value.year_of_study} onChange={e => change('year_of_study', Number(e.target.value))} /></label>
      <label className="space-y-1 text-xs">Semester<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value.semester} onChange={e => change('semester', Number(e.target.value))}>{[1, 2, 3, 4].map(term => <option key={term} value={term}>{term}</option>)}</select></label>
    </div>
    <label className="block space-y-1 text-xs">Institution (optional)<Input value={value.institution || ''} maxLength={120} onChange={e => change('institution', e.target.value)} /></label>
    <label className="block space-y-1 text-xs">Class / cohort (optional)<Input placeholder="e.g. Nursing intake 2026" value={value.cohort || ''} maxLength={120} onChange={e => change('cohort', e.target.value)} /></label>
    <label className="block space-y-1 text-xs">Study language (optional)<Input value={value.language || ''} maxLength={60} onChange={e => change('language', e.target.value)} /></label>
    <label className="block space-y-1 text-xs">Next semester review (optional)<Input type="date" value={value.next_review || ''} onChange={e => change('next_review', e.target.value)} /></label>
    <p className="text-[11px] text-muted-foreground">We’ll prompt you to review at this date. We never silently advance your year or semester—school calendars and course lengths differ.</p>
  </fieldset>;
}
