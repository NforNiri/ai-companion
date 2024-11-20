import CompanionForm from "@/app/(root)/(routes)/companion/[companionId]/componenets/CompanionForm";
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import React from "react";

interface CompanionIdPageProps {
  params: {
    companionId: string;
  };
}

const CompanionIdPage = async ({ params }: CompanionIdPageProps) => {
  const { companionId } = await params;
  const {userId} = await auth();

  if (!userId) {
    return redirect("/");
  }
  //Todo: Check subscription

  const companion = await prismadb.companion.findUnique({
    where: {
      id: companionId,
      userId,
    },
  });


  const categories = await prismadb.category.findMany();

  return <CompanionForm initialData={companion} categories={categories} />;
};

export default CompanionIdPage;
