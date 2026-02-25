import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPageContent from "./landing-content";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user has completed onboarding
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgMember) {
      const { data: brandConfig } = await supabase
        .from("brand_configs")
        .select("id")
        .eq("organization_id", orgMember.organization_id)
        .single();

      if (brandConfig) {
        redirect("/mission-control");
      } else {
        redirect("/onboard");
      }
    }
  }

  // Show landing page for unauthenticated users
  return <LandingPageContent />;
}
