import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { KGQAProvider } from "@/components/kgqa-provider";
import { ScatterplotProvider } from "@/components/scatterplot-provider";
import { TutorialProvider } from "@/hooks/use-tutorial";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <KGQAProvider>
          <ScatterplotProvider>
            <TutorialProvider>
              <Suspense fallback={<div className="flex h-dvh" />}>
                <SidebarWrapper>{children}</SidebarWrapper>
              </Suspense>
            </TutorialProvider>
          </ScatterplotProvider>
        </KGQAProvider>
      </DataStreamProvider>
    </>
  );
}

async function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} className="z-30" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
