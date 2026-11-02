import { readMode } from "@/lib/server/mode";

// Runs once when the server starts. An unset or invalid NEXUS_MODE stops the
// process here, with a message that names the variable and the accepted values
// (Requirement 1.8), instead of leaving a server that answers every request
// with an error. During `next build` the error is thrown so the build fails
// with the same message.
export function register() {
  try {
    readMode(process.env);
  } catch (error) {
    if (
      process.env.NEXT_RUNTIME === "nodejs" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    throw error;
  }
}
