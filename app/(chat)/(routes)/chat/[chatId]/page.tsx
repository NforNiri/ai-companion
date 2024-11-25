import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { ChatClient } from "./components/ChatClient";


interface ChatIdPageProps {
  params: Promise<{ chatId?: string }>; // Made `chatId` optional to handle undefined cases gracefully
}

const ChatIdPage = async (props: ChatIdPageProps) => {
  const params = await props.params;
  const { userId } = await auth();

  if (!userId) {
    // Redirect to sign-in page if the user is not authenticated
    redirect("/sign-in"); // Replace "/sign-in" with your sign-in route
    return null;
  }

  const chatId = await params?.chatId; // Safely access `chatId`

  if (!chatId) {
    return <div>Error: Chat ID is missing</div>;
  }

  const companion = await prismadb.companion.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        where: {
          userId,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  if (!companion) {
    redirect("/");
    return null; // Prevent further rendering after redirection
  }

  return <ChatClient companion={companion} />;
};

export default ChatIdPage;
