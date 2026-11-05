"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AccountSetupCard from "./AccountSetupCard";
import { completeAcademicSetup, getCurrentProfile, getProfileOptions, type ProfileOptions, type StudentLevel } from "@/lib/profiles";
import { useSpaces } from "@/components/spaces/SpacesProvider";

export default function CollegeMajorSetup() {
  const router = useRouter();
  const { reload: reloadSpaces } = useSpaces();
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [collegeId, setCollegeId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [studentLevel, setStudentLevel] = useState<StudentLevel | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const savingRequest = useRef<AbortController | null>(null);
  // The existing catalog assigns each major to one college.
  const colleges = options?.colleges.filter((college) => options.majors.some((major) => major.college_id === college.id)) ?? [];
  const majors = options?.majors.filter((major) => major.college_id === collegeId) ?? [];
  const valid = !!collegeId && majors.some((major) => major.id === majorId)
    && studentLevel !== "" && !!options?.student_levels.includes(studentLevel);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setOptions(null);
      let redirecting = false;
      try {
        const profile = await getCurrentProfile(controller.signal);
        if (controller.signal.aborted) return;
        if (!profile || !profile.username_chosen || profile.academic_setup_completed) {
          redirecting = true;
          router.replace(!profile ? "/login" : !profile.username_chosen ? "/choose-username" : "/profile");
          return;
        }
        const choices = await getProfileOptions(controller.signal);
        if (controller.signal.aborted) return;
        if (!choices.majors.length) throw new Error("College and major options are currently unavailable.");
        setOptions(choices);
        setCollegeId(profile.home_college_id ?? "");
        setMajorId(profile.major_id ?? "");
        setStudentLevel(profile.student_level ?? "");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load your college and major options.");
      } finally { if (!controller.signal.aborted && !redirecting) setLoading(false); }
    }
    void load();
    return () => { controller.abort(); savingRequest.current?.abort(); savingRequest.current = null; };
  }, [router, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !studentLevel || savingRequest.current) return;
    const request = new AbortController();
    savingRequest.current = request;
    setSaving(true); setError("");
    try {
      await completeAcademicSetup(collegeId, majorId, studentLevel, request.signal);
      if (!request.signal.aborted) { reloadSpaces(); router.replace("/profile"); }
    } catch (cause) {
      if (!request.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Unable to save your academic details.");
        setSaving(false);
      }
    } finally { if (savingRequest.current === request) savingRequest.current = null; }
  }

  return <AccountSetupCard title="Choose your college and major"
    description="Choose the college that offers your major and add your student level. You can change these later in your profile." error={error}>
    {loading ? <p role="status" className="mt-7 text-sm text-muted-foreground">Loading your options…</p>
      : !options ? <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-5 text-sm font-semibold text-primary underline">Try again</button>
        : <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5">
          <fieldset disabled={saving} className="space-y-5">
            <div>
              <label htmlFor="college-choice" className="text-sm font-semibold text-foreground">College</label>
              <select id="college-choice" required value={collegeId} onChange={(event) => { setCollegeId(event.target.value); setMajorId(""); }}
                className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="">Choose your college</option>
                {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="major-choice" className="text-sm font-semibold text-foreground">Major</label>
              <select id="major-choice" required value={majorId} disabled={!collegeId || saving} onChange={(event) => setMajorId(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50">
                <option value="">{collegeId ? "Choose your major" : "Select your college first"}</option>
                {majors.map((major) => <option key={major.id} value={major.id}>{major.name} — {major.degree}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="level-choice" className="text-sm font-semibold text-foreground">Student level</label>
              <select id="level-choice" required value={studentLevel} onChange={(event) => setStudentLevel(event.target.value as StudentLevel | "")}
                className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="">Choose your student level</option>
                {options.student_levels.map((level) => <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
              </select>
            </div>
          </fieldset>
          <p className="text-xs leading-5 text-muted-foreground">You’ll automatically follow your college’s community when you continue.</p>
          <button type="submit" disabled={saving || !valid} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-[#681c20] disabled:opacity-60">
            {saving ? "Saving…" : "Continue to profile"}
          </button>
        </form>}
  </AccountSetupCard>;
}
