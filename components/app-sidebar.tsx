"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SidebarUser = { id?: string; email?: string | null };
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { PlusIcon, SidebarLeftIcon, TrashIcon } from "@/components/icons";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function AppSidebar({ user, className }: { user: SidebarUser | undefined; className?: string }) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting all chats...",
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        setShowDeleteAllDialog(false);
        router.replace("/");
        router.refresh();
        return "All chats deleted successfully";
      },
      error: "Failed to delete all chats",
    });
  };

  return (
    <>
      <Sidebar className={`group-data-[side=left]:border-r ${className || ""}`}>
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 p-1 md:h-fit md:p-2"
                      onClick={toggleSidebar}
                      type="button"
                      variant="ghost"
                    >
                      <SidebarLeftIcon size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="start" className="hidden md:block">
                    Toggle Sidebar
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      className="flex flex-row items-center gap-3"
                      href="/"
                      onClick={() => {
                        setOpenMobile(false);
                      }}
                    >
                      <span className="cursor-pointer rounded-md px-2 font-semibold text-lg tracking-wide hover:bg-muted">
                        <span style={{ color: "#f87171" }}>T</span>
                        <span style={{ color: "#fb923c" }}>R</span>
                        <span style={{ color: "#facc15" }}>A</span>
                        <span style={{ color: "#4ade80" }}>C</span>
                        <span style={{ color: "#60a5fa" }}>E</span>
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="text-sm">
                    <span><span style={{ color: "#f87171", fontWeight: 600 }}>T</span>RACE is an </span>
                    <span><span style={{ color: "#fb923c", fontWeight: 600 }}>R</span>easoning and </span>
                    <span><span style={{ color: "#facc15", fontWeight: 600 }}>A</span>nswer-path </span>
                    <span><span style={{ color: "#4ade80", fontWeight: 600 }}>C</span>omprehension </span>
                    <span><span style={{ color: "#60a5fa", fontWeight: 600 }}>E</span>ngine</span>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-row gap-1">
                {user && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-8 p-1 md:h-fit md:p-2"
                        onClick={() => setShowDeleteAllDialog(true)}
                        type="button"
                        variant="ghost"
                      >
                        <TrashIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end" className="hidden md:block">
                      Delete All Chats
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 px-2 md:h-fit md:px-2 gap-1"
                      onClick={() => {
                        setOpenMobile(false);
                        router.push("/");
                        router.refresh();
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <PlusIcon />
                      <span className="text-xs">New Chat</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="hidden md:block">
                    New Chat
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
