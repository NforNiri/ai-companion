import { auth } from "@clerk/nextjs/server";
import prismadb from "./prismadb";
import { exitCode } from "process";


const DAY_IN_MS = 68_400_000 ; 

export const checkSubscription = async () => {
    const {userId} = await auth();

    if (!userId) {
        return false;
    }

    const userSubscription = await prismadb.userSubscription.findUnique({
        where: {
            userId:userId,
        },

        select: {
            stripeCurrentPeriodEnd:true,
            stripeCustomerId: true,
            stripePriceId: true,
            stripeSubscriptionId:true,
        }
    });

    if(!userSubscription) {
        return false;
    }

const isValid = userSubscription.stripePriceId && userSubscription.stripeCurrentPeriodEnd?.getTime()! = DAY_IN_MS > Date.now()

return !!isValid;

}