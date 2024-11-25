import dotenv from "dotenv";
import { streamText, LangChainAdapter } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { Replicate } from "@langchain/community/llms/replicate";
import { NextResponse } from "next/server";
import { Readable } from "stream";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

dotenv.config({path: '.env'});

export async function POST(request: Request, props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  console.log("[CHAT_POST] - Request started");
  try {
    // Parse the request body
    console.log("[CHAT_POST] - Parsing request JSON");
    const { prompt } = await request.json();
    console.log("[CHAT_POST] - Received prompt:", prompt);

    // Validate user
    console.log("[CHAT_POST] - Validating user");
    const user = await currentUser();
    if (!user || !user.firstName || !user.id) {
      console.error("[CHAT_POST] - Unauthorized user");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Rate limit check
    console.log("[CHAT_POST] - Checking rate limit for user:", user.id);
    const identifier = request.url + "-" + user.id;
    const { success } = await rateLimit(identifier);
    if (!success) {
      console.warn("[CHAT_POST] - Rate limit exceeded for user:", user.id);
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    // Update companion with the new message
    console.log("[CHAT_POST] - Updating companion messages in database");
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
      console.error("[CHAT_POST] - Companion not found:", params.chatId);
      return new NextResponse("Companion not found", { status: 404 });
    }
    console.log("[CHAT_POST] - Companion updated:", companion.id);

    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      modelName: "llama2-13b",
    };

    // Initialize memory manager
    console.log("[CHAT_POST] - Initializing memory manager");
    const memoryManager = await MemoryManager.getInstance();

    // Read the latest history
    console.log("[CHAT_POST] - Reading latest history for companionKey");
    const records = await memoryManager.readLatestHistory(companionKey);
    if (records.length === 0) {
      console.log("[CHAT_POST] - Seeding initial chat history");
      await memoryManager.seedChatHistory(companion.seed, "\n\n", companionKey);
    }

    // Write the prompt to memory
    console.log("[CHAT_POST] - Writing prompt to memory");
    await memoryManager.writeToHistory(`User: ${prompt}\n`, companionKey);

    // Perform vector search for relevant history
    console.log("[CHAT_POST] - Performing vector search for relevant history");
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      `${companion.id}.txt`
    );

    const relevantHistory = similarDocs
      ? similarDocs.map((doc) => doc.pageContent).join("\n")
      : "";
    console.log("[CHAT_POST] - Relevant history:", relevantHistory);

    // Configure the model
    console.log("[CHAT_POST] - Configuring the model");
    const model = new Replicate({
      model:
        "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
      input: { max_length: 512 },
      apiKey: process.env.REPLICATE_API_TOKEN,
    });
    model.verbose = true;

    // Generate a response from the model
    console.log("[CHAT_POST] - Invoking the model");
    let responseText: string;
    try {
      const rawResponse = await model.invoke(
        `ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}
        : prefix.Limit your answer to a short paragraph not more than 50 words.

        ${companion.instructions}

        Below are the relevant details about ${companion.name}'s past and the conversation you are in.
        ${relevantHistory}

        ${recentChatHistory}\n${companion.name}:`
      );
      responseText = rawResponse?.toString().trim() || "";
      
      console.log("[CHAT_POST] - Model response:", responseText);
    } catch (error) {
      console.error("[CHAT_POST] - Model invocation failed:", error);
      return new NextResponse("Model invocation error", { status: 500 });
    }

    if (!responseText) {
      console.error("[CHAT_POST] - Empty response from model");
      return new NextResponse("Failed to generate response", { status: 500 });
    }

    // Write response to memory
    console.log("[CHAT_POST] - Writing response to memory");
    await memoryManager.writeToHistory(responseText, companionKey);

    // Save response in the database
    console.log("[CHAT_POST] - Saving response to database");
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

    // Stream the response back to the user
    console.log("[CHAT_POST] - Streaming response back to user");
    
    const stream= await model.stream(responseText);
    return LangChainAdapter.toDataStreamResponse(stream);;
  } catch (error) {
    console.error("[CHAT_POST_ERROR] - Error occurred:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
