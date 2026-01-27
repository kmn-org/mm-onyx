import Link from "next/link";
import { OnyxLogoTypeIcon } from "../icons/icons";

export default function AuthFlowContainer({
  children,
  authState,
  footerContent,
}: {
  children: React.ReactNode;
  authState?: "signup" | "login" | "join";
  footerContent?: React.ReactNode;
}) {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[var(--brand-blue-92)] to-[var(--brand-teal-50)] dark:bg-none dark:bg-background">
      <div className="w-full max-w-md flex items-start flex-col bg-white dark:bg-background-tint-00 rounded-16 p-6">
        <OnyxLogoTypeIcon className="h-12 w-auto" />
        <div className="w-full mt-3">{children}</div>
      </div>
      {authState === "login" && (
        <div className="text-sm mt-6 text-center w-full text-white/80 dark:text-text-03 mainUiBody mx-auto">
          {footerContent ?? (
            <>
              New to MaticMind?{" "}
              <Link
                href="/auth/signup"
                className="text-white dark:text-text-05 mainUiAction underline transition-colors duration-200"
              >
                Create an Account
              </Link>
            </>
          )}
        </div>
      )}
      {authState === "signup" && (
        <div className="text-sm mt-6 text-center w-full text-white/80 dark:text-text-03 mainUiBody mx-auto">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-white dark:text-text-05 mainUiAction underline transition-colors duration-200"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
