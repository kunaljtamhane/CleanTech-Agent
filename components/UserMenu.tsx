import { signOut } from "@/auth";
import type { Session } from "next-auth";

export default function UserMenu({ user }: { user: Session["user"] }) {
  return (
    <div className="flex items-center gap-3">
      {user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="h-7 w-7 rounded-full bg-petrol-light" />
      )}
      <span className="hidden text-sm text-paper/90 sm:inline">{user?.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="text-xs text-paper/70 underline hover:text-paper">
          Sign out
        </button>
      </form>
    </div>
  );
}
