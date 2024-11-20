const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  try {
    await db.category.createMany({
      data: [
        { name: "Sports" },
        { name: "Movies & Tv" },
        { name: "Musicians" },
        { name: "Animals" },
        { name: "Philosophy" },
        { name: "Scientists" },
        { name: "Games" },
      ],
    });
  } catch (error) {
    console.log("Error seeding defaul categories");
  } finally {
    await db.$disconnect();
  }
}
main();
