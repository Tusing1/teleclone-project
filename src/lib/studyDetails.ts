export const QUALIFICATIONS = ['Certificate', 'Diploma', 'Bachelors', 'Postgraduate diploma', 'Masters', 'Doctorate', 'Secondary school', 'Other'] as const;
export interface StudyDetails {
  [key: string]: string | number | undefined;
  course: string; qualification: string; calendar_year: number; year_of_study: number; semester: number;
  institution?: string; cohort?: string; next_review?: string; language?: string;
}
export const emptyStudyDetails = (): StudyDetails => ({ course: '', qualification: '', calendar_year: new Date().getFullYear(), year_of_study: 1, semester: 1 });
export function studyDetailsError(details: StudyDetails) {
  if (typeof details.course !== 'string' || !details.course.trim() || details.course.length > 120) return 'Enter your course or class (up to 120 characters).';
  if (!QUALIFICATIONS.includes(details.qualification as typeof QUALIFICATIONS[number])) return 'Choose your qualification level.';
  if (!Number.isInteger(details.calendar_year) || details.calendar_year < 2000 || details.calendar_year > 2100) return 'Enter a valid academic calendar year.';
  if (!Number.isInteger(details.year_of_study) || details.year_of_study < 1 || details.year_of_study > 10) return 'Year of study must be between 1 and 10.';
  if (![1, 2, 3, 4].includes(details.semester)) return 'Choose a valid semester or term.';
  for (const key of ['institution', 'cohort', 'language'] as const) {
    if (details[key] && (typeof details[key] !== 'string' || details[key].length > 120)) return 'Keep optional study details under 120 characters.';
  }
  if (details.next_review && (!/^\d{4}-\d{2}-\d{2}$/.test(details.next_review) || !Number.isFinite(Date.parse(details.next_review)) || new Date(details.next_review).toISOString().slice(0, 10) !== details.next_review)) return 'Choose a valid semester review date.';
  return null;
}
export function studySummary(details?: StudyDetails | null) {
  return details ? `${details.qualification} · ${details.course} · Year ${details.year_of_study}, Semester ${details.semester} · ${details.calendar_year}` : '';
}
