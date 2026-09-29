"use client";

import { useEffect, useState } from "react";
import {getProfileOptions, updateCurrentProfile, type CurrentProfile, type ProfileOptions, type StudentLevel,} from "@/lib/api";
import { getImagePolicy } from "@/lib/images/image-api";
import type { ImagePolicy } from "@/lib/images/image-policy";
import ImageUploader from "./ImageUploader";

interface EditProfileModalProps {
  profile: CurrentProfile;
  onClose: () => void;
  onSaved: (profile: CurrentProfile) => void;
}

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [policy, setPolicy] = useState<ImagePolicy | null>(null);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [majorId, setMajorId] = useState(profile.major_id ?? "");
  const [collegeId, setCollegeId] = useState(profile.home_college_id ?? "");
  const [level, setLevel] = useState<StudentLevel | "">(profile.student_level ?? "");
  const [avatarId, setAvatarId] = useState(profile.profile_image_upload_id);
  const [bannerId, setBannerId] = useState(profile.banner_image_upload_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableMajors = options?.majors.filter(
    (major) => major.college_id === collegeId
  ) ?? [];

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getProfileOptions(controller.signal),
      getImagePolicy(controller.signal),
    ]).then(([profileOptions, imagePolicy]) => {
      setOptions(profileOptions);
      setPolicy(imagePolicy);
    }).catch((cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to load profile options.");
    });
    return () => controller.abort();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateCurrentProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        major_id: majorId || null,
        home_college_id: collegeId || null,
        student_level: level || null,
        profile_image_upload_id: avatarId,
        banner_image_upload_id: bannerId,
      });
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-10" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className="w-full max-w-3xl rounded-card border border-border bg-card p-5 shadow-xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 id="edit-profile-title" className="font-serif text-2xl font-bold text-primary">Edit profile</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-xl text-muted-foreground hover:bg-secondary" aria-label="Close profile editor">×</button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-card bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-semibold text-foreground">Display name</span>
            <input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-card border border-border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-accent" />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
              <span>Biography</span>
              <span className="font-normal text-muted-foreground">{bio.length}/500</span>
            </span>
            <textarea
              value={bio}
              maxLength={500}
              rows={4}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell other Bobcats a little about yourself."
              className="w-full resize-y rounded-card border border-border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-accent"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">College</span>
            <select value={collegeId} onChange={(event) => {
              const nextCollegeId = event.target.value;
              setCollegeId(nextCollegeId);
              if (!options?.majors.some(
                (major) => major.id === majorId && major.college_id === nextCollegeId
              )) setMajorId("");
            }} disabled={!options} className="w-full rounded-card border border-border bg-background px-3 py-2 disabled:opacity-50">
              <option value="">Not selected</option>
              {options?.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">Student level</span>
            <select value={level} onChange={(event) => setLevel(event.target.value as StudentLevel | "")} disabled={!options} className="w-full rounded-card border border-border bg-background px-3 py-2 capitalize disabled:opacity-50">
              <option value="">Not selected</option>
              {options?.student_levels.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-semibold text-foreground">Major</span>
            <select value={majorId} onChange={(event) => setMajorId(event.target.value)} disabled={!options || !collegeId} className="w-full rounded-card border border-border bg-background px-3 py-2 disabled:opacity-50">
              <option value="">{collegeId ? "Not selected" : "Select a college first"}</option>
              {availableMajors.map((major) => <option key={major.id} value={major.id}>{major.name} — {major.degree}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-primary">Profile photo</h3>
              {avatarId && <button type="button" onClick={() => setAvatarId(null)} className="text-sm font-semibold text-primary underline">Remove</button>}
            </div>
            {policy ? <ImageUploader policy={policy} canUpload={profile.email_verified} cropShape="circle" onUploaded={(image) => setAvatarId(image.id)} /> : <p className="text-sm text-muted-foreground">Loading image uploader…</p>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-primary">Profile banner</h3>
              {bannerId && <button type="button" onClick={() => setBannerId(null)} className="text-sm font-semibold text-primary underline">Remove</button>}
            </div>
            {policy ? <ImageUploader policy={policy} canUpload={profile.email_verified} onUploaded={(image) => setBannerId(image.id)} /> : <p className="text-sm text-muted-foreground">Loading image uploader…</p>}
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={onClose} className="rounded-full border border-primary px-5 py-2 text-sm font-bold text-primary">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !options} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving…" : "Save profile"}</button>
        </div>
      </div>
    </div>
  );
}
