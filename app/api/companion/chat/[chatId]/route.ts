import { streamText, LangChainAdapter } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { Replicate } from "@langchain/community/llms/replicate";
import { NextResponse } from "next/server";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";
import { Readable } from "stream";

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json();
    const user = await currentUser();

    // Validate user
    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Rate limit check
    const identifier = request.url + "-" + user.id;
    const { success } = await rateLimit(identifier);

    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    // Update companion messages in database
    const companion = await prismadb.companion.update({
      where: { id: params.chatId },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
          },
        },
      },
    });

    if (!companion) {
      console.log("Companion not found");
      return new NextResponse("Companion not found", { status: 404 });
    }

    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      modelName: "llama2-13b",
    };

    const memoryManager = await MemoryManager.getInstance();
    const records = await memoryManager.readLatestHistory(companionKey);

    if (records.length === 0) {
      await memoryManager.seedChatHistory(companion.seed, "\n\n", companionKey);
    }

    // Write prompt to memory
    await memoryManager.writeToHistory(`User: ${prompt}\n`, companionKey);

    // Perform vector search for relevant history
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      `${companion.id}.txt`
    );

    const relevantHistory = similarDocs
      ? similarDocs.map((doc) => doc.pageContent).join("\n")
      : "";

    // Setup LangChain adapter
    const { handlers } = LangChainAdapter.toDataStreamResponse();

    const model = new Replicate({
      model:
        "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
      input: { max_length: 2048 },
      apiKey: process.env.REPLICATE_API_TOKEN,
      callbackManager: CallbackManager.fromHandlers(handlers),
    });

    model.verbose = true;

    // Invoke the model
    let responseText: string;
    try {
      const rawResponse = await model.invoke(
        `ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.id}
        : prefix.

        ${companion.instructions}

        Below are the relevant details about ${companion.id}'s past and the conversation you are in.
        ${relevantHistory}

        ${recentChatHistory}\n${companion.id}:`
      );
      responseText = rawResponse?.toString().trim() || "";
    } catch (error) {
      console.error("Model invocation failed:", error);
      return new NextResponse("Model invocation error", { status: 500 });
    }

    if (!responseText) {
      return new NextResponse("Failed to generate response", { status: 500 });
    }

    // Write response to memory
    await memoryManager.writeToHistory(responseText, companionKey);

    // Save response in database
    await prismadb.companion.update({
      where: { id: params.chatId },
      data: {
        messages: {
          create: {
            content: responseText,
            role: "system",
            userId: user.id,
          },
        },
      },
    });

    // Stream the response
    const readableStream = Readable.from([responseText]);
    return streamText(readableStream);
  } catch (error) {
    console.error("[CHAT_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
