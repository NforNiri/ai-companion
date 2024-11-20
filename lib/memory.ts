import { Redis } from "@upstash/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

export interface CompanionKey {
  companionName: string;
  modelName: string;
  userId: string;
}

export class MemoryManager {
  private static instance: MemoryManager | null = null;
  private history: Redis;
  private vectorDBClient: Pinecone;

  private constructor() {
    this.history = Redis.fromEnv();
    this.vectorDBClient = new Pinecone();
  }

  public async init(): Promise<void> {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
      throw new Error("Missing Pinecone configuration");
    }

    await this.vectorDBClient.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
  }

  public async vectorSearch(
    recentChatHistory: string, 
    companionFileName: string
  ) {
    if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_INDEX) {
      console.error("Missing API configuration for vector search");
      return [];
    }

    try {
      const pineconeIndex = this.vectorDBClient.Index(process.env.PINECONE_INDEX);

      const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
        { pineconeIndex }
      );

      return await vectorStore.similaritySearch(
        recentChatHistory, 
        3, 
        { fileName: companionFileName }
      );
    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
      await MemoryManager.instance.init();
    }
    return MemoryManager.instance;
  }

  private generateRedisCompanionKey(key: CompanionKey): string {
    return `${key.companionName}-${key.modelName}-${key.userId}`;
  }

  public async writeToHistory(text: string, companionKey: CompanionKey): Promise<string | null> {
    if (!companionKey?.userId) {
      console.warn("Invalid companion key");
      return null;
    }

    const key = this.generateRedisCompanionKey(companionKey);
    
    try {
      return await this.history.zadd(key, {
        score: Date.now(),
        member: text,
      });
    } catch (error) {
      console.error("Failed to write to history:", error);
      return null;
    }
  }

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey?.userId) {
      console.warn("Invalid companion key");
      return "";
    }

    const key = this.generateRedisCompanionKey(companionKey);
    
    try {
      let result = await this.history.zrange(key, 0, Date.now(), {
        byScore: true,
      });

      result = result.slice(-30).reverse();
      return result.reverse().join("\n");
    } catch (error) {
      console.error("Failed to read history:", error);
      return "";
    }
  }

  public async seedChatHistory(
    seedContent: string,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ): Promise<void> {
    const key = this.generateRedisCompanionKey(companionKey);
    
    try {
      if (await this.history.exists(key)) {
        console.log("User already has chat history");
        return;
      }

      const content = seedContent.split(delimiter);
      for (const [index, line] of content.entries()) {
        await this.history.zadd(key, { score: index, member: line });
      }
    } catch (error) {
      console.error("Failed to seed chat history:", error);
    }
  }
}