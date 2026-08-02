import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CompleteProfilePrompt({ next, action }: { next: string; action: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Complete your JU profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Before you can {action}, we need your full JU student details — student ID, registration
            number, hall, department, session, and phone — so buyers know who they&apos;re dealing with.
          </p>
        </CardHeader>
        <CardContent>
          <Link href={`/complete-profile?next=${encodeURIComponent(next)}`} className={cn(buttonVariants())}>
            Complete your profile
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
