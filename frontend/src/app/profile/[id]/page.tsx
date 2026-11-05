"use client";

import { useParams } from "next/navigation";
import ProfileContainer from "@/components/profiles/ProfileContainer";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <ProfileContainer profileId={id} />;
}
