import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure functions only — no DOM, no Supabase, no Next runtime.
 *
 * Everything under test here is a plain function of its arguments, which is why the
 * environment is `node` and there is no setup file: nothing needs mocking.
 */

// ⚠️ Set at module scope, not only via `test.env`. The main process forks the workers, so
// assigning here is what actually reaches `Date` and `Intl` before they are first used.
// features/booking/lib/dates.ts formats days with LOCAL getters (getMonth/getDate), so an
// unpinned zone makes toISO/monthGrid/parseUsDate disagree between a laptop and CI.
// Asia/Jakarta (WIB, UTC+7) is deliberately NOT the villas' zone — propertyTodayISO() must
// come out as Asia/Makassar regardless of where the process runs, and a differing local
// zone is what proves it.
process.env.TZ = "Asia/Jakarta";

export default defineConfig({
    // Resolves the `@/*` alias from tsconfig.json so tests import the same specifiers the
    // app does. Native since Vite 8 — no vite-tsconfig-paths plugin needed.
    resolve: { tsconfigPaths: true },
    test: {
        environment: "node",
        include: ["**/*.test.ts"],
        exclude: ["node_modules/**", ".next/**", "out/**", "dist/**", "build/**"],
        env: {
            TZ: "Asia/Jakarta",
            // lib/supabase.ts throws at module load when these are missing, so importing
            // publicStorageUrl() needs them present. Dummy values — nothing here makes a
            // network call.
            NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        },
        coverage: {
            provider: "v8",
            include: [
                "features/booking/lib/**/*.ts",
                "features/auth/next-path.ts",
                "lib/nav.ts",
                "lib/format.ts",
            ],
            exclude: ["**/*.test.ts", "features/booking/lib/payment-gateway.ts", "features/booking/lib/qr.ts"],
        },
    },
});
