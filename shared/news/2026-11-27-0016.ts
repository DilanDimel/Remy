import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "System shows whether nightly backups are running",
  body: "Admin → System (website and phone app) now shows when the last database backup was made and warns if backups aren't set up or are over 36 hours old. The server, deploy and transfer labels now name DigitalOcean instead of Render and Supabase.",
  to: "/admin?tab=system",
  owners: true,
} satisfies NewsNote;
