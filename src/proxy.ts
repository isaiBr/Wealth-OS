import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Pub/Sub (Google) y el cron de Vercel no cargan con una sesión de
// Clerk — se autentican con su propio secreto dentro de cada ruta
// (GMAIL_WEBHOOK_SECRET / CRON_SECRET), no con auth.protect().
// /legal/* debe ser pública: Google (OAuth consent screen) y cualquier
// visitante deben poder ver la política de privacidad y los términos sin login.
const esRutaPublica = createRouteMatcher(["/api/webhooks/(.*)", "/api/cron/(.*)", "/legal/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (esRutaPublica(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
    "/(api|trpc)(.*)",
  ],
};
