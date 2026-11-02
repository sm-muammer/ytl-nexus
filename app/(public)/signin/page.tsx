import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// The sign-in form arrives with Task 6. It is a form page, so no particle field.
export const metadata = pageMetadata("/signin");

export default function SignInPage() {
  return <ModulePage path="/signin" register="public" />;
}
