import { Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ModeToggle } from "./Mode-Toggle";
import MobileSidebar from "./MobileSidebar";

const font = Poppins({
  weight: "600",
  subsets: ["latin"],
});

const Navbar = () => {
  return (
    <div className="fixed w-full z-50 flex justify-between items-center py-2 px-4 border-b-primary/10 bg-secondary h-16">
      {/* Left side */}
      <div className="flex items-center gap-x-2">
        <MobileSidebar className="block md:hidden" />
        <Link href="/">
          <h1
            className={cn(
              "hidden md:block md:text-3xl font-bold text-primary",
              font.className
            )}
          >
            FunChat.ai
          </h1>
        </Link>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-x-3">
        <Button variant="premium" size="sm">
          Upgrade
          <Sparkles className="h-4 w-4 fill-white text-white ml-2"/>
        </Button>
        <ModeToggle />
        
        <UserButton />
      </div>
    </div>
  );
};

export default Navbar;
