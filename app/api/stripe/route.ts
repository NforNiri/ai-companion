import {auth, currentUser} from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import prismadb from "@/lib/prismadb"
import { stripe } from "@/lib/stripe"
import { absoluteURL } from "@/lib/utils"

const settingURL = absoluteURL("/settings");

export async function GET() {

    try {
        const {userId} = await auth();
        const user = await currentUser();


        if(!userId || !user) {
            return new NextResponse ("Unauthorized", {status : 401});
        }
        const userSubscription = await prismadb.userSubscription.findUnique({
            where:{
            userId
            }
        });

        if(userSubscription && userSubscription.stripeCustomerId) {
            const stripeSession = await stripe.billingPortal.sessions.create({
                customer: userSubscription.stripeCustomerId,
                return_url: settingURL
            })
            return new NextResponse(JSON.stringify({url: stripeSession.url}))
        } 

        const stripeSession= await stripe.checkout.sessions.create({
            success_url: settingURL,
            cancel_url: settingURL,
            payment_method_types: ["card", "paypal"],
            mode: "subscription",
            billing_address_collection: "auto",
            customer_email: user.emailAddresses[0].emailAddress,
            line_items: [
                {
                    price_data: { 
                        currency: "USD",
                        product_data: {
                            name : "Companion Pro",
                            description:"Create Custom AI Companions"
                        },
                        unit_amount: 999,
                        recurring:{
                            interval: "month",
                        }
                    },
                    quantity:1,
                }
            ],
            metadata: { 
                userId
            }
        })

        return new NextResponse(JSON.stringify({url: stripeSession.url}))

    } catch (error) {
        console.log("[STRIPE_GET]", error)
        return new NextResponse("Internal Error", {status : 500})
    }
    
}
