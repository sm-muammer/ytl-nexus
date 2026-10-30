// Platform baseline page (Task 1). Task 3 replaces it with the editorial
// Nexus home inside the public route group.

const plannedModules = [
  { name: "Nexus Command", role: "Infrastructure dashboard" },
  { name: "Nexus Atlas", role: "Service dependency map" },
  { name: "Nexus Status", role: "Health history and incidents" },
  { name: "Nexus AI", role: "Local knowledge assistant" },
  { name: "Nexus Transfer", role: "Secure SFTP and file portal" },
  { name: "Nexus Mail", role: "Secure webmail" },
  { name: "Nexus Data", role: "MariaDB demonstration" },
  { name: "Nexus Library", role: "Runbooks and FAQs" },
  { name: "Nexus Continuity", role: "Verified backups" },
  { name: "Nexus Shield", role: "Security posture" },
  { name: "Nexus Tour", role: "Guided presentation" },
  { name: "Yes Experience", role: "Yes website redesign" },
] as const;

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="relative isolate flex flex-1 flex-col justify-center overflow-hidden px-6 py-20 sm:px-12 lg:px-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_85%_10%,color-mix(in_oklab,var(--color-ytl-blue)_22%,transparent),transparent_70%)]"
      />

      <p className="text-ytl-blue font-mono text-xs tracking-[0.3em] uppercase">
        Platform baseline
      </p>

      <h1 className="mt-6 text-6xl font-semibold tracking-tight text-balance sm:text-8xl">
        YTL Nexus
      </h1>

      <p className="text-muted mt-6 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
        One platform for infrastructure, intelligence and digital services. An
        internship project built with the YTL Communications IT Infrastructure
        team.
      </p>

      <h2 id="planned-modules" className="sr-only">
        Planned modules
      </h2>
      <ul
        aria-labelledby="planned-modules"
        className="border-line bg-line mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3"
      >
        {plannedModules.map((module) => (
          <li key={module.name} className="bg-canvas px-5 py-4">
            <span className="block text-sm font-medium">{module.name}</span>
            <span className="text-muted mt-1 block text-sm">{module.role}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
