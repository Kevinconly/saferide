import { redirect } from "next/navigation";

export default function Page() {
  // Redirect /app to root (app shell is implemented under root route groups)
  redirect("/");
}
